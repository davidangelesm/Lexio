from decimal import Decimal

import models as m
import pytest
from seed_demo import seed_demo
from sqlalchemy import func, select
from sqlalchemy.orm import Session


def test_demo_scope_counts_balance_and_repeat_guard(setup):
    _, _, ids, engine = setup
    with Session(engine) as db:
        result = seed_demo(db, 1, ids[0], True)
        db.commit()
        assert {name: len(values) for name, values in result.items()} == {
            "clients": 3, "cases": 3, "entries": 3, "tasks": 10, "events": 2,
            "services": 2, "installments": 4, "payments": 3,
        }
        assert db.scalar(select(func.sum(m.Service.fee)).where(m.Service.tenant_id == 1)) == Decimal("2100.00")
        assert db.scalar(select(func.sum(m.Application.amount)).where(m.Application.tenant_id == 1)) == Decimal("1500.00")
        assert db.scalar(select(func.count(m.Client.id)).where(m.Client.tenant_id == 2)) == 0
        assert db.scalar(select(func.max(m.Task.due_date)).where(m.Task.tenant_id == 1)).isoformat() == "2026-10-15"
        with pytest.raises(ValueError, match="ya existe"):
            seed_demo(db, 1, ids[0], True)
        assert db.scalar(select(func.count(m.Client.id)).where(m.Client.tenant_id == 1)) == 3


def test_demo_rejects_other_tenant_admin_and_is_atomic(setup):
    _, _, ids, engine = setup
    with Session(engine) as db:
        with pytest.raises(ValueError):
            seed_demo(db, 2, ids[0], True)
        seed_demo(db, 1, ids[0], False)
        db.rollback()
        assert db.scalar(select(func.count(m.Client.id))) == 0
