from test_acceptance import make_case


def test_case_area_and_filters_only_accept_catalog(setup):
    client, headers, ids, _ = setup
    customer, case = make_case(setup)
    data = {
        "client_id": customer["id"], "area": "Otra rama", "subject": "Caso de prueba",
        "description": "Prueba", "initial_stage": "Inicio", "current_stage": "Inicio",
        "start_date": "2026-10-08", "responsible_id": ids[0],
    }
    assert client.post("/cases", headers=headers[0], json=data).status_code == 422
    data["area"] = "Familia – Civil"
    created = client.post("/cases", headers=headers[0], json=data)
    assert created.status_code == 201
    assert created.json()["area"] == "Familia – Civil"
    update = {"area": "Otra rama", "subject": "Prueba", "description": "Prueba",
              "current_stage": "Inicio", "status": "activo", "responsible_id": ids[0]}
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json=update).status_code == 422
    for route in ("/cases", "/reports/operational", "/reports/economic", "/reports/collections"):
        assert client.get(route, headers=headers[0], params={"area": "Otra rama"}).status_code == 422
    filtered = client.get("/cases", headers=headers[0], params={"area": "Familia – Civil"})
    assert filtered.status_code == 200
    assert [row["id"] for row in filtered.json()] == [created.json()["id"]]
