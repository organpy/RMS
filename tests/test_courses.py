def test_course_and_group_crud(admin):
    c = admin.post("/api/courses", json={"name": "Grade 5"}).json()
    g = admin.post(f"/api/courses/{c['id']}/groups", json={"name": "Morning", "capacity": 20}).json()
    assert g["course_id"] == c["id"]
    courses = admin.get("/api/courses").json()
    assert courses[0]["groups"][0]["name"] == "Morning"
    admin.patch(f"/api/courses/{c['id']}", json={"archived": True})
    assert admin.get("/api/courses").json() == []
    assert len(admin.get("/api/courses?include_archived=true").json()) == 1


def test_deleting_group_keeps_members(admin):
    from backend.core import db
    from backend.modules.members.models import Member

    c = admin.post("/api/courses", json={"name": "Judo"}).json()
    g = admin.post(f"/api/courses/{c['id']}/groups", json={"name": "Kids"}).json()
    with db.SessionLocal() as s:
        s.add(Member(first_name="A", last_name="B", course_id=c["id"], group_id=g["id"]))
        s.commit()
    assert admin.get("/api/courses").json()[0]["groups"][0]["member_count"] == 1
    assert admin.delete(f"/api/groups/{g['id']}").status_code == 204
    with db.SessionLocal() as s:
        m = s.query(Member).one()
        assert m.group_id is None and m.course_id == c["id"]
    assert admin.delete(f"/api/courses/{c['id']}").status_code == 409
