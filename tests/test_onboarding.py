from backend.modules.messaging import providers


def _steps(client):
    return {s["id"]: s["done"] for s in client.get("/api/onboarding").json()["steps"]}


def test_steps_complete_as_data_appears(admin, monkeypatch):
    monkeypatch.setattr(providers, "configured", lambda: {"email": False, "sms": False, "whatsapp": False})
    r = admin.get("/api/onboarding").json()
    assert r["completed"] == 0 and r["total"] == 8 and r["dismissed"] is False
    assert {s["id"] for s in r["steps"] if s["optional"]} == {"messaging", "staff"}

    admin.patch("/api/organization", json={"phone": "+1 555 0100"})
    course = admin.post("/api/courses", json={"name": "Judo"}).json()
    admin.post("/api/plans", json={"name": "Monthly", "price": "30", "interval_days": 30, "course_id": course["id"]})
    member = admin.post("/api/members", json={"first_name": "Ana", "last_name": "A"}).json()
    admin.post("/api/payments", json={"member_id": member["id"], "amount": "30"})
    admin.post("/api/staff", json={"username": "sam", "name": "Sam", "password": "password1"})

    steps = _steps(admin)
    assert all(steps[k] for k in ("organization", "course", "plan", "members", "payment", "staff"))
    assert not steps["backups"] and not steps["messaging"]

    monkeypatch.setattr(providers, "configured", lambda: {"email": True, "sms": False, "whatsapp": False})
    assert _steps(admin)["messaging"]


def test_only_admins_dismiss(admin):
    admin.post("/api/staff", json={"username": "sam", "name": "Sam", "password": "password1", "role": "staff"})
    assert admin.put("/api/onboarding", json={"dismissed": True}).json()["dismissed"] is True
    admin.post("/api/auth/logout")
    admin.post("/api/auth/login", json={"username": "sam", "password": "password1"})
    assert admin.get("/api/onboarding").json()["dismissed"] is True
    assert admin.put("/api/onboarding", json={"dismissed": False}).status_code == 403
