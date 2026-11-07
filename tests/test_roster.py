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


def _pdf_text(response) -> list[str]:
    import io

    from pypdf import PdfReader

    assert response.status_code == 200 and response.headers["content-type"] == "application/pdf"
    return [page.extract_text() for page in PdfReader(io.BytesIO(response.content)).pages]


def test_member_list_pdf_prints_a_page_per_group_or_just_one_group(admin):
    course = admin.post("/api/courses", json={"name": "Judo"}).json()
    other = admin.post("/api/courses", json={"name": "Chess"}).json()
    a = admin.post(f"/api/courses/{course['id']}/groups", json={"name": "Juniors", "schedule": "Mon 17:00"}).json()
    admin.post(f"/api/courses/{course['id']}/groups", json={"name": "Empty"})
    foreign = admin.post(f"/api/courses/{other['id']}/groups", json={"name": "Elsewhere"}).json()
    admin.post("/api/members", json={"first_name": "Ana", "last_name": "Lopez", "phone": "+1 555 0101", "course_id": course["id"], "group_id": a["id"]})
    admin.post("/api/members", json={"first_name": "Cy", "last_name": "Ng", "course_id": course["id"]})
    url = f"/api/courses/{course['id']}/roster.pdf"

    pages = _pdf_text(admin.get(url))
    assert len(pages) == 2  # empty groups are skipped
    assert "Judo · Juniors" in pages[0] and "Mon 17:00" in pages[0] and "Ana Lopez" in pages[0] and "+1 555 0101" in pages[0]
    assert "Unassigned" in pages[1] and "Cy Ng" in pages[1]

    (only,) = _pdf_text(admin.get(url, params={"group_id": a["id"]}))
    assert "Ana Lopez" in only and "Cy Ng" not in only
    assert 'filename="judo-juniors.pdf"' in admin.get(url, params={"group_id": a["id"]}).headers["content-disposition"]

    (rest,) = _pdf_text(admin.get(url, params={"unassigned": True}))
    assert "Cy Ng" in rest and "Ana Lopez" not in rest

    assert admin.get(url, params={"group_id": foreign["id"]}).status_code == 404
    assert admin.get("/api/courses/999/roster.pdf").status_code == 404
    (blank,) = _pdf_text(admin.get(f"/api/courses/{other['id']}/roster.pdf"))
    assert "No members." in blank
