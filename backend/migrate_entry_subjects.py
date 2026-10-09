"""Add entry subjects explicitly; preview by default, never on API startup.

MySQL DDL commits implicitly. A retry completes missing columns, backfill and
constraints without deleting records or replacing already populated subjects.
"""

import argparse

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

from database import build_engine


TABLE = "lexio_entries"
CHECK = "ck_entry_subject_type"


def migrate(connection: Connection, *, apply: bool = False) -> None:
    if connection.dialect.name != "mysql":
        raise ValueError("Esta migración requiere MySQL; no se modificó el esquema.")
    inspector = inspect(connection)
    if TABLE not in inspector.get_table_names():
        raise ValueError("Falta lexio_entries; no se modificó el esquema.")
    columns = {column["name"]: column for column in inspector.get_columns(TABLE)}
    if not {"tenant_id", "description"} <= columns.keys():
        raise ValueError("La bitácora no tiene el esquema esperado; no se modificó.")
    subject = columns.get("subject")
    subject_type = columns.get("subject_type")
    if subject and getattr(subject["type"], "length", None) != 150:
        raise ValueError("subject existente no es VARCHAR(150); revisa el esquema antes de migrar.")
    total = connection.scalar(text("SELECT COUNT(*) FROM lexio_entries")) or 0
    subjects_to_fill = total if subject is None else connection.scalar(text(
        "SELECT COUNT(*) FROM lexio_entries WHERE subject IS NULL OR TRIM(subject) = ''"
    )) or 0
    types_to_fill = 0
    if subject_type is not None:
        invalid_types = connection.scalar(text(
            "SELECT COUNT(*) FROM lexio_entries "
            "WHERE subject_type IS NOT NULL AND TRIM(subject_type) <> '' "
            "AND subject_type NOT IN ('legal', 'otro')"
        )) or 0
        if invalid_types:
            raise ValueError("Hay tipos de asunto distintos de legal/otro; revisa esos datos antes de migrar.")
        types_to_fill = connection.scalar(text(
            "SELECT COUNT(*) FROM lexio_entries WHERE subject_type IS NULL OR TRIM(subject_type) = ''"
        )) or 0
    checks = {check["name"] for check in inspector.get_check_constraints(TABLE)}
    tighten_subject = subject is None or subject["nullable"]
    default_type = None if subject_type is None else str(subject_type.get("default", "")).strip("'")
    normalize_type = subject_type is not None and (
        subject_type["nullable"]
        or getattr(subject_type["type"], "length", None) != 20
        or default_type != "legal"
    )
    pending = (
        subject is None or subject_type is None or subjects_to_fill or types_to_fill
        or tighten_subject or normalize_type or CHECK not in checks
    )
    if not pending:
        print("Asunto y tipo de asunto ya están migrados. No se modificó ningún dato.")
        return
    print("Migración aditiva global de lexio_entries para todos los estudios.")
    print(f"Registros existentes: {total}; asuntos por completar: {subjects_to_fill}.")
    print("Conservar descripciones, actuaciones, cuentas y relaciones; no se elimina ningún registro.")
    print("Resultado: subject VARCHAR(150) NOT NULL; subject_type VARCHAR(20) NOT NULL DEFAULT 'legal'.")
    if not apply:
        print("Vista previa. Revisión humana y --apply son necesarios para ejecutar.")
        return

    connection.commit()
    if subject is None:
        connection.execute(text("ALTER TABLE lexio_entries ADD COLUMN subject VARCHAR(150) NULL"))
        connection.commit()
    if subject_type is None:
        connection.execute(text(
            "ALTER TABLE lexio_entries ADD COLUMN subject_type VARCHAR(20) NOT NULL DEFAULT 'legal'"
        ))
        connection.commit()
    if subjects_to_fill:
        connection.execute(text(
            "UPDATE lexio_entries SET subject = "
            "COALESCE(NULLIF(LEFT(TRIM(description), 150), ''), 'Actuación registrada') "
            "WHERE subject IS NULL OR TRIM(subject) = ''"
        ))
    if types_to_fill:
        connection.execute(text(
            "UPDATE lexio_entries SET subject_type = 'legal' "
            "WHERE subject_type IS NULL OR TRIM(subject_type) = ''"
        ))
    connection.commit()
    if tighten_subject:
        connection.execute(text("ALTER TABLE lexio_entries MODIFY COLUMN subject VARCHAR(150) NOT NULL"))
        connection.commit()
    if normalize_type:
        connection.execute(text(
            "ALTER TABLE lexio_entries MODIFY COLUMN subject_type VARCHAR(20) NOT NULL DEFAULT 'legal'"
        ))
        connection.commit()
    if CHECK not in checks:
        connection.execute(text(
            "ALTER TABLE lexio_entries ADD CONSTRAINT ck_entry_subject_type "
            "CHECK (subject_type IN ('legal', 'otro'))"
        ))
        connection.commit()
    print("Migración aplicada. Descripciones conservadas; asuntos vacíos completados y tipos validados.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Añadir asunto y tipo a la bitácora de Lexio")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    engine = None
    try:
        engine = build_engine()
        with engine.connect() as connection:
            migrate(connection, apply=args.apply)
    except (ValueError, RuntimeError) as error:
        raise SystemExit(str(error)) from None
    except Exception as error:
        # Connection errors may include URLs or credentials; never print them.
        raise SystemExit(
            f"No se completó la migración ({type(error).__name__}). "
            "Revisa el esquema; el DDL previo puede haberse aplicado. Puedes reintentar."
        ) from None
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
