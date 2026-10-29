from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Password = Annotated[str, StringConstraints(strip_whitespace=False)]
Money = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2)]
Username = Annotated[str, StringConstraints(
    strip_whitespace=True, to_lower=True, min_length=3, max_length=50,
    pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$",
)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(Input):
    username: Username
    password: Password = Field(min_length=1, max_length=256)


class UserIn(Input):
    name: str = Field(min_length=1, max_length=150)
    username: Username
    password: Password = Field(min_length=6, max_length=128)
    can_create_clients: bool = False
    can_create_cases: bool = False


class UserUpdate(Input):
    username: Username
    name: str = Field(min_length=1, max_length=150)
    active: bool
    can_create_clients: bool
    can_create_cases: bool
    password: Password | None = Field(default=None, min_length=6, max_length=128)


class LegalAreaIn(Input):
    name: str = Field(min_length=1, max_length=80)


class ClientIn(Input):
    document_type: Literal["DNI", "RUC", "CE"]
    document_number: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=180)
    phone: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=254)
    address: str = Field(default="", max_length=250)
    lead_source: Literal["", "Sin atribución", "Instagram", "Facebook", "Tiktok", "Web", "Referido", "Volantes", "Otro"] = "Sin atribución"

    @model_validator(mode="after")
    def document(self):
        if self.document_type in ("DNI", "RUC"):
            size = 8 if self.document_type == "DNI" else 11
            if not self.document_number.isascii() or not self.document_number.isdigit() or len(self.document_number) != size:
                raise ValueError(f"{self.document_type} debe tener {size} dígitos")
        return self


class InstallmentIn(Input):
    id: int | None = Field(default=None, gt=0)
    amount: Money
    due_date: date | None = None
    event_name: str | None = Field(default=None, min_length=1, max_length=150)

    @model_validator(mode="after")
    def payment_trigger(self):
        if self.event_name is None and self.due_date is None:
            raise ValueError("La cuota necesita una fecha o un evento de pago")
        if self.event_name is not None and self.due_date is not None and self.id is None:
            raise ValueError("Una cuota nueva por evento no tiene fecha hasta que se atiende la actuación")
        return self


class CollectionUpdate(Input):
    reason: str | None = Field(min_length=1, max_length=500)


class CollectionBatchUpdate(CollectionUpdate):
    installment_ids: list[Annotated[int, Field(gt=0)]] = Field(min_length=1, max_length=100)


class CaseIn(Input):
    client_id: int | None = Field(default=None, gt=0)
    client: ClientIn | None = None
    area_id: int = Field(gt=0)
    process_type: str = Field(min_length=1, max_length=150)
    initial_stage: str = Field(min_length=1, max_length=100)
    status: Literal["activo", "concluido", "retirado"] = "activo"
    responsible_id: int | None = Field(default=None, gt=0)
    fee: Money | None = None
    installments: list[InstallmentIn] | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def client_source(self):
        if (self.client_id is None) == (self.client is None):
            raise ValueError("Selecciona un cliente existente o registra sus datos")
        return self


class CaseUpdate(Input):
    client: ClientIn | None = None
    area_id: int | None = Field(default=None, gt=0)
    process_type: str | None = Field(default=None, min_length=1, max_length=150)
    initial_stage: str | None = Field(default=None, min_length=1, max_length=100)
    status: Literal["activo", "concluido", "retirado"] | None = None
    responsible_id: int | None = Field(default=None, gt=0)
    fee: Money | None = None
    installments: list[InstallmentIn] | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def area_required_when_present(self):
        if "area_id" in self.model_fields_set and self.area_id is None:
            raise ValueError("Selecciona una rama del catálogo")
        return self


class Grant(Input):
    user_id: int = Field(gt=0)
    level: Literal["read", "edit"]


class EntryIn(Input):
    action_date: date
    subject: str = Field(min_length=1, max_length=150)
    subject_type: Literal["legal", "otro"] = "legal"
    description: str = Field(min_length=1, max_length=10000)
    alert_date: date | None = None
    alert_time: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")] | None = None
    payment_installment_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_alert_time(self):
        if self.alert_time is not None and self.alert_date is None:
            raise ValueError("La hora de alerta requiere una fecha de alerta")
        return self


class PaymentIn(Input):
    payment_date: date
    amount: Money
    method: str = Field(default="", max_length=50)
    installment_id: int | None = Field(default=None, gt=0)

    @field_validator("payment_date")
    @classmethod
    def not_future(cls, value: date) -> date:
        from domain import today
        if value > today():
            raise ValueError("El abono no puede tener fecha futura")
        return value
