import json
from datetime import date

import domain as d
import models as m
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from test_integral_flow import abono, area_id, create, ficha


def event_case(setup, **changes):
    return create(setup, installments=[
        {"amount": "500.00", "due_date": "2026-12-01"},
        {"amount": "500.00", "event_name": "Sentencia favorable"},
    ], **changes)


def entry_data(**changes):
    return {"action_date": "2026-10-08", "subject": "Obtener sentencia",
        "description": "Verificar el hito pactado", "alert_date": "2026-10-08", **changes}


def link_entry(client, header, case):
    response = client.post(f"/cases/{case['id']}/entries", headers=header,
        json=entry_data(payment_installment_id=case["installments"][1]["id"]))
    assert response.status_code == 201, response.text
    return response.json()


def test_case_can_add_date_and_event_charges_after_partial_payment(setup):
    client, headers, ids, engine = setup
    case = event_case(setup, team_member_id=ids[1])
    entry = link_entry(client, headers[0], case)
    assert abono(client, headers[0], case, "200.00").status_code == 201
    before = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    with Session(engine) as db:
        applications = [d.public(x) for x in db.scalars(select(m.Application))]
    plan = [{"id": x["id"], "amount": x["amount"], "due_date": x["due_date"],
        "event_name": x["event_name"]} for x in before["installments"]]
    plan += [{"amount": "300.00", "due_date": "2026-10-15"},
        {"amount": "200.00", "event_name": "Sentencia de apelación"}]
    payload = {"fee": "1500.00", "installments": plan}
    path = f"/cases/{case['id']}"
    assert client.put(path, headers=headers[1], json=payload).status_code == 403
    response = client.put(path, headers=headers[0], json=payload)
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["fee"] == "1500.00" and updated["paid"] == "200.00" and updated["balance"] == "1300.00"
    assert updated["payments"] == before["payments"]
    assert updated["installments"][:2] == before["installments"]
    assert [x["number"] for x in updated["installments"]] == [1, 2, 3, 4]
    new_event = updated["installments"][3]
    assert new_event["state"] == "esperando_evento"
    with Session(engine) as db:
        assert [d.public(x) for x in db.scalars(select(m.Application))] == applications
        assert db.get(m.Entry, entry["id"]).payment_installment_id == case["installments"][1]["id"]
    event_entry = client.post(f"{path}/entries", headers=headers[0],
        json=entry_data(payment_installment_id=new_event["id"]))
    assert event_entry.status_code == 201
    assert client.post(f"/entries/{event_entry.json()['id']}/attend", headers=headers[1]).status_code == 200
    assert {x["id"] for x in client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"]} == {
        updated["installments"][1]["id"], updated["installments"][2]["id"], new_event["id"]}
    assert abono(client, headers[0], updated, "1100.00").status_code == 201
    final = client.get(path, headers=headers[0]).json()
    assert [x["paid"] for x in final["installments"]] == ["500.00", "500.00", "300.00", "0.00"]
    assert final["balance"] == "200.00"


@pytest.mark.parametrize("change", ["remove", "reorder", "amount", "event", "date", "duplicate", "foreign", "total"])
def test_extension_rejects_changes_to_protected_plan_without_writes(setup, change):
    client, headers, _, _ = setup
    case = event_case(setup)
    assert abono(client, headers[0], case, "200.00").status_code == 201
    path = f"/cases/{case['id']}"
    before = client.get(path, headers=headers[0]).json()
    plan = [{"id": x["id"], "amount": x["amount"], "due_date": x["due_date"],
        "event_name": x["event_name"]} for x in before["installments"]]
    plan.append({"amount": "300.00", "due_date": "2026-10-15"})
    fee = "1300.00"
    if change == "remove":
        plan.pop(0)
        fee = "800.00"
    elif change == "reorder":
        plan[0], plan[1] = plan[1], plan[0]
    elif change == "amount":
        plan[0]["amount"], plan[1]["amount"] = "400.00", "600.00"
    elif change == "event":
        plan[0].update(event_name="Otro hito", due_date=None)
    elif change == "date":
        plan[0]["due_date"] = "2026-10-16"
    elif change == "duplicate":
        plan[2]["id"] = plan[0]["id"]
    elif change == "foreign":
        other = event_case(setup, document="88888888")
        plan[2]["id"] = other["installments"][0]["id"]
    else:
        fee = "1400.00"
    assert client.put(path, headers=headers[0], json={"fee": fee, "installments": plan}).status_code == 422
    assert client.get(path, headers=headers[0]).json() == before


