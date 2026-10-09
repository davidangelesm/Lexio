from datetime import date

import domain as d
import models as m
import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from schemas import EntryIn
from test_entry_editing import entry_data
from test_integral_flow import create


@pytest.mark.parametrize("changes", [
    {"subject": ""}, {"subject": "   "}, {"subject": "a" * 151},
    {"description": "   "}, {"subject_type": "pago"}, {"subject_type": None},
])
def test_entry_subject_description_and_type_validation(changes):
    with pytest.raises(ValidationError):
        EntryIn(**entry_data(**changes))


def test_entry_requires_short_subject_and_defaults_to_legal():
    data = entry_data(subject="  Presentar escrito  ", description="  Detalle del escrito  ")
    parsed = EntryIn(**data)
    assert parsed.subject == "Presentar escrito" and parsed.description == "Detalle del escrito"
    assert parsed.subject_type == "legal"
    del data["subject"]
    with pytest.raises(ValidationError):
        EntryIn(**data)


def entry_alerts(client, header):
    return [x for x in client.get("/alerts", headers=header).json() if x["kind"] != "pago"]


def test_alert_identifies_case_and_responsible_while_bitacora_keeps_author(setup):
    client, headers, ids, _ = setup
    case = create(setup, responsible_id=ids[1])
    data = entry_data(subject="Presentar apelación", description="Adjuntar fundamentos y medios de prueba.")
    response = client.post(f"/cases/{case['id']}/entries", headers=headers[0], json=data)
    assert response.status_code == 201, response.text
    entry = response.json()
    assert entry["subject"] == data["subject"] and entry["description"] == data["description"]
    assert entry["subject_type"] == "legal" and entry["registered_by"] == ids[0]
    assert entry["responsible_name"] == "David"
    alert = entry_alerts(client, headers[1])[0]
    assert alert["subject"] == data["subject"] and alert["responsible_name"] == "Abogado"
    assert alert["case_code"] == case["code"] and alert["process_type"] == case["process_type"]
    assert alert["client_code"] == case["client"]["code"] and alert["client_name"] == case["client"]["name"]
    assert "balance" not in alert and "tenant_id" not in alert


def test_other_alert_read_next_reminder_urgent_and_attend(setup, monkeypatch):
    client, headers, ids, engine = setup
    case = create(setup, responsible_id=ids[1])
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[1],
        json=entry_data(subject="Enviar documentos", subject_type="otro")).json()
    assert entry["can_attend"] is True
    for when, anticipation in [(date(2026, 10, 8), 5), (date(2026, 10, 12), 3),
            (date(2026, 10, 14), 1), (date(2026, 10, 15), 0)]:
        monkeypatch.setattr(d, "today", lambda when=when: when)
        notices = entry_alerts(client, headers[1])
        assert len(notices) == 1 and notices[0]["kind"] == "otro"
        assert notices[0]["anticipation"] == anticipation and notices[0]["target_date"] == "2026-10-15"
        assert client.post(f"/alerts/{notices[0]['id']}/read", headers=headers[1]).status_code == 200
        assert entry_alerts(client, headers[1]) == []
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 17))
    notice = entry_alerts(client, headers[1])[0]
    assert notice["urgent"] and notice["can_attend"]
    assert client.post(f"/alerts/{notice['id']}/read", headers=headers[1]).status_code == 200
    assert entry_alerts(client, headers[1])[0]["id"] == notice["id"]
    response = client.post(f"/entries/{entry['id']}/attend", headers=headers[1])
    assert response.status_code == 200 and response.json()["attended"] is True
    assert response.json()["can_attend"] is False
    assert entry_alerts(client, headers[1]) == [] and entry_alerts(client, headers[0]) == []
    with Session(engine) as db:
        notices = list(db.scalars(select(m.Notice).where(m.Notice.kind == "otro")))
        assert len(notices) == 4 and all(x.status == "cancelado" for x in notices)


def test_subject_and_type_edits_preserve_read_notices_and_next_reminder(setup, monkeypatch):
    client, headers, ids, engine = setup
    case = create(setup, responsible_id=ids[1])
    original = client.post(f"/cases/{case['id']}/entries", headers=headers[1], json=entry_data()).json()
    admin_notice = entry_alerts(client, headers[0])[0]
    staff_notice = entry_alerts(client, headers[1])[0]
    client.post(f"/alerts/{admin_notice['id']}/read", headers=headers[0])
    with Session(engine) as db:
        original_read = db.get(m.Notice, admin_notice["id"]).read_at
    corrected = entry_data(subject="Enviar documentos", subject_type="otro", description="Descripción detallada corregida")
    updated = client.put(f"/entries/{original['id']}", headers=headers[0], json=corrected).json()
    for key in ("registered_by", "created_at", "attended"):
        assert updated[key] == original[key]
    assert entry_alerts(client, headers[0]) == []
    visible = entry_alerts(client, headers[1])
    assert len(visible) == 1 and visible[0]["id"] == staff_notice["id"]
    assert visible[0]["kind"] == "otro" and visible[0]["subject"] == corrected["subject"]
    with Session(engine) as db:
        notices = list(db.scalars(select(m.Notice)))
        entry_notices = [x for x in notices if x.source_key.startswith(f"legal:{original['id']}:")]
        assert len(entry_notices) == 2
        notice = db.get(m.Notice, admin_notice["id"])
        assert notice.status == "leido" and notice.read_at == original_read
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 12))
    next_notice = entry_alerts(client, headers[0])[0]
    assert next_notice["kind"] == "otro" and next_notice["anticipation"] == 3
    assert next_notice["subject"] == corrected["subject"]


def test_other_alert_tenant_case_and_recipient_isolation(setup):
    client, headers, ids, _ = setup
    case = create(setup)
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0],
        json=entry_data(subject_type="otro")).json()
    assert entry_alerts(client, headers[1]) == [] and entry_alerts(client, headers[2]) == []
    assert client.get(f"/cases/{case['id']}/entries", headers=headers[2]).status_code == 404
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[2]).status_code == 404
    client.post(f"/cases/{case['id']}/access", headers=headers[0], json={"user_id": ids[1], "level": "read"})
    staff_notice = entry_alerts(client, headers[1])[0]
    assert staff_notice["kind"] == "otro" and not staff_notice["can_attend"]
    assert not client.get(f"/cases/{case['id']}/entries", headers=headers[1]).json()[0]["can_attend"]
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[1]).status_code == 404
    assert client.post(f"/alerts/{staff_notice['id']}/read", headers=headers[0]).status_code == 404
    assert client.post(f"/alerts/{staff_notice['id']}/read", headers=headers[2]).status_code == 404
    assert client.post(f"/alerts/{staff_notice['id']}/read", headers=headers[1]).status_code == 200
    client.delete(f"/cases/{case['id']}/access/{ids[1]}", headers=headers[0])
    assert entry_alerts(client, headers[1]) == []
    assert client.get(f"/cases/{case['id']}/entries", headers=headers[1]).status_code == 404


@pytest.mark.parametrize("subject_type", ["legal", "otro"])
def test_entry_without_alert_cannot_be_attended(setup, subject_type):
    client, headers, _, _ = setup
    case = create(setup)
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0],
        json=entry_data(subject_type=subject_type, alert_date=None)).json()
    assert not entry["can_attend"]
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[0]).status_code == 422
