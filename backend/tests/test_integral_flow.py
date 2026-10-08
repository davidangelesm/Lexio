from datetime import date

import domain as d
import models as m
from sqlalchemy import select
from sqlalchemy.orm import Session


def ficha(document="12345678", **changes):
    return {
        "client": {"document_type": "DNI", "document_number": document, "name": "María Torres", "phone": "999555111", "email": "maria@test.pe", "address": "Lima"},
        "area": "Civil", "process_type": "Cobro de deuda", "initial_stage": "Demanda",
        "fee": "1000.00", "installments": [
            {"amount": "500.00", "due_date": "2026-10-15"},
            {"amount": "500.00", "due_date": "2026-10-20"},
        ], **changes,
    }


def create(setup, **changes):
    client, headers, _, _ = setup
    result = client.post("/cases", headers=headers[0], json=ficha(**changes))
    assert result.status_code == 201, result.text
    return result.json()


def abono(client, header, case, amount, **changes):
    return client.post(f"/cases/{case['id']}/payments", headers=header,
        json={"payment_date": "2026-10-08", "amount": amount, "method": "Efectivo", **changes})


def test_ficha_bitacora_alertas_abonos_reportes(setup):
    client, headers, ids, _ = setup
    case = create(setup, responsible_id=ids[1])
    assert case["client"]["code"] == "CL-000001"
    assert case["initial_stage"] == "Demanda"
    assert case["paid"] == "0.00" and case["balance"] == "1000.00"
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[1],
        json={"action_date": "2026-10-07", "description": "Presentar escrito", "alert_date": "2026-10-15"})
    assert entry.status_code == 201
    entry = entry.json()
    assert entry["registered_by"] == ids[1] and entry["responsible_name"] == "Abogado"
    assert entry["client_code"] == case["client"]["code"] and entry["created_at"]
    assert client.get("/entries", headers=headers[1]).json()[0]["id"] == entry["id"]
    notices = client.get("/alerts", headers=headers[0]).json()
    assert {x["kind"] for x in notices} == {"legal", "pago"}
    assert all(x["anticipation"] == 5 and x["notice_date"] == "2026-10-08" for x in notices)
    assert abono(client, headers[0], case, "400.00").status_code == 201
    updated = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    assert [x["balance"] for x in updated["installments"]] == ["100.00", "500.00"]
    assert abono(client, headers[0], case, "300.00").status_code == 201
    updated = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    assert [x["paid"] for x in updated["installments"]] == ["500.00", "200.00"]
    report = client.get("/reports", headers=headers[0]).json()
    assert report["totals"] == {"total_cases": 1, "active_cases": 1, "concluded_cases": 0, "fee": "1000.00", "paid": "700.00", "balance": "300.00"}
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"status": "concluido"}).status_code == 200
    assert client.get("/reports", headers=headers[0]).json()["rows"][0]["concluded_cases"] == 1
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[1]).status_code == 200
    assert not any(x["kind"] == "legal" for x in client.get("/alerts", headers=headers[0]).json())
    assert not client.get("/alerts", headers=headers[1]).json()
    assert abono(client, headers[0], case, "300.00").status_code == 201
    assert client.get(f"/cases/{case['id']}", headers=headers[0]).json()["cancelled"] is True
    assert client.get("/reports", headers=headers[0]).json()["totals"]["balance"] == "0.00"


def test_manual_first_installment_overflow_and_overpayment_atomicity(setup):
    client, headers, _, engine = setup
    case = create(setup)
    second = case["installments"][1]["id"]
    assert abono(client, headers[0], case, "650.00", installment_id=second).status_code == 201
    current = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    assert [x["paid"] for x in current["installments"]] == ["150.00", "500.00"]
    assert abono(client, headers[0], case, "350.01").status_code == 422
    assert abono(client, headers[0], case, "10.00", installment_id=99999).status_code == 422
    assert abono(client, headers[0], case, "10.00", installment_id=second).status_code == 422
    with Session(engine) as db:
        assert len(list(db.scalars(select(m.Payment)))) == 1
    assert abono(client, headers[0], case, "350.00").status_code == 201


