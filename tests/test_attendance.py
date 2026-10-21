from datetime import date

from backend.core import clock


def _setup(admin, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 6, 10))
    course = admin.post("/api/courses", json={"name": "Judo"}).json()
    group = admin.post(f"/api/courses/{course['id']}/groups", json={"name": "A"}).json()
    ana, bob = (
        admin.post("/api/members", json={"first_name": n, "last_name": "X", "course_id": course["id"], "group_id": group["id"]}).json()
        for n in ("Ana", "Bob")
    )
    return course, group, ana, bob


def test_take_and_edit_attendance(admin, monkeypatch):
    course, group, ana, bob = _setup(admin, monkeypatch)
    url = f"/api/groups/{group['id']}/sessions/2026-06-09"

    empty = admin.get(url).json()
    assert empty["recorded"] is False and [r["status"] for r in empty["records"]] == [None, None]

    saved = admin.put(url, json={"records": [{"member_id": ana["id"], "status": "present"}, {"member_id": bob["id"], "status": "absent"}]}).json()
    assert saved["recorded"] and [(r["full_name"], r["status"]) for r in saved["records"]] == [("Ana X", "present"), ("Bob X", "absent")]

    admin.put(url, json={"records": [{"member_id": bob["id"], "status": "late"}]})
    assert [r["status"] for r in admin.get(url).json()["records"]] == ["present", "late"]

    # Bob moves group: he still appears on the day he was recorded.
    other = admin.post(f"/api/courses/{course['id']}/groups", json={"name": "B"}).json()
    admin.patch(f"/api/members/{bob['id']}", json={"group_id": other["id"]})
    assert [r["full_name"] for r in admin.get(url).json()["records"]] == ["Ana X", "Bob X"]
    assert [r["full_name"] for r in admin.get(f"/api/groups/{group['id']}/sessions/2026-06-10").json()["records"]] == ["Ana X"]


def test_attendance_validation(admin, monkeypatch):
    _, group, ana, _ = _setup(admin, monkeypatch)
    url = f"/api/groups/{group['id']}/sessions"
    assert admin.put(f"{url}/2026-06-11", json={"records": []}).status_code == 400
    assert admin.put(f"{url}/2026-06-09", json={"records": [{"member_id": ana["id"], "status": "present"}] * 2}).status_code == 400
    assert admin.put(f"{url}/2026-06-09", json={"records": [{"member_id": 999, "status": "present"}]}).status_code == 404
    assert admin.put(f"{url}/2026-06-09", json={"records": [{"member_id": ana["id"], "status": "sick"}]}).status_code == 422
    assert admin.get("/api/groups/999/sessions/2026-06-09").status_code == 404


def test_rates_on_roster_and_register_export(admin, monkeypatch):
    course, group, ana, bob = _setup(admin, monkeypatch)
    for day, (a, b) in {"2026-06-01": ("present", "absent"), "2026-06-03": ("late", "absent"), "2026-06-05": ("absent", "present")}.items():
        admin.put(f"/api/groups/{group['id']}/sessions/{day}", json={"records": [{"member_id": ana["id"], "status": a}, {"member_id": bob["id"], "status": b}]})

    roster = admin.get(f"/api/courses/{course['id']}/roster").json()
    assert {m["full_name"]: m["attendance_rate"] for m in roster["groups"][0]["members"]} == {"Ana X": 0.667, "Bob X": 0.333}

    csv = admin.get(f"/api/groups/{group['id']}/attendance.csv", params={"from": "2026-06-01", "to": "2026-06-04"}).text.splitlines()
    assert csv == ["Member,2026-06-01,2026-06-03", "Ana X,P,L", "Bob X,A,A"]
