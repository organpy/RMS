def test_plans_filter_by_course(admin):
    c = admin.post("/api/courses", json={"name": "Yoga"}).json()
    admin.post("/api/plans", json={"name": "Any monthly", "price": "40.00", "interval_days": 30})
    admin.post("/api/plans", json={"name": "Yoga term", "price": "99.5", "interval_days": 90, "course_id": c["id"]})
    other = admin.post("/api/courses", json={"name": "Boxing"}).json()
    admin.post("/api/plans", json={"name": "Boxing", "price": "10", "interval_days": 7, "course_id": other["id"]})
    names = [p["name"] for p in admin.get(f"/api/plans?course_id={c['id']}").json()]
    assert names == ["Any monthly", "Yoga term"]
    yoga = admin.get(f"/api/plans?course_id={c['id']}").json()[1]
    assert yoga["course_name"] == "Yoga" and yoga["price"] == "99.50"


def test_archive_plan(admin):
    p = admin.post("/api/plans", json={"name": "Old", "price": "1", "interval_days": 30}).json()
    admin.patch(f"/api/plans/{p['id']}", json={"archived": True})
    assert admin.get("/api/plans").json() == []


def test_rejects_invalid(admin):
    assert admin.post("/api/plans", json={"name": "x", "price": "-1", "interval_days": 30}).status_code == 422
    assert admin.post("/api/plans", json={"name": "x", "price": "1", "interval_days": 30, "course_id": 99}).status_code == 404
