"""Temporary, local-only UI acceptance environment. Never reads DATABASE_URL.

Run with: backend/venv/Scripts/python.exe backend/tests/preview_server.py
The database lives in memory and disappears on exit. Credentials are test-only.
"""

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["JWT_SECRET"] = "local-ui-test-only-not-production-1234567890"
os.environ["CORS_ORIGINS"] = "http://127.0.0.1:1420,http://localhost:1420"
import uvicorn
from main import app
from models import Tenant, User
from security import passwords
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from database import Base, get_db


def main() -> None:
    temporary = tempfile.TemporaryDirectory(prefix="lexio-ui-")
    path = (Path(temporary.name) / "preview.db").as_posix()
    engine = create_engine(
        f"sqlite:///{path}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        tenant = Tenant(name="Estudio de prueba local")
        db.add(tenant)
        db.flush()
        db.add(
            User(
                tenant_id=tenant.tenant_id,
                name="David (prueba)",
                username="preview",
                password_hash=passwords.hash("lexio-preview-only"),
                role="admin",
                can_create_clients=True,
                can_create_cases=True,
            )
        )
        db.commit()

    def sessions():
        with Session(engine, expire_on_commit=False) as db:
            yield db

    app.dependency_overrides[get_db] = sessions
    print("ENTORNO TEMPORAL LOCAL: preview / lexio-preview-only")
    try:
        uvicorn.run(app, host="127.0.0.1", port=8000)
    finally:
        engine.dispose()
        temporary.cleanup()


if __name__ == "__main__":
    main()
