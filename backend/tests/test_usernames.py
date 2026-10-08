import models as m
import pytest
from sqlalchemy.orm import Session


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
