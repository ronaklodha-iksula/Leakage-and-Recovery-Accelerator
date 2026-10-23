# Pending-user access flow: new sign-up is pending (403 on data), admin approves via PATCH role, user gets access.
import subprocess
import pytest
import requests
from conftest import BASE_URL, client

H = "/app/scripts/clerk_pending_helper.py"
EMAIL = "TEST_pendingreg+clerk_test@example.com".lower()


def _run(*a):
    return subprocess.run(["python3", H, *a], capture_output=True, text=True, timeout=60).stdout.strip().splitlines()[-1]


@pytest.fixture(scope="module")
def pending_user():
    uid = _run("create", EMAIL)
    jwt = _run("jwt", uid)
    yield uid, jwt
    _run("delete", EMAIL)


def _s(jwt):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {jwt}"})
    return s


def test_no_token_401():
    assert requests.get(f"{BASE_URL}/api/me").status_code == 401


def test_new_user_is_pending(pending_user):
    uid, jwt = pending_user
    me = _s(jwt).get(f"{BASE_URL}/api/me")
    assert me.status_code == 200
    d = me.json()
    assert d["role"] == "pending" and d["email"] == EMAIL and d["caps"] == []
    assert "_id" not in d


def test_pending_recheck_does_not_promote_non_admin(pending_user):
    uid, jwt = pending_user
    s = _s(jwt)
    for _ in range(2):
        assert s.get(f"{BASE_URL}/api/me").json()["role"] == "pending"
    assert s.get(f"{BASE_URL}/api/dashboard").status_code == 403


def test_pending_cannot_change_roles(pending_user):
    uid, jwt = pending_user
    r = _s(jwt).patch(f"{BASE_URL}/api/users/{uid}/role", json={"role": "admin"})
    assert r.status_code == 403


def test_admin_lists_and_approves_pending(pending_user):
    uid, jwt = pending_user
    admin = client("admin")
    users = admin.get(f"{BASE_URL}/api/users").json()["users"]
    assert any(u["user_id"] == uid and u["role"] == "pending" for u in users)
    r = admin.patch(f"{BASE_URL}/api/users/{uid}/role", json={"role": "analyst"})
    assert r.status_code == 200 and r.json()["role"] == "analyst"
    me = _s(jwt).get(f"{BASE_URL}/api/me").json()
    assert me["role"] == "analyst" and "upload" in me["caps"]
    assert _s(jwt).get(f"{BASE_URL}/api/dashboard").status_code == 200


def test_invalid_role_rejected(pending_user):
    uid, _ = pending_user
    r = client("admin").patch(f"{BASE_URL}/api/users/{uid}/role", json={"role": "superuser"})
    assert r.status_code == 403
