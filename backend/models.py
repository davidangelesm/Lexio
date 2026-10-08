# backend/models.py
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def ref(column: str, table: str) -> ForeignKeyConstraint:
    return ForeignKeyConstraint(
        ["tenant_id", column], [f"lexio_{table}.tenant_id", f"lexio_{table}.id"]
    )


class Tenant(Base):
    __tablename__ = "lexio_tenants"
    tenant_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    name: Mapped[str] = mapped_column(String(150))
    notice_days: Mapped[str] = mapped_column(String(30), default="5,3,1")


class Entity:
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("lexio_tenants.tenant_id"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class User(Entity, Base):
    __tablename__ = "lexio_users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("username"),
    )
    name: Mapped[str] = mapped_column(String(150))
    username: Mapped[str] = mapped_column(String(50))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="staff")
    active: Mapped[bool] = mapped_column(default=True)
    can_create_clients: Mapped[bool] = mapped_column(default=False)
    can_create_cases: Mapped[bool] = mapped_column(default=False)


class Client(Entity, Base):
    __tablename__ = "lexio_clients"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("tenant_id", "document_type", "document_number"),
    )
    document_type: Mapped[str] = mapped_column(String(5))
    document_number: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(180))
    phone: Mapped[str] = mapped_column(String(30), default="")
    email: Mapped[str] = mapped_column(String(254), default="")
    address: Mapped[str] = mapped_column(String(250), default="")


class Case(Entity, Base):
    __tablename__ = "lexio_cases"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ref("client_id", "clients"),
        ref("responsible_id", "users"),
    )
    client_id: Mapped[int] = mapped_column(Integer)
    area: Mapped[str] = mapped_column(String(80))
    subject: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)
    initial_stage: Mapped[str] = mapped_column(String(100))
    current_stage: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="activo")
    start_date: Mapped[date] = mapped_column(Date)
    responsible_id: Mapped[int] = mapped_column(Integer)
    reference: Mapped[str] = mapped_column(String(120), default="")


class Access(Entity, Base):
    __tablename__ = "lexio_access"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("tenant_id", "case_id", "user_id"),
        ref("case_id", "cases"),
        ref("user_id", "users"),
    )
    case_id: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[int] = mapped_column(Integer)
    level: Mapped[str] = mapped_column(String(10))


class Entry(Entity, Base):
    __tablename__ = "lexio_entries"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ref("case_id", "cases"),
        ref("registered_by", "users"),
    )
    case_id: Mapped[int] = mapped_column(Integer)
    action_date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text)
    registered_by: Mapped[int] = mapped_column(Integer)
    is_payment_event: Mapped[bool] = mapped_column(default=False)


class Task(Entity, Base):
    __tablename__ = "lexio_tasks"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ref("case_id", "cases"),
        ref("entry_id", "entries"),
        ref("responsible_id", "users"),
    )
    case_id: Mapped[int] = mapped_column(Integer)
    entry_id: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(String(250))
    responsible_id: Mapped[int] = mapped_column(Integer)
    due_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="pendiente")


class FileLink(Entity, Base):
    __tablename__ = "lexio_files"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ref("client_id", "clients"),
        ref("case_id", "cases"),
        ref("registered_by", "users"),
    )
    client_id: Mapped[int] = mapped_column(Integer)
    case_id: Mapped[int | None] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(180))
    url: Mapped[str] = mapped_column(Text)
    classification: Mapped[str] = mapped_column(String(20))
    registered_by: Mapped[int] = mapped_column(Integer)


class Service(Entity, Base):
    __tablename__ = "lexio_services"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ref("case_id", "cases"),
        CheckConstraint("fee > 0", name="ck_service_fee"),
    )
    case_id: Mapped[int] = mapped_column(Integer)
    mode: Mapped[str] = mapped_column(String(30))
    scope: Mapped[str] = mapped_column(Text)
    stage: Mapped[str] = mapped_column(String(120))
    contract_date: Mapped[date] = mapped_column(Date)
    fee: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(20), default="contratado")


class Event(Entity, Base):
    __tablename__ = "lexio_events"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ref("case_id", "cases"),
        ref("entry_id", "entries"),
    )
    case_id: Mapped[int] = mapped_column(Integer)
    entry_id: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(String(250))
    scheduled_date: Mapped[date | None] = mapped_column(Date)
    effective_date: Mapped[date | None] = mapped_column(Date)
    effective_kind: Mapped[str | None] = mapped_column(String(30))
    revision: Mapped[int] = mapped_column(default=1)
    reviewed_revision: Mapped[int] = mapped_column(default=0)


class Installment(Entity, Base):
    __tablename__ = "lexio_installments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ref("service_id", "services"),
        ref("event_id", "events"),
        CheckConstraint("amount > 0", name="ck_installment_amount"),
    )
    service_id: Mapped[int] = mapped_column(Integer)
    number: Mapped[int] = mapped_column(Integer)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    condition: Mapped[str] = mapped_column(String(30))
    event_id: Mapped[int | None] = mapped_column(Integer)
    offset_days: Mapped[int] = mapped_column(default=0)
    day_basis: Mapped[str] = mapped_column(String(20), default="calendario")
    due_date: Mapped[date | None] = mapped_column(Date)
    confirmed_revision: Mapped[int | None] = mapped_column(Integer)


class Payment(Entity, Base):
    __tablename__ = "lexio_payments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ref("service_id", "services"),
        ref("registered_by", "users"),
        CheckConstraint("amount > 0", name="ck_payment_amount"),
    )
    service_id: Mapped[int] = mapped_column(Integer)
    payment_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    method: Mapped[str] = mapped_column(String(50))
    receipt: Mapped[str] = mapped_column(String(250), default="")
    observation: Mapped[str] = mapped_column(Text, default="")
    registered_by: Mapped[int] = mapped_column(Integer)
    reversed_at: Mapped[datetime | None] = mapped_column(DateTime)
    reversal_reason: Mapped[str | None] = mapped_column(Text)


class Application(Entity, Base):
    __tablename__ = "lexio_applications"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("tenant_id", "payment_id", "installment_id"),
        ref("payment_id", "payments"),
        ref("installment_id", "installments"),
        CheckConstraint("amount > 0", name="ck_application_amount"),
    )
    payment_id: Mapped[int] = mapped_column(Integer)
    installment_id: Mapped[int] = mapped_column(Integer)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))


class Notice(Entity, Base):
    __tablename__ = "lexio_notices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("tenant_id", "user_id", "source_key"),
        ref("user_id", "users"),
        ref("case_id", "cases"),
    )
    user_id: Mapped[int] = mapped_column(Integer)
    case_id: Mapped[int] = mapped_column(Integer)
    source_key: Mapped[str] = mapped_column(String(180))
    kind: Mapped[str] = mapped_column(String(20))
    target_date: Mapped[date] = mapped_column(Date)
    notice_date: Mapped[date] = mapped_column(Date)
    anticipation: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="pendiente")
    read_at: Mapped[datetime | None] = mapped_column(DateTime)


class Audit(Entity, Base):
    __tablename__ = "lexio_audit"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ref("user_id", "users"),
    )
    user_id: Mapped[int] = mapped_column(Integer)
    resource: Mapped[str] = mapped_column(String(40))
    resource_id: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(40))
    changes: Mapped[str] = mapped_column(Text)
