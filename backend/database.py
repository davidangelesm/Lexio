# backend/database.py
"""Database sessions only; schema changes are explicit, never on API import."""

import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv(Path(__file__).with_name(".env"))


class Base(DeclarativeBase):
    pass


def build_engine() -> Engine:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("Configura DATABASE_URL en backend/.env")
    if url.startswith("mysql://"):
        url = url.replace("mysql://", "mysql+pymysql://", 1)
    return create_engine(
        url, pool_pre_ping=True, pool_recycle=280, isolation_level="READ COMMITTED"
    )


_factory: sessionmaker[Session] | None = None


def get_db() -> Generator[Session, None, None]:
    global _factory
    if _factory is None:
        _factory = sessionmaker(bind=build_engine(), expire_on_commit=False)
    with _factory() as session:
        yield session
