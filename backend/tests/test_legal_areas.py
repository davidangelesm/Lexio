import models as m
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from test_integral_flow import area_id, create, ficha


def add_area(engine, user_id, name):
    with Session(engine) as db:
        tenant_id = db.get(m.User, user_id).tenant_id
        area = m.LegalArea(tenant_id=tenant_id, name=name)
        db.add(area)
        db.commit()
        return area.id


def test_legal_area_catalog_requires_auth_and_is_tenant_scoped(setup):
    client, headers, _, _ = setup
    assert client.get("/legal-areas").status_code == 401
    own = client.get("/legal-areas", headers=headers[0]).json()
    staff = client.get("/legal-areas", headers=headers[1]).json()
    foreign = client.get("/legal-areas", headers=headers[2]).json()
    assert own == staff
    assert [row["name"] for row in own] == ["Civil", "Familia – Civil"]
    assert all(set(row) == {"id", "name"} for row in own + foreign)
    assert not {row["id"] for row in own} & {row["id"] for row in foreign}


def test_admin_creates_area_in_authenticated_tenant_with_audit_and_case_usage(setup):
    client, headers, ids, engine = setup
    response = client.post("/legal-areas", headers=headers[0], json={"name": "  Derecho marítimo  "})
    assert response.status_code == 201
    area = response.json()
    assert set(area) == {"id", "name"}
    assert area["name"] == "Derecho marítimo"
    assert area in client.get("/legal-areas", headers=headers[1]).json()
    assert area not in client.get("/legal-areas", headers=headers[2]).json()
    with Session(engine) as db:
        row = db.get(m.LegalArea, area["id"])
        user = db.get(m.User, ids[0])
        assert row.tenant_id == user.tenant_id
        audit = db.scalar(select(m.Audit).where(m.Audit.resource == "lexio_legal_areas"))
        assert audit.resource_id == row.id
        assert audit.user_id == user.id and audit.tenant_id == user.tenant_id
        assert audit.action == "Agregar rama de derecho"
    assert create(setup, area_id=area["id"])["area"] == area["name"]


def test_area_creation_requires_admin_and_rejects_frontend_tenant(setup):
    client, headers, _, engine = setup
    assert client.post("/legal-areas", json={"name": "Penal"}).status_code == 401
    assert client.post("/legal-areas", headers=headers[1], json={"name": "Penal"}).status_code == 403
    assert client.post("/legal-areas", headers=headers[0], json={"name": "Penal", "tenant_id": 2}).status_code == 422
    with Session(engine) as db:
        assert db.scalar(select(func.count(m.LegalArea.id))) == 4
        assert db.scalar(select(func.count(m.Audit.id))) == 0


@pytest.mark.parametrize("name", ["", "   ", "x" * 81, None])
def test_area_creation_validates_name(setup, name):
    client, headers, _, _ = setup
    assert client.post("/legal-areas", headers=headers[0], json={"name": name}).status_code == 422


def test_duplicate_area_is_rejected_without_audit_and_other_tenant_can_use_same_name(setup):
    client, headers, _, engine = setup
    assert client.post("/legal-areas", headers=headers[0], json={"name": "Penal"}).status_code == 201
    response = client.post("/legal-areas", headers=headers[0], json={"name": "  Penal  "})
    assert response.status_code == 409
    assert response.json()["detail"] == "Ya existe una rama de derecho con ese nombre en el estudio"
    assert client.post("/legal-areas", headers=headers[2], json={"name": "Penal"}).status_code == 201
    with Session(engine) as db:
        assert db.scalar(select(func.count(m.LegalArea.id))) == 6
        assert db.scalar(select(func.count(m.Audit.id))) == 2


