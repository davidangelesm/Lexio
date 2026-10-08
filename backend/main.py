import os
from datetime import date
from typing import Any

import domain as d
import models as m
import schemas as s
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routing import ExactMoneyRoute
from security import Actor, Db, admin, passwords, token
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

app = FastAPI(title="Lexio", version="0.1.0")
app.router.route_class = ExactMoneyRoute
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "CORS_ORIGINS", "http://localhost:1420,http://tauri.localhost,tauri://localhost"
    ).split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "application": "Lexio"}


@app.post("/auth/login")
def login(data: s.Login, db: Db) -> dict[str, Any]:
    # Only pre-tenant query: username is globally unique, never supplied tenant_id.
    user = db.scalar(
        select(m.User).where(
            m.User.username == data.username, m.User.active.is_(True)
        )
    )
    dummy = "$argon2id$v=19$m=65536,t=3,p=4$YWJjZGVmZ2hpamtsbW5vcA$wuHiHEU1PVLTqr1CjKOcoahMfreGtLdihckAyHJ68N4"
    valid = passwords.verify(data.password, user.password_hash if user else dummy)
    if not user or not valid:
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    return {"access_token": token(user), "token_type": "bearer", "user": d.public(user)}


@app.get("/auth/me")
def me(user: Actor) -> dict[str, Any]:
    return d.public(user)


@app.get("/users")
def users(db: Db, user: Actor) -> list[dict[str, Any]]:
    data = d.rows(db, m.User, user)
    return [
        d.public(x, {"username", "can_create_clients", "can_create_cases"})
        if user.role != "admin"
        else d.public(x)
        for x in data
    ]


