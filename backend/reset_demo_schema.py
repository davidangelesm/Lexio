"""Explicit transition to the four-module schema; keeps accounts and audit.

Only for a database whose business records are disposable test data. Without
--apply this prints the plan and does not change the database. Never run on API
startup. MySQL DDL commits implicitly, so deploy the matching backend together.
"""

import argparse
import json

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from database import Base, build_engine
from models import Audit, Tenant, User


KEEP = {"lexio_tenants", "lexio_users", "lexio_audit"}
DROP_ORDER = (
    "lexio_files",
    "lexio_notices",
    "lexio_applications",
    "lexio_payments",
    "lexio_installments",
    "lexio_tasks",
    "lexio_events",
    "lexio_services",
    "lexio_entries",
    "lexio_access",
    "lexio_cases",
    "lexio_clients",
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Simplificar el esquema de prueba de Lexio")
    parser.add_argument("--tenant-id", type=int, required=True)
    parser.add_argument("--admin-id", type=int, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    engine = build_engine()
    try:
        with engine.connect() as connection:
            inspector = inspect(connection)
            existing = set(inspector.get_table_names())
            if not KEEP <= existing:
                raise ValueError("Faltan tablas de identidad o auditoría; no se modificó el esquema.")
            with Session(bind=connection) as db:
                actor = db.scalar(select(User).where(
                    User.id == args.admin_id, User.tenant_id == args.tenant_id,
                    User.role == "admin", User.active.is_(True),
                ))
                if actor is None or db.get(Tenant, args.tenant_id) is None:
                    raise ValueError("Administrador o estudio inválido; no se modificó el esquema.")
                accounts_before = db.execute(select(
                    User.id, User.tenant_id, User.username, User.password_hash,
                    User.role, User.active, User.name,
                    User.can_create_clients, User.can_create_cases,
                ).order_by(User.id)).all()
            current = set(Base.metadata.tables) - KEEP
            obsolete = set(DROP_ORDER) - current
            if current <= existing and not (obsolete & existing) and all(
                {column.name for column in Base.metadata.tables[name].columns}
                <= {column["name"] for column in inspector.get_columns(name)}
                for name in current
            ):
                print("El esquema simplificado ya está aplicado. No se borró ningún dato.")
                return
            to_drop = set(DROP_ORDER) & existing
            counts: dict[str, int] = {}
            for name in existing:
                for relation in inspector.get_foreign_keys(name):
                    if relation["referred_table"] in to_drop and name not in to_drop:
                        raise ValueError("Una tabla ajena depende del esquema anterior; no se modificó.")
            for name in sorted(to_drop):
                if "tenant_id" not in {column["name"] for column in inspector.get_columns(name)}:
                    raise ValueError("Una tabla anterior no contiene tenant_id; no se modificó.")
                foreign_rows = connection.scalar(text(
                    f"SELECT COUNT(*) FROM `{name}` WHERE tenant_id <> :tenant_id"
                ), {"tenant_id": args.tenant_id})
                if foreign_rows:
                    raise ValueError("Hay datos de otro estudio; no se modificó ninguna tabla.")
                counts[name] = connection.scalar(text(f"SELECT COUNT(*) FROM `{name}`")) or 0
            print("Conservar: estudios, usuarios, contraseñas, permisos de alta y auditoría.")
            print("Eliminar datos de prueba y reemplazar:", ", ".join(sorted(to_drop)))
            print("Crear:", ", ".join(sorted(current)))
            print("Registros de prueba:", json.dumps(counts, ensure_ascii=False))
            if not args.apply:
                print("Vista previa. Añade --apply para ejecutar el cambio autorizado.")
                return
            connection.commit()
            for name in DROP_ORDER:
                if name in to_drop:
                    connection.execute(text(f"DROP TABLE `{name}`"))
            for table in Base.metadata.sorted_tables:
                table.dialect_options["mysql"]["engine"] = "InnoDB"
                table.dialect_options["mysql"]["charset"] = "utf8mb4"
                table.dialect_options["mysql"]["collate"] = "utf8mb4_unicode_ci"
            Base.metadata.create_all(connection, tables=[
                table for table in Base.metadata.sorted_tables if table.name not in KEEP
            ])
            connection.commit()
            with Session(bind=connection) as db:
                accounts_after = db.execute(select(
                    User.id, User.tenant_id, User.username, User.password_hash,
                    User.role, User.active, User.name,
                    User.can_create_clients, User.can_create_cases,
                ).order_by(User.id)).all()
                if accounts_before != accounts_after:
                    raise RuntimeError("La comprobación de cuentas no coincide.")
                db.add(Audit(
                    tenant_id=args.tenant_id, user_id=args.admin_id,
                    resource="lexio_cases", resource_id=0,
                    action="simplificar datos de prueba",
                    changes=json.dumps({"removed_test_rows": counts,
                        "modules": ["Ficha integral", "Bitácora", "Alertas", "Reportes"]},
                        ensure_ascii=False),
                ))
                db.commit()
            print("Esquema simplificado aplicado. Cuentas y contraseñas verificadas sin cambios.")
    except (ValueError, RuntimeError) as error:
        raise SystemExit(str(error)) from None
    except Exception as error:
        # Connection exceptions can contain URLs or query values; never print them.
        raise SystemExit(f"No se completó la actualización ({type(error).__name__}). Revisa el esquema antes de reintentar.") from None
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
