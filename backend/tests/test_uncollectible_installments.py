from datetime import date

import domain as d
import models as m
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_integral_flow import abono, create


def test_uncollectible_partial_quota_reduces_collectible_balance_and_preserves_history(setup):
    client, headers, _, engine = setup
    case = create(setup)
    quota_id = case["installments"][0]["id"]
    assert abono(client, headers[0], case, "100.00").status_code == 201
    client.get("/alerts", headers=headers[0])
    response = client.put(f"/installments/{quota_id}/collection", headers=headers[0], json={"reason": "Cliente no pagará"})
    assert response.status_code == 200, response.text
    current = response.json()
    assert current["balance"] == "500.00" and current["paid"] == "100.00"
    assert current["uncollectible"] == "400.00" and current["fee"] == "1000.00"
    quota = current["installments"][0]
    assert quota["state"] == "incobrable" and quota["uncollectible_at"]
    assert quota["due_date"] == "2026-10-15" and quota["paid"] == "100.00"
    assert {x["id"] for x in client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"]} == {case["installments"][1]["id"]}
    assert not client.get("/alerts", headers=headers[0]).json()
    assert client.get("/reports", headers=headers[0]).json()["totals"]["uncollectible"] == "400.00"
    assert client.get("/reports", headers=headers[0]).json()["totals"]["balance"] == "500.00"
    assert client.get("/dashboard", headers=headers[0]).json()["finance"]["balance"] == "500.00"
    assert abono(client, headers[0], case, "1.00", installment_id=quota_id).status_code == 422
    assert abono(client, headers[0], case, "500.01").status_code == 422
    assert abono(client, headers[0], case, "500.00").status_code == 201
    current = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    assert [q["paid"] for q in current["installments"]] == ["100.00", "500.00"]
    assert current["balance"] == "0.00" and current["uncollectible"] == "400.00"
    assert current["cancelled"] is False
    assert client.get("/reports", headers=headers[0]).json()["totals"]["balance"] == "0.00"
    assert client.get("/dashboard", headers=headers[0]).json()["finance"]["balance"] == "0.00"
    with Session(engine) as db:
        notices = list(db.scalars(select(m.Notice).where(m.Notice.source_key.startswith(f"payment:{quota_id}:"))))
        assert notices and all(x.status == "cancelado" for x in notices)
        assert len(list(db.scalars(select(m.Payment)))) == 2
        assert db.scalar(select(m.Audit).where(m.Audit.action == "Marcar cuota incobrable")) is not None


def test_restore_collection_reappears_as_urgent_and_allows_payment(setup, monkeypatch):
    client, headers, _, engine = setup
    case = create(setup)
    quota_id = case["installments"][0]["id"]
    client.get("/alerts", headers=headers[0])
    client.put(f"/installments/{quota_id}/collection", headers=headers[0], json={"reason": "Sin posibilidad de cobro"})
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 16))
    assert not any(x.get("description") == "Cuota 1" for x in client.get("/alerts", headers=headers[0]).json())
    current = client.put(f"/installments/{quota_id}/collection", headers=headers[0], json={"reason": None}).json()
    assert current["uncollectible"] == "0.00" and current["balance"] == "1000.00"
    assert client.get("/reports", headers=headers[0]).json()["totals"]["balance"] == "1000.00"
    assert client.get("/dashboard", headers=headers[0]).json()["finance"]["balance"] == "1000.00"
    assert current["installments"][0]["state"] == "vencido"
    assert current["installments"][0]["uncollectible_at"] is None
    assert any(x.get("description") == "Cuota 1" and x["urgent"] for x in client.get("/alerts", headers=headers[0]).json())
    assert abono(client, headers[0], case, "500.00", installment_id=quota_id).status_code == 201
    with Session(engine) as db:
        assert db.scalar(select(m.Audit).where(m.Audit.action == "Reactivar cobranza")) is not None


def test_collection_security_validation_and_protected_plan(setup):
    client, headers, ids, _ = setup
    case = create(setup, team_member_id=ids[1])
    quota_id = case["installments"][0]["id"]
    url = f"/installments/{quota_id}/collection"
    assert client.put(url, json={"reason": "Motivo"}).status_code == 401
    assert client.put(url, headers=headers[1], json={"reason": "Motivo"}).status_code == 403
    assert client.put(url, headers=headers[2], json={"reason": "Motivo"}).status_code == 404
    for payload in ({}, {"reason": "  "}, {"reason": "x" * 501}, {"reason": "Motivo", "tenant_id": 2}):
        assert client.put(url, headers=headers[0], json=payload).status_code == 422
    assert abono(client, headers[0], case, "500.00").status_code == 201
    assert client.put(url, headers=headers[0], json={"reason": "Motivo"}).status_code == 422
    second = case["installments"][1]["id"]
    client.put(f"/installments/{second}/collection", headers=headers[0], json={"reason": "Motivo"})
    plan = [{"id": x["id"], "amount": x["amount"], "due_date": x["due_date"]} for x in case["installments"]]
    plan[1]["due_date"] = "2026-10-25"
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"installments": plan}).status_code == 422
    hidden = {"uncollectible", "installments", "payments", "fee", "paid", "balance"}
    assert not hidden & client.get(f"/cases/{case['id']}", headers=headers[1]).json().keys()
    report = client.get("/reports", headers=headers[1]).json()
    assert "uncollectible" not in report["totals"] and "uncollectible" not in report["rows"][0]
    assert client.get("/reports", headers=headers[2]).json()["totals"]["uncollectible"] == "0.00"


