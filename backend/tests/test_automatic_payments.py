from datetime import timedelta
from decimal import Decimal

import domain as d
from test_acceptance import make_case, service


def setup_service(setup):
    _, case = make_case(setup)
    contract = service(setup, case, plan=[
        {"amount": "500", "condition": "fecha", "due_date": (d.today() + timedelta(days=7)).isoformat()},
        {"amount": "500", "condition": "fecha", "due_date": (d.today() - timedelta(days=1)).isoformat()},
    ])
    return case, contract


def payment(setup, contract, amount, **extra):
    client, headers, _, _ = setup
    response = client.post(f"/services/{contract['id']}/payments", headers=headers[0], json={
        "payment_date": d.today().isoformat(), "amount": amount, "method": "Efectivo", **extra,
    })
    assert response.status_code == 201, response.text
    return response.json()


def balances(setup, case):
    client, headers, _, _ = setup
    contract = client.get(f"/cases/{case['id']}/services", headers=headers[0]).json()[0]
    return [Decimal(row["balance"]) for row in sorted(contract["installments"], key=lambda row: row["number"])]


def test_default_payment_fills_first_then_second_and_excess_credit(setup):
    client, headers, _, _ = setup
    case, contract = setup_service(setup)
    payment(setup, contract, "400")
    assert balances(setup, case) == [Decimal("100"), Decimal("500")]
    payment(setup, contract, "650", applications=None)
    assert balances(setup, case) == [Decimal("0"), Decimal("0")]
    totals = client.get("/reports/economic", headers=headers[0]).json()["totals"]
    assert Decimal(totals["credit"]) == Decimal("50")
    assert client.get(f"/services/{contract['id']}/payment-proposal", headers=headers[0]).json() == []


def test_manual_override_and_explicit_unapplied_credit(setup):
    case, contract = setup_service(setup)
    second = next(row for row in contract["installments"] if row["number"] == 2)
    payment(setup, contract, "200", applications=[{"installment_id": second["id"], "amount": "200"}])
    assert balances(setup, case) == [Decimal("500"), Decimal("300")]
    payment(setup, contract, "100", applications=[])
    assert balances(setup, case) == [Decimal("500"), Decimal("300")]


def test_reversal_restores_first_installment_and_cent_accuracy(setup):
    client, headers, _, _ = setup
    case, contract = setup_service(setup)
    original = payment(setup, contract, "500.01")
    assert balances(setup, case) == [Decimal("0"), Decimal("499.99")]
    assert client.post(f"/payments/{original['id']}/reverse", headers=headers[0], json={"reason": "Prueba"}).status_code == 200
    payment(setup, contract, "0.01")
    assert balances(setup, case) == [Decimal("499.99"), Decimal("500")]
    proposal = client.get(f"/services/{contract['id']}/payment-proposal", headers=headers[0]).json()
    assert [row["number"] for row in proposal] == [1, 2]
