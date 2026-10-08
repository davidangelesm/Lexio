"""Business rules shared by endpoints and acceptance tests. Money stays Decimal."""

import json
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, TypeVar, TYPE_CHECKING
from zoneinfo import ZoneInfo

import models as m
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

T = TypeVar("T", bound=m.Entity)
if TYPE_CHECKING:
    from schemas import ApplyIn
ZERO = Decimal("0.00")


def today() -> date:
    return datetime.now(ZoneInfo("America/Lima")).date()


def shift(day: date, count: int, business: bool = True) -> date:
    step = 1 if count >= 0 else -1
    left = abs(count)
    while left:
        day += timedelta(days=step)
        if not business or day.weekday() < 5:
            left -= 1
    return day


def rows(db: Session, model: type[T], user: m.User) -> list[T]:
    return list(db.scalars(select(model).where(model.tenant_id == user.tenant_id)))


def get(db: Session, model: type[T], key: int, user: m.User, lock: bool = False) -> T:
    query = select(model).where(model.tenant_id == user.tenant_id, model.id == key)
    if lock:
        query = query.with_for_update()
    item = db.scalar(query)
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


def case_access(db: Session, user: m.User, key: int, edit: bool = False) -> m.Case:
    case = get(db, m.Case, key, user)
    if user.role != "admin":
        grant = db.scalar(
            select(m.Access).where(
                m.Access.tenant_id == user.tenant_id,
                m.Access.case_id == key,
                m.Access.user_id == user.id,
            )
        )
        if grant is None or (edit and grant.level != "edit"):
            raise HTTPException(404, "Caso no encontrado o sin autorización")
    return case


def responsible(db: Session, user: m.User, case: m.Case, user_id: int) -> None:
    target = get(db, m.User, user_id, user)
    if not target.active:
        raise HTTPException(422, "Responsable inactivo")
    case_access(db, target, case.id)


def public(item: m.Entity, exclude: set[str] | None = None) -> dict[str, Any]:
    hidden = {"tenant_id", "password_hash"} | (exclude or set())
    data = {
        col.name: getattr(item, col.name)
        for col in item.__table__.columns
        if col.name not in hidden
    }
    if isinstance(item, m.Case):
        data["code"] = f"CAS-{item.id:06d}"
    if isinstance(item, m.Client):
        data["code"] = f"{item.document_type}-{item.document_number}"
    if isinstance(item, m.Task) and data["status"] == "atendida":
        data["status"] = "atendido"
    return data


def audit(
    db: Session,
    user: m.User,
    item: m.Entity,
    action: str,
    before: dict[str, Any] | None = None,
) -> None:
    db.flush()
    after = public(item)
    db.add(
        m.Audit(
            tenant_id=user.tenant_id,
            user_id=user.id,
            resource=item.__tablename__,
            resource_id=item.id,
            action=action,
            changes=json.dumps(
                {"before": before, "after": after}, default=str, ensure_ascii=False
            ),
        )
    )


def save(db: Session) -> None:
    from sqlalchemy.exc import IntegrityError

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Registro duplicado o relación inválida") from None


def cancel_notices(db: Session, user: m.User, source: str) -> None:
    db.execute(
        update(m.Notice)
        .where(
            m.Notice.tenant_id == user.tenant_id,
            m.Notice.source_key.startswith(source + ":", autoescape=True),
        )
        .values(status="cancelado")
    )


def amounts(fee: Decimal, plan: list[Any]) -> list[Decimal]:
    percentages = all(x.percentage is not None for x in plan)
    if not percentages and any(x.percentage is not None for x in plan):
        raise HTTPException(422, "Usa todos los importes o todos los porcentajes")
    if percentages:
        if sum(x.percentage for x in plan) != Decimal(100):
            raise HTTPException(422, "Los porcentajes deben sumar 100%")
        result = [
            (fee * x.percentage / 100).quantize(Decimal(".01"), rounding=ROUND_HALF_UP)
            for x in plan
        ]
        result[-1] = fee - sum(result[:-1])
    else:
        result = [x.amount for x in plan]
    if sum(result) != fee or any(x <= 0 for x in result):
        raise HTTPException(
            422, "Las cuotas deben ser positivas y sumar los honorarios"
        )
    if not any(x.condition == "fecha" for x in plan):
        raise HTTPException(422, "El cobro inicial debe tener una fecha concreta")
    return result


def paid(
    db: Session, user: m.User, installment_id: int, cutoff: date | None = None
) -> Decimal:
    query = (
        select(m.Application.amount)
        .join(
            m.Payment,
            (m.Payment.id == m.Application.payment_id)
            & (m.Payment.tenant_id == m.Application.tenant_id),
        )
        .where(
            m.Application.tenant_id == user.tenant_id,
            m.Payment.tenant_id == user.tenant_id,
            m.Application.installment_id == installment_id,
            m.Payment.reversed_at.is_(None),
        )
    )
    if cutoff is not None:
        query = query.where(m.Payment.payment_date <= cutoff)
    return sum(db.scalars(query), ZERO)


def installment_view(
    db: Session, user: m.User, item: m.Installment, cutoff: date | None = None
) -> dict[str, Any]:
    cut = cutoff or today()
    applied = paid(db, user, item.id, cut)
    balance = item.amount - applied
    valid_date = item.due_date
    review = False
    provisional = None
    if item.event_id:
        event = get(db, m.Event, item.event_id, user)
        review = item.confirmed_revision != event.revision
        if review:
            valid_date = None
        if event.scheduled_date:
            provisional = shift(
                event.scheduled_date,
                item.offset_days,
                item.day_basis == "lunes_viernes",
            )
    if balance <= 0:
        state = "pagado"
    elif valid_date is None:
        state = "pendiente de evento"
    elif valid_date < cut:
        state = "vencido parcial" if applied > 0 else "vencido"
    else:
        state = "parcial" if applied > 0 else "pendiente"
    return {
        **public(item),
        "due_date": valid_date,
        "paid": applied,
        "balance": balance,
        "state": state,
        "review_required": review,
        "provisional_date": provisional,
        "due_today": valid_date == cut,
    }