def test_uncollectible_event_keeps_scheduled_date_without_collection_notice(setup):
    client, headers, ids, _ = setup
    case = create(setup, team_member_id=ids[1], installments=[{"amount": "1000.00", "event_name": "Sentencia"}])
    quota_id = case["installments"][0]["id"]
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={
        "action_date": "2026-10-08", "subject": "Sentencia", "description": "Hito", "payment_installment_id": quota_id,
        "alert_date": "2026-10-22",
    }).json()
    client.put(f"/installments/{quota_id}/collection", headers=headers[0], json={"reason": "Cliente insolvente"})
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[1]).status_code == 200
    current = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    assert current["installments"][0]["activated_at"] and current["installments"][0]["state"] == "incobrable"
    assert current["installments"][0]["due_date"] == "2026-10-22"
    assert client.get("/alerts", headers=headers[0]).json() == []
    assert client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"] == []
    assert current["balance"] == "0.00" and current["uncollectible"] == "1000.00"


def test_payment_correction_on_uncollectible_quota_does_not_reintroduce_collectible_debt(setup):
    client, headers, _, _ = setup
    case = create(setup)
    payment = abono(client, headers[0], case, "100.00").json()
    quota_id = case["installments"][0]["id"]
    client.put(f"/installments/{quota_id}/collection", headers=headers[0], json={"reason": "Insolvencia"})
    assert client.delete(f"/payments/{payment['id']}", headers=headers[0]).status_code == 200
    current = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    assert current["balance"] == "500.00" and current["uncollectible"] == "500.00"
    assert current["paid"] == "0.00" and current["fee"] == "1000.00"
    report = client.get("/reports", headers=headers[0]).json()
    assert report["rows"][0]["balance"] == "500.00" and report["totals"]["balance"] == "500.00"
    current = client.put(f"/installments/{quota_id}/collection", headers=headers[0], json={"reason": None}).json()
    assert current["balance"] == "1000.00" and current["uncollectible"] == "0.00"


def test_batch_collection_marks_and_restores_selected_quotas(setup):
    client, headers, _, engine = setup
    case = create(setup)
    assert abono(client, headers[0], case, "100.00").status_code == 201
    ids = [x["id"] for x in case["installments"]]
    url = f"/cases/{case['id']}/collection"
    client.get("/alerts", headers=headers[0])
    response = client.put(url, headers=headers[0], json={"installment_ids": ids, "reason": "Cliente insolvente"})
    assert response.status_code == 200, response.text
    current = response.json()
    assert current["balance"] == "0.00" and current["uncollectible"] == "900.00"
    assert current["paid"] == "100.00" and current["fee"] == "1000.00"
    assert all(x["state"] == "incobrable" for x in current["installments"])
    assert client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"] == []
    current = client.put(url, headers=headers[0], json={"installment_ids": [ids[0]], "reason": None}).json()
    assert current["balance"] == "400.00" and current["uncollectible"] == "500.00"
    assert current["installments"][0]["state"] != "incobrable"
    assert current["installments"][1]["state"] == "incobrable"
    with Session(engine) as db:
        assert len(list(db.scalars(select(m.Audit).where(m.Audit.action == "Marcar cuota incobrable")))) == 2
        assert len(list(db.scalars(select(m.Audit).where(m.Audit.action == "Reactivar cobranza")))) == 1


def test_batch_collection_is_atomic_and_rejects_foreign_paid_or_invalid_quotas(setup):
    client, headers, _, engine = setup
    case = create(setup)
    second_case = create(setup, document="88888888")
    ids = [x["id"] for x in case["installments"]]
    url = f"/cases/{case['id']}/collection"
    payload = {"installment_ids": ids, "reason": "Motivo"}
    assert client.put(url, json=payload).status_code == 401
    assert client.put(url, headers=headers[1], json=payload).status_code == 403
    assert client.put(url, headers=headers[2], json=payload).status_code == 404
    for selected, status in (([], 422), ([ids[0], ids[0]], 422), ([ids[0], 99999], 404), ([ids[0], second_case["installments"][0]["id"]], 404)):
        assert client.put(url, headers=headers[0], json={**payload, "installment_ids": selected}).status_code == status
        assert client.get(f"/cases/{case['id']}", headers=headers[0]).json()["uncollectible"] == "0.00"
    assert abono(client, headers[0], case, "500.00", installment_id=ids[1]).status_code == 201
    assert client.put(url, headers=headers[0], json=payload).status_code == 422
    assert client.get(f"/cases/{case['id']}", headers=headers[0]).json()["uncollectible"] == "0.00"
    with Session(engine) as db:
        assert db.scalar(select(m.Audit).where(m.Audit.action == "Marcar cuota incobrable")) is None
