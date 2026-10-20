"""Actualización explícita de cuotas existentes; simula salvo que se indique --apply."""

import argparse

import domain as d
import models as m
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import build_engine


def synchronize(db: Session, user: m.User) -> int:
    if user.role != "admin" or not user.active:
        raise ValueError("Selecciona un administrador activo del estudio")
    entries = list(db.scalars(select(m.Entry).join(m.Installment,
        (m.Installment.tenant_id == m.Entry.tenant_id)
        & (m.Installment.case_id == m.Entry.case_id)
        & (m.Installment.id == m.Entry.payment_installment_id)
    ).where(m.Entry.tenant_id == user.tenant_id, m.Installment.event_name.is_not(None))))
    changed = 0
    for entry in entries:
        assert entry.payment_installment_id is not None
        d.case_access(db, user, entry.case_id, lock=True)
        quota = d.get(db, m.Installment, entry.payment_installment_id, user, lock=True)
        if quota.due_date != entry.alert_date:
            d.sync_entry_payment(db, user, quota.id, entry.alert_date)
            changed += 1
    return changed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--admin-id", type=int, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    engine = build_engine()
    with Session(engine) as db:
        user = db.get(m.User, args.admin_id)
        if user is None:
            parser.error("Administrador no encontrado")
        count = synchronize(db, user)
        if args.apply:
            db.commit()
        else:
            db.rollback()
        print(f"Cuotas {'actualizadas' if args.apply else 'por actualizar (simulación)'}: {count}")
    engine.dispose()