def confirm(db: Session, user: m.User, item: m.Installment) -> None:
    if item.event_id is None:
        raise HTTPException(422, "La cuota no depende de un evento")
    event = get(db, m.Event, item.event_id, user)
    anchor = (
        event.scheduled_date
        if item.condition == "programacion"
        else event.effective_date
        if event.effective_kind == item.condition
        else None
    )
    if anchor is None:
        raise HTTPException(422, "El evento todavía no cumple la condición pactada")
    item.due_date = shift(anchor, item.offset_days, item.day_basis == "lunes_viernes")
    item.confirmed_revision = event.revision


def automatic_applications(
    db: Session, user: m.User, service_id: int, amount: Decimal
) -> list["ApplyIn"]:
    from schemas import ApplyIn

    # Caller locks the service before reading balances or creating the payment.
    remaining = amount
    result: list[ApplyIn] = []
    for item in db.scalars(select(m.Installment).where(
        m.Installment.tenant_id == user.tenant_id,
        m.Installment.service_id == service_id,
    ).order_by(m.Installment.number, m.Installment.id)):
        balance = item.amount - paid(db, user, item.id)
        allocation = min(remaining, max(balance, ZERO))
        if allocation > ZERO:
            result.append(ApplyIn(installment_id=item.id, amount=allocation))
            remaining -= allocation
        if remaining == ZERO:
            break
    return result


def apply_payment(
    db: Session, user: m.User, payment: m.Payment, applications: list[Any]
) -> None:
    # All money mutations first lock the service; serializes allocations and reversals.
    get(db, m.Service, payment.service_id, user, lock=True)
    if payment.reversed_at:
        raise HTTPException(422, "El abono está reversado")
    existing = list(
        db.scalars(
            select(m.Application).where(
                m.Application.tenant_id == user.tenant_id,
                m.Application.payment_id == payment.id,
            )
        )
    )
    if (
        sum((x.amount for x in existing), ZERO)
        + sum((x.amount for x in applications), ZERO)
        > payment.amount
    ):
        raise HTTPException(422, "La aplicación excede el crédito disponible del abono")
    seen: set[int] = set()
    for allocation in applications:
        if allocation.installment_id in seen:
            raise HTTPException(422, "Cuota duplicada en las aplicaciones")
        seen.add(allocation.installment_id)
        item = get(db, m.Installment, allocation.installment_id, user)
        if item.service_id != payment.service_id:
            raise HTTPException(422, "La cuota debe pertenecer al mismo servicio")
        if allocation.amount > item.amount - paid(db, user, item.id):
            raise HTTPException(422, "El importe supera el saldo de la cuota")
        old = next((x for x in existing if x.installment_id == item.id), None)
        if old:
            old.amount += allocation.amount
            audit(db, user, old, "aplicar crédito")
        else:
            row = m.Application(
                tenant_id=user.tenant_id,
                payment_id=payment.id,
                installment_id=item.id,
                amount=allocation.amount,
            )
            db.add(row)
            audit(db, user, row, "aplicar abono")
        if item.amount - paid(db, user, item.id) <= 0:
            cancel_notices(db, user, f"quota:{item.id}")


def economic(
    db: Session, user: m.User, services: list[m.Service], cut: date
) -> dict[str, Any]:
    totals = dict.fromkeys(
        [
            "contracted",
            "applied",
            "balance",
            "overdue",
            "not_due",
            "pending_event",
            "credit",
        ],
        ZERO,
    )
    detail = []
    for service in services:
        if service.contract_date > cut:
            continue
        items = list(
            db.scalars(
                select(m.Installment)
                .where(
                    m.Installment.tenant_id == user.tenant_id,
                    m.Installment.service_id == service.id,
                )
                .order_by(m.Installment.number)
            )
        )
        views = [installment_view(db, user, x, cut) for x in items]
        payments = list(
            db.scalars(
                select(m.Payment).where(
                    m.Payment.tenant_id == user.tenant_id,
                    m.Payment.service_id == service.id,
                    m.Payment.payment_date <= cut,
                    m.Payment.reversed_at.is_(None),
                )
            )
        )
        received = sum((x.amount for x in payments), ZERO)
        applied = sum((x["paid"] for x in views), ZERO)
        totals["contracted"] += service.fee
        totals["applied"] += applied
        totals["balance"] += sum((x["balance"] for x in views), ZERO)
        totals["credit"] += received - applied
        for x in views:
            bucket = (
                "pending_event"
                if x["due_date"] is None
                else "overdue"
                if x["due_date"] < cut
                else "not_due"
            )
            totals[bucket] += x["balance"]
            allocations = list(
                db.execute(
                    select(m.Application, m.Payment)
                    .join(
                        m.Payment,
                        (m.Payment.id == m.Application.payment_id)
                        & (m.Payment.tenant_id == m.Application.tenant_id),
                    )
                    .where(
                        m.Application.tenant_id == user.tenant_id,
                        m.Payment.tenant_id == user.tenant_id,
                        m.Application.installment_id == x["id"],
                        m.Payment.payment_date <= cut,
                    )
                )
            )
            x["payments"] = [
                {**public(p), "applied_amount": a.amount} for a, p in allocations
            ]
        detail.append(
            {
                **public(service),
                "installments": views,
                "payments": [public(x) for x in payments],
            }
        )
    return {"cutoff": cut, "totals": totals, "services": detail}
