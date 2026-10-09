import models as m
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from test_integral_flow import abono, area_id, create, ficha


def test_tenant_isolation_every_resource_and_relations(setup):
    client, headers, ids, engine = setup
    case = create(setup)
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={"action_date": "2026-10-08", "subject": "Acto", "description": "Acto", "alert_date": "2026-10-15"}).json()
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
    foreign = client.post("/cases", headers=headers[2], json=ficha(document="22222222", area_id=area_id(client, headers[2]))).json()
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
    assert client.post(f"/cases/{case['id']}/entries", headers=headers[1], json={"action_date": "2026-10-08", "subject": "Cambio", "description": "Cambio"}).status_code == 404
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={"action_date": "2026-10-08", "subject": "Acto", "description": "Acto", "alert_date": "2026-10-15"}).json()
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
    assert client.post(f"/cases/{case['id']}/entries", headers=headers[1], json={"action_date": "2026-10-08", "subject": "Acto", "description": "Acto", "registered_by": ids[0]}).status_code == 422


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
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[1], json={"action_date": "2026-10-08", "subject": "Acto", "description": "Acto", "alert_date": "2026-10-15"}).json()
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


def test_staff_standalone_client_then_case_preserves_visibility_and_revocation(setup):
    client, headers, ids, engine = setup
    with Session(engine) as db:
        user = db.get(m.User, ids[1])
        user.can_create_clients = True
        user.can_create_cases = True
        db.commit()
    colleague = client.post("/users", headers=headers[0], json={
        "username": "colega", "name": "Otra abogada", "password": "abc123",
        "can_create_clients": True, "can_create_cases": True,
    })
    assert colleague.status_code == 201
    login = client.post("/auth/login", json={"username": "colega", "password": "abc123"})
    colleague_header = {"Authorization": f"Bearer {login.json()['access_token']}"}
    other_client = client.post("/clients", headers=headers[0], json={**ficha()["client"], "document_number": "88888888"}).json()
    foreign_client = client.post("/clients", headers=headers[2], json={**ficha()["client"], "document_number": "77777777"}).json()
    registered = client.post("/clients", headers=headers[1], json=ficha()["client"])
    assert registered.status_code == 201
    own_client = registered.json()
    assert [x["id"] for x in client.get("/clients", headers=headers[1]).json()] == [own_client["id"]]
    assert client.get("/clients", headers=colleague_header).json() == []
    data = {"client_id": own_client["id"], "area_id": area_id(client, headers[1]), "process_type": "Cobro de deuda", "initial_stage": "Demanda"}
    assert client.post("/cases", headers=colleague_header, json=data).status_code == 404
    for hidden in (other_client, foreign_client):
        assert client.post("/cases", headers=headers[1], json={**data, "client_id": hidden["id"]}).status_code == 404
    created = client.post("/cases", headers=headers[1], json=data)
    assert created.status_code == 201, created.text
    case = created.json()
    assert case["client"]["id"] == own_client["id"] and "fee" not in case
    assert case["responsible_id"] == ids[1]
    assert [x["id"] for x in client.get("/clients", headers=headers[1]).json()] == [own_client["id"]]
    assert client.get("/clients", headers=colleague_header).json() == []
    # La auditoría de creación no puede recuperar acceso después de una revocación.
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"responsible_id": ids[0]}).status_code == 200
    assert client.delete(f"/cases/{case['id']}/access/{ids[1]}", headers=headers[0]).status_code == 200
    assert client.get("/clients", headers=headers[1]).json() == []
    assert client.get("/cases", headers=headers[1]).json() == []
    assert client.post("/cases", headers=headers[1], json=data).status_code == 404


def test_old_client_creation_audit_cannot_grant_access_to_reused_id(setup):
    from datetime import timedelta

    client, headers, ids, engine = setup
    current = client.post("/clients", headers=headers[0], json=ficha()["client"]).json()
    with Session(engine) as db:
        customer = db.get(m.Client, current["id"])
        db.add(m.Audit(
            tenant_id=customer.tenant_id, user_id=ids[1], resource=m.Client.__tablename__,
            resource_id=customer.id, action="Registrar cliente", changes="{}",
            created_at=customer.created_at - timedelta(days=1),
        ))
        db.commit()
    assert client.get("/clients", headers=headers[1]).json() == []