def test_payment_correction_and_dates_keep_plan_identity(setup, monkeypatch):
    client, headers, _, _ = setup
    case = create(setup)
    payment = abono(client, headers[0], case, "500.00").json()
    plan = [{"id": x["id"], "amount": x["amount"], "due_date": x["due_date"]} for x in case["installments"]]
    plan[0]["due_date"] = "2026-10-16"
    response = client.put(f"/cases/{case['id']}", headers=headers[0], json={"installments": plan})
    assert response.status_code == 200, response.text
    assert response.json()["installments"][0]["id"] == case["installments"][0]["id"]
    plan[0]["amount"], plan[1]["amount"] = "400.00", "600.00"
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"installments": plan}).status_code == 422
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"fee": "900.00"}).status_code == 422
    assert client.delete(f"/payments/{payment['id']}", headers=headers[0]).status_code == 200
    current = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    assert current["paid"] == "0.00" and current["balance"] == "1000.00"
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 17))
    # Una deuda concluida sigue siendo una deuda; corregir un abono la vuelve a mostrar.
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"status": "concluido"}).status_code == 200
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 19))
    assert any(x["kind"] == "pago" and x["urgent"] for x in client.get("/alerts", headers=headers[0]).json())


def test_three_business_day_reminders_read_and_urgent(setup, monkeypatch):
    client, headers, _, _ = setup
    case = create(setup)
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={"action_date": "2026-10-08", "description": "Apelar", "alert_date": "2026-10-15"}).json()
    for when, anticipation in [(date(2026, 10, 8), 5), (date(2026, 10, 12), 3), (date(2026, 10, 14), 1), (date(2026, 10, 15), 0)]:
        monkeypatch.setattr(d, "today", lambda when=when: when)
        legal = [x for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal"]
        assert len(legal) == 1 and legal[0]["anticipation"] == anticipation
        assert client.post(f"/alerts/{legal[0]['id']}/read", headers=headers[0]).status_code == 200
        assert not any(x["kind"] == "legal" for x in client.get("/alerts", headers=headers[0]).json())
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 16))
    legal = [x for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal"]
    assert len(legal) == 1 and legal[0]["urgent"]
    assert client.post(f"/alerts/{legal[0]['id']}/read", headers=headers[0]).status_code == 200
    assert any(x["urgent"] for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal")
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 17))
    assert any(x["urgent"] for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal")
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[0]).status_code == 200
    assert not any(x["kind"] == "legal" for x in client.get("/alerts", headers=headers[0]).json())


