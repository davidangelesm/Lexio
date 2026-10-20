from datetime import date

import domain as d
import pytest
from test_integral_flow import create


@pytest.mark.parametrize("day,anticipation", [(13, 5), (15, 3), (16, 2), (19, 1), (20, 0), (21, 0)])
def test_fresh_session_shows_latest_legal_other_and_payment_reminders(setup, monkeypatch, day, anticipation):
    client, headers, ids, _ = setup
    case = create(setup, team_member_id=ids[1], installments=[{"amount": "1000.00", "due_date": "2026-10-20"}])
    for kind in ("legal", "otro"):
        assert client.post(f"/cases/{case['id']}/entries", headers=headers[0], json={
            "action_date": "2026-10-12", "subject": f"Aviso {kind}", "subject_type": kind,
            "description": "Detalle", "alert_date": "2026-10-20",
        }).status_code == 201
    monkeypatch.setattr(d, "today", lambda: date(2026, 10, day))
    for header, kinds in ((headers[0], {"legal", "otro", "pago"}), (headers[1], {"legal", "otro"})):
        alerts = client.get("/alerts", headers=header).json()
        assert len(alerts) == len(kinds) and {x["kind"] for x in alerts} == kinds
        assert all(x["anticipation"] == anticipation and x["target_date"] == "2026-10-20" for x in alerts)
        assert all(x["urgent"] == (day > 20) for x in alerts)
        for alert in alerts:
            client.post(f"/alerts/{alert['id']}/read", headers=header)
        remaining = client.get("/alerts", headers=header).json()
        assert len(remaining) == (len(kinds) if day > 20 else 0)
    assert client.get("/alerts", headers=headers[2]).json() == []
