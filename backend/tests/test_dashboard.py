from datetime import date, timedelta

import models as m
from sqlalchemy import select
from sqlalchemy.orm import Session

from test_integral_flow import abono, create, ficha


def test_dashboard_counts_finances_and_upcoming_partial_overdue_payments(setup):
    client, headers, ids, engine = setup
    case = create(setup, responsible_id=ids[1], installments=[
        {"amount": "500.00", "due_date": "2026-10-07"},
        {"amount": "500.00", "due_date": "2026-11-07"},
    ])
    assert abono(client, headers[0], case, "400.00").status_code == 201
    for values in [
        {"description": "Obligación próxima", "alert_date": "2026-10-15"},
        {"description": "Obligación futura", "alert_date": "2026-12-01"},
        {"description": "Solo actuación"},
    ]:
        assert client.post(f"/cases/{case['id']}/entries", headers=headers[1], json={"action_date": "2026-10-08", **values}).status_code == 201
    # Leer un recordatorio no completa la obligación ni modifica el conteo del panel.
    legal = next(x for x in client.get("/alerts", headers=headers[0]).json() if x["kind"] == "legal")
    client.post(f"/alerts/{legal['id']}/read", headers=headers[0])
    response = client.get("/dashboard", headers=headers[0])
    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["counts"] == {"total_cases": 1, "active_cases": 1, "concluded_cases": 0, "pending_legal_alerts": 2}
    assert dashboard["finance"] == {"fee": "1000.00", "paid": "400.00", "balance": "600.00"}
    upcoming = dashboard["upcoming_payments"]
    assert len(upcoming) == 2
    assert upcoming[0] == {
        "id": case["installments"][0]["id"], "case_id": case["id"], "process_type": "Cobro de deuda",
        "client_code": case["client"]["code"], "client_name": "María Torres", "number": 1,
        "due_date": "2026-10-07", "amount": "500.00", "paid": "400.00", "balance": "100.00", "responsible_name": "Abogado",
    }
    assert upcoming[1]["due_date"] == "2026-11-07" and upcoming[1]["balance"] == "500.00"
    client.post(f"/entries/{legal['entry_id']}/attend", headers=headers[1])
    client.put(f"/cases/{case['id']}", headers=headers[0], json={"status": "concluido"})
    dashboard = client.get("/dashboard", headers=headers[0]).json()
    assert dashboard["counts"] == {"total_cases": 1, "active_cases": 0, "concluded_cases": 1, "pending_legal_alerts": 1}
    assert dashboard["finance"]["balance"] == "600.00" and len(dashboard["upcoming_payments"]) == 2
    with Session(engine) as db:
        # El panel no crea ni cambia avisos; solamente lee datos de negocio.
        before = [(x.id, x.status, x.read_at) for x in db.scalars(select(m.Notice))]
    client.get("/dashboard", headers=headers[0])
    with Session(engine) as db:
        assert [(x.id, x.status, x.read_at) for x in db.scalars(select(m.Notice))] == before


def test_dashboard_payment_window_limit_and_paid_installments_omitted(setup):
    client, headers, _, _ = setup
    plan = [{"amount": "100.00", "due_date": (date(2026, 10, 7) + timedelta(days=i)).isoformat()} for i in range(12)]
    plan.append({"amount": "100.00", "due_date": "2026-11-08"})
    case = create(setup, fee="1300.00", installments=plan)
    assert abono(client, headers[0], case, "100.00").status_code == 201
    upcoming = client.get("/dashboard", headers=headers[0]).json()["upcoming_payments"]
    assert len(upcoming) == 10
    assert [x["number"] for x in upcoming] == list(range(2, 12))
    assert [x["due_date"] for x in upcoming] == sorted(x["due_date"] for x in upcoming)
    assert all(x["id"] != case["installments"][0]["id"] for x in upcoming)
    assert abono(client, headers[0], case, "1100.00").status_code == 201
    # La única cuota restante está a 31 días y queda fuera del panel de próximos cobros.
    dashboard = client.get("/dashboard", headers=headers[0]).json()
    assert dashboard["upcoming_payments"] == []
    assert dashboard["finance"]["balance"] == "100.00"


def test_dashboard_isolates_tenants_and_excludes_staff_financial_data(setup):
    client, headers, ids, _ = setup
    case = create(setup)
    client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={"action_date": "2026-10-08", "description": "Plazo legal", "alert_date": "2026-10-15"})
    assert client.get("/dashboard", headers=headers[1]).json() == {
        "counts": {"total_cases": 0, "active_cases": 0, "concluded_cases": 0, "pending_legal_alerts": 0},
    }
    foreign = client.get("/dashboard", headers=headers[2]).json()
    assert foreign == {
        "counts": {"total_cases": 0, "active_cases": 0, "concluded_cases": 0, "pending_legal_alerts": 0},
        "finance": {"fee": "0.00", "paid": "0.00", "balance": "0.00"}, "upcoming_payments": [],
    }
    client.post(f"/cases/{case['id']}/access", headers=headers[0], json={"user_id": ids[1], "level": "read"})
    visible = client.get("/dashboard", headers=headers[1]).json()
    assert visible == {"counts": {"total_cases": 1, "active_cases": 1, "concluded_cases": 0, "pending_legal_alerts": 1}}
    # Tener otro estudio con sus datos no altera los indicadores del estudio actual.
    result = client.post("/cases", headers=headers[2], json=ficha(document="87654321", fee="500.00", installments=[{"amount": "500.00", "due_date": "2026-10-15"}]))
    assert result.status_code == 201
    own = client.get("/dashboard", headers=headers[0]).json()
    foreign = client.get("/dashboard", headers=headers[2]).json()
    assert own["finance"]["fee"] == "1000.00" and own["counts"]["total_cases"] == 1
    assert foreign["finance"]["fee"] == "500.00" and foreign["counts"]["pending_legal_alerts"] == 0
    assert {x["case_id"] for x in own["upcoming_payments"]} == {case["id"]}
    assert {x["case_id"] for x in foreign["upcoming_payments"]} == {result.json()["id"]}
    assert client.get("/dashboard").status_code == 401
