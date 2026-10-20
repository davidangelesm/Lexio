from datetime import date

import domain as d
import models as m
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from sync_event_due_dates import synchronize
from test_event_installments import entry_data, event_case
from test_integral_flow import abono, create


def linked(setup, **changes):
    client, headers, ids, _ = setup
    case = event_case(setup, team_member_id=ids[1])
    quota_id = case["installments"][1]["id"]
    response = client.post(f"/cases/{case['id']}/entries", headers=headers[0],
        json=entry_data(alert_date="2026-10-22", payment_installment_id=quota_id, **changes))
    assert response.status_code == 201, response.text
    return case, quota_id, response.json()


@pytest.mark.parametrize("current,anticipation", [
    (date(2026, 10, 15), 5), (date(2026, 10, 19), 3),
    (date(2026, 10, 21), 1), (date(2026, 10, 22), 0),
])
def test_event_and_collection_share_deadline_and_anticipations(setup, monkeypatch, current, anticipation):
    client, headers, _, _ = setup
    case, quota_id, entry = linked(setup)
    monkeypatch.setattr(d, "today", lambda: current)
    notices = client.get("/alerts", headers=headers[0]).json()
    assert {x["kind"] for x in notices} == {"legal", "pago"}
    assert all(x["target_date"] == "2026-10-22" and x["anticipation"] == anticipation for x in notices)
    assert not entry["attended"]
    payments = client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"]
    assert next(x for x in payments if x["id"] == quota_id)["due_date"] == "2026-10-22"
    assert {x["kind"] for x in client.get("/alerts", headers=headers[1]).json()} == {"legal"}


def test_reprogram_remove_and_restore_sync_paid_quota_without_reviving_text_edits(setup, monkeypatch):
    client, headers, _, engine = setup
    case, quota_id, entry = linked(setup)
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 19))
    notices = client.get("/alerts", headers=headers[0]).json()
    assert len(notices) == 2
    for notice in notices:
        assert client.post(f"/alerts/{notice['id']}/read", headers=headers[0]).status_code == 200
    path = f"/entries/{entry['id']}"
    assert client.put(path, headers=headers[1], json=entry_data(alert_date="2026-10-22", description="Corrección")).status_code == 200
    assert client.get("/alerts", headers=headers[0]).json() == []
    assert abono(client, headers[0], case, "100.00", installment_id=quota_id).status_code == 201
    for target in ("2026-10-23", None, "2026-10-22"):
        response = client.put(path, headers=headers[1], json=entry_data(alert_date=target))
        assert response.status_code == 200, response.text
        assert "payment_installment_id" not in response.json()
        result = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
        quota = next(x for x in result["installments"] if x["id"] == quota_id)
        assert quota["due_date"] == target and quota["paid"] == "100.00"
        notices = client.get("/alerts", headers=headers[0]).json()
        assert all(x["target_date"] == target for x in notices)
        if target is None:
            assert notices == [] and quota["activated_at"] is None
    assert {x["kind"] for x in notices} == {"legal", "pago"}
    assert client.post(path + "/attend", headers=headers[1]).status_code == 200
    assert {x["kind"] for x in client.get("/alerts", headers=headers[0]).json()} == {"pago"}
    with Session(engine) as db:
        assert db.get(m.Installment, quota_id).due_date == date(2026, 10, 22)


def test_unlink_clears_due_date_and_no_alert_does_not_activate_on_attendance(setup):
    client, headers, _, _ = setup
    case, quota_id, entry = linked(setup)
    path = f"/entries/{entry['id']}"
    assert client.put(path, headers=headers[0], json=entry_data(payment_installment_id=None)).status_code == 200
    quota = client.get(f"/cases/{case['id']}", headers=headers[0]).json()["installments"][1]
    assert quota["due_date"] is None and quota["entry_id"] is None
    assert client.put(path, headers=headers[0], json=entry_data(alert_date=None, payment_installment_id=quota_id)).status_code == 200
    assert client.post(path + "/attend", headers=headers[0]).status_code == 200
    quota = client.get(f"/cases/{case['id']}", headers=headers[0]).json()["installments"][1]
    assert quota["due_date"] is None and quota["activated_at"] is None
    assert client.get("/alerts", headers=headers[0]).json() == []


def test_backfill_is_tenant_scoped_audited_and_idempotent(setup):
    client, headers, ids, engine = setup
    case, quota_id, entry = linked(setup)
    with Session(engine) as db:
        quota = db.get(m.Installment, quota_id)
        quota.due_date = None
        quota.activated_at = None
        db.commit()
        assert synchronize(db, db.get(m.User, ids[2])) == 0
        user = db.get(m.User, ids[0])
        assert synchronize(db, user) == 1
        assert synchronize(db, user) == 0
        assert db.get(m.Installment, quota_id).due_date == date(2026, 10, 22)
        assert list(db.scalars(select(m.Audit).where(m.Audit.resource_id == quota_id,
            m.Audit.action == "Sincronizar vencimiento de cuota")))
        db.rollback()
        assert db.get(m.Installment, quota_id).due_date is None


def test_two_event_quotas_follow_their_own_entries_and_payment_only_clears_collection(setup, monkeypatch):
    client, headers, _, _ = setup
    case = create(setup, installments=[
        {"amount": "500.00", "event_name": "Audiencia"},
        {"amount": "500.00", "event_name": "Sentencia"},
    ])
    for quota, target in zip(case["installments"], ("2026-10-22", "2026-10-23")):
        response = client.post(f"/cases/{case['id']}/entries", headers=headers[0],
            json=entry_data(alert_date=target, payment_installment_id=quota["id"]))
        assert response.status_code == 201
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 21))
    notices = client.get("/alerts", headers=headers[0]).json()
    assert len(notices) == 4
    assert {x["target_date"] for x in notices if x["kind"] == "pago"} == {"2026-10-22", "2026-10-23"}
    assert abono(client, headers[0], case, "500.00").status_code == 201
    notices = client.get("/alerts", headers=headers[0]).json()
    assert len(notices) == 3
    assert [x["target_date"] for x in notices if x["kind"] == "pago"] == ["2026-10-23"]
    assert len([x for x in notices if x["kind"] == "legal"]) == 2
