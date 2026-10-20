import re
from datetime import date
from pathlib import Path

import models as m
import pytest
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.orm import Session

from database import Base


SQL = (Path(__file__).resolve().parents[2] / "database" / "cleanup_demo_data.sql").read_text()


def snapshot(connection):
    return {
        name: [dict(row) for row in connection.execute(select(table)).mappings()]
        for name, table in Base.metadata.tables.items()
    }


@pytest.mark.parametrize("apply", [0, 1])
def test_cleanup_preserves_admin_catalog_and_other_tenant_with_foreign_keys(apply):
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all(m.Tenant(tenant_id=i, name=f"Estudio {i}") for i in (1, 2))
        db.flush()
        db.add(m.User(id=3, tenant_id=1, name="Asistente", username="asistente1",
            password_hash="test-assistant-hash", role="staff"))
        for i in (1, 2):
            db.add_all([
                m.User(id=i, tenant_id=i, name="Admin", username="admin" if i == 1 else "otro",
                    password_hash=f"test-admin-hash-{i}", role="admin"),
                m.LegalArea(id=i, tenant_id=i, name="Civil"),
                m.Client(id=i, tenant_id=i, document_type="DNI", document_number="12345678", name="Cliente"),
            ])
        db.flush()
        for i in (1, 2):
            db.add(m.Case(id=i, tenant_id=i, client_id=i, area_id=i, responsible_id=i,
                process_type="Cobro", initial_stage="Demanda", fee=1000))
        db.flush()
        for i in (1, 2):
            db.add(m.Installment(id=i, tenant_id=i, case_id=i, number=1,
                amount=1000, event_name="Sentencia"))
        db.flush()
        for i in (1, 2):
            db.add_all([
                m.Entry(id=i, tenant_id=i, case_id=i, registered_by=3 if i == 1 else i,
                    action_date=date(2026, 10, 8), subject="Sentencia", subject_type="legal",
                    description="Ejemplo", payment_installment_id=i),
                m.Payment(id=i, tenant_id=i, case_id=i, registered_by=i,
                    payment_date=date(2026, 10, 8), amount=100),
                m.Access(tenant_id=i, case_id=i, user_id=3 if i == 1 else i, level="edit"),
                m.Notice(tenant_id=i, case_id=i, user_id=i, source_key=f"entry:{i}", kind="legal",
                    target_date=date(2026, 10, 15), notice_date=date(2026, 10, 8), anticipation=5),
                m.Audit(tenant_id=i, user_id=3 if i == 1 else i, resource="lexio_cases",
                    resource_id=i, action="Registrar caso", changes="{}"),
            ])
        db.flush()
        for i in (1, 2):
            db.add(m.Application(tenant_id=i, payment_id=i, installment_id=i, amount=100))
        db.commit()

    statements = re.findall(r"DELETE FROM lexio_\w+\s+WHERE[^;]+;", SQL)
    default_call = re.search(r"CALL lexio_cleanup_demo_data\('admin',\s*(\d+)\);", SQL)
    assert default_call is not None and int(default_call.group(1)) == 0
    preserved = {"lexio_tenants", "lexio_legal_areas"}
    deleted = {statement.split()[2] for statement in statements}
    assert deleted == set(Base.metadata.tables) - preserved

    with engine.connect() as connection:
        before = snapshot(connection)
        connection.rollback()
        transaction = connection.begin()
        for name in deleted:
            assert any(row["tenant_id"] == 1 for row in before[name]), name
        for statement in statements:
            connection.execute(text(statement.replace("v_tenant_id", ":tenant_id")
                .replace("v_admin_id", ":admin_id")), {"tenant_id": 1, "admin_id": 1})
        cleaned = snapshot(connection)
        for name in preserved:
            assert cleaned[name] == before[name]
        for name in deleted:
            assert [row for row in cleaned[name] if row["tenant_id"] == 2] == [
                row for row in before[name] if row["tenant_id"] == 2]
            remaining = [row for row in cleaned[name] if row["tenant_id"] == 1]
            assert remaining == ([row for row in before[name] if row["id"] == 1]
                if name == "lexio_users" else [])
        if apply:
            transaction.commit()
            assert snapshot(connection) == cleaned
        else:
            transaction.rollback()
            assert snapshot(connection) == before
    engine.dispose()