@app.post("/users", status_code=201)
def create_user(data: s.UserIn, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    row = m.User(
        tenant_id=user.tenant_id,
        name=data.name,
        username=data.username,
        password_hash=passwords.hash(data.password),
        role="staff",
        can_create_clients=data.can_create_clients,
        can_create_cases=data.can_create_cases,
    )
    db.add(row)
    try:
        d.audit(db, user, row, "crear usuario")
        d.save(db)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Nombre de usuario ya registrado") from None
    return d.public(row)


@app.put("/users/{key}")
def update_user(key: int, data: s.UserUpdate, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    row = d.get(db, m.User, key, user)
    if row.role == "admin":
        raise HTTPException(
            422, "El administrador se gestiona mediante la consola de mantenimiento"
        )
    before = d.public(row)
    for name, value in data.model_dump(exclude={"password"}).items():
        setattr(row, name, value)
    if data.password:
        row.password_hash = passwords.hash(data.password)
    try:
        d.audit(db, user, row, "actualizar usuario", before)
        d.save(db)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Nombre de usuario ya registrado") from None
    return d.public(row)


def visible_clients(db: Db, user: m.User):
    query = select(m.Client).where(m.Client.tenant_id == user.tenant_id)
    if user.role != "admin":
        case_ids = [x.client_id for x in db.scalars(d.case_scope(db, user))]
        query = query.where(m.Client.id.in_(case_ids))
    return query


@app.get("/clients")
def clients(
    db: Db, user: Actor, q: str = "", document_type: str | None = None
) -> list[dict[str, Any]]:
    query = visible_clients(db, user)
    if document_type:
        query = query.where(m.Client.document_type == document_type)
    if q:
        query = query.where(
            (m.Client.document_number.contains(q, autoescape=True))
            | (m.Client.name.contains(q, autoescape=True))
        )
    return [d.public(x) for x in db.scalars(query.order_by(m.Client.name))]


@app.post("/clients", status_code=201)
def create_client(data: s.ClientIn, db: Db, user: Actor) -> dict[str, Any]:
    if user.role != "admin" and not user.can_create_clients:
        raise HTTPException(403, "No tiene permiso para registrar clientes")
    row = m.Client(tenant_id=user.tenant_id, **data.model_dump())
    db.add(row)
    try:
        d.audit(db, user, row, "crear cliente")
        d.save(db)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "Documento registrado; solicita autorización al administrador"
        ) from None
    return d.public(row)


@app.put("/clients/{key}")
def update_client(key: int, data: s.ClientIn, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    row = d.get(db, m.Client, key, user)
    before = d.public(row)
    for name, value in data.model_dump().items():
        setattr(row, name, value)
    try:
        d.audit(db, user, row, "corregir cliente", before)
        d.save(db)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Documento duplicado") from None
    return d.public(row)


def case_view(db: Db, user: m.User, row: m.Case) -> dict[str, Any]:
    client = d.get(db, m.Client, row.client_id, user)
    level = (
        "edit"
        if user.role == "admin"
        else db.scalar(
            select(m.Access.level).where(
                m.Access.tenant_id == user.tenant_id,
                m.Access.case_id == row.id,
                m.Access.user_id == user.id,
            )
        )
    )
    return {**d.public(row), "client": d.public(client), "access_level": level}


@app.get("/cases")
def cases(
    db: Db,
    user: Actor,
    client_id: int | None = None,
    area: s.LegalArea | None = None,
    status: str | None = None,
    responsible_id: int | None = None,
    start: date | None = None,
    end: date | None = None,
) -> list[dict[str, Any]]:
    query = d.case_scope(db, user)
    for column, value in [
        (m.Case.client_id, client_id),
        (m.Case.area, area),
        (m.Case.status, status),
        (m.Case.responsible_id, responsible_id),
    ]:
        if value is not None:
            query = query.where(column == value)
    if start:
        query = query.where(m.Case.start_date >= start)
    if end:
        query = query.where(m.Case.start_date <= end)
    return [
        case_view(db, user, x) for x in db.scalars(query.order_by(m.Case.id.desc()))
    ]


@app.post("/cases", status_code=201)
def create_case(data: s.CaseIn, db: Db, user: Actor) -> dict[str, Any]:
    if user.role != "admin" and not user.can_create_cases:
        raise HTTPException(403, "No tiene permiso para crear casos")
    d.get(db, m.Client, data.client_id, user)
    target = d.get(db, m.User, data.responsible_id, user)
    if not target.active:
        raise HTTPException(422, "Responsable inactivo")
    if user.role != "admin" and target.id != user.id:
        raise HTTPException(403, "El administrador debe asignar otros responsables")
    row = m.Case(tenant_id=user.tenant_id, **data.model_dump())
    db.add(row)
    d.audit(db, user, row, "crear caso")
    for uid in {data.responsible_id, user.id}:
        grant = m.Access(
            tenant_id=user.tenant_id, case_id=row.id, user_id=uid, level="edit"
        )
        db.add(grant)
        d.audit(db, user, grant, "autorizar")
    d.save(db)
    return case_view(db, user, row)


@app.get("/cases/{key}")
def read_case(key: int, db: Db, user: Actor) -> dict[str, Any]:
    return case_view(db, user, d.case_access(db, user, key))


@app.put("/cases/{key}")
def update_case(key: int, data: s.CaseUpdate, db: Db, user: Actor) -> dict[str, Any]:
    row = d.case_access(db, user, key, edit=True)
    d.responsible(db, user, row, data.responsible_id)
    before = d.public(row)
    for name, value in data.model_dump().items():
        setattr(row, name, value)
    d.audit(db, user, row, "actualizar caso", before)
    d.save(db)
    return case_view(db, user, row)


@app.get("/cases/{key}/access")
def list_access(key: int, db: Db, user: Actor) -> list[dict[str, Any]]:
    admin(user)
    d.case_access(db, user, key)
    return [
        d.public(x)
        for x in db.scalars(
            select(m.Access).where(
                m.Access.tenant_id == user.tenant_id, m.Access.case_id == key
            )
        )
    ]


@app.post("/cases/{key}/access")
def grant(key: int, data: s.Grant, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    d.case_access(db, user, key)
    d.get(db, m.User, data.user_id, user)
    row = db.scalar(
        select(m.Access).where(
            m.Access.tenant_id == user.tenant_id,
            m.Access.case_id == key,
            m.Access.user_id == data.user_id,
        )
    )
    before = d.public(row) if row else None
    if not row:
        row = m.Access(
            tenant_id=user.tenant_id,
            case_id=key,
            user_id=data.user_id,
            level=data.level,
        )
        db.add(row)
    else:
        row.level = data.level
    d.audit(db, user, row, "autorizar", before)
    d.save(db)
    return d.public(row)


@app.delete("/cases/{key}/access/{uid}")
def revoke(key: int, uid: int, db: Db, user: Actor) -> dict[str, bool]:
    admin(user)
    case = d.case_access(db, user, key)
    if case.responsible_id == uid or db.scalar(
        select(m.Task.id).where(
            m.Task.tenant_id == user.tenant_id,
            m.Task.case_id == key,
            m.Task.responsible_id == uid,
            m.Task.status == "pendiente",
        )
    ):
        raise HTTPException(
            422, "Reasigna el caso y las tareas pendientes antes de revocar"
        )
    row = db.scalar(
        select(m.Access).where(
            m.Access.tenant_id == user.tenant_id,
            m.Access.case_id == key,
            m.Access.user_id == uid,
        )
    )
    if row:
        d.audit(db, user, row, "revocar", d.public(row))
        db.delete(row)
        d.save(db)
    return {"ok": True}


def in_case(db: Db, user: m.User, model, key: int, case_id: int):
    row = d.get(db, model, key, user)
    if row.case_id != case_id:
        raise HTTPException(422, "El registro pertenece a otro caso")
    return row


@app.get("/cases/{key}/entries")
def entries(key: int, db: Db, user: Actor) -> list[dict[str, Any]]:
    d.case_access(db, user, key)
    return [
        d.public(x)
        for x in db.scalars(
            select(m.Entry)
            .where(m.Entry.tenant_id == user.tenant_id, m.Entry.case_id == key)
            .order_by(m.Entry.action_date.desc(), m.Entry.id.desc())
        )
    ]


@app.post("/cases/{key}/entries", status_code=201)
def create_entry(key: int, data: s.EntryIn, db: Db, user: Actor) -> dict[str, Any]:
    d.case_access(db, user, key, edit=True)
    row = m.Entry(
        tenant_id=user.tenant_id,
        case_id=key,
        registered_by=user.id,
        **data.model_dump(),
    )
    db.add(row)
    d.audit(db, user, row, "registrar actuación")
    if data.is_payment_event:
        event = m.Event(
            tenant_id=user.tenant_id,
            case_id=key,
            entry_id=row.id,
            description=data.description[:250],
        )
        db.add(event)
        d.audit(db, user, event, "registrar evento para revisión")
    d.save(db)
    return d.public(row)


@app.put("/cases/{key}/entries/{entry_id}")
def update_entry(
    key: int, entry_id: int, data: s.EntryIn, db: Db, user: Actor
) -> dict[str, Any]:
    d.case_access(db, user, key, edit=True)
    row = in_case(db, user, m.Entry, entry_id, key)
    if data.is_payment_event != row.is_payment_event:
        raise HTTPException(
            422, "La clasificación de evento no se cambia; registra una nueva actuación"
        )
    before = d.public(row)
    row.action_date, row.description = data.action_date, data.description
    d.audit(db, user, row, "corregir actuación", before)
    d.save(db)
    return d.public(row)


@app.get("/cases/{key}/tasks")
def tasks(key: int, db: Db, user: Actor) -> list[dict[str, Any]]:
    d.case_access(db, user, key)
    return [
        d.public(x)
        for x in db.scalars(
            select(m.Task)
            .where(m.Task.tenant_id == user.tenant_id, m.Task.case_id == key)
            .order_by(m.Task.due_date)
        )
    ]


def task_values(db: Db, user: m.User, case: m.Case, data: s.TaskIn) -> None:
    d.responsible(db, user, case, data.responsible_id)
    if data.entry_id:
        in_case(db, user, m.Entry, data.entry_id, case.id)


@app.post("/cases/{key}/tasks", status_code=201)
def create_task(key: int, data: s.TaskIn, db: Db, user: Actor) -> dict[str, Any]:
    case = d.case_access(db, user, key, edit=True)
    task_values(db, user, case, data)
    row = m.Task(tenant_id=user.tenant_id, case_id=key, **data.model_dump())
    db.add(row)
    d.audit(db, user, row, "crear tarea")
    d.save(db)
    return d.public(row)


@app.put("/cases/{key}/tasks/{task_id}")
def update_task(
    key: int, task_id: int, data: s.TaskIn, db: Db, user: Actor
) -> dict[str, Any]:
    case = d.case_access(db, user, key, edit=True)
    task_values(db, user, case, data)
    row = in_case(db, user, m.Task, task_id, key)
    before = d.public(row)
    for name, value in data.model_dump().items():
        setattr(row, name, value)
    d.audit(db, user, row, "actualizar tarea", before)
    d.cancel_notices(db, user, f"task:{row.id}")
    d.save(db)
    return d.public(row)


@app.get("/cases/{key}/events")
def events(key: int, db: Db, user: Actor) -> list[dict[str, Any]]:
    d.case_access(db, user, key)
    return [
        d.public(x)
        for x in db.scalars(
            select(m.Event).where(
                m.Event.tenant_id == user.tenant_id, m.Event.case_id == key
            )
        )
    ]


@app.post("/cases/{key}/events", status_code=201)
def create_event(key: int, data: s.EventIn, db: Db, user: Actor) -> dict[str, Any]:
    d.case_access(db, user, key, edit=True)
    if data.entry_id:
        in_case(db, user, m.Entry, data.entry_id, key)
    row = m.Event(tenant_id=user.tenant_id, case_id=key, **data.model_dump())
    db.add(row)
    d.audit(db, user, row, "crear evento")
    d.save(db)
    return d.public(row)


@app.put("/cases/{key}/events/{event_id}")
def update_event(
    key: int, event_id: int, data: s.EventIn, db: Db, user: Actor
) -> dict[str, Any]:
    d.case_access(db, user, key, edit=True)
    if data.entry_id:
        in_case(db, user, m.Entry, data.entry_id, key)
    row = in_case(db, user, m.Event, event_id, key)
    # Lock affected services before event changes, same order used by financial writes.
    ids = list(
        db.scalars(
            select(m.Installment.service_id)
            .where(
                m.Installment.tenant_id == user.tenant_id,
                m.Installment.event_id == event_id,
            )
            .distinct()
            .order_by(m.Installment.service_id)
        )
    )
    for sid in ids:
        d.get(db, m.Service, sid, user, lock=True)
    before = d.public(row)
    for name, value in data.model_dump().items():
        setattr(row, name, value)
    row.revision += 1
    for quota in db.scalars(
        select(m.Installment).where(
            m.Installment.tenant_id == user.tenant_id,
            m.Installment.event_id == event_id,
        )
    ):
        d.cancel_notices(db, user, f"quota:{quota.id}")
    d.audit(db, user, row, "reprogramar evento", before)
    d.save(db)
    return d.public(row)


@app.get("/cases/{key}/services")
def services(key: int, db: Db, user: Actor) -> list[dict[str, Any]]:
    d.case_access(db, user, key)
    result = []
    for row in db.scalars(
        select(m.Service).where(
            m.Service.tenant_id == user.tenant_id, m.Service.case_id == key
        )
    ):
        if user.role != "admin":
            result.append(d.public(row, {"fee"}))
        else:
            result.append(
                d.economic(db, user, [row], d.today())["services"][0]
                if row.contract_date <= d.today()
                else {**d.public(row), "installments": [], "payments": []}
            )
    return result


@app.post("/cases/{key}/events/{event_id}/review")
def review_event(key: int, event_id: int, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    d.case_access(db, user, key)
    row = in_case(db, user, m.Event, event_id, key)
    before = d.public(row)
    row.reviewed_revision = row.revision
    d.audit(db, user, row, "revisar evento de cobro", before)
    d.save(db)
    return d.public(row)


@app.put("/installments/{key}/event")
def link_event(key: int, data: s.LinkEvent, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    row = d.get(db, m.Installment, key, user)
    service = d.get(db, m.Service, row.service_id, user, lock=True)
    db.refresh(row)
    if row.condition == "fecha":
        raise HTTPException(
            422, "Solo se vinculan eventos a cuotas pactadas por evento"
        )
    in_case(db, user, m.Event, data.event_id, service.case_id)
    before = d.public(row)
    row.event_id, row.due_date, row.confirmed_revision = data.event_id, None, None
    d.audit(db, user, row, "vincular evento concreto", before)
    d.cancel_notices(db, user, f"quota:{row.id}")
    d.save(db)
    return d.installment_view(db, user, row)


@app.post("/cases/{key}/services", status_code=201)
def create_service(key: int, data: s.ServiceIn, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    d.case_access(db, user, key)
    if data.contract_date > d.today():
        raise HTTPException(
            422, "Una contratación efectiva no puede tener fecha futura"
        )
    values = d.amounts(data.fee, data.installments)
    for item in data.installments:
        if item.event_id:
            in_case(db, user, m.Event, item.event_id, key)
    row = m.Service(
        tenant_id=user.tenant_id,
        case_id=key,
        **data.model_dump(exclude={"installments"}),
    )
    db.add(row)
    d.audit(db, user, row, "contratar servicio")
    for index, (plan, amount) in enumerate(zip(data.installments, values), 1):
        item = m.Installment(
            tenant_id=user.tenant_id,
            service_id=row.id,
            number=index,
            amount=amount,
            **plan.model_dump(exclude={"percentage", "amount"}),
        )
        db.add(item)
        d.audit(db, user, item, "crear cuota")
    d.save(db)
    return d.public(row)


@app.post("/installments/{key}/confirm")
def confirm_installment(key: int, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    row = d.get(db, m.Installment, key, user)
    service = d.get(db, m.Service, row.service_id, user, lock=True)
    d.case_access(db, user, service.case_id)
    db.refresh(row)
    before = d.public(row)
    d.confirm(db, user, row)
    d.cancel_notices(db, user, f"quota:{row.id}")
    d.audit(db, user, row, "confirmar efecto económico", before)
    d.save(db)
    return d.installment_view(db, user, row)


@app.put("/installments/{key}/reschedule")
def reschedule_installment(
    key: int, data: s.Reschedule, db: Db, user: Actor
) -> dict[str, Any]:
    admin(user)
    row = d.get(db, m.Installment, key, user)
    d.get(db, m.Service, row.service_id, user, lock=True)
    db.refresh(row)
    if row.condition != "fecha":
        raise HTTPException(
            422, "Reprograma el evento y confirma su efecto en esta cuota"
        )
    before = d.public(row)
    row.due_date = data.due_date
    d.audit(db, user, row, "reprogramar cuota: " + data.reason[:18], before)
    db.add(
        m.Audit(
            tenant_id=user.tenant_id,
            user_id=user.id,
            resource="lexio_installments",
            resource_id=row.id,
            action="motivo reprogramación",
            changes=data.reason,
        )
    )
    d.cancel_notices(db, user, f"quota:{row.id}")
    d.save(db)
    return d.installment_view(db, user, row)


@app.post("/services/{key}/payments", status_code=201)
def create_payment(key: int, data: s.PaymentIn, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    service = d.get(db, m.Service, key, user, lock=True)
    d.case_access(db, user, service.case_id)
    row = m.Payment(
        tenant_id=user.tenant_id,
        service_id=key,
        registered_by=user.id,
        **data.model_dump(exclude={"applications"}),
    )
    db.add(row)
    d.audit(db, user, row, "registrar abono")
    d.apply_payment(db, user, row, data.applications)
    d.save(db)
    return d.public(row)


@app.post("/payments/{key}/apply")
def apply_credit(key: int, data: s.ApplyList, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    row = d.get(db, m.Payment, key, user)
    d.get(db, m.Service, row.service_id, user, lock=True)
    db.refresh(row)
    d.apply_payment(db, user, row, data.applications)
    d.audit(db, user, row, "distribuir crédito")
    d.save(db)
    return d.public(row)


@app.post("/payments/{key}/reverse")
def reverse_payment(key: int, data: s.Reason, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    row = d.get(db, m.Payment, key, user)
    d.get(db, m.Service, row.service_id, user, lock=True)
    db.refresh(row)
    if row.reversed_at:
        raise HTTPException(409, "El abono ya fue reversado")
    before = d.public(row)
    row.reversed_at, row.reversal_reason = m.now(), data.reason
    d.audit(db, user, row, "reversar abono", before)
    d.save(db)
    return d.public(row)


@app.get("/services/{key}/payment-proposal")
def payment_proposal(key: int, db: Db, user: Actor) -> list[dict[str, Any]]:
    admin(user)
    service = d.get(db, m.Service, key, user)
    d.case_access(db, user, service.case_id)
    result = [
        d.installment_view(db, user, x)
        for x in db.scalars(
            select(m.Installment).where(
                m.Installment.tenant_id == user.tenant_id,
                m.Installment.service_id == key,
            )
        )
    ]
    return sorted(
        [x for x in result if x["balance"] > 0],
        key=lambda x: (
            x["due_date"] is None or x["due_date"] > d.today(),
            x["due_date"] or date.max,
            x["number"],
        ),
    )


@app.get("/settings/notices")
def notice_settings(db: Db, user: Actor) -> dict[str, Any]:
    tenant = db.scalar(select(m.Tenant).where(m.Tenant.tenant_id == user.tenant_id))
    return {"days": [int(x) for x in tenant.notice_days.split(",")]}


@app.put("/settings/notices")
def update_notice_settings(
    data: s.NoticeSettings, db: Db, user: Actor
) -> dict[str, Any]:
    admin(user)
    tenant = db.scalar(select(m.Tenant).where(m.Tenant.tenant_id == user.tenant_id))
    before = tenant.notice_days
    tenant.notice_days = ",".join(str(x) for x in data.days)
    db.add(
        m.Audit(
            tenant_id=user.tenant_id,
            user_id=user.id,
            resource="lexio_tenants",
            resource_id=user.tenant_id,
            action="configurar avisos",
            changes=f"{before} → {tenant.notice_days}",
        )
    )
    d.save(db)
    return {"days": data.days}


@app.get("/alerts")
def alerts(db: Db, user: Actor) -> list[dict[str, Any]]:
    # Serialize notice regeneration per recipient; no cron/network notifications in this version.
    d.get(db, m.User, user.id, user, lock=True)
    cases = {x.id: x for x in db.scalars(d.case_scope(db, user))}
    editable = set(cases) if user.role == "admin" else set(
        db.scalars(select(m.Access.case_id).where(
            m.Access.tenant_id == user.tenant_id,
            m.Access.user_id == user.id,
            m.Access.level == "edit",
        ))
    )
    settings = notice_settings(db, user)["days"]
    sources: list[dict[str, Any]] = []
    for task in db.scalars(
        select(m.Task).where(
            m.Task.tenant_id == user.tenant_id,
            m.Task.case_id.in_(cases),
            m.Task.status == "pendiente",
        )
    ):
        sources.append(
            {
                "key": f"task:{task.id}",
                "kind": "procesal",
                "case_id": task.case_id,
                "target": task.due_date,
                "description": task.description,
                "responsible_id": task.responsible_id,
                "amount": None,
                "provisional": False,
            }
        )
    if user.role == "admin":
        for service in db.scalars(
            select(m.Service).where(
                m.Service.tenant_id == user.tenant_id, m.Service.case_id.in_(cases)
            )
        ):
            for item in db.scalars(
                select(m.Installment).where(
                    m.Installment.tenant_id == user.tenant_id,
                    m.Installment.service_id == service.id,
                )
            ):
                view = d.installment_view(db, user, item)
                target = view["due_date"] or view["provisional_date"]
                if view["balance"] > 0 and target:
                    sources.append(
                        {
                            "key": f"quota:{item.id}",
                            "kind": "pago",
                            "case_id": service.case_id,
                            "target": target,
                            "description": f"{service.scope} · Cuota {item.number}",
                            "responsible_id": user.id,
                            "amount": view["balance"],
                            "provisional": view["due_date"] is None,
                        }
                    )
    old = {
        x.source_key: x
        for x in db.scalars(
            select(m.Notice).where(
                m.Notice.tenant_id == user.tenant_id, m.Notice.user_id == user.id
            )
        )
    }
    active: set[str] = set()
    result = []
    for source in sources:
        target = source["target"]
        urgent = target < d.today() and not source["provisional"]
        schedule = [(n, d.shift(target, -n)) for n in settings]
        schedule.append((0, target))
        for anticipation, notice_date in schedule:
            key = f"{source['key']}:{target}:{anticipation}:{source['provisional']}"
            active.add(key)
            row = old.get(key)
            if row is None:
                row = m.Notice(
                    tenant_id=user.tenant_id,
                    user_id=user.id,
                    case_id=source["case_id"],
                    source_key=key,
                    kind=source["kind"],
                    target_date=target,
                    notice_date=notice_date,
                    anticipation=anticipation,
                )
                db.add(row)
                db.flush()
            row.status = "pendiente"
            if notice_date <= d.today():
                # Once due, show only the current obligation, not outdated advance notices.
                if target <= d.today() and anticipation != 0:
                    continue
                if target > d.today() and anticipation == 0:
                    continue
                # Reading dismisses this reminder; an overdue obligation resurfaces as urgent.
                if row.read_at and not urgent:
                    continue
                case = cases[source["case_id"]]
                client = d.get(db, m.Client, case.client_id, user)
                label = (
                    "urgente · vencido"
                    if urgent
                    else "fecha programada pasada"
                    if target < d.today()
                    else "vence hoy"
                    if target == d.today()
                    else f"aviso {anticipation} días"
                )
                result.append(
                    {
                        **d.public(row),
                        "description": source["description"],
                        "responsible_id": source["responsible_id"],
                        "client": d.public(client),
                        "case_code": f"CAS-{case.id:06d}",
                        "amount": source["amount"],
                        "label": "provisional · " + label
                        if source["provisional"]
                        else label,
                        "provisional": source["provisional"],
                        "urgent": urgent,
                        "can_attend": source["kind"] == "procesal" and source["case_id"] in editable,
                    }
                )
    for key, row in old.items():
        if key not in active:
            row.status = "cancelado"
    d.save(db)
    return sorted(
        result, key=lambda x: (not x["urgent"], x["target_date"], x["case_id"], -x["anticipation"])
    )


@app.post("/alerts/{key}/read")
def read_alert(key: int, db: Db, user: Actor) -> dict[str, bool]:
    row = d.get(db, m.Notice, key, user)
    if row.user_id != user.id:
        raise HTTPException(404, "Aviso no encontrado")
    d.case_access(db, user, row.case_id)
    if row.kind == "pago":
        admin(user)
    if row.target_date < d.today() and not row.source_key.endswith(":True"):
        raise HTTPException(409, "El aviso es urgente; atiende la obligación para retirarlo")
    row.read_at = m.now()
    d.save(db)
    return {"ok": True}


@app.post("/alerts/{key}/attend")
def attend_alert(key: int, db: Db, user: Actor) -> dict[str, bool]:
    row = d.get(db, m.Notice, key, user)
    if row.user_id != user.id or row.kind != "procesal":
        raise HTTPException(404, "Aviso procesal no encontrado")
    d.case_access(db, user, row.case_id, edit=True)
    task_id = int(row.source_key.split(":")[1])
    task = d.get(db, m.Task, task_id, user, lock=True)
    if task.case_id != row.case_id:
        raise HTTPException(404, "Tarea no encontrada")
    if task.status in ("atendido", "atendida"):
        return {"ok": True}
    if task.status != "pendiente" or task.due_date != row.target_date or row.status != "pendiente":
        raise HTTPException(409, "El aviso cambió; actualiza las alertas")
    before = d.public(task)
    task.status = "atendido"
    d.audit(db, user, task, "atender tarea", before)
    # Applies to every recipient in this tenant, including future reminders.
    d.cancel_notices(db, user, f"task:{task.id}")
    d.save(db)
    return {"ok": True}


@app.get("/dashboard")
def dashboard(db: Db, user: Actor) -> dict[str, Any]:
    case_list = list(db.scalars(d.case_scope(db, user)))
    notices = alerts(db, user)
    today_tasks = list(
        db.scalars(
            select(m.Task).where(
                m.Task.tenant_id == user.tenant_id,
                m.Task.case_id.in_([x.id for x in case_list]),
                m.Task.due_date == d.today(),
                m.Task.status == "pendiente",
            )
        )
    )
    result = {
        "date": d.today(),
        "active_cases": sum(x.status == "activo" for x in case_list),
        "procedural_alerts": sum(x["kind"] == "procesal" for x in notices),
        "today_tasks": [d.public(x) for x in today_tasks],
        "today_events": [
            d.public(x)
            for x in db.scalars(
                select(m.Event).where(
                    m.Event.tenant_id == user.tenant_id,
                    m.Event.case_id.in_([c.id for c in case_list]),
                    m.Event.scheduled_date == d.today(),
                    m.Event.effective_date.is_(None),
                )
            )
        ],
        "alerts": notices,
    }
    if user.role == "admin":
        reviews = []
        for row in db.scalars(
            select(m.Installment).where(
                m.Installment.tenant_id == user.tenant_id,
                m.Installment.event_id.is_not(None),
            )
        ):
            view = d.installment_view(db, user, row)
            if view["review_required"] and view["balance"] > 0:
                service = d.get(db, m.Service, row.service_id, user)
                reviews.append(
                    {
                        "installment_id": row.id,
                        "event_id": row.event_id,
                        "case_id": service.case_id,
                        "service_id": service.id,
                        "description": f"{service.scope} · Cuota {row.number}",
                    }
                )
        payment_sources = {
            ":".join(x["source_key"].split(":")[:2]): x
            for x in notices
            if x["kind"] == "pago"
        }
        result["payment_alerts"] = len(payment_sources)
        result["payment_balance"] = sum(
            (x["amount"] for x in payment_sources.values()), d.ZERO
        )
        result["event_reviews"] = reviews
        for event in db.scalars(
            select(m.Event).where(
                m.Event.tenant_id == user.tenant_id,
                m.Event.reviewed_revision < m.Event.revision,
            )
        ):
            if not any(x.get("event_id") == event.id for x in reviews):
                reviews.append(
                    {
                        "installment_id": -event.id,
                        "event_id": event.id,
                        "case_id": event.case_id,
                        "description": event.description,
                    }
                )
    return result


@app.get("/reports/operational")
def operational(
    db: Db,
    user: Actor,
    area: s.LegalArea | None = None,
    responsible_id: int | None = None,
    status: str | None = None,
    client_id: int | None = None,
    start: date | None = None,
    end: date | None = None,
    date_basis: str = "inicio",
) -> dict[str, Any]:
    if date_basis not in ("inicio", "actuacion", "vencimiento"):
        raise HTTPException(422, "Base de fechas inválida")
    if start and end and start > end:
        raise HTTPException(422, "Rango de fechas inválido")
    case_list = cases(
        db,
        user,
        client_id,
        area,
        status,
        responsible_id,
        start if date_basis == "inicio" else None,
        end if date_basis == "inicio" else None,
    )
    by_area: dict[str, dict[str, Any]] = {}
    for case in case_list:
        bucket = by_area.setdefault(
            case["area"],
            {
                "area": case["area"],
                "total": 0,
                "activo": 0,
                "suspendido": 0,
                "concluido": 0,
            },
        )
        bucket["total"] += 1
        bucket[case["status"]] += 1
    case_map = {x["id"]: x for x in case_list}
    activities, task_list = [], []
    for model, output, date_column, basis in [
        (m.Entry, activities, m.Entry.action_date, "actuacion"),
        (m.Task, task_list, m.Task.due_date, "vencimiento"),
    ]:
        query = select(model).where(
            model.tenant_id == user.tenant_id, model.case_id.in_(case_map)
        )
        if date_basis == basis:
            if start:
                query = query.where(date_column >= start)
            if end:
                query = query.where(date_column <= end)
        for row in db.scalars(query):
            output.append(
                {
                    **d.public(row),
                    "client": case_map[row.case_id]["client"],
                    "case_code": case_map[row.case_id]["code"],
                }
            )
    return {
        "date_basis": date_basis,
        "areas": list(by_area.values()),
        "cases": case_list,
        "entries": activities,
        "tasks": task_list,
    }


@app.get("/reports/economic")
def economic_report(
    db: Db,
    user: Actor,
    cutoff: date | None = None,
    client_id: int | None = None,
    case_id: int | None = None,
    service_id: int | None = None,
    area: s.LegalArea | None = None,
) -> dict[str, Any]:
    admin(user)
    cut = cutoff or d.today()
    case_list = cases(db, user, client_id=client_id, area=area)
    if case_id:
        case_list = [x for x in case_list if x["id"] == case_id]
    case_map = {x["id"]: x for x in case_list}
    query = select(m.Service).where(
        m.Service.tenant_id == user.tenant_id, m.Service.case_id.in_(case_map)
    )
    if service_id:
        query = query.where(m.Service.id == service_id)
    service_list = list(db.scalars(query))
    result = d.economic(db, user, service_list, cut)
    by_area = []
    for name in sorted({x["area"] for x in case_list}):
        matching = [x for x in case_list if x["area"] == name]
        summary = d.economic(
            db,
            user,
            [x for x in service_list if case_map[x.case_id]["area"] == name],
            cut,
        )["totals"]
        by_area.append(
            {
                "area": name,
                "total": len(matching),
                **{
                    state: sum(x["status"] == state for x in matching)
                    for state in ["activo", "suspendido", "concluido"]
                },
                **summary,
            }
        )
    for service in result["services"]:
        service["client"] = case_map[service["case_id"]]["client"]
        service["case_code"] = case_map[service["case_id"]]["code"]
    return {**result, "areas": by_area}


@app.get("/reports/collections")
def collections(
    db: Db,
    user: Actor,
    start: date,
    end: date,
    client_id: int | None = None,
    case_id: int | None = None,
    service_id: int | None = None,
    area: s.LegalArea | None = None,
) -> dict[str, Any]:
    admin(user)
    if start > end:
        raise HTTPException(422, "Rango inválido")
    case_map = {x["id"]: x for x in cases(db, user, client_id=client_id, area=area)}
    if case_id:
        case_map = {k: v for k, v in case_map.items() if k == case_id}
    service_map = {
        x.id: x
        for x in db.scalars(
            select(m.Service).where(
                m.Service.tenant_id == user.tenant_id, m.Service.case_id.in_(case_map)
            )
        )
    }
    if service_id:
        service_map = {k: v for k, v in service_map.items() if k == service_id}
    payment_list = list(
        db.scalars(
            select(m.Payment).where(
                m.Payment.tenant_id == user.tenant_id,
                m.Payment.service_id.in_(service_map),
                m.Payment.payment_date >= start,
                m.Payment.payment_date <= end,
            )
        )
    )
    result = []
    for row in payment_list:
        allocations = [
            d.public(x)
            for x in db.scalars(
                select(m.Application).where(
                    m.Application.tenant_id == user.tenant_id,
                    m.Application.payment_id == row.id,
                )
            )
        ]
        applied = (
            sum((x["amount"] for x in allocations), d.ZERO)
            if not row.reversed_at
            else d.ZERO
        )
        case = case_map[service_map[row.service_id].case_id]
        result.append(
            {
                **d.public(row),
                "applications": allocations,
                "applied": applied,
                "credit": row.amount - applied if not row.reversed_at else d.ZERO,
                "client": case["client"],
                "case_code": case["code"],
                "case_id": case["id"],
                "scope": service_map[row.service_id].scope,
            }
        )
    return {
        "start": start,
        "end": end,
        "payments": result,
        "received": sum((x["amount"] for x in result if not x["reversed_at"]), d.ZERO),
        "credit": sum((x["credit"] for x in result), d.ZERO),
    }


@app.get("/audit")
def audit_log(db: Db, user: Actor) -> list[dict[str, Any]]:
    admin(user)
    return [
        d.public(x)
        for x in db.scalars(
            select(m.Audit)
            .where(m.Audit.tenant_id == user.tenant_id)
            .order_by(m.Audit.id.desc())
            .limit(300)
        )
    ]
