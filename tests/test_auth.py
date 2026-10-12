from tests.conftest import SETUP


def test_status_reports_setup_required(client):
    assert client.get("/api/auth/status").json() == {"setup_required": True}


def test_setup_creates_admin_and_signs_in(admin):
    me = admin.get("/api/auth/me").json()
    assert me["username"] == "admin" and me["role"] == "admin"
    assert admin.get("/api/auth/status").json() == {"setup_required": False}


def test_setup_only_once(admin):
    assert admin.post("/api/auth/setup", json=SETUP).status_code == 409


def test_login_logout_cycle(admin):
    admin.post("/api/auth/logout")
    assert admin.get("/api/auth/me").status_code == 401
    bad = admin.post("/api/auth/login", json={"username": "admin", "password": "nope"})
    assert bad.status_code == 401
    ok = admin.post("/api/auth/login", json={"username": "ADMIN", "password": SETUP["password"]})
    assert ok.status_code == 200
    assert admin.get("/api/auth/me").status_code == 200


def test_login_is_throttled(admin):
    admin.post("/api/auth/logout")
    for _ in range(5):
        admin.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    r = admin.post("/api/auth/login", json={"username": "admin", "password": SETUP["password"]})
    assert r.status_code == 429


def test_password_is_not_stored_in_plain_text(admin):
    from backend.core import db
    from backend.modules.staff.models import Staff

    with db.SessionLocal() as s:
        staff = s.query(Staff).one()
        assert SETUP["password"] not in staff.password_hash
        assert staff.password_hash.startswith("scrypt$")


def test_every_api_route_requires_auth(client):
    from backend.main import create_app

    public = {"/api/health", "/api/auth/status", "/api/auth/setup", "/api/auth/login", "/api/auth/logout", "/api/organization/logo"}
    for route in create_app().routes:
        path = getattr(route, "path", "")
        if not path.startswith("/api/") or path in public or "docs" in path or "openapi" in path:
            continue
        for method in route.methods - {"HEAD", "OPTIONS"}:
            url = path.replace("{", "").replace("}", "")
            url = url.replace("member_id", "1").replace("payment_id", "1").replace("course_id", "1")
            url = url.replace("group_id", "1").replace("plan_id", "1").replace("staff_id", "1").replace("filename", "x")
            r = client.request(method, url)
            assert r.status_code == 401, f"{method} {path} -> {r.status_code}"


def test_security_headers(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "default-src 'self'" in r.headers["content-security-policy"]


def test_change_own_password(admin):
    bad = admin.post("/api/auth/password", json={"current": "nope", "new": "new-password"})
    assert bad.status_code == 401
    assert admin.post("/api/auth/password", json={"current": SETUP["password"], "new": "new-password"}).status_code == 204
    admin.post("/api/auth/logout")
    assert admin.post("/api/auth/login", json={"username": "admin", "password": "new-password"}).status_code == 200
