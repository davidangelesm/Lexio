"""Reglas de la ficha integral. Los importes se mantienen como Decimal."""

import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, TypeVar
from zoneinfo import ZoneInfo

import models as m
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

T = TypeVar("T", bound=m.Entity)
ZERO = Decimal("0.00")


def today() -> date:
    return datetime.now(ZoneInfo("America/Lima")).date()


def shift(day: date, count: int) -> date:
    step = 1 if count >= 0 else -1
    left = abs(count)
    while left:
        day += timedelta(days=step)
        if day.weekday() < 5:
            left -= 1
    return day


def rows(db: Session, model: type[T], user: m.User) -> list[T]:
    return list(db.scalars(select(model).where(model.tenant_id == user.tenant_id)))


def get(db: Session, model: type[T], key: int, user: m.User, lock: bool = False) -> T:
    query = select(model).where(model.tenant_id == user.tenant_id, model.id == key)
    item = db.scalar(query.with_for_update() if lock else query)
    if item is None:
        raise HTTPException(404, "Registro no encontrado")
    return item


def case_responsible(db: Session, user: m.User) -> m.User:
    if user.role == "admin":
        return user
    responsible = db.scalar(select(m.User).where(
        m.User.tenant_id == user.tenant_id, m.User.role == "admin", m.User.active.is_(True),
    ).order_by(m.User.id).limit(1))
    if responsible is None:
        raise HTTPException(422, "El estudio necesita un administrador activo como responsable")
    return responsible


def correct_case_responsible(db: Session, user: m.User, case: m.Case) -> None:
    responsible = case_responsible(db, user)
    if case.responsible_id != responsible.id:
        before = public(case)
        case.responsible_id = responsible.id
        audit(db, user, case, "Corregir responsable del caso", before)


def case_scope(db: Session, user: m.User):
    query = select(m.Case).where(m.Case.tenant_id == user.tenant_id)
    if user.role != "admin":
        allowed = select(m.Access.case_id).where(
            m.Access.tenant_id == user.tenant_id, m.Access.user_id == user.id
        )
        query = query.where((m.Case.responsible_id == user.id) | m.Case.id.in_(allowed))
    return query


def access_level(db: Session, user: m.User, key: int) -> str | None:
    if user.role == "admin":
        return "edit"
    case = db.scalar(select(m.Case).where(m.Case.tenant_id == user.tenant_id, m.Case.id == key))
    if case is not None and case.responsible_id == user.id:
        return "edit"
    return db.scalar(select(m.Access.level).where(
        m.Access.tenant_id == user.tenant_id, m.Access.case_id == key, m.Access.user_id == user.id
    ))


def case_access(db: Session, user: m.User, key: int, edit: bool = False, lock: bool = False) -> m.Case:
    case = get(db, m.Case, key, user, lock)
    level = access_level(db, user, key)
    if level is None or (edit and level != "edit"):
        raise HTTPException(404, "Caso no encontrado o sin autorización")
    return case


def public(item: m.Entity, exclude: set[str] | None = None) -> dict[str, Any]:
    hidden = {"tenant_id", "password_hash"} | (exclude or set())
    data = {col.name: getattr(item, col.name) for col in item.__table__.columns if col.name not in hidden}
    if isinstance(item, m.Case):
        data["code"] = f"CAS-{item.id:06d}"
    if isinstance(item, m.Client):
        data["code"] = f"CL-{item.id:06d}"
    return data


def audit(db: Session, user: m.User, item: m.Entity, action: str, before: dict[str, Any] | None = None) -> None:
    db.flush()
    db.add(m.Audit(
        tenant_id=user.tenant_id, user_id=user.id, resource=item.__tablename__,
        resource_id=item.id, action=action,
        changes=json.dumps({"before": before, "after": public(item)}, default=str, ensure_ascii=False),
    ))


