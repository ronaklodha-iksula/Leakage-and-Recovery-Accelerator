import os
import subprocess
import pytest
import requests


def _base():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                url = line.split("=", 1)[1].strip()
    return url.rstrip("/")


BASE_URL = _base()
_TOK = {}


def token(role):
    if role not in _TOK:
        p = f"/tmp/tok_{role}.txt"
        if os.path.exists(p) and os.path.getmtime(p) > __import__("time").time() - 3000:
            _TOK[role] = open(p).read().strip()
        else:
            out = subprocess.run(["python3", "/app/scripts/clerk_test_users.py", role], capture_output=True, text=True)
            _TOK[role] = out.stdout.strip().splitlines()[-1]
            open(p, "w").write(_TOK[role])
    return _TOK[role]


def client(role):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token(role)}"})
    return s


@pytest.fixture(scope="session")
def base():
    return BASE_URL


@pytest.fixture(scope="session")
def c():
    return {r: client(r) for r in ["admin", "analyst", "approver", "assurance", "rule_author", "viewer_cfo"]}
