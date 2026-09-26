def _add(client, username="sam", role="staff"):
    return client.post("/api/staff", json={"username": username, "name": "Sam", "password": "password1", "role": role})


def test_admin_manages_staff(admin):
    r = _add(admin)
    assert r.status_code == 201
    assert _add(admin).status_code == 409
    sid = r.json()["id"]
    assert admin.patch(f"/api/staff/{sid}", json={"active": False}).json()["active"] is False
    assert len(admin.get("/api/staff").json()) == 2


def test_staff_role_cannot_manage_staff(admin):
    _add(admin)
    admin.post("/api/auth/logout")
    admin.post("/api/auth/login", json={"username": "sam", "password": "password1"})
    assert admin.get("/api/staff").status_code == 403


def test_admin_cannot_demote_self(admin):
    me = admin.get("/api/auth/me").json()
    assert admin.patch(f"/api/staff/{me['id']}", json={"role": "staff"}).status_code == 400


def test_deactivated_staff_cannot_log_in(admin):
    sid = _add(admin).json()["id"]
    admin.patch(f"/api/staff/{sid}", json={"active": False})
    r = admin.post("/api/auth/login", json={"username": "sam", "password": "password1"})
    assert r.status_code == 401
