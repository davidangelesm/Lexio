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


def case_scope(db: Session, user: m.User):
    query = select(m.Case).where(m.Case.tenant_id == user.tenant_id)
    if user.role != "admin":
        allowed = select(m.Access.case_id).where(
            m.Access.tenant_id == user.tenant_id, m.Access.user_id == user.id
        )
        query = query.where(m.Case.id.in_(allowed))
    return query


def access_level(db: Session, user: m.User, key: int) -> str | None:
    if user.role == "admin":
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
    state = "pagado" if balance == ZERO else "vencido" if item.due_date < today() else "parcial" if applied > ZERO else "pendiente"
    return {**public(item), "paid": applied, "balance": balance, "state": state}


def case_view(db: Session, user: m.User, item: m.Case) -> dict[str, Any]:
    data = {
        **public(item, {"fee"}),
        "client": public(get(db, m.Client, item.client_id, user)),
        "responsible_name": get(db, m.User, item.responsible_id, user).name,
        "access_level": access_level(db, user, item.id),
    }
    if user.role == "admin":
        received = payments(db, user, item.id)
        total = sum((p.amount for p in received), ZERO)
        data.update({
            "fee": item.fee, "paid": total,
            "balance": item.fee - total if item.fee is not None else None,
            "cancelled": item.fee is not None and item.fee == total,
            "installments": [installment_view(db, user, x) for x in installments(db, user, item.id)],
            "payments": [public(p) for p in received],
        })
    return data


def entry_view(db: Session, user: m.User, item: m.Entry) -> dict[str, Any]:
    case = get(db, m.Case, item.case_id, user)
    client = get(db, m.Client, case.client_id, user)
    return {
        **public(item), "client_code": public(client)["code"], "client_name": client.name,
        "process_type": case.process_type,
        "responsible_name": get(db, m.User, item.registered_by, user).name,
        "can_attend": access_level(db, user, case.id) == "edit",
    }


def validate_plan(fee: Decimal | None, plan: list[Any] | None) -> None:
    if fee is None or not plan or sum((x.amount for x in plan), ZERO) != fee:
        raise HTTPException(422, "Las cuotas deben sumar el costo total de los honorarios")


def allocate_payment(db: Session, user: m.User, payment: m.Payment, first: int | None) -> None:
    plan = installments(db, user, payment.case_id)
    if first is not None:
        chosen = next((x for x in plan if x.id == first), None)
        if chosen is None:
            raise HTTPException(422, "La cuota debe pertenecer a esta ficha")
        if chosen.amount == paid(db, user, chosen.id):
            raise HTTPException(422, "La cuota seleccionada ya está pagada")
        plan = [chosen, *(x for x in plan if x.id != first)]
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