def test_weekend_does_not_generate_notifications(setup, monkeypatch):
    client, headers, _, engine = setup
    case = create(setup)
    client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={"action_date": "2026-10-08", "description": "Vence lunes", "alert_date": "2026-10-12"})
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 10))
    assert client.get("/alerts", headers=headers[0]).json() == []
    with Session(engine) as db:
        assert not list(db.scalars(select(m.Notice)))
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 12))
    legal = [x for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal"]
    assert len(legal) == 1 and legal[0]["anticipation"] == 0


def test_only_latest_reminder_is_visible_and_read_hides_older_pending(setup, monkeypatch):
    client, headers, _, engine = setup
    case = create(setup)
    client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={"action_date": "2026-10-08", "description": "Vence mañana", "alert_date": "2026-10-09"})
    legal = [x for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal"]
    assert len(legal) == 1 and legal[0]["anticipation"] == 1
    with Session(engine) as db:
        persisted = list(db.scalars(select(m.Notice).where(m.Notice.kind == "legal")))
        assert sorted(x.anticipation for x in persisted) == [1, 3, 5]
        assert all(x.status == "pendiente" for x in persisted)
    assert client.post(f"/alerts/{legal[0]['id']}/read", headers=headers[0]).status_code == 200
    assert not any(x["kind"] == "legal" for x in client.get("/alerts", headers=headers[0]).json())
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 9))
    legal = [x for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal"]
    assert len(legal) == 1 and legal[0]["anticipation"] == 0


def test_weekend_deadline_keeps_last_reminder_until_weekday(setup, monkeypatch):
    client, headers, _, _ = setup
    case = create(setup)
    client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={"action_date": "2026-10-08", "description": "Vence sábado", "alert_date": "2026-10-10"})
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 9))
    legal = [x for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal"]
    last = next(x for x in legal if x["anticipation"] == 1)
    client.post(f"/alerts/{last['id']}/read", headers=headers[0])
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 11))
    legal = [x for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal"]
    assert len(legal) == 1 and legal[0]["id"] == last["id"] and legal[0]["urgent"]
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 12))
    legal = [x for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal"]
    assert len(legal) == 1 and legal[0]["anticipation"] == 0 and legal[0]["urgent"]


def test_client_code_stable_and_creation_transaction_rejects_invalid_plan(setup):
    client, headers, _, engine = setup
    bad = ficha(installments=[{"amount": "200.00", "due_date": "2026-10-15"}])
    assert client.post("/cases", headers=headers[0], json=bad).status_code == 422
    with Session(engine) as db:
        assert not list(db.scalars(select(m.Client)))
    case = create(setup)
    updated = {**ficha()["client"], "document_number": "88888888", "name": "María Pérez"}
    current = client.put(f"/cases/{case['id']}", headers=headers[0], json={"client": updated})
    assert current.status_code == 200
    assert current.json()["client"]["code"] == case["client"]["code"]
    assert current.json()["client"]["name"] == "María Pérez"
    assert client.post("/cases", headers=headers[0], json=ficha(document="88888888")).status_code == 409
    assert len(client.get("/cases", headers=headers[0]).json()) == 1


def test_catalog_two_statuses_and_readable_audit(setup):
    client, headers, _, engine = setup
    assert client.post("/cases", headers=headers[0], json=ficha(area="Otra")).status_code == 422
    assert client.post("/cases", headers=headers[0], json=ficha(status="suspendido")).status_code == 422
    case = create(setup, area="Familia – Civil")
    assert client.get("/cases", headers=headers[0], params={"area": "Otra"}).status_code == 422
    assert len(client.get("/cases", headers=headers[0], params={"search": "María"}).json()) == 1
    assert client.get("/cases", headers=headers[0], params={"search": case["client"]["code"]}).json()[0]["id"] == case["id"]
    assert client.get("/clients", headers=headers[0], params={"search": case["client"]["code"]}).json()[0]["id"] == case["client"]["id"]
    assert not client.get("/cases", headers=headers[0], params={"search": "Inexistente"}).json()
    assert client.get("/cases", headers=headers[0], params={"client_id": case["client"]["id"]}).json()[0]["id"] == case["id"]
    logs = client.get("/audit", headers=headers[0]).json()
    assert logs and all(not {"resource", "changes", "tenant_id"} & x.keys() for x in logs)
    assert all(x["user_name"] == "David" and x["created_at"] for x in logs)
    with Session(engine) as db:
        assert db.scalar(select(m.Audit)).changes


def test_honorarios_and_plan_can_be_corrected_before_payments(setup):
    client, headers, _, _ = setup
    case = create(setup)
    plan = [{"id": item["id"], "amount": "600.00", "due_date": item["due_date"]} for item in case["installments"]]
    result = client.put(f"/cases/{case['id']}", headers=headers[0], json={"fee": "1200.00", "installments": plan})
    assert result.status_code == 200, result.text
    assert result.json()["fee"] == "1200.00"
    assert [x["amount"] for x in result.json()["installments"]] == ["600.00", "600.00"]
    plan[0]["id"] = 99999
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"fee": "1200.00", "installments": plan}).status_code == 422
