"""Explicit initial setup. Run only after reviewing/executing the HeidiSQL schema."""

import argparse
from getpass import getpass

from models import Audit, Tenant, User
from schemas import UserIn
from pydantic import ValidationError
from security import passwords
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import build_engine


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crear estudio y administrador de Lexio"
    )
    parser.add_argument("--name", required=True, help="Nombre del estudio")
    parser.add_argument("--username", required=True, help="Nombre de usuario de David")
    parser.add_argument("--admin-name", default="David")
    args = parser.parse_args()
    password = getpass("Contraseña del administrador (mínimo 12 caracteres): ")
    if len(password) < 12 or password != getpass("Repetir contraseña: "):
        raise SystemExit(
            "Contraseña corta o confirmación distinta. No se hizo ningún cambio."
        )
    try:
        account = UserIn(name=args.admin_name, username=args.username, password=password)
    except ValidationError:
        raise SystemExit(
            "Nombre obligatorio; usuario de 3 a 50 caracteres (letras sin tildes, "
            "números, punto, guion o guion bajo, comenzando con letra o número); "
            "contraseña de 12 a 128 caracteres. No se hizo ningún cambio."
        ) from None
    with Session(build_engine()) as db:
        if db.scalar(select(User.id).where(User.username == account.username)):
            raise SystemExit("Nombre de usuario ya registrado. No se creó otro estudio.")
        tenant = Tenant(name=args.name, notice_days="3,1")
        db.add(tenant)
        db.flush()
        user = User(
            tenant_id=tenant.tenant_id,
            name=account.name,
            username=account.username,
            password_hash=passwords.hash(password),
            role="admin",
            active=True,
            can_create_clients=True,
            can_create_cases=True,
        )
        db.add(user)
        db.flush()
        db.add(
            Audit(
                tenant_id=tenant.tenant_id,
                user_id=user.id,
                resource="lexio_tenants",
                resource_id=tenant.tenant_id,
                action="inicializar estudio",
                changes="Estudio y administrador creados mediante bootstrap",
            )
        )
        db.commit()
        print(
            f"Estudio {tenant.tenant_id} y administrador creados. Ingresa con el usuario configurado."
        )


if __name__ == "__main__":
    main()
