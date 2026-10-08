from datetime import date, timedelta
from decimal import Decimal

import domain as d
import models as m
from sqlalchemy import select
from sqlalchemy.orm import Session


def make_case(setup):
    client, headers, ids, _ = setup
    response = client.post(
        "/clients",
        headers=headers[0],
        json={
            "document_type": "DNI",
            "document_number": "00123456",
            "name": "Cliente de prueba",
        },
    )
    assert response.status_code == 201, response.text
    customer = response.json()
    response = client.post(
        "/cases",
        headers=headers[0],
        json={
            "client_id": customer["id"],
            "area": "Civil",
            "subject": "Cobranza",
            "description": "Caso de prueba",
            "initial_stage": "Primera instancia",
            "current_stage": "Primera instancia",
            "start_date": d.today().isoformat(),
            "responsible_id": ids[0],
        },
    )
    assert response.status_code == 201, response.text
    return customer, response.json()


def service(setup, case, amount="1000.00", plan=None):
    client, headers, _, _ = setup
    response = client.post(
        f"/cases/{case['id']}/services",
        headers=headers[0],
        json={
            "mode": "etapa",
            "scope": "Primera instancia",
            "stage": "Primera instancia",
            "contract_date": d.today().isoformat(),
            "fee": amount,
            "installments": plan
            or [
                {
                    "amount": amount,
                    "condition": "fecha",
                    "due_date": (d.today() - timedelta(days=1)).isoformat(),
                }
            ],
        },
    )
    assert response.status_code == 201, response.text
    return client.get(f"/cases/{case['id']}/services", headers=headers[0]).json()[-1]


def pay(setup, s, amount):
    client, headers, _, _ = setup
    return client.post(
        f"/services/{s['id']}/payments",
        headers=headers[0],
        json={
            "payment_date": d.today().isoformat(),
            "amount": amount,
            "method": "Transferencia",
            "applications": [
                {"installment_id": s["installments"][0]["id"], "amount": amount}
            ],
        },
    )


def test_tenant_and_case_access(setup):
    client, headers, ids, _ = setup
    customer, case = make_case(setup)
    assert customer["document_number"] == "00123456"
    assert client.get("/cases", headers=headers[1]).json() == []
    assert client.get(f"/cases/{case['id']}", headers=headers[2]).status_code == 404
    assert (
        client.get(f"/cases/{case['id']}/entries", headers=headers[1]).status_code
        == 404
    )
    assert (
        client.post(
            f"/cases/{case['id']}/access",
            headers=headers[0],
            json={"user_id": ids[1], "level": "read"},
        ).status_code
        == 200
    )
    assert client.get(f"/cases/{case['id']}", headers=headers[1]).status_code == 200
    assert (
        client.post(
            f"/cases/{case['id']}/entries",
            headers=headers[1],
            json={"action_date": d.today().isoformat(), "description": "Intento"},
        ).status_code
        == 404
    )
    assert client.get("/reports/economic", headers=headers[1]).status_code == 403
    assert (
        client.post(
            "/clients",
            headers=headers[0],
            json={
                "tenant_id": 2,
                "document_type": "DNI",
                "document_number": "11111111",
                "name": "Ataque",
            },
        ).status_code
        == 422
    )


def test_money_partial_reversal_and_totals(setup):
    client, headers, _, _ = setup
    _, case = make_case(setup)
    s = service(setup, case)
    p = pay(setup, s, "300.00")
    assert p.status_code == 201, p.text
    assert pay(setup, s, "200.00").status_code == 201
    row = client.get(f"/cases/{case['id']}/services", headers=headers[0]).json()[0][
        "installments"
    ][0]
    assert Decimal(row["balance"]) == Decimal(500)
    assert row["state"] == "vencido parcial"
    assert pay(setup, s, "600.00").status_code == 422
    report = client.get("/reports/economic", headers=headers[0]).json()
    assert Decimal(report["totals"]["applied"]) == Decimal(500)
    assert len(report["services"][0]["payments"]) == 2
    assert (
        client.post(
            f"/payments/{p.json()['id']}/reverse",
            headers=headers[0],
            json={"reason": "Error de registro"},
        ).status_code
        == 200
    )
    report = client.get("/reports/economic", headers=headers[0]).json()
    assert Decimal(report["totals"]["balance"]) == Decimal(800)
    assert Decimal(report["totals"]["balance"]) == sum(
        Decimal(report["totals"][k]) for k in ["overdue", "not_due", "pending_event"]
    )