def test_linked_event_without_payments_can_extend_plan(setup):
    client, headers, _, _ = setup
    case = event_case(setup)
    entry = link_entry(client, headers[0], case)
    current = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    plan = [{"id": x["id"], "amount": x["amount"], "due_date": x["due_date"],
        "event_name": x["event_name"]} for x in current["installments"]]
    plan.append({"amount": "100.00", "event_name": "Apelación"})
    response = client.put(f"/cases/{case['id']}", headers=headers[0], json={"fee": "1100.00", "installments": plan})
    assert response.status_code == 200, response.text
    assert response.json()["installments"][1]["entry_id"] == entry["id"]


@pytest.mark.parametrize("attended", [False, True])
def test_unpaid_quota_can_change_amount_and_modality_despite_other_payments(setup, attended):
    client, headers, _, engine = setup
    case = event_case(setup)
    entry = link_entry(client, headers[0], case)
    if attended:
        assert client.post(f"/entries/{entry['id']}/attend", headers=headers[0]).status_code == 200
    assert abono(client, headers[0], case, "200.00").status_code == 201
    path = f"/cases/{case['id']}"
    before = client.get(path, headers=headers[0]).json()
    plan = [{"id": x["id"], "amount": x["amount"], "due_date": x["due_date"],
        "event_name": x["event_name"]} for x in before["installments"]]
    plan[1].update(amount="300.00", event_name=None, due_date="2026-10-15")
    response = client.put(path, headers=headers[0], json={"fee": "800.00", "installments": plan})
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["balance"] == "600.00" and updated["payments"] == before["payments"]
    assert updated["installments"][0] == before["installments"][0]
    quota = updated["installments"][1]
    assert quota["id"] == case["installments"][1]["id"]
    assert quota["event_name"] is None and quota["activated_at"] is None and quota["entry_id"] is None
    with Session(engine) as db:
        assert db.get(m.Entry, entry["id"]).attended == attended
        assert db.get(m.Entry, entry["id"]).payment_installment_id is None
    plan[1].update(amount="600.00", event_name="Nuevo hito", due_date=None)
    response = client.put(path, headers=headers[0], json={"fee": "1100.00", "installments": plan})
    assert response.status_code == 200, response.text
    assert response.json()["installments"][1]["state"] == "esperando_evento"
    assert client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"] == []


def test_editing_unpaid_event_amount_keeps_activated_link_and_can_remove_only_unpaid(setup):
    client, headers, _, engine = setup
    case = event_case(setup)
    entry = link_entry(client, headers[0], case)
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[0]).status_code == 200
    assert abono(client, headers[0], case, "200.00").status_code == 201
    path = f"/cases/{case['id']}"
    before = client.get(path, headers=headers[0]).json()
    plan = [{"id": x["id"], "amount": x["amount"], "due_date": x["due_date"],
        "event_name": x["event_name"]} for x in before["installments"]]
    plan[1]["amount"] = "700.00"
    response = client.put(path, headers=headers[0], json={"fee": "1200.00", "installments": plan})
    assert response.status_code == 200, response.text
    quota = response.json()["installments"][1]
    assert quota["entry_id"] == entry["id"] and quota["activated_at"] == before["installments"][1]["activated_at"]
    assert client.put(path, headers=headers[0], json={"fee": "500.00", "installments": plan[:1]}).status_code == 200
    with Session(engine) as db:
        assert db.get(m.Installment, quota["id"]) is None
        assert db.get(m.Entry, entry["id"]).attended
    assert client.get(path, headers=headers[0]).json()["balance"] == "300.00"


