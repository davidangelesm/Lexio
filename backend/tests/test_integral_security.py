import models as m
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from test_integral_flow import abono, create, ficha


def test_tenant_isolation_every_resource_and_relations(setup):
    client, headers, ids, engine = setup
    case = create(setup)
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={"action_date": "2026-10-08", "description": "Acto", "alert_date": "2026-10-15"}).json()
    payment = abono(client, headers[0], case, "50.00").json()
    assert client.get("/cases", headers=headers[2]).json() == []
    assert client.get("/clients", headers=headers[2]).json() == []
    assert client.get("/entries", headers=headers[2]).json() == []
    assert client.get("/reports", headers=headers[2]).json()["totals"]["fee"] == "0.00"
    for path in [f"/cases/{case['id']}", f"/cases/{case['id']}/entries", f"/cases/{case['id']}/payments", f"/cases/{case['id']}/access"]:
        assert client.get(path, headers=headers[2]).status_code == 404
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[2]).status_code == 404
    assert client.delete(f"/payments/{payment['id']}", headers=headers[2]).status_code == 404
    assert client.put(f"/clients/{case['client']['id']}", headers=headers[2], json=ficha()["client"]).status_code == 404
    assert client.post(f"/cases/{case['id']}/access", headers=headers[0], json={"user_id": ids[2], "level": "edit"}).status_code == 404
    assert client.post("/cases", headers=headers[0], json=ficha(document="11111111", responsible_id=ids[2])).status_code == 404
    foreign = client.post("/cases", headers=headers[2], json=ficha(document="22222222")).json()
    assert abono(client, headers[0], case, "10.00", installment_id=foreign["installments"][0]["id"]).status_code == 422
    assert client.post("/cases", headers=headers[0], json={**ficha(document="33333333"), "tenant_id": 2}).status_code == 422
    with Session(engine) as db:
        db.add(m.Access(tenant_id=2, case_id=case["id"], user_id=ids[2], level="read"))
        with pytest.raises(IntegrityError):
            db.commit()


def test_staff_case_permissions_and_financial_privacy(setup):
    client, headers, ids, _ = setup
    case = create(setup)
    assert client.get("/cases", headers=headers[1]).json() == []
    assert client.get("/clients", headers=headers[1]).json() == []
    assert client.get(f"/cases/{case['id']}", headers=headers[1]).status_code == 404
    client.post(f"/cases/{case['id']}/access", headers=headers[0], json={"user_id": ids[1], "level": "read"})
    hidden = {"fee", "paid", "balance", "cancelled", "installments", "payments", "tenant_id"}
    visible = client.get(f"/cases/{case['id']}", headers=headers[1]).json()
    assert not hidden & visible.keys()
    assert all(not hidden & x.keys() for x in client.get("/cases", headers=headers[1]).json())
    report = client.get("/reports", headers=headers[1]).json()
    assert not {"fee", "paid", "balance"} & report["totals"].keys()
    assert not {"fee", "paid", "balance"} & report["rows"][0].keys()
    assert client.get(f"/cases/{case['id']}/payments", headers=headers[1]).status_code == 403
    assert client.get("/audit", headers=headers[1]).status_code == 403
    assert abono(client, headers[1], case, "20.00").status_code == 403
    assert client.get(f"/cases/{case['id']}/access", headers=headers[1]).status_code == 403
    assert client.post(f"/cases/{case['id']}/entries", headers=headers[1], json={"action_date": "2026-10-08", "description": "Cambio"}).status_code == 404
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={"action_date": "2026-10-08", "description": "Acto", "alert_date": "2026-10-15"}).json()
    assert not client.get("/entries", headers=headers[1]).json()[0]["can_attend"]
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[1]).status_code == 404
    alerts = client.get("/alerts", headers=headers[1]).json()
    assert alerts and all(x["kind"] == "legal" and "balance" not in x and not x["can_attend"] for x in alerts)
    client.post(f"/cases/{case['id']}/access", headers=headers[0], json={"user_id": ids[1], "level": "edit"})
    assert client.put(f"/cases/{case['id']}", headers=headers[1], json={"status": "concluido"}).status_code == 200
    assert client.put(f"/cases/{case['id']}", headers=headers[1], json={"fee": "1000.00"}).status_code == 403
    assert client.put(f"/cases/{case['id']}", headers=headers[1], json={"client": ficha()["client"]}).status_code == 403
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[1]).status_code == 200


def test_staff_can_register_operational_ficha_and_admin_completes_finances(setup):
    client, headers, ids, engine = setup
    with Session(engine) as db:
        user = db.get(m.User, ids[1])
        user.can_create_clients = True
        user.can_create_cases = True
        db.commit()
    hidden_case = create(setup, document="99999999")
    existing_client = {**ficha(), "client_id": hidden_case["client"]["id"]}
    del existing_client["client"], existing_client["fee"], existing_client["installments"]
    assert client.post("/cases", headers=headers[1], json=existing_client).status_code == 404
    data = ficha()
    assert client.post("/cases", headers=headers[1], json=data).status_code == 403
    del data["fee"], data["installments"]
    response = client.post("/cases", headers=headers[1], json=data)
    assert response.status_code == 201, response.text
    case = response.json()
    assert case["responsible_id"] == ids[1] and "fee" not in case
    admin_case = client.get(f"/cases/{case['id']}", headers=headers[0]).json()
    assert admin_case["fee"] is None and admin_case["balance"] is None
    complete = client.put(f"/cases/{case['id']}", headers=headers[0], json={"fee": "1000.00", "installments": ficha()["installments"]})
    assert complete.status_code == 200 and complete.json()["balance"] == "1000.00"
    assert client.post(f"/cases/{case['id']}/entries", headers=headers[1], json={"action_date": "2026-10-08", "description": "Acto", "registered_by": ids[0]}).status_code == 422


def test_reassigning_responsible_promotes_read_access(setup):
    client, headers, ids, _ = setup
    case = create(setup)
    client.post(f"/cases/{case['id']}/access", headers=headers[0], json={"user_id": ids[1], "level": "read"})
    assert client.get(f"/cases/{case['id']}", headers=headers[1]).json()["access_level"] == "read"
    response = client.put(f"/cases/{case['id']}", headers=headers[0], json={"responsible_id": ids[1]})
    assert response.status_code == 200
    assert client.get(f"/cases/{case['id']}", headers=headers[1]).json()["access_level"] == "edit"


def test_notifications_are_private_and_attended_hides_every_recipient(setup):
    client, headers, ids, engine = setup
    case = create(setup, responsible_id=ids[1])
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[1], json={"action_date": "2026-10-08", "description": "Acto", "alert_date": "2026-10-15"}).json()
    admin_alert = next(x for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal")
    staff_alert = client.get("/alerts", headers=headers[1]).json()[0]
    assert client.post(f"/alerts/{staff_alert['id']}/read", headers=headers[0]).status_code == 404
    assert client.post(f"/alerts/{admin_alert['id']}/read", headers=headers[1]).status_code == 404
    assert client.post(f"/alerts/{admin_alert['id']}/read", headers=headers[2]).status_code == 404
    assert client.post(f"/entries/{entry['id']}/attend", headers=headers[1]).status_code == 200
    with Session(engine) as db:
        assert all(x.status == "cancelado" for x in db.scalars(select(m.Notice).where(m.Notice.kind == "legal")))
    assert client.get("/alerts", headers=headers[1]).json() == []
    assert not any(x["kind"] == "legal" for x in client.get("/alerts", headers=headers[0]).json())
