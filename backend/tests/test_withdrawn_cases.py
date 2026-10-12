import json

import models as m
from sqlalchemy import select
from sqlalchemy.orm import Session

from test_integral_flow import abono, create


def test_withdrawn_cases_preserve_history_alerts_debt_and_count_separately(setup):
    client, headers, _, engine = setup
    case = create(setup)
    create(setup, document="88888888", status="concluido")
    retired = create(setup, document="77777777", status="retirado")
    assert retired["status"] == "retirado"
    entry = client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={
        "action_date": "2026-10-08", "subject": "Plazo pendiente",
        "description": "Conservar el historial", "alert_date": "2026-10-15",
    }).json()
    assert abono(client, headers[0], case, "100.00").status_code == 201
    alerts_before = client.get("/alerts", headers=headers[0]).json()
    response = client.put(f"/cases/{case['id']}", headers=headers[0], json={"status": "retirado"})
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "retirado"
    assert result["balance"] == "900.00"
    assert len(result["payments"]) == 1 and len(result["installments"]) == 2
    assert client.get("/alerts", headers=headers[0]).json() == alerts_before
    assert client.get(f"/cases/{case['id']}/entries", headers=headers[0]).json()[0]["id"] == entry["id"]
    filtered = client.get("/cases", headers=headers[0], params={"status": "retirado"}).json()
    assert {row["id"] for row in filtered} == {case["id"], retired["id"]}
    totals = client.get("/reports", headers=headers[0]).json()["totals"]
    assert (totals["total_cases"], totals["active_cases"], totals["concluded_cases"], totals["withdrawn_cases"]) == (3, 0, 1, 2)
    assert totals["balance"] == "2900.00"
    assert client.get("/reports", headers=headers[2]).json()["totals"]["withdrawn_cases"] == 0
    with Session(engine) as db:
        audit = db.scalar(select(m.Audit).where(m.Audit.resource == "lexio_cases",
            m.Audit.resource_id == case["id"], m.Audit.action == "Actualizar caso"))
        assert json.loads(audit.changes)["after"]["status"] == "retirado"


def test_withdrawing_case_requires_edit_access_and_same_tenant(setup):
    client, headers, ids, _ = setup
    case = create(setup)
    path = f"/cases/{case['id']}"
    assert client.put(path, headers=headers[2], json={"status": "retirado"}).status_code == 404
    client.post(f"{path}/access", headers=headers[0], json={"user_id": ids[1], "level": "read"})
    assert client.put(path, headers=headers[1], json={"status": "retirado"}).status_code == 404
    client.post(f"{path}/access", headers=headers[0], json={"user_id": ids[1], "level": "edit"})
    result = client.put(path, headers=headers[1], json={"status": "retirado"})
    assert result.status_code == 200 and result.json()["status"] == "retirado"
    assert "fee" not in result.json() and "balance" not in result.json()
    report = client.get("/reports", headers=headers[1]).json()
    assert report["totals"]["withdrawn_cases"] == 1 and "fee" not in report["totals"]
