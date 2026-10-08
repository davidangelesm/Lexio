from datetime import date

import domain as d
import models as m
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_acceptance import make_case, service


def task(setup):
    client, headers, ids, _ = setup
    _, case = make_case(setup)
    result = client.post(
        f"/cases/{case['id']}/tasks", headers=headers[0],
        json={"description": "Presentar escrito", "responsible_id": ids[0], "due_date": "2026-10-19"},
    )
    assert result.status_code == 201
    return case, result.json()


def test_three_reminders_read_then_urgent_then_attended(setup, monkeypatch):
    client, headers, _, engine = setup
    case, created = task(setup)
    assert client.get("/settings/notices", headers=headers[0]).json() == {"days": [5, 3, 1]}
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 11))
    assert client.get("/alerts", headers=headers[0]).json() == []
    for current, anticipation in [(date(2026, 10, 12), 5), (date(2026, 10, 14), 3), (date(2026, 10, 16), 1)]:
        monkeypatch.setattr(d, "today", lambda: current)
        notices = client.get("/alerts", headers=headers[0]).json()
        assert len(notices) == 1
        assert notices[0]["anticipation"] == anticipation
        assert notices[0]["can_attend"] is True
        assert client.post(f"/alerts/{notices[0]['id']}/read", headers=headers[0]).status_code == 200
        assert client.get("/alerts", headers=headers[0]).json() == []
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 19))
    due = client.get("/alerts", headers=headers[0]).json()[0]
    assert due["urgent"] is False
    assert due["label"] == "vence hoy"
    client.post(f"/alerts/{due['id']}/read", headers=headers[0])
    assert client.get("/alerts", headers=headers[0]).json() == []
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 20))
    urgent = client.get("/alerts", headers=headers[0]).json()
    assert len(urgent) == 1
    assert urgent[0]["urgent"] is True
    assert urgent[0]["id"] == due["id"]
    assert client.post(f"/alerts/{due['id']}/read", headers=headers[0]).status_code == 409
    assert client.post(f"/alerts/{due['id']}/attend", headers=headers[0]).status_code == 200
    assert client.get("/alerts", headers=headers[0]).json() == []
    assert client.get(f"/cases/{case['id']}/tasks", headers=headers[0]).json()[0]["status"] == "atendido"
    with Session(engine) as db:
        assert all(row.status == "cancelado" for row in db.scalars(select(m.Notice)))
        assert db.scalar(select(m.Audit.id).where(m.Audit.action == "atender tarea"))


def test_attend_permissions_and_removes_every_recipient(setup, monkeypatch):
    client, headers, ids, engine = setup
    case, created = task(setup)
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 19))
    with Session(engine) as db:
        db.add(m.Access(tenant_id=1, case_id=case["id"], user_id=ids[1], level="read"))
        db.commit()
    own = client.get("/alerts", headers=headers[0]).json()[0]
    staff = client.get("/alerts", headers=headers[1]).json()[0]
    assert staff["can_attend"] is False
    assert client.post(f"/alerts/{own['id']}/attend", headers=headers[2]).status_code == 404
    assert client.post(f"/alerts/{own['id']}/attend", headers=headers[1]).status_code == 404
    assert client.post(f"/alerts/{staff['id']}/attend", headers=headers[1]).status_code == 404
    with Session(engine) as db:
        grant = db.scalar(select(m.Access).where(m.Access.user_id == ids[1]))
        grant.level = "edit"
        db.commit()
    assert client.post(f"/alerts/{staff['id']}/attend", headers=headers[1]).status_code == 200
    assert client.get("/alerts", headers=headers[0]).json() == []
    assert client.get("/alerts", headers=headers[1]).json() == []
    assert client.post(f"/alerts/{staff['id']}/attend", headers=headers[1]).status_code == 200


def test_financial_alert_cannot_be_manually_attended(setup, monkeypatch):
    client, headers, _, _ = setup
    _, case = make_case(setup)
    service(setup, case, plan=[{"amount": "1000", "condition": "fecha", "due_date": "2026-10-19"}])
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 20))
    notice = client.get("/alerts", headers=headers[0]).json()[0]
    assert notice["kind"] == "pago"
    assert notice["can_attend"] is False
    assert client.post(f"/alerts/{notice['id']}/attend", headers=headers[0]).status_code == 404
    assert client.get("/alerts", headers=headers[0]).json()[0]["amount"] == "1000.00"


def test_three_notice_settings_validation(setup):
    client, headers, _, _ = setup
    assert client.put("/settings/notices", headers=headers[0], json={"days": [1, 5, 3]}).json() == {"days": [5, 3, 1]}
    for days in ([3, 1], [5, 5, 1], [61, 3, 1]):
        assert client.put("/settings/notices", headers=headers[0], json={"days": days}).status_code == 422


def test_stale_reminder_cannot_complete_rescheduled_task(setup, monkeypatch):
    client, headers, _, _ = setup
    case, created = task(setup)
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 19))
    notice = client.get("/alerts", headers=headers[0]).json()[0]
    data = {key: created[key] for key in ("description", "responsible_id", "due_date", "entry_id", "status")}
    data["due_date"] = "2026-11-19"
    assert client.put(f"/cases/{case['id']}/tasks/{created['id']}", headers=headers[0], json=data).status_code == 200
    assert client.post(f"/alerts/{notice['id']}/attend", headers=headers[0]).status_code == 409
