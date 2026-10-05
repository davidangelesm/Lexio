"""Generate reviewable MySQL DDL without connecting to any database."""

from pathlib import Path

import models  # noqa: F401
from sqlalchemy.dialects import mysql
from sqlalchemy.schema import CreateIndex, CreateTable

from database import Base


def export() -> Path:
    dialect = mysql.dialect()
    lines = [
        "-- Lexio: esquema inicial MySQL 8.0.16+ / InnoDB.",
        "-- Selecciona en HeidiSQL la base de datos de Railway antes de ejecutar.",
        "-- Esquema completo: crea las 15 tablas de Lexio desde cero, incluida clientes (lexio_clients).",
        "-- Ejecutar una sola vez en la base vacía seleccionada. No requiere tablas anteriores.",
        "-- DDL MySQL hace COMMIT implícito: no es reversible mediante ROLLBACK.",
        "SET NAMES utf8mb4;",
    ]
    for table in Base.metadata.sorted_tables:
        table.dialect_options["mysql"]["engine"] = "InnoDB"
        table.dialect_options["mysql"]["charset"] = "utf8mb4"
        table.dialect_options["mysql"]["collate"] = "utf8mb4_unicode_ci"
        lines.append(str(CreateTable(table).compile(dialect=dialect)).strip() + ";")
        for index in sorted(table.indexes, key=lambda x: x.name or ""):
            lines.append(str(CreateIndex(index).compile(dialect=dialect)) + ";")
    output = Path(__file__).parent.parent / "database" / "001_lexio_schema.sql"
    output.parent.mkdir(exist_ok=True)
    output.write_text("\n\n".join(lines) + "\n", encoding="utf-8")
    return output


if __name__ == "__main__":
    print(export())