def save(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Documento o usuario ya registrado; verifica los datos") from None


def cancel_notices(db: Session, user: m.User, source: str) -> None:
    db.execute(update(m.Notice).where(
        m.Notice.tenant_id == user.tenant_id,
        m.Notice.source_key.startswith(source + ":", autoescape=True),
    ).values(status="cancelado"))


def payments(db: Session, user: m.User, case_id: int) -> list[m.Payment]:
    return list(db.scalars(select(m.Payment).where(
        m.Payment.tenant_id == user.tenant_id, m.Payment.case_id == case_id
    ).order_by(m.Payment.payment_date.desc(), m.Payment.id.desc())))


def installments(db: Session, user: m.User, case_id: int) -> list[m.Installment]:
    return list(db.scalars(select(m.Installment).where(
        m.Installment.tenant_id == user.tenant_id, m.Installment.case_id == case_id
    ).order_by(m.Installment.number)))


def paid(db: Session, user: m.User, installment_id: int) -> Decimal:
    return sum(db.scalars(select(m.Application.amount).where(
        m.Application.tenant_id == user.tenant_id, m.Application.installment_id == installment_id
    )), ZERO)


def installment_view(db: Session, user: m.User, item: m.Installment) -> dict[str, Any]:
    applied = paid(db, user, item.id)
    balance = item.amount - applied
    state = "pagado" if balance == ZERO else "incobrable" if item.uncollectible_reason is not None else "esperando_evento" if item.due_date is None else "vencido" if item.due_date < today() else "parcial" if applied > ZERO else "pendiente"
    entry_id = db.scalar(select(m.Entry.id).where(m.Entry.tenant_id == user.tenant_id,
        m.Entry.case_id == item.case_id, m.Entry.payment_installment_id == item.id))
    return {**public(item), "paid": applied, "balance": balance, "state": state, "entry_id": entry_id}


def uncollectible_amount(db: Session, user: m.User, case_id: int) -> Decimal:
    return sum((x.amount - paid(db, user, x.id) for x in installments(db, user, case_id)
        if x.uncollectible_reason is not None), ZERO)


def sync_client_delinquency(db: Session, user: m.User, client: m.Client) -> None:
    linked_case_ids = select(m.CaseClient.case_id).where(
        m.CaseClient.tenant_id == user.tenant_id, m.CaseClient.client_id == client.id,
    )
    delinquent_cases = select(m.Case.id).where(
        m.Case.tenant_id == user.tenant_id,
        (m.Case.client_id == client.id) | m.Case.id.in_(linked_case_ids),
        m.Case.status.in_(("concluido", "retirado")),
    )
    has_uncollectible = db.scalar(select(m.Installment.id).where(
        m.Installment.tenant_id == user.tenant_id,
        m.Installment.case_id.in_(delinquent_cases),
        m.Installment.uncollectible_reason.is_not(None),
    ).limit(1)) is not None
    if client.is_delinquent != has_uncollectible:
        before = public(client)
        client.is_delinquent = has_uncollectible
        audit(
            db, user, client,
            "Marcar cliente moroso" if has_uncollectible else "Retirar condición de moroso",
            before,
        )


def sync_case_clients_delinquency(db: Session, user: m.User, case: m.Case) -> None:
    db.flush()
    for client in case_clients(db, user, case):
        sync_client_delinquency(db, user, client)


def update_collection(db: Session, user: m.User, row: m.Installment, reason: str | None) -> None:
    if reason is not None and row.amount == paid(db, user, row.id):
        raise HTTPException(422, "Una cuota pagada no puede marcarse incobrable")
    if reason != row.uncollectible_reason:
        before = public(row)
        row.uncollectible_reason = reason
        row.uncollectible_at = m.now() if reason is not None else None
        cancel_notices(db, user, f"payment:{row.id}")
        audit(db, user, row, "Marcar cuota incobrable" if reason is not None else "Reactivar cobranza", before)


def case_clients(db: Session, user: m.User, item: m.Case) -> list[m.Client]:
    linked_ids = list(db.scalars(select(m.CaseClient.client_id).where(
        m.CaseClient.tenant_id == user.tenant_id, m.CaseClient.case_id == item.id,
    ).order_by(m.CaseClient.id)))
    ordered_ids = [item.client_id, *(cid for cid in linked_ids if cid != item.client_id)]
    return [get(db, m.Client, cid, user) for cid in ordered_ids]


def case_client_summary(db: Session, user: m.User, item: m.Case) -> dict[str, Any]:
    clients = case_clients(db, user, item)
    first = clients[0]
    return {
        "client_code": public(first)["code"],
        "client_name": " / ".join(c.name for c in clients),
        "client_document_type": first.document_type,
        "client_document_number": " / ".join(c.document_number for c in clients),
    }


def case_view(db: Session, user: m.User, item: m.Case) -> dict[str, Any]:
    clients = [public(c) for c in case_clients(db, user, item)]
    data = {
        **public(item, {"fee"}),
        "area": get(db, m.LegalArea, item.area_id, user).name,
        "client": clients[0],
        "clients": clients,
        "client_ids": [c["id"] for c in clients],
        "responsible_name": get(db, m.User, item.responsible_id, user).name,
        "access_level": access_level(db, user, item.id),
    }
    if user.role == "admin":
        received = payments(db, user, item.id)
        total = sum((p.amount for p in received), ZERO)
        plan = [installment_view(db, user, x) for x in installments(db, user, item.id)]
        uncollectible = sum((x["balance"] for x in plan if x["uncollectible_reason"] is not None), ZERO)
        data.update({
            "fee": item.fee, "paid": total,
            "balance": item.fee - total - uncollectible if item.fee is not None else None,
            "cancelled": item.fee is not None and item.fee == total,
            "uncollectible": uncollectible,
            "installments": plan,
            "payments": [public(p) for p in received],
        })
    return data


def entry_view(db: Session, user: m.User, item: m.Entry) -> dict[str, Any]:
    case = get(db, m.Case, item.case_id, user)
    data = {
        **public(item, {"payment_installment_id"}), **case_client_summary(db, user, case),
        "process_type": case.process_type,
        "responsible_name": get(db, m.User, item.registered_by, user).name,
        "can_attend": (item.alert_date is not None or item.payment_installment_id is not None) and not item.attended
            and access_level(db, user, case.id) == "edit",
    }
    if user.role == "admin" and item.payment_installment_id is not None:
        quota = get(db, m.Installment, item.payment_installment_id, user)
        data["payment_event"] = quota.event_name
        data["payment_installment_id"] = item.payment_installment_id
        data["payment_activated"] = quota.activated_at is not None
    return data


def sync_entry_payment(db: Session, user: m.User, installment_id: int, due_date: date | None) -> None:
    quota = get(db, m.Installment, installment_id, user, lock=True)
    if quota.due_date == due_date:
        return
    before = public(quota)
    quota.due_date = due_date
    quota.activated_at = (quota.activated_at or m.now()) if due_date is not None else None
    cancel_notices(db, user, f"payment:{quota.id}")
    if due_date is not None:
        db.execute(update(m.Notice).where(
            m.Notice.tenant_id == user.tenant_id,
            m.Notice.source_key.startswith(f"payment:{quota.id}:{due_date.isoformat()}:", autoescape=True),
        ).values(status="pendiente", read_at=None))
    audit(db, user, quota, "Sincronizar vencimiento de cuota", before)


def validate_entry_payment(db: Session, user: m.User, case_id: int, installment_id: int | None,
        entry: m.Entry | None = None) -> None:
    previous = entry.payment_installment_id if entry else None
    if installment_id == previous:
        return
    admin_only = user.role != "admin"
    if admin_only:
        raise HTTPException(403, "Solo el administrador puede vincular una cláusula de pago")
    if entry and entry.attended:
        raise HTTPException(422, "No se puede cambiar la cláusula de una actuación atendida")
    if installment_id is None:
        return
    quota = get(db, m.Installment, installment_id, user, lock=True)
    if quota.case_id != case_id or quota.event_name is None:
        raise HTTPException(422, "Selecciona una cuota por evento del mismo caso")
    if quota.activated_at is not None:
        raise HTTPException(422, "Esta cláusula de pago ya está activada")
    linked = db.scalar(select(m.Entry.id).where(m.Entry.tenant_id == user.tenant_id,
        m.Entry.payment_installment_id == installment_id))
    if linked is not None:
        raise HTTPException(422, "Esta cuota ya está vinculada a otra actuación")


def validate_plan(fee: Decimal | None, plan: list[Any] | None) -> None:
    if fee is None or not plan or sum((x.amount for x in plan), ZERO) != fee:
        raise HTTPException(422, "Las cuotas deben sumar el costo total de los honorarios")


def allocate_payment(db: Session, user: m.User, payment: m.Payment, first: int | None) -> None:
    plan = installments(db, user, payment.case_id)
    if first is not None:
        chosen = next((x for x in plan if x.id == first), None)
        if chosen is None:
            raise HTTPException(422, "La cuota debe pertenecer a esta ficha")
        if chosen.uncollectible_reason is not None:
            raise HTTPException(422, "Reactiva la cobranza de la cuota antes de registrar un abono")
        if chosen.amount == paid(db, user, chosen.id):
            raise HTTPException(422, "La cuota seleccionada ya está pagada")
        plan = [chosen, *(x for x in plan if x.id != first)]
    plan = [x for x in plan if x.uncollectible_reason is None]
    remaining = payment.amount
    for item in plan:
        amount = min(remaining, item.amount - paid(db, user, item.id))
        if amount > ZERO:
            db.add(m.Application(tenant_id=user.tenant_id, payment_id=payment.id, installment_id=item.id, amount=amount))
            remaining -= amount
            db.flush()
            if item.amount == paid(db, user, item.id):
                cancel_notices(db, user, f"payment:{item.id}")
        if remaining == ZERO:
            break
    if remaining > ZERO:
        raise HTTPException(422, "El abono supera el saldo pendiente de la ficha")
