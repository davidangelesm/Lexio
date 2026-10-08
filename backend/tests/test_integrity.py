from datetime import timedelta
from decimal import Decimal

import domain as d
import models as m
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from test_acceptance import make_case, service


def test_composite_foreign_key_rejects_other_tenant(setup):
    _, _, ids, engine = setup
    customer, _ = make_case(setup)
    with Session(engine) as db:
        db.add(
            m.Case(
                tenant_id=2,
                client_id=customer["id"],
                responsible_id=ids[2],
                area="Penal",
                subject="Inválido",
                description="Cross tenant",
                initial_stage="Inicio",
                current_stage="Inicio",
                status="activo",
                start_date=d.today(),
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()


def test_credit_allocation_and_overflow_rollback(setup):
    client, headers, _, _ = setup
    _, case = make_case(setup)
    s = service(setup, case)
    p = client.post(
        f"/services/{s['id']}/payments",
        headers=headers[0],
        json={
            "payment_date": d.today().isoformat(),
            "amount": "1200",
            "method": "Efectivo",
            "applications": [],
        },
    ).json()
    assert (
        client.post(
            f"/payments/{p['id']}/apply",
            headers=headers[0],
            json={
                "applications": [
                    {"installment_id": s["installments"][0]["id"], "amount": "1000"}
                ]
            },
        ).status_code
        == 200
    )
    totals = client.get("/reports/economic", headers=headers[0]).json()["totals"]
    assert Decimal(totals["balance"]) == 0
    assert Decimal(totals["credit"]) == 200
    assert isinstance(totals["balance"], str)
    assert (
        client.post(
            f"/payments/{p['id']}/apply",
            headers=headers[0],
            json={
                "applications": [
                    {"installment_id": s["installments"][0]["id"], "amount": "1"}
                ]
            },
        ).status_code
        == 422
    )


def test_reschedule_cancels_old_notices_preserves_paid(setup):
    client, headers, _, engine = setup
    _, case = make_case(setup)
    s = service(setup, case)
    old = client.get("/alerts", headers=headers[0]).json()
    assert old
    response = client.put(
        f"/installments/{s['installments'][0]['id']}/reschedule",
        headers=headers[0],
        json={
            "due_date": (d.today() + timedelta(days=20)).isoformat(),
            "reason": "Nuevo acuerdo con cliente",
        },
    )
    assert response.status_code == 200, response.text
    with Session(engine) as db:
        assert all(x.status == "cancelado" for x in db.scalars(select(m.Notice)))
    assert client.get("/alerts", headers=headers[0]).json() == []


def test_document_uniqueness_is_per_tenant(setup):
    client, headers, _, _ = setup
    customer, _ = make_case(setup)
    data = {
        "document_type": customer["document_type"],
        "document_number": customer["document_number"],
        "name": "Otro cliente",
    }
    assert client.post("/clients", headers=headers[0], json=data).status_code == 409
    assert client.post("/clients", headers=headers[2], json=data).status_code == 201


def test_pending_event_and_concluded_case_debt_in_reports(setup):
    client, headers, ids, _ = setup
    _, case = make_case(setup)
    service(setup, case)
    response = client.put(
        f"/cases/{case['id']}",
        headers=headers[0],
        json={
            "area": "Civil",
            "subject": "Cobranza",
            "description": "Concluido",
            "current_stage": "Finalizado",
            "status": "concluido",
            "responsible_id": ids[0],
        },
    )
    assert response.status_code == 200
    report = client.get("/reports/economic", headers=headers[0]).json()
    assert Decimal(report["totals"]["overdue"]) == 1000
    assert report["areas"][0]["concluido"] == 1


def test_assignment_requires_case_access_and_token_is_required(setup):
    client, headers, ids, _ = setup
    _, case = make_case(setup)
    assert (
        client.post(
            f"/cases/{case['id']}/tasks",
            headers=headers[0],
            json={
                "description": "Tarea",
                "responsible_id": ids[1],
                "due_date": d.today().isoformat(),
            },
        ).status_code
        == 404
    )
    assert client.get("/cases").status_code == 401
    assert (
        client.get("/cases", headers={"Authorization": "Bearer invalid"}).status_code
        == 401
    )
