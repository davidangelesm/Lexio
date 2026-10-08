from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    StringConstraints,
    field_validator,
    model_validator,
)

Password = Annotated[str, StringConstraints(strip_whitespace=False)]
Username = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$",
    ),
]


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


class ClientIn(Input):
    document_type: Literal["DNI", "RUC", "CE"]
    document_number: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=180)
    phone: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=254)
    address: str = Field(default="", max_length=250)

    @model_validator(mode="after")
    def document(self):
        if self.document_type in ("DNI", "RUC"):
            size = 8 if self.document_type == "DNI" else 11
            if (
                not self.document_number.isascii()
                or not self.document_number.isdigit()
                or len(self.document_number) != size
            ):
                raise ValueError(f"{self.document_type} debe tener {size} dígitos")
        return self


class CaseIn(Input):
    client_id: int = Field(gt=0)
    area: str = Field(min_length=1, max_length=80)
    subject: str = Field(min_length=1, max_length=150)
    description: str = Field(min_length=1, max_length=10000)
    initial_stage: str = Field(min_length=1, max_length=100)
    current_stage: str = Field(min_length=1, max_length=100)
    status: Literal["activo", "suspendido", "concluido"] = "activo"
    start_date: date
    responsible_id: int = Field(gt=0)
    reference: str = Field(default="", max_length=120)


class CaseUpdate(Input):
    area: str = Field(min_length=1, max_length=80)
    subject: str = Field(min_length=1, max_length=150)
    description: str = Field(min_length=1, max_length=10000)
    current_stage: str = Field(min_length=1, max_length=100)
    status: Literal["activo", "suspendido", "concluido"]
    responsible_id: int = Field(gt=0)
    reference: str = Field(default="", max_length=120)


class Grant(Input):
    user_id: int = Field(gt=0)
    level: Literal["read", "edit"]


class EntryIn(Input):
    action_date: date
    description: str = Field(min_length=1, max_length=10000)
    is_payment_event: bool = False


class TaskIn(Input):
    entry_id: int | None = Field(default=None, gt=0)
    description: str = Field(min_length=1, max_length=250)
    responsible_id: int = Field(gt=0)
    due_date: date
    status: Literal["pendiente", "atendido", "atendida", "cancelada"] = "pendiente"

    @field_validator("status")
    @classmethod
    def normalize_status(cls, value: str) -> str:
        return "atendido" if value == "atendida" else value


class FileIn(Input):
    title: str = Field(min_length=1, max_length=180)
    url: HttpUrl
    classification: Literal["operativo", "financiero"]

    @field_validator("url")
    @classmethod
    def secure_url(cls, value: HttpUrl) -> HttpUrl:
        if value.scheme != "https":
            raise ValueError("El enlace del archivo debe usar HTTPS")
        return value


class EventIn(Input):
    entry_id: int | None = Field(default=None, gt=0)
    description: str = Field(min_length=1, max_length=250)
    scheduled_date: date | None = None
    effective_date: date | None = None
    effective_kind: Literal["realizacion", "emision", "notificacion"] | None = None

    @model_validator(mode="after")
    def effective(self):
        if bool(self.effective_date) != bool(self.effective_kind):
            raise ValueError(
                "Fecha efectiva y condición efectiva deben registrarse juntas"
            )
        return self


class InstallmentIn(Input):
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    percentage: Decimal | None = Field(default=None, gt=0, le=100, decimal_places=4)
    condition: Literal[
        "fecha", "programacion", "realizacion", "emision", "notificacion"
    ]
    due_date: date | None = None
    event_id: int | None = Field(default=None, gt=0)
    offset_days: int = Field(default=0, ge=-3650, le=3650)
    day_basis: Literal["calendario", "lunes_viernes"] = "calendario"

    @model_validator(mode="after")
    def valid_condition(self):
        if (self.amount is None) == (self.percentage is None):
            raise ValueError("Indica monto o porcentaje, exclusivamente")
        if self.condition == "fecha":
            if self.due_date is None or self.event_id is not None:
                raise ValueError("Cuota por fecha requiere fecha y no evento")
        elif self.event_id is None or self.due_date is not None:
            raise ValueError(
                "Cuota por evento requiere evento; su fecha se confirma después"
            )
        return self


class ServiceIn(Input):
    mode: Literal["etapa", "acto", "integral", "otro"]
    scope: str = Field(min_length=1, max_length=10000)
    stage: str = Field(min_length=1, max_length=120)
    contract_date: date
    fee: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    installments: list[InstallmentIn] = Field(min_length=1, max_length=100)


class ApplyIn(Input):
    installment_id: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)


class PaymentIn(Input):
    payment_date: date
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    method: str = Field(min_length=1, max_length=50)
    receipt: str = Field(default="", max_length=250)
    observation: str = Field(default="", max_length=10000)
    applications: list[ApplyIn] = Field(default_factory=list, max_length=100)

    @field_validator("payment_date")
    @classmethod
    def not_future(cls, value: date) -> date:
        from domain import today

        if value > today():
            raise ValueError("El abono no puede tener fecha futura")
        return value


class ApplyList(Input):
    applications: list[ApplyIn] = Field(min_length=1, max_length=100)


class Reason(Input):
    reason: str = Field(min_length=5, max_length=2000)


class Reschedule(Input):
    due_date: date
    reason: str = Field(min_length=5, max_length=2000)


class LinkEvent(Input):
    event_id: int = Field(gt=0)


class NoticeSettings(Input):
    days: list[int] = Field(min_length=3, max_length=3)

    @field_validator("days")
    @classmethod
    def valid_days(cls, value: list[int]) -> list[int]:
        if len(set(value)) != 3 or any(x < 1 or x > 60 for x in value):
            raise ValueError("Define tres anticipaciones distintas entre 1 y 60 días")
        return sorted(value, reverse=True)
