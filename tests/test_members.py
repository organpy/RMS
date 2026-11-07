from datetime import date, timedelta

import pytest

from backend.core import clock


@pytest.fixture
def course(admin):
    c = admin.post("/api/courses", json={"name": "Grade 5"}).json()
    g = admin.post(f"/api/courses/{c['id']}/groups", json={"name": "A"}).json()
    return c, g


def _member(client, **kw):
    body = {"first_name": "Lina", "last_name": "Haddad", **kw}
    r = client.post("/api/members", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _set_paid_until(member_id, value):
    from backend.core import db
    from backend.modules.members.models import Member

    with db.SessionLocal() as s:
        s.get(Member, member_id).paid_until = value
        s.commit()


def test_create_infers_course_from_group(admin, course):
    c, g = course
    m = _member(admin, group_id=g["id"])
    assert m["course_id"] == c["id"] and m["group_name"] == "A" and m["status"] == "due"


def test_group_must_match_course(admin, course):
    _, g = course
    other = admin.post("/api/courses", json={"name": "Other"}).json()
    r = admin.post("/api/members", json={"first_name": "a", "last_name": "b", "course_id": other["id"], "group_id": g["id"]})
    assert r.status_code == 400


def test_status_is_derived_from_paid_until(admin, monkeypatch):
    m = _member(admin)
    today = date(2026, 3, 10)
    monkeypatch.setattr(clock, "today", lambda: today)
    cases = [(today, "active"), (today - timedelta(days=3), "due"), (today - timedelta(days=30), "overdue")]
    for paid_until, expected in cases:
        _set_paid_until(m["id"], paid_until)
        assert admin.get(f"/api/members/{m['id']}").json()["status"] == expected
    assert admin.get("/api/members?status=overdue").json()["total"] == 1
    assert admin.get("/api/members/counts").json()["overdue"] == 1


def test_search_paginate_and_archive(admin):
    for i in range(30):
        _member(admin, first_name=f"Person{i:02d}", email=f"p{i}@example.com")
    page = admin.get("/api/members?size=10&page=2").json()
    assert page["total"] == 30 and len(page["items"]) == 10
    hit = admin.get("/api/members?q=person07").json()
    assert hit["total"] == 1
    mid = hit["items"][0]["id"]
    admin.patch(f"/api/members/{mid}", json={"archived": True})
    assert admin.get("/api/members").json()["total"] == 29
    assert admin.get("/api/members?status=archived").json()["total"] == 1


def test_export_csv(admin):
    _member(admin, first_name="Zed")
    r = admin.get("/api/members/export.csv")
    assert r.headers["content-type"].startswith("text/csv")
    assert "Zed,Haddad" in r.text


def test_moving_course_drops_a_plan_only_the_old_course_offers(admin):
    judo = admin.post("/api/courses", json={"name": "Judo"}).json()
    chess = admin.post("/api/courses", json={"name": "Chess"}).json()
    judo_plan = admin.post("/api/plans", json={"name": "Judo term", "price": "90", "interval_days": 90, "course_id": judo["id"]}).json()
    general = admin.post("/api/plans", json={"name": "Monthly", "price": "30", "interval_days": 30}).json()
    a = admin.post("/api/members", json={"first_name": "A", "last_name": "X", "course_id": judo["id"], "plan_id": judo_plan["id"]}).json()
    b = admin.post("/api/members", json={"first_name": "B", "last_name": "X", "course_id": judo["id"], "plan_id": general["id"]}).json()

    moved = admin.patch(f"/api/members/{a['id']}", json={"course_id": chess["id"], "group_id": None})
    assert moved.status_code == 200 and moved.json()["plan_id"] is None
    assert admin.patch(f"/api/members/{b['id']}", json={"course_id": chess["id"]}).json()["plan_id"] == general["id"]  # kept
