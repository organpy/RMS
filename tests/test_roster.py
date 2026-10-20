def test_roster_groups_members_with_unassigned_bucket(admin):
    course = admin.post("/api/courses", json={"name": "Judo"}).json()
    other = admin.post("/api/courses", json={"name": "Chess"}).json()
    a = admin.post(f"/api/courses/{course['id']}/groups", json={"name": "A", "capacity": 2}).json()
    b = admin.post(f"/api/courses/{course['id']}/groups", json={"name": "B"}).json()

    def member(first, **extra):
        return admin.post("/api/members", json={"first_name": first, "last_name": "X", **extra}).json()

    member("Ana", course_id=course["id"], group_id=a["id"])
    member("Bob", course_id=course["id"], group_id=a["id"])
    member("Cy", course_id=course["id"])
    gone = member("Dee", course_id=course["id"], group_id=b["id"])
    admin.patch(f"/api/members/{gone['id']}", json={"archived": True})
    member("Eve", course_id=other["id"])

    r = admin.get(f"/api/courses/{course['id']}/roster").json()
    assert r["course"]["name"] == "Judo"
    assert [(g["name"], [m["full_name"] for m in g["members"]], g["member_count"]) for g in r["groups"]] == [
        ("A", ["Ana X", "Bob X"], 2),
        ("B", [], 0),
    ]
    assert [m["full_name"] for m in r["unassigned"]] == ["Cy X"]
    assert r["groups"][0]["members"][0]["status"] == "due"
    assert admin.get("/api/courses/999/roster").status_code == 404
