from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy import String

import migrate_entry_subjects as migration


def connection_for(monkeypatch, *, columns=None, checks=(), counts=(2,)):
    connection = Mock()
    connection.dialect = SimpleNamespace(name="mysql")
    connection.scalar.side_effect = counts
    inspector = Mock()
    inspector.get_table_names.return_value = ["lexio_entries"]
    inspector.get_columns.return_value = [
        {"name": "tenant_id"}, {"name": "description"}, *(columns or []),
    ]
    inspector.get_check_constraints.return_value = [{"name": name} for name in checks]
    monkeypatch.setattr(migration, "inspect", lambda _: inspector)
    return connection


def subject_columns(*, nullable=False, default="'legal'", length=150):
    return [
        {"name": "subject", "type": String(length), "nullable": nullable},
        {"name": "subject_type", "type": String(20), "nullable": nullable, "default": default},
    ]


def statements(connection):
    return [str(call.args[0]) for call in connection.execute.call_args_list]


def test_preview_does_not_write(monkeypatch, capsys):
    connection = connection_for(monkeypatch)
    migration.migrate(connection)
    connection.execute.assert_not_called()
    connection.commit.assert_not_called()
    assert "Vista previa" in capsys.readouterr().out


def test_additive_migration_backfills_before_not_null(monkeypatch):
    connection = connection_for(monkeypatch)
    migration.migrate(connection, apply=True)
    sql = statements(connection)
    assert sql[0] == "ALTER TABLE lexio_entries ADD COLUMN subject VARCHAR(150) NULL"
    assert "ADD COLUMN subject_type VARCHAR(20) NOT NULL DEFAULT 'legal'" in sql[1]
    assert "LEFT(TRIM(description), 150)" in sql[2]
    assert "Actuación registrada" in sql[2]
    assert "WHERE subject IS NULL OR TRIM(subject) = ''" in sql[2]
    assert "MODIFY COLUMN subject VARCHAR(150) NOT NULL" in sql[3]
    assert "CHECK (subject_type IN ('legal', 'otro'))" in sql[4]
    assert all("DROP " not in statement and "DELETE " not in statement for statement in sql)


def test_partial_migration_resumes_without_readding_columns(monkeypatch):
    connection = connection_for(
        monkeypatch, columns=subject_columns(nullable=True, default=None),
        counts=(2, 1, 0, 1),
    )
    migration.migrate(connection, apply=True)
    sql = statements(connection)
    assert not any("ADD COLUMN" in statement for statement in sql)
    assert sql[0].startswith("UPDATE lexio_entries SET subject =")
    assert sql[1].startswith("UPDATE lexio_entries SET subject_type = 'legal'")
    assert "WHERE subject_type IS NULL OR TRIM(subject_type) = ''" in sql[1]
    assert "MODIFY COLUMN subject VARCHAR(150) NOT NULL" in sql[2]
    assert "MODIFY COLUMN subject_type VARCHAR(20) NOT NULL DEFAULT 'legal'" in sql[3]


def test_completed_migration_is_noop(monkeypatch, capsys):
    connection = connection_for(
        monkeypatch, columns=subject_columns(), checks=(migration.CHECK,), counts=(2, 0, 0, 0),
    )
    migration.migrate(connection, apply=True)
    connection.execute.assert_not_called()
    connection.commit.assert_not_called()
    assert "ya están migrados" in capsys.readouterr().out


def test_invalid_existing_type_stops_before_changes(monkeypatch):
    connection = connection_for(monkeypatch, columns=subject_columns(), counts=(2, 0, 1))
    with pytest.raises(ValueError, match="distintos de legal/otro"):
        migration.migrate(connection, apply=True)
    connection.execute.assert_not_called()
    connection.commit.assert_not_called()


def test_unexpected_subject_length_stops_before_changes(monkeypatch):
    connection = connection_for(monkeypatch, columns=subject_columns(length=100))
    with pytest.raises(ValueError, match="VARCHAR\\(150\\)"):
        migration.migrate(connection, apply=True)
    connection.execute.assert_not_called()
    connection.commit.assert_not_called()