def test_existing_dated_quota_can_be_converted_to_event_and_activated(setup):
    client, headers, _, _ = setup
    case = create(setup)
    plan = [{"id": quota["id"], "amount": quota["amount"], "due_date": quota["due_date"]}
        for quota in case["installments"]]
    plan[0].update(due_date=None, event_name="Se aprueba en primera instancia")
    response = client.put(f"/cases/{case['id']}", headers=headers[0], json={"installments": plan})
    assert response.status_code == 200, response.text
    updated = response.json()
    converted = updated["installments"][0]
    assert converted["event_name"] == "Se aprueba en primera instancia"
    assert converted["due_date"] is None and converted["state"] == "esperando_evento"
    assert updated["installments"][1]["due_date"] == plan[1]["due_date"]
    assert updated["fee"] == case["fee"] and updated["balance"] == case["balance"]
    assert all(item["id"] != converted["id"] for item in client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"])
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0],
        json=entry_data(payment_installment_id=converted["id"]))
    assert entry.status_code == 201
    assert client.post(f"/entries/{entry.json()['id']}/attend", headers=headers[0]).status_code == 200
    payments = client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"]
    assert next(item for item in payments if item["id"] == converted["id"])["due_date"] == "2026-10-08"


def test_event_quota_is_due_before_attendance_and_attending_preserves_collection(setup, monkeypatch):
    client, headers, ids, engine = setup
    case = event_case(setup, team_member_id=ids[1])
    quota = case["installments"][1]
    assert quota["due_date"] is None and quota["activated_at"] is None
    assert quota["state"] == "esperando_evento"
    assert client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"] == []
    assert client.get("/alerts", headers=headers[0]).json() == []
    entry = link_entry(client, headers[0], case)
    assert entry["can_attend"] and entry["alert_date"] == "2026-10-08"
    assert len(client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"]) == 1
    assert {x["kind"] for x in client.get("/alerts", headers=headers[0]).json()} == {"legal", "pago"}
    staff = client.get(f"/cases/{case['id']}/entries", headers=headers[1]).json()[0]
    assert staff["can_attend"]
    assert not {"payment_installment_id", "payment_event", "payment_activated"} & staff.keys()
    attended = client.post(f"/entries/{entry['id']}/attend", headers=headers[1])
    assert attended.status_code == 200 and attended.json()["attended"]
    assert "payment_installment_id" not in attended.json()
    result = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    activated = result["installments"][1]
    assert activated["due_date"] == "2026-10-08" and activated["activated_at"]
    assert result["balance"] == "1000.00"
    upcoming = client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"]
    assert len(upcoming) == 1 and upcoming[0]["id"] == quota["id"]
    assert upcoming[0]["event_name"] == "Sentencia favorable"
    notices = client.get("/alerts", headers=headers[0]).json()
    assert len(notices) == 1 and notices[0]["kind"] == "pago" and notices[0]["anticipation"] == 0
    assert client.get("/alerts", headers=headers[1]).json() == []
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 9))
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[0]).status_code == 200
    repeated = client.get(f"/cases/{case['id']}", headers=headers[0]).json()["installments"][1]
    assert repeated["due_date"] == activated["due_date"] and repeated["activated_at"] == activated["activated_at"]
    with Session(engine) as db:
        audits = list(db.scalars(select(m.Audit).where(m.Audit.action == "Sincronizar vencimiento de cuota")))
        assert len(audits) == 1 and audits[0].user_id == ids[0]
        assert json.loads(audits[0].changes)["after"]["due_date"] == "2026-10-08"
    assert abono(client, headers[0], case, "500.00", installment_id=quota["id"]).status_code == 201
    assert client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"] == []
    assert client.get("/alerts", headers=headers[0]).json() == []


@pytest.mark.parametrize("quota", [
    {"amount": "1000.00"},
    {"amount": "1000.00", "event_name": ""},
    {"amount": "1000.00", "event_name": "   "},
    {"amount": "1000.00", "event_name": "x" * 151},
    {"amount": "1000.00", "event_name": "Hito", "due_date": "2026-10-15"},
    {"amount": "1000.00", "event_name": "Hito", "activated_at": "2026-10-08"},
])
def test_invalid_event_plans_are_rejected_without_writes(setup, quota):
    client, headers, _, engine = setup
    assert client.post("/cases", headers=headers[0], json=ficha(installments=[quota])).status_code == 422
    with Session(engine) as db:
        assert db.scalar(select(func.count(m.Case.id))) == 0
        assert db.scalar(select(func.count(m.Client.id))) == 0


