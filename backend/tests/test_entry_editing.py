import json
from datetime import date

import domain as d
import models as m
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from test_integral_flow import create


def entry_data(**changes):
    return {"action_date": "2026-10-08", "description": "Presentar escrito", "alert_date": "2026-10-15", **changes}


def new_entry(setup, **changes):
    client, headers, ids, _ = setup
    case = create(setup, responsible_id=ids[1])
    response = client.post(f"/cases/{case['id']}/entries", headers=headers[1], json=entry_data(**changes))
    assert response.status_code == 201, response.text
    return case, response.json()


def legal_alerts(client, headers):
    return [x for x in client.get("/alerts", headers=headers).json() if x["kind"] == "legal"]


def test_edit_three_entry_fields_preserves_creation_and_audits_editor(setup):
    client, headers, ids, engine = setup
    case, entry = new_entry(setup)
    corrected = entry_data(action_date="2026-10-07", description="Presentar escrito corregido", alert_date="2026-10-16")
    response = client.put(f"/entries/{entry['id']}", headers=headers[0], json=corrected)
    assert response.status_code == 200, response.text
    updated = response.json()
    assert {key: updated[key] for key in corrected} == corrected
    for key in ("id", "case_id", "registered_by", "created_at", "attended", "responsible_name"):
        assert updated[key] == entry[key]
    assert client.get(f"/cases/{case['id']}/entries", headers=headers[1]).json()[0] == updated
    with Session(engine) as db:
        audit = db.scalar(select(m.Audit).where(m.Audit.action == "Editar actuación"))
        assert audit.user_id == ids[0] and audit.resource_id == entry["id"]
        assert audit.resource == m.Entry.__tablename__
        changes = json.loads(audit.changes)
        assert changes["before"]["description"] == entry["description"]
        assert changes["after"]["description"] == corrected["description"]
        assert changes["before"]["registered_by"] == changes["after"]["registered_by"] == ids[1]
        assert changes["before"]["created_at"] == changes["after"]["created_at"]


@pytest.mark.parametrize("extra", [
    {"registered_by": 1}, {"created_at": "2026-10-01T00:00:00"},
    {"case_id": 100}, {"attended": True}, {"tenant_id": 2},
])
def test_entry_edit_rejects_immutable_fields(setup, extra):
    client, headers, _, _ = setup
    _, entry = new_entry(setup)
    response = client.put(f"/entries/{entry['id']}", headers=headers[0], json={**entry_data(), **extra})
    assert response.status_code == 422


def test_entry_edit_requires_auth_same_tenant_and_case_edit_access(setup):
    client, headers, ids, _ = setup
    case = create(setup)
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0], json=entry_data()).json()
    path = f"/entries/{entry['id']}"
    assert client.put(path, json=entry_data()).status_code == 401
    assert client.put(path, headers=headers[2], json=entry_data()).status_code == 404
    assert client.put(path, headers=headers[1], json=entry_data()).status_code == 404
    assert client.put("/entries/99999", headers=headers[0], json=entry_data()).status_code == 404
    client.post(f"/cases/{case['id']}/access", headers=headers[0], json={"user_id": ids[1], "level": "read"})
    assert client.put(path, headers=headers[1], json=entry_data()).status_code == 404
    client.post(f"/cases/{case['id']}/access", headers=headers[0], json={"user_id": ids[1], "level": "edit"})
    edited = client.put(path, headers=headers[1], json=entry_data(description="Corrección del abogado"))
    assert edited.status_code == 200
    assert edited.json()["registered_by"] == ids[0]


def test_edit_same_alert_date_preserves_read_and_updates_description(setup, monkeypatch):
    client, headers, _, engine = setup
    _, entry = new_entry(setup)
    admin_notice = legal_alerts(client, headers[0])[0]
    staff_notice = legal_alerts(client, headers[1])[0]
    client.post(f"/alerts/{admin_notice['id']}/read", headers=headers[0])
    with Session(engine) as db:
        original_read = db.get(m.Notice, admin_notice["id"]).read_at
    result = client.put(f"/entries/{entry['id']}", headers=headers[1], json=entry_data(action_date="2026-10-07", description="Nueva descripción"))
    assert result.status_code == 200
    assert legal_alerts(client, headers[0]) == []
    assert legal_alerts(client, headers[1])[0]["id"] == staff_notice["id"]
    assert legal_alerts(client, headers[1])[0]["description"] == "Nueva descripción"
    with Session(engine) as db:
        notice = db.get(m.Notice, admin_notice["id"])
        assert notice.status == "leido" and notice.read_at == original_read
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 12))
    next_notice = legal_alerts(client, headers[0])
    assert len(next_notice) == 1 and next_notice[0]["anticipation"] == 3
    assert next_notice[0]["description"] == "Nueva descripción"


