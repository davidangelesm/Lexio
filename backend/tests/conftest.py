import os
import sys
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["JWT_SECRET"] = "test-only-not-a-production-secret-1234567890"
import models as m
from main import app
from security import passwords, token

from database import Base, get_db


@pytest.fixture(autouse=True)
def fixed_day(monkeypatch):
    import domain
    monkeypatch.setattr(domain, "today", lambda: date(2026, 10, 8))


@pytest.fixture
def setup():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as db:
        tenants = [m.Tenant(name="Estudio A"), m.Tenant(name="Estudio B")]
        db.add_all(tenants)
        db.flush()
        users = [
            m.User(
                tenant_id=tenants[0].tenant_id,
                name="David",
                username="david",
                password_hash=passwords.hash("password-test-123"),
                role="admin",
            ),
            m.User(
                tenant_id=tenants[0].tenant_id,
                name="Abogado",
                username="abogado",
                password_hash=passwords.hash("password-test-123"),
                role="staff",
            ),
            m.User(
                tenant_id=tenants[1].tenant_id,
                name="Otro estudio",
                username="otro",
                password_hash=passwords.hash("password-test-123"),
                role="admin",
            ),
        ]
        db.add_all(users)
        db.commit()
        headers = [{"Authorization": f"Bearer {token(u)}"} for u in users]
        ids = [u.id for u in users]

    def session():
        with Session(engine, expire_on_commit=False) as db:
            yield db

    app.dependency_overrides[get_db] = session
    with TestClient(app) as client:
        yield client, headers, ids, engine
    app.dependency_overrides.clear()
    engine.dispose()