def test_link_is_admin_only_same_case_same_tenant_unique_and_preserved_on_staff_edit(setup):
    client, headers, ids, engine = setup
    case = event_case(setup, team_member_id=ids[1])
    other = event_case(setup, document="88888888")
    foreign = client.post("/cases", headers=headers[2], json=ficha(document="77777777",
        area_id=area_id(client, headers[2]), installments=[{"amount": "1000.00", "event_name": "Hito ajeno"}])).json()
    path = f"/cases/{case['id']}/entries"
    assert client.post(path, headers=headers[1], json=entry_data(payment_installment_id=case["installments"][1]["id"])).status_code == 403
    for invalid_id, status in [(other["installments"][1]["id"], 422),
            (case["installments"][0]["id"], 422), (foreign["installments"][0]["id"], 404), (99999, 404)]:
        assert client.post(path, headers=headers[0], json=entry_data(payment_installment_id=invalid_id)).status_code == status
    entry = link_entry(client, headers[0], case)
    assert client.post(path, headers=headers[0], json=entry_data(payment_installment_id=case["installments"][1]["id"])).status_code == 422
    update_path = f"/entries/{entry['id']}"
    assert client.put(update_path, headers=headers[1], json=entry_data(payment_installment_id=None)).status_code == 403
    assert client.put(update_path, headers=headers[1], json=entry_data(description="Corrección del asistente")).status_code == 200
    with Session(engine) as db:
        assert db.get(m.Entry, entry["id"]).payment_installment_id == case["installments"][1]["id"]
        assert db.scalar(select(func.count(m.Entry.id))) == 1
    assert client.post(update_path + "/attend", headers=headers[2]).status_code == 404
    client.post(f"/cases/{case['id']}/access", headers=headers[0], json={"user_id": ids[1], "level": "read"})
    assert client.post(update_path + "/attend", headers=headers[1]).status_code == 404


def test_link_can_change_before_attendance_but_never_rewrites_activated_event(setup):
    client, headers, _, _ = setup
    case = event_case(setup)
    entry = link_entry(client, headers[0], case)
    path = f"/entries/{entry['id']}"
    assert client.put(path, headers=headers[0], json=entry_data(payment_installment_id=None)).status_code == 200
    assert client.put(path, headers=headers[0], json=entry_data(payment_installment_id=case["installments"][1]["id"])).status_code == 200
    assert client.post(path + "/attend", headers=headers[0]).status_code == 200
    assert client.put(path, headers=headers[0], json=entry_data(payment_installment_id=None)).status_code == 422
    assert client.put(path, headers=headers[0], json=entry_data(description="Corrección de texto")).status_code == 200
    current = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    plan = [{"id": x["id"], "amount": x["amount"], "due_date": x["due_date"], "event_name": x["event_name"]} for x in current["installments"]]
    plan[0]["due_date"] = "2026-12-02"
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"installments": plan}).status_code == 200
    plan[1]["due_date"] = "2026-10-10"
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"installments": plan}).status_code == 422
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"installments": [plan[0]], "fee": "500.00"}).status_code == 200
    with Session(setup[3]) as db:
        assert db.get(m.Entry, entry["id"]).payment_installment_id is None


def test_event_on_weekend_creates_no_notices_and_prepaid_event_creates_no_cobranza(setup, monkeypatch):
    client, headers, _, _ = setup
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 10))
    case = event_case(setup)
    entry = link_entry(client, headers[0], case)
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[0]).status_code == 200
    assert client.get("/alerts", headers=headers[0]).json() == []
    assert client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"][0]["due_date"] == "2026-10-08"
    assert abono(client, headers[0], case, "500.00", installment_id=case["installments"][1]["id"]).status_code == 201
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, 12))
    assert client.get("/alerts", headers=headers[0]).json() == []


def test_database_rejects_links_across_cases_and_tenants(setup):
    client, headers, _, engine = setup
    case = event_case(setup)
    other = event_case(setup, document="88888888")
    entry = link_entry(client, headers[0], case)
    with Session(engine) as db:
        db.get(m.Entry, entry["id"]).payment_installment_id = other["installments"][1]["id"]
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        db.get(m.Entry, entry["id"]).tenant_id = db.get(m.User, 3).tenant_id
        with pytest.raises(IntegrityError):
            db.commit()