def test_new_and_renamed_catalog_names_appear_in_cases_filters_and_reports(setup):
    client, headers, ids, engine = setup
    branch_id = add_area(engine, ids[0], "Derecho marítimo")
    other_id = add_area(engine, ids[0], "Derecho aduanero")
    catalog = client.get("/legal-areas", headers=headers[0]).json()
    assert [row["name"] for row in catalog] == sorted(row["name"] for row in catalog)
    assert {"id": branch_id, "name": "Derecho marítimo"} in catalog
    case = create(setup, area_id=branch_id)
    second = create(setup, document="88888888", area_id=branch_id)
    assert case["area_id"] == branch_id and case["area"] == "Derecho marítimo"
    assert len(client.get("/cases", headers=headers[0], params={"area_id": branch_id}).json()) == 2
    assert client.get("/cases", headers=headers[0], params={"area_id": other_id}).json() == []
    assert client.put(f"/cases/{second['id']}", headers=headers[0], json={"status": "concluido"}).status_code == 200
    with Session(engine) as db:
        db.get(m.LegalArea, branch_id).name = "Derecho marítimo y portuario"
        db.commit()
    assert {"id": branch_id, "name": "Derecho marítimo y portuario"} in client.get("/legal-areas", headers=headers[0]).json()
    assert client.get(f"/cases/{case['id']}", headers=headers[0]).json()["area"] == "Derecho marítimo y portuario"
    assert all(row["area"] == "Derecho marítimo y portuario" for row in client.get("/cases", headers=headers[0]).json())
    report = client.get("/reports", headers=headers[0]).json()
    assert report["rows"] == [{"area_id": branch_id, "area": "Derecho marítimo y portuario",
        "total_cases": 2, "active_cases": 1, "concluded_cases": 1, "withdrawn_cases": 0,
        "fee": "2000.00", "paid": "0.00", "balance": "2000.00", "uncollectible": "0.00"}]
    changed = client.put(f"/cases/{case['id']}", headers=headers[0], json={"area_id": other_id})
    assert changed.status_code == 200 and changed.json()["area"] == "Derecho aduanero"
    assert changed.json()["area_id"] == other_id
    rows = client.get("/reports", headers=headers[0]).json()["rows"]
    assert {row["area_id"] for row in rows} == {branch_id, other_id}


def test_foreign_and_missing_catalog_assignments_are_rejected_before_writes(setup):
    client, headers, _, engine = setup
    case = create(setup)
    foreign_id = area_id(client, headers[2])
    with Session(engine) as db:
        audits_before = db.scalar(select(func.count(m.Audit.id)))
    for invalid_id in (foreign_id, 99999):
        assert client.post("/cases", headers=headers[0],
            json=ficha(document="88888888", area_id=invalid_id)).status_code == 404
        response = client.put(f"/cases/{case['id']}", headers=headers[0],
            json={"area_id": invalid_id, "client": {**ficha()["client"], "name": "No debe guardarse"}})
        assert response.status_code == 404
        assert client.get("/cases", headers=headers[0], params={"area_id": invalid_id}).status_code == 404
    with Session(engine) as db:
        assert db.scalar(select(func.count(m.Client.id))) == 1
        assert db.scalar(select(func.count(m.Case.id))) == 1
        assert db.scalar(select(func.count(m.Audit.id))) == audits_before
        assert db.get(m.Client, case["client"]["id"]).name == case["client"]["name"]
        assert db.get(m.Case, case["id"]).area_id == case["area_id"]


@pytest.mark.parametrize("invalid_id", [None, 0, -1, "Civil"])
def test_case_area_requires_a_valid_catalog_id(setup, invalid_id):
    client, headers, _, _ = setup
    assert client.post("/cases", headers=headers[0], json=ficha(area_id=invalid_id)).status_code == 422
    case = create(setup)
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"area_id": invalid_id}).status_code == 422


def test_free_text_area_is_no_longer_an_accepted_input(setup):
    client, headers, _, _ = setup
    data = ficha()
    del data["area_id"]
    data["area"] = "Civil"
    assert client.post("/cases", headers=headers[0], json=data).status_code == 422
    case = create(setup)
    assert client.put(f"/cases/{case['id']}", headers=headers[0], json={"area": "Civil"}).status_code == 422


def test_catalog_foreign_key_restricts_deletion_and_cross_tenant_relations(setup):
    client, headers, _, engine = setup
    case = create(setup)
    foreign_id = area_id(client, headers[2])
    with Session(engine) as db:
        db.delete(db.get(m.LegalArea, case["area_id"]))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        db.get(m.Case, case["id"]).area_id = foreign_id
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        assert db.get(m.Case, case["id"]).area_id == case["area_id"]


def test_empty_and_duplicate_catalog_names_are_rejected_by_database(setup):
    _, _, ids, engine = setup
    with Session(engine) as db:
        tenant_id = db.get(m.User, ids[0]).tenant_id
        for name in ("   ", "Civil"):
            db.add(m.LegalArea(tenant_id=tenant_id, name=name))
            with pytest.raises(IntegrityError):
                db.commit()
            db.rollback()