def test_events_and_rescheduling_keep_payments(setup):
    client, headers, _, _ = setup
    _, case = make_case(setup)
    root = f"/cases/{case['id']}"
    event = client.post(
        root + "/events",
        headers=headers[0],
        json={
            "description": "Audiencia 1",
            "scheduled_date": (d.today() - timedelta(days=5)).isoformat(),
        },
    ).json()
    s = service(
        setup,
        case,
        plan=[
            {"amount": "300", "condition": "fecha", "due_date": d.today().isoformat()},
            {"amount": "700", "condition": "realizacion", "event_id": event["id"]},
        ],
    )
    quota = s["installments"][1]
    assert quota["state"] == "pendiente de evento"
    assert (
        client.post(
            f"/installments/{quota['id']}/confirm", headers=headers[0]
        ).status_code
        == 422
    )
    assert (
        client.put(
            root + f"/events/{event['id']}",
            headers=headers[0],
            json={
                "description": "Audiencia 1",
                "effective_date": d.today().isoformat(),
                "effective_kind": "realizacion",
            },
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/installments/{quota['id']}/confirm", headers=headers[0]
        ).status_code
        == 200
    )
    assert pay(setup, s, "100").status_code == 201
    assert (
        client.put(
            root + f"/events/{event['id']}",
            headers=headers[0],
            json={
                "description": "Audiencia reprogramada",
                "scheduled_date": (d.today() + timedelta(days=8)).isoformat(),
            },
        ).status_code
        == 200
    )
    updated = client.get(root + "/services", headers=headers[0]).json()[0]
    assert updated["installments"][1]["state"] == "pendiente de evento"
    assert updated["installments"][1]["review_required"]
    assert Decimal(updated["installments"][0]["paid"]) == Decimal(100)


def test_multiple_services_count_one_case(setup):
    client, headers, _, _ = setup
    _, case = make_case(setup)
    service(setup, case)
    service(setup, case, "800")
    report = client.get("/reports/economic", headers=headers[0]).json()
    assert report["areas"][0]["total"] == 1
    assert Decimal(report["totals"]["contracted"]) == Decimal(1800)


def test_alerts_weekdays_idempotent_and_read_not_resolution(setup):
    assert d.shift(date(2026, 10, 5), -3) == date(2026, 9, 30)
    assert d.shift(date(2026, 10, 4), -1) == date(2026, 10, 2)
    client, headers, ids, engine = setup
    _, case = make_case(setup)
    root = f"/cases/{case['id']}"
    task = {
        "description": "Presentar escrito",
        "responsible_id": ids[0],
        "due_date": d.today().isoformat(),
    }
    created = client.post(root + "/tasks", headers=headers[0], json=task).json()
    first = client.get("/alerts", headers=headers[0])
    assert first.status_code == 200, first.text
    data = first.json()
    assert len(data) == 1
    assert client.get("/alerts", headers=headers[0]).json()[0]["id"] == data[0]["id"]
    client.post(f"/alerts/{data[0]['id']}/read", headers=headers[0])
    assert len(client.get("/alerts", headers=headers[0]).json()) == 1
    client.put(
        root + f"/tasks/{created['id']}",
        headers=headers[0],
        json={**task, "status": "atendida"},
    )
    assert client.get("/alerts", headers=headers[0]).json() == []
    with Session(engine) as db:
        assert all(x.status == "cancelado" for x in db.scalars(select(m.Notice)))


def test_financial_files_and_service_fields_hidden(setup):
    client, headers, ids, _ = setup
    _, case = make_case(setup)
    service(setup, case)
    root = f"/cases/{case['id']}"
    client.post(
        root + "/access", headers=headers[0], json={"user_id": ids[1], "level": "edit"}
    )
    file = client.post(
        root + "/files",
        headers=headers[0],
        json={
            "title": "Contrato económico",
            "url": "https://drive.google.com/file/d/example",
            "classification": "financiero",
        },
    ).json()
    assert client.get(root + "/files", headers=headers[1]).json() == []
    assert (
        client.get(f"/files/{file['id']}/open", headers=headers[1]).status_code == 403
    )
    view = client.get(root + "/services", headers=headers[1]).json()[0]
    assert not {"fee", "installments", "payments"} & set(view)


def test_percent_rounding_and_actual_vs_registration_date(setup):
    client, headers, ids, _ = setup
    _, case = make_case(setup)
    s = service(
        setup,
        case,
        "10",
        plan=[
            {
                "percentage": "33.33",
                "condition": "fecha",
                "due_date": d.today().isoformat(),
            },
            {
                "percentage": "33.33",
                "condition": "fecha",
                "due_date": d.today().isoformat(),
            },
            {
                "percentage": "33.34",
                "condition": "fecha",
                "due_date": d.today().isoformat(),
            },
        ],
    )
    assert sum(Decimal(x["amount"]) for x in s["installments"]) == Decimal(10)
    row = client.post(
        f"/cases/{case['id']}/entries",
        headers=headers[0],
        json={"action_date": "2020-01-01", "description": "Actuación anterior"},
    ).json()
    assert row["action_date"] == "2020-01-01"
    assert row["created_at"][:10] != row["action_date"]
    assert row["registered_by"] == ids[0]


def test_login_and_health(setup):
    client, _, _, _ = setup
    assert client.get("/health").status_code == 200
    assert (
        client.post(
            "/auth/login",
            json={"username": "david", "password": "password-test-123"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/auth/login", json={"username": "nadie", "password": "wrong"}
        ).status_code
        == 401
    )
