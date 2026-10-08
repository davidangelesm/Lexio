import models as m
import pytest
from sqlalchemy.orm import Session
from rename_admin import rename_admin


def account(username: str) -> dict:
    return {
        "name": "Abogado nuevo",
        "username": username,
        "password": "password-test-123",
    }


def test_login_normalizes_username_and_rejects_old_email_contract(setup):
    client, _, ids, _ = setup
    result = client.post(
        "/auth/login",
        json={"username": "  DaViD  ", "password": "password-test-123"},
    )
    assert result.status_code == 200
    assert result.json()["user"]["id"] == ids[0]
    assert result.json()["user"]["username"] == "david"
    assert not {"email", "tenant_id", "password_hash"} & result.json()["user"].keys()
    assert client.post(
        "/auth/login",
        json={"email": "david@test.pe", "password": "password-test-123"},
    ).status_code == 422
    assert client.post(
        "/auth/login", json={"username": "david", "password": "wrong"}
    ).status_code == 401


def test_username_global_uniqueness_and_permissions(setup):
    client, headers, _, _ = setup
    created = client.post("/users", headers=headers[0], json=account("  Juan.Perez  "))
    assert created.status_code == 201
    assert created.json()["username"] == "juan.perez"
    assert created.json()["role"] == "staff"
    assert client.post(
        "/users", headers=headers[2], json=account("JUAN.PEREZ")
    ).status_code == 409
    assert client.post(
        "/users", headers=headers[1], json=account("nuevo")
    ).status_code == 403
    assert client.post(
        "/auth/login",
        json={"username": "Juan.Perez", "password": "password-test-123"},
    ).json()["user"]["id"] == created.json()["id"]


@pytest.mark.parametrize("username", ["ab", "a" * 51, "juan perez", "josé", "x@test.pe", "_juan", "juan/uno"])
def test_invalid_username_rejected(setup, username):
    client, headers, _, _ = setup
    assert client.post("/users", headers=headers[0], json=account(username)).status_code == 422


def test_rename_preserves_account_and_enforces_isolation(setup):
    client, headers, ids, engine = setup
    update = {
        "name": "Abogado",
        "username": "nuevo.abogado",
        "active": True,
        "can_create_clients": False,
        "can_create_cases": False,
    }
    url = f"/users/{ids[1]}"
    assert client.put(url, headers=headers[2], json=update).status_code == 404
    assert client.put(url, headers=headers[0], json={**update, "username": "OTRO"}).status_code == 409
    assert client.get("/users", headers=headers[0]).json()[1]["username"] == "abogado"
    assert client.put(url, headers=headers[0], json=update).status_code == 200
    assert client.post(
        "/auth/login", json={"username": "abogado", "password": "password-test-123"}
    ).status_code == 401

    assert client.post(
        "/auth/login", json={"username": "nuevo.abogado", "password": "password-test-123"}
    ).json()["user"]["id"] == ids[1]
    with Session(engine) as db:
        user = db.get(m.User, ids[1])
        user.active = False
        db.commit()
    assert client.post(
        "/auth/login", json={"username": "nuevo.abogado", "password": "password-test-123"}
    ).status_code == 401


def test_admin_rename_preserves_password_role_and_tenant(setup):
    client, _, ids, engine = setup
    with Session(engine) as db:
        original = db.get(m.User, ids[0])
        original_values = (original.password_hash, original.role, original.tenant_id)
        rename_admin(db, "david", "Admin")
        changed = db.get(m.User, ids[0])
        assert changed.username == "admin"
        assert (changed.password_hash, changed.role, changed.tenant_id) == original_values
    response = client.post(
        "/auth/login", json={"username": "Admin", "password": "password-test-123"}
    )
    assert response.status_code == 200
    assert response.json()["user"]["id"] == ids[0]


def test_password_minimum_for_creation_and_update(setup):
    client, headers, _, _ = setup
    assert client.post(
        "/users", headers=headers[0], json={**account("asistente"), "password": "abc12"}
    ).status_code == 422
    created = client.post(
        "/users", headers=headers[0], json={**account("asistente"), "password": "abc123"}
    )
    assert created.status_code == 201
    url = f"/users/{created.json()['id']}"
    data = {
        "username": "asistente",
        "name": "Asistente",
        "active": True,
        "can_create_clients": False,
        "can_create_cases": False,
        "password": "xyz12",
    }
    assert client.put(url, headers=headers[0], json=data).status_code == 422
    assert client.put(url, headers=headers[0], json={**data, "password": "xyz123"}).status_code == 200
    assert client.post(
        "/auth/login", json={"username": "asistente", "password": "xyz123"}
    ).status_code == 200