def test_changed_removed_and_restored_alert_cancel_all_recipients(setup, monkeypatch):
    client, headers, _, engine = setup
    _, entry = new_entry(setup)
    path = f"/entries/{entry['id']}"
    admin_notice = legal_alerts(client, headers[0])[0]
    legal_alerts(client, headers[1])
    client.post(f"/alerts/{admin_notice['id']}/read", headers=headers[0])
    assert client.put(path, headers=headers[1], json=entry_data(alert_date="2026-10-16")).status_code == 200
    with Session(engine) as db:
        old = list(db.scalars(select(m.Notice).where(m.Notice.kind == "legal")))
        assert len(old) == 2 and all(x.status == "cancelado" for x in old)
    assert legal_alerts(client, headers[0]) == []
    assert legal_alerts(client, headers[1]) == []
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 9))
    assert legal_alerts(client, headers[0])[0]["target_date"] == "2026-10-16"
    legal_alerts(client, headers[1])
    assert client.put(path, headers=headers[1], json=entry_data(alert_date=None)).status_code == 200
    assert legal_alerts(client, headers[0]) == [] and legal_alerts(client, headers[1]) == []
    with Session(engine) as db:
        assert all(x.status == "cancelado" for x in db.scalars(select(m.Notice).where(m.Notice.kind == "legal")))
    assert client.put(path, headers=headers[1], json=entry_data()).status_code == 200
    for header in headers[:2]:
        restored = legal_alerts(client, header)
        assert len(restored) == 1 and restored[0]["target_date"] == "2026-10-15"
        assert restored[0]["anticipation"] == 5


def test_restored_deadline_uses_existing_reminders_on_weekend(setup, monkeypatch):
    client, headers, _, engine = setup
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 9))
    _, entry = new_entry(setup, alert_date="2026-10-13")
    path = f"/entries/{entry['id']}"
    original = legal_alerts(client, headers[0])[0]
    legal_alerts(client, headers[1])
    assert original["anticipation"] == 3
    client.post(f"/alerts/{original['id']}/read", headers=headers[0])
    assert client.put(path, headers=headers[1], json=entry_data(alert_date="2026-10-14")).status_code == 200
    legal_alerts(client, headers[0])
    with Session(engine) as db:
        count = len(list(db.scalars(select(m.Notice))))
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 10))
    assert client.put(path, headers=headers[1], json=entry_data(alert_date="2026-10-13")).status_code == 200
    restored = legal_alerts(client, headers[0])
    assert len(restored) == 1 and restored[0]["id"] == original["id"]
    assert restored[0]["anticipation"] == 3
    assert legal_alerts(client, headers[1])[0]["target_date"] == "2026-10-13"
    # Quitar y volver a añadir la misma fecha tampoco crea avisos durante el fin de semana.
    assert client.put(path, headers=headers[1], json=entry_data(alert_date=None)).status_code == 200
    assert legal_alerts(client, headers[0]) == []
    assert client.put(path, headers=headers[1], json=entry_data(alert_date="2026-10-13")).status_code == 200
    assert legal_alerts(client, headers[0])[0]["id"] == original["id"]
    with Session(engine) as db:
        assert len(list(db.scalars(select(m.Notice)))) == count


def test_editing_attended_entry_keeps_attended_and_never_restores_alerts(setup):
    client, headers, _, engine = setup
    _, entry = new_entry(setup)
    path = f"/entries/{entry['id']}"
    legal_alerts(client, headers[0])
    legal_alerts(client, headers[1])
    assert client.post(path + "/attend", headers=headers[1]).status_code == 200
    for alert_date in ("2026-10-09", None, "2026-10-15"):
        result = client.put(path, headers=headers[0], json=entry_data(description="Actuación ya atendida", alert_date=alert_date))
        assert result.status_code == 200 and result.json()["attended"] is True
        assert legal_alerts(client, headers[0]) == [] and legal_alerts(client, headers[1]) == []
    with Session(engine) as db:
        assert all(x.status == "cancelado" for x in db.scalars(select(m.Notice).where(m.Notice.kind == "legal")))
