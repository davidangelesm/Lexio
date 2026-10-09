import os
from datetime import timedelta
from typing import Any

import domain as d
import models as m
import schemas as s
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routing import ExactMoneyRoute
from security import Actor, Db, admin, passwords, token
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError

app = FastAPI(title="Lexio", version="0.2.0")
app.router.route_class = ExactMoneyRoute
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:1420,http://tauri.localhost,tauri://localhost").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(IntegrityError)
async def duplicate_record(_, __):
    return JSONResponse(status_code=409, content={"detail": "Documento o usuario ya registrado; verifica los datos"})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "application": "Lexio"}


@app.post("/auth/login")
def login(data: s.Login, db: Db) -> dict[str, Any]:
    # Única consulta anterior al contexto tenant: usuario globalmente único.
    user = db.scalar(select(m.User).where(m.User.username == data.username, m.User.active.is_(True)))
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
    hidden = {"username", "can_create_clients", "can_create_cases"} if user.role != "admin" else set()
    return [d.public(x, hidden) for x in d.rows(db, m.User, user)]


@app.post("/users", status_code=201)
def create_user(data: s.UserIn, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    row = m.User(tenant_id=user.tenant_id, **data.model_dump(exclude={"password"}), password_hash=passwords.hash(data.password), role="staff")
    db.add(row)
    d.audit(db, user, row, "Crear usuario")
    d.save(db)
    return d.public(row)


@app.put("/users/{key}")
def update_user(key: int, data: s.UserUpdate, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    row = d.get(db, m.User, key, user)
    if row.role == "admin":
        raise HTTPException(422, "El administrador se gestiona mediante la consola de mantenimiento")
    before = d.public(row)
    for name, value in data.model_dump(exclude={"password"}).items():
        setattr(row, name, value)
    if data.password:
        row.password_hash = passwords.hash(data.password)
    d.audit(db, user, row, "Actualizar usuario", before)
    d.save(db)
    return d.public(row)


def visible_clients(db: Db, user: m.User):
    query = select(m.Client).where(m.Client.tenant_id == user.tenant_id)
    if user.role != "admin":
        case_ids = [x.client_id for x in db.scalars(d.case_scope(db, user))]
        no_case = ~select(m.Case.id).where(
            m.Case.tenant_id == user.tenant_id, m.Case.client_id == m.Client.id,
        ).exists()
        own_creation = select(m.Audit.id).where(
            m.Audit.tenant_id == user.tenant_id, m.Audit.user_id == user.id,
            m.Audit.resource == m.Client.__tablename__, m.Audit.resource_id == m.Client.id,
            m.Audit.action == "Registrar cliente", m.Audit.created_at >= m.Client.created_at,
        ).exists()
        query = query.where(m.Client.id.in_(case_ids) | (no_case & own_creation))
    return query


@app.get("/clients")
def clients(db: Db, user: Actor, search: str = "", q: str = "") -> list[dict[str, Any]]:
    query = visible_clients(db, user)
    term = search or q
    if term:
        matches = m.Client.name.contains(term, autoescape=True) | m.Client.document_number.contains(term, autoescape=True)
        if term.upper().startswith("CL-") and term[3:].isascii() and term[3:].isdigit():
            matches = matches | (m.Client.id == int(term[3:]))
        query = query.where(matches)
    return [d.public(x) for x in db.scalars(query.order_by(m.Client.name))]


@app.post("/clients", status_code=201)
def create_client(data: s.ClientIn, db: Db, user: Actor) -> dict[str, Any]:
    if user.role != "admin" and not user.can_create_clients:
        raise HTTPException(403, "No tiene permiso para registrar clientes")
    row = m.Client(tenant_id=user.tenant_id, **data.model_dump())
    db.add(row)
    d.audit(db, user, row, "Registrar cliente")
    d.save(db)
    return d.public(row)


@app.put("/clients/{key}")
def update_client(key: int, data: s.ClientIn, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    row = d.get(db, m.Client, key, user)
    before = d.public(row)
    for name, value in data.model_dump().items():
        setattr(row, name, value)
    d.audit(db, user, row, "Corregir cliente", before)
    d.save(db)
    return d.public(row)


@app.get("/cases")
def cases(db: Db, user: Actor, search: str = "", client_id: int | None = None, area: s.LegalArea | None = None, status: str | None = None) -> list[dict[str, Any]]:
    query = d.case_scope(db, user)
    for column, value in [(m.Case.client_id, client_id), (m.Case.area, area), (m.Case.status, status)]:
        if value is not None:
            query = query.where(column == value)
    if search:
        matches = m.Client.name.contains(search, autoescape=True) | m.Client.document_number.contains(search, autoescape=True)
        if search.upper().startswith("CL-") and search[3:].isascii() and search[3:].isdigit():
            matches = matches | (m.Client.id == int(search[3:]))
        names = select(m.Client.id).where(m.Client.tenant_id == user.tenant_id, matches)
        query = query.where(m.Case.client_id.in_(names) | m.Case.process_type.contains(search, autoescape=True))
    return [d.case_view(db, user, x) for x in db.scalars(query.order_by(m.Case.id.desc()))]


@app.post("/cases", status_code=201)
def create_case(data: s.CaseIn, db: Db, user: Actor) -> dict[str, Any]:
    if user.role != "admin" and not user.can_create_cases:
        raise HTTPException(403, "No tiene permiso para registrar casos")
    if user.role != "admin" and ({"fee", "installments"} & data.model_fields_set):
        raise HTTPException(403, "Los honorarios los registra el administrador financiero")
    if user.role == "admin":
        d.validate_plan(data.fee, data.installments)
    target = d.get(db, m.User, data.responsible_id or user.id, user)
    if not target.active:
        raise HTTPException(422, "Responsable inactivo")
    if user.role != "admin" and target.id != user.id:
        raise HTTPException(403, "El administrador debe asignar otros responsables")
    if data.client is not None:
        if user.role != "admin" and not user.can_create_clients:
            raise HTTPException(403, "No tiene permiso para registrar clientes")
        client = m.Client(tenant_id=user.tenant_id, **data.client.model_dump())
        db.add(client)
        d.audit(db, user, client, "Registrar cliente")
    else:
        client = db.scalar(visible_clients(db, user).where(m.Client.id == data.client_id))
        if client is None:
            raise HTTPException(404, "Cliente no encontrado o sin autorización")
    row = m.Case(
        tenant_id=user.tenant_id, client_id=client.id, responsible_id=target.id,
        **data.model_dump(exclude={"client", "client_id", "responsible_id", "installments"}),
    )
    db.add(row)
    d.audit(db, user, row, "Registrar caso")
    for uid in {user.id, target.id}:
        db.add(m.Access(tenant_id=user.tenant_id, case_id=row.id, user_id=uid, level="edit"))
    for number, item in enumerate(data.installments or [], 1):
        if item.id is not None:
            raise HTTPException(422, "Las cuotas nuevas no llevan identificador")
        db.add(m.Installment(tenant_id=user.tenant_id, case_id=row.id, number=number, amount=item.amount, due_date=item.due_date))
    d.save(db)
    return d.case_view(db, user, row)


@app.get("/cases/{key}")
def read_case(key: int, db: Db, user: Actor) -> dict[str, Any]:
    return d.case_view(db, user, d.case_access(db, user, key))


@app.put("/cases/{key}")
def update_case(key: int, data: s.CaseUpdate, db: Db, user: Actor) -> dict[str, Any]:
    row = d.case_access(db, user, key, edit=True, lock=True)
    before = d.public(row)
    financial = {"fee", "installments"} & data.model_fields_set
    if financial or data.client is not None:
        admin(user)
    if data.client is not None:
        client = d.get(db, m.Client, row.client_id, user)
        previous = d.public(client)
        for name, value in data.client.model_dump().items():
            setattr(client, name, value)
        d.audit(db, user, client, "Corregir cliente", previous)
    if data.responsible_id is not None:
        target = d.get(db, m.User, data.responsible_id, user)
        if not target.active:
            raise HTTPException(422, "Responsable inactivo")
        if user.role != "admin" and target.id != row.responsible_id:
            raise HTTPException(403, "El administrador debe asignar otros responsables")
        grant = db.scalar(select(m.Access).where(m.Access.tenant_id == user.tenant_id, m.Access.case_id == key, m.Access.user_id == target.id))
        if grant is None:
            db.add(m.Access(tenant_id=user.tenant_id, case_id=key, user_id=target.id, level="edit"))
        elif grant.level != "edit":
            grant.level = "edit"
    if financial:
        current = d.installments(db, user, key)
        fee = data.fee if "fee" in data.model_fields_set else row.fee
        plan = data.installments
        if fee is None or ("installments" in data.model_fields_set and plan is None):
            raise HTTPException(422, "No se puede retirar el plan de pagos")
        if plan is not None:
            d.validate_plan(fee, plan)
        elif sum((x.amount for x in current), d.ZERO) != fee:
            raise HTTPException(422, "Actualiza también las cuotas para que sumen los honorarios")
        if d.payments(db, user, key):
            if fee != row.fee or (plan is not None and [(x.id, x.amount) for x in plan] != [(x.id, x.amount) for x in current]):
                raise HTTPException(422, "Con abonos registrados solo puedes corregir las fechas de las cuotas")
            for old, new in zip(current, plan or current):
                if old.due_date != new.due_date:
                    d.cancel_notices(db, user, f"payment:{old.id}")
                    old.due_date = new.due_date
        elif plan is not None:
            if any(item.id is not None and item.id not in {x.id for x in current} for item in plan):
                raise HTTPException(422, "Las cuotas deben pertenecer a esta ficha")
            for item in current:
                d.cancel_notices(db, user, f"payment:{item.id}")
            db.execute(delete(m.Installment).where(m.Installment.tenant_id == user.tenant_id, m.Installment.case_id == key))
            for number, item in enumerate(plan, 1):
                db.add(m.Installment(tenant_id=user.tenant_id, case_id=key, number=number, amount=item.amount, due_date=item.due_date))
        row.fee = fee
    for name, value in data.model_dump(exclude={"client", "fee", "installments"}, exclude_none=True).items():
        setattr(row, name, value)
    d.audit(db, user, row, "Actualizar caso", before)
    d.save(db)
    return d.case_view(db, user, row)


@app.get("/cases/{key}/access")
def list_access(key: int, db: Db, user: Actor) -> list[dict[str, Any]]:
    admin(user)
    d.case_access(db, user, key)
    return [{**d.public(x), "user_name": d.get(db, m.User, x.user_id, user).name} for x in db.scalars(select(m.Access).where(m.Access.tenant_id == user.tenant_id, m.Access.case_id == key))]


@app.post("/cases/{key}/access")
def grant_access(key: int, data: s.Grant, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    case = d.case_access(db, user, key)
    target = d.get(db, m.User, data.user_id, user)
    if not target.active:
        raise HTTPException(422, "Usuario inactivo")
    if case.responsible_id == target.id and data.level != "edit":
        raise HTTPException(422, "El responsable necesita permiso para editar")
    row = db.scalar(select(m.Access).where(m.Access.tenant_id == user.tenant_id, m.Access.case_id == key, m.Access.user_id == target.id))
    before = d.public(row) if row else None
    if row is None:
        row = m.Access(tenant_id=user.tenant_id, case_id=key, user_id=target.id, level=data.level)
        db.add(row)
    else:
        row.level = data.level
    d.audit(db, user, row, "Asignar acceso", before)
    d.save(db)
    return {**d.public(row), "user_name": target.name}


@app.delete("/cases/{key}/access/{user_id}")
def revoke_access(key: int, user_id: int, db: Db, user: Actor) -> dict[str, str]:
    admin(user)
    case = d.case_access(db, user, key)
    if case.responsible_id == user_id:
        raise HTTPException(422, "Asigna otro responsable antes de retirar su acceso")
    row = db.scalar(select(m.Access).where(m.Access.tenant_id == user.tenant_id, m.Access.case_id == key, m.Access.user_id == user_id))
    if row is None:
        raise HTTPException(404, "Acceso no encontrado")
    d.audit(db, user, row, "Retirar acceso", d.public(row))
    db.delete(row)
    d.save(db)
    return {"status": "ok"}


@app.get("/entries")
def entries(db: Db, user: Actor) -> list[dict[str, Any]]:
    allowed = [x.id for x in db.scalars(d.case_scope(db, user))]
    query = select(m.Entry).where(m.Entry.tenant_id == user.tenant_id, m.Entry.case_id.in_(allowed)).order_by(m.Entry.action_date.desc(), m.Entry.id.desc())
    return [d.entry_view(db, user, x) for x in db.scalars(query)]


@app.get("/cases/{key}/entries")
def case_entries(key: int, db: Db, user: Actor) -> list[dict[str, Any]]:
    d.case_access(db, user, key)
    query = select(m.Entry).where(m.Entry.tenant_id == user.tenant_id, m.Entry.case_id == key).order_by(m.Entry.action_date.desc(), m.Entry.id.desc())
    return [d.entry_view(db, user, x) for x in db.scalars(query)]


@app.post("/cases/{key}/entries", status_code=201)
def create_entry(key: int, data: s.EntryIn, db: Db, user: Actor) -> dict[str, Any]:
    d.case_access(db, user, key, edit=True)
    row = m.Entry(tenant_id=user.tenant_id, case_id=key, registered_by=user.id, **data.model_dump())
    db.add(row)
    d.audit(db, user, row, "Registrar actuación")
    d.save(db)
    return d.entry_view(db, user, row)


@app.put("/entries/{key}")
def update_entry(key: int, data: s.EntryIn, db: Db, user: Actor) -> dict[str, Any]:
    row = d.get(db, m.Entry, key, user, lock=True)
    d.case_access(db, user, row.case_id, edit=True)
    before = d.public(row)
    if row.alert_date != data.alert_date:
        d.cancel_notices(db, user, f"legal:{row.id}")
        if data.alert_date is not None and not row.attended:
            # Restaurar un plazo anterior reutiliza sus avisos sin crear otros en fin de semana.
            db.execute(update(m.Notice).where(
                m.Notice.tenant_id == user.tenant_id,
                m.Notice.source_key.startswith(f"legal:{row.id}:{data.alert_date.isoformat()}:", autoescape=True),
            ).values(status="pendiente", read_at=None))
    for name, value in data.model_dump().items():
        setattr(row, name, value)
    d.audit(db, user, row, "Editar actuación", before)
    d.save(db)
    return d.entry_view(db, user, row)


@app.post("/entries/{key}/attend")
def attend_entry(key: int, db: Db, user: Actor) -> dict[str, Any]:
    row = d.get(db, m.Entry, key, user, lock=True)
    d.case_access(db, user, row.case_id, edit=True)
    if row.alert_date is None:
        raise HTTPException(422, "Esta actuación no tiene una obligación pendiente")
    if not row.attended:
        before = d.public(row)
        row.attended = True
        d.cancel_notices(db, user, f"legal:{row.id}")
        d.audit(db, user, row, "Marcar atendido", before)
        d.save(db)
    return d.entry_view(db, user, row)


@app.get("/cases/{key}/payments")
def case_payments(key: int, db: Db, user: Actor) -> list[dict[str, Any]]:
    admin(user)
    d.case_access(db, user, key)
    return [d.public(x) for x in d.payments(db, user, key)]


@app.post("/cases/{key}/payments", status_code=201)
def create_payment(key: int, data: s.PaymentIn, db: Db, user: Actor) -> dict[str, Any]:
    admin(user)
    case = d.case_access(db, user, key, edit=True, lock=True)
    received = sum((x.amount for x in d.payments(db, user, key)), d.ZERO)
    if case.fee is None:
        raise HTTPException(422, "Registra primero los honorarios y las cuotas")
    if data.amount > case.fee - received:
        raise HTTPException(422, "El abono supera el saldo pendiente de la ficha")
    row = m.Payment(tenant_id=user.tenant_id, case_id=key, registered_by=user.id, **data.model_dump(exclude={"installment_id"}))
    db.add(row)
    db.flush()
    d.allocate_payment(db, user, row, data.installment_id)
    d.audit(db, user, row, "Registrar abono")
    d.save(db)
    return d.public(row)


@app.delete("/payments/{key}")
def delete_payment(key: int, db: Db, user: Actor) -> dict[str, str]:
    admin(user)
    row = d.get(db, m.Payment, key, user)
    d.case_access(db, user, row.case_id, edit=True, lock=True)
    d.audit(db, user, row, "Corregir abono", d.public(row))
    db.execute(delete(m.Application).where(m.Application.tenant_id == user.tenant_id, m.Application.payment_id == key))
    db.delete(row)
    d.save(db)
    return {"status": "ok"}


@app.get("/alerts")
def alerts(db: Db, user: Actor) -> list[dict[str, Any]]:
    # Un bloqueo por destinatario evita duplicar recordatorios en solicitudes simultáneas.
    d.get(db, m.User, user.id, user, lock=True)
    current = d.today()
    cases = {x.id: x for x in db.scalars(d.case_scope(db, user))}
    sources: dict[str, dict[str, Any]] = {}
    for entry in db.scalars(select(m.Entry).where(m.Entry.tenant_id == user.tenant_id, m.Entry.case_id.in_(cases), m.Entry.alert_date.is_not(None), m.Entry.attended.is_(False))):
        sources[f"legal:{entry.id}"] = {
            "case_id": entry.case_id, "kind": entry.subject_type, "target_date": entry.alert_date,
            "subject": entry.subject, "description": entry.description, "entry_id": entry.id,
            "responsible_name": d.get(db, m.User, cases[entry.case_id].responsible_id, user).name,
            "can_attend": d.access_level(db, user, entry.case_id) == "edit",
        }
    if user.role == "admin":
        for item in db.scalars(select(m.Installment).where(m.Installment.tenant_id == user.tenant_id, m.Installment.case_id.in_(cases))):
            balance = item.amount - d.paid(db, user, item.id)
            if balance > d.ZERO:
                sources[f"payment:{item.id}"] = {
                    "case_id": item.case_id, "kind": "pago", "target_date": item.due_date,
                    "description": f"Cuota {item.number}", "balance": balance,
                    "responsible_name": d.get(db, m.User, cases[item.case_id].responsible_id, user).name,
                    "can_attend": False,
                }
        for data in sources.values():
            case = cases[data["case_id"]]
            received = sum((p.amount for p in d.payments(db, user, case.id)), d.ZERO)
            data["balance"] = case.fee - received if case.fee is not None else None
    existing = {x.source_key: x for x in db.scalars(select(m.Notice).where(m.Notice.tenant_id == user.tenant_id, m.Notice.user_id == user.id))}
    if current.weekday() < 5:
        for source, data in sources.items():
            target = data["target_date"]
            for anticipation in (5, 3, 1, 0):
                when = d.shift(target, -anticipation)
                if when > current:
                    continue
                key = f"{source}:{target.isoformat()}:{anticipation}"
                notice = existing.get(key)
                if notice is None:
                    notice = m.Notice(tenant_id=user.tenant_id, user_id=user.id, source_key=key,
                        case_id=data["case_id"], kind=data["kind"], target_date=target,
                        notice_date=when, anticipation=anticipation)
                    db.add(notice)
                    existing[key] = notice
                elif notice.status == "cancelado":
                    notice.status = "pendiente"
                    notice.read_at = None
    d.save(db)
    latest = {}
    for notice in existing.values():
        source = ":".join(notice.source_key.split(":")[:2])
        data = sources.get(source)
        if data is not None and data["target_date"] == notice.target_date and notice.notice_date <= current and notice.status != "cancelado":
            if source not in latest or (notice.notice_date, -notice.anticipation) > (latest[source].notice_date, -latest[source].anticipation):
                latest[source] = notice
    result = []
    for notice in existing.values():
        source = ":".join(notice.source_key.split(":")[:2])
        data = sources.get(source)
        if data is None or data["target_date"] != notice.target_date or notice.status == "cancelado":
            continue
        # Un aviso vigente por obligación; leerlo no hace reaparecer recordatorios anteriores.
        if source not in latest or notice.id != latest[source].id:
            continue
        urgent = current > notice.target_date
        if notice.status == "leido" and not urgent:
            continue
        if notice.notice_date > current:
            continue
        client = d.get(db, m.Client, cases[notice.case_id].client_id, user)
        result.append({
            "id": notice.id, **data, "client_code": d.public(client)["code"], "client_name": client.name,
            "case_code": d.public(cases[notice.case_id])["code"], "process_type": cases[notice.case_id].process_type,
            "notice_date": notice.notice_date, "anticipation": notice.anticipation, "urgent": urgent,
        })
    return sorted(result, key=lambda x: (not x["urgent"], x["target_date"], x["notice_date"], x["id"]))


@app.post("/alerts/{key}/read")
def read_alert(key: int, db: Db, user: Actor) -> dict[str, str]:
    row = d.get(db, m.Notice, key, user, lock=True)
    if row.user_id != user.id:
        raise HTTPException(404, "Aviso no encontrado")
    d.case_access(db, user, row.case_id)
    row.status = "leido"
    row.read_at = m.now()
    d.save(db)
    return {"status": "ok"}


@app.get("/reports")
def reports(db: Db, user: Actor) -> dict[str, Any]:
    groups: dict[str, dict[str, Any]] = {}
    for case in db.scalars(d.case_scope(db, user)):
        if case.area not in groups:
            groups[case.area] = {"area": case.area, "total_cases": 0, "active_cases": 0, "concluded_cases": 0}
            if user.role == "admin":
                groups[case.area].update({"fee": d.ZERO, "paid": d.ZERO, "balance": d.ZERO})
        row = groups[case.area]
        row["total_cases"] += 1
        row["active_cases" if case.status == "activo" else "concluded_cases"] += 1
        if user.role == "admin":
            received = sum((p.amount for p in d.payments(db, user, case.id)), d.ZERO)
            fee = case.fee or d.ZERO
            row["fee"] += fee
            row["paid"] += received
            row["balance"] += fee - received
    fields = ["total_cases", "active_cases", "concluded_cases"]
    if user.role == "admin":
        fields += ["fee", "paid", "balance"]
    totals = {field: sum((r[field] for r in groups.values()), d.ZERO if field in ("fee", "paid", "balance") else 0) for field in fields}
    return {"rows": sorted(groups.values(), key=lambda x: x["area"]), "totals": totals}


@app.get("/dashboard")
def dashboard(db: Db, user: Actor) -> dict[str, Any]:
    cases = {x.id: x for x in db.scalars(d.case_scope(db, user))}
    result: dict[str, Any] = {"counts": {
        "total_cases": len(cases),
        "active_cases": sum(x.status == "activo" for x in cases.values()),
        "concluded_cases": sum(x.status == "concluido" for x in cases.values()),
        "pending_legal_alerts": db.scalar(select(func.count(m.Entry.id)).where(
            m.Entry.tenant_id == user.tenant_id, m.Entry.case_id.in_(cases),
            m.Entry.subject_type == "legal", m.Entry.alert_date.is_not(None), m.Entry.attended.is_(False),
        )),
    }}
    if user.role == "admin":
        fee = sum((case.fee or d.ZERO for case in cases.values()), d.ZERO)
        received = sum((p.amount for case in cases.values() for p in d.payments(db, user, case.id)), d.ZERO)
        result["finance"] = {"fee": fee, "paid": received, "balance": fee - received}
        result["upcoming_payments"] = []
        query = select(m.Installment).where(
            m.Installment.tenant_id == user.tenant_id,
            m.Installment.case_id.in_(cases), m.Installment.due_date <= d.today() + timedelta(days=30),
        ).order_by(m.Installment.due_date, m.Installment.id)
        for item in db.scalars(query):
            paid = d.paid(db, user, item.id)
            if item.amount == paid:
                continue
            case = cases[item.case_id]
            client = d.get(db, m.Client, case.client_id, user)
            result["upcoming_payments"].append({
                "id": item.id, "case_id": case.id, "case_code": d.public(case)["code"], "process_type": case.process_type,
                "client_code": d.public(client)["code"], "client_name": client.name,
                "number": item.number, "due_date": item.due_date,
                "amount": item.amount, "paid": paid, "balance": item.amount - paid,
                "responsible_name": d.get(db, m.User, case.responsible_id, user).name,
            })
    return result


@app.get("/audit")
def audit_log(db: Db, user: Actor) -> list[dict[str, Any]]:
    admin(user)
    query = select(m.Audit).where(m.Audit.tenant_id == user.tenant_id).order_by(m.Audit.id.desc()).limit(100)
    return [{"id": x.id, "created_at": x.created_at, "user_id": x.user_id,
        "user_name": d.get(db, m.User, x.user_id, user).name, "action": x.action} for x in db.scalars(query)]
