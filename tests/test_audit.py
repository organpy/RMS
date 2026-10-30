def _log(admin, **params):
    return admin.get("/api/audit", params=params).json()["items"]


def test_changes_are_audited_with_who_and_what(admin):
    course = admin.post("/api/courses", json={"name": "Judo"}).json()
    group = admin.post(f"/api/courses/{course['id']}/groups", json={"name": "A"}).json()
    plan = admin.post("/api/plans", json={"name": "Gold", "price": "50", "interval_days": 30}).json()
    m = admin.post("/api/members", json={"first_name": "Ana", "last_name": "A", "course_id": course["id"]}).json()
    admin.patch(f"/api/members/{m['id']}", json={"phone": "+1555", "group_id": group["id"]})
    admin.patch(f"/api/members/{m['id']}", json={"archived": True})
    p = admin.post("/api/payments", json={"member_id": m["id"], "plan_id": plan["id"]}).json()
    admin.post(f"/api/payments/{p['id']}/refund")
    admin.post("/api/expenses", json={"category": "Rent", "description": "Rent", "amount": "10"})
    admin.patch("/api/organization", json={"name": "New name", "grace_days": 3})
    admin.delete(f"/api/members/{m['id']}")

    rows = [(r["action"], r["entity"], r["summary"]) for r in reversed(_log(admin))]
    assert rows[:4] == [
        ("created", "course", "Judo"),
        ("created", "group", "Judo · A"),
        ("created", "plan", "Gold"),
        ("created", "member", "Ana A"),
    ]
    assert ("updated", "member", "Ana A (group_id, phone)") in rows
    assert ("archived", "member", "Ana A") in rows
    assert ("created", "payment", f"{p['invoice_number']} · Ana A · 50.00") in rows
    assert ("refunded", "payment", f"{p['invoice_number']} · Ana A · 50.00") in rows
    assert ("created", "expense", "Rent · Rent · 10.00") in rows
    assert ("updated", "settings", "name, grace_days") in rows
    assert rows[-1] == ("deleted", "member", "Ana A")
    assert {r["staff_name"] for r in _log(admin)} == {"Ada Admin"}
    assert _log(admin, entity="expense")[0]["summary"].startswith("Rent")


def test_staff_and_backup_changes_never_log_secrets(admin):
    s = admin.post("/api/staff", json={"username": "sam", "name": "Sam", "password": "password1"}).json()
    admin.patch(f"/api/staff/{s['id']}", json={"password": "new-secret-pass", "role": "admin"})
    admin.post("/api/backups")
    admin.put("/api/backups/schedule", json={"backup_enabled": True, "backup_cadence": "weekly", "backup_keep": 3})
    rows = _log(admin)
    summaries = [r["summary"] for r in rows]
    assert "Sam (staff)" in summaries and "Sam (role, password)" in summaries
    assert not any("secret" in x or "password1" in x for x in summaries)
    assert any(r["entity"] == "backup" and r["action"] == "created" and r["summary"].endswith(".zip") for r in rows)
    assert any(r["summary"] == "schedule: on, weekly, keep 3" for r in rows)


def test_audit_log_is_admin_only(admin):
    admin.post("/api/staff", json={"username": "sam", "name": "Sam", "password": "password1"})
    admin.post("/api/auth/logout")
    admin.post("/api/auth/login", json={"username": "sam", "password": "password1"})
    assert admin.get("/api/audit").status_code == 403
    m = admin.post("/api/members", json={"first_name": "Bo", "last_name": "B"}).json()
    admin.post("/api/auth/logout")
    admin.post("/api/auth/login", json={"username": "admin", "password": "correct-horse"})
    assert (_log(admin)[0]["staff_name"], _log(admin)[0]["summary"]) == ("Sam", "Bo B")
    assert m["id"]
