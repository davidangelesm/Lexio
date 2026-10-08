"""Explicit maintenance: rename one existing admin without changing its password."""

import argparse

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import domain as d
from database import build_engine
from models import User
from schemas import Username


def rename_admin(db: Session, current: str, username: str) -> None:
    validator = TypeAdapter(Username)
    current = validator.validate_python(current)
    username = validator.validate_python(username)
    # Trusted maintenance resolves the globally unique identity, then scopes by tenant.
    identity = db.scalar(select(User).where(User.username == current))
    if identity is None or identity.role != "admin":
        raise ValueError("No se encontró la cuenta administradora indicada.")
    row = db.scalar(
        select(User)
        .where(User.id == identity.id, User.tenant_id == identity.tenant_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if row is None or row.role != "admin" or row.username != current:
        raise ValueError("La cuenta cambió; vuelve a revisar el usuario actual.")
    before = d.public(row)
    row.username = username
    d.audit(db, row, row, "cambiar usuario administrador", before)
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Cambiar usuario de un administrador existente")
    parser.add_argument("--current-username", required=True)
    parser.add_argument("--username", required=True)
    args = parser.parse_args()
    try:
        with Session(build_engine()) as db:
            rename_admin(db, args.current_username, args.username)
    except ValidationError:
        raise SystemExit("Nombre de usuario inválido. No se hizo ningún cambio.") from None
    except ValueError as error:
        raise SystemExit(str(error)) from None
    except SQLAlchemyError:
        raise SystemExit(
            "No se pudo guardar el cambio. Revisa la conexión y que el usuario nuevo esté disponible."
        ) from None
    print("Usuario administrador actualizado. Conserva la misma contraseña y permisos.")


if __name__ == "__main__":
    main()
