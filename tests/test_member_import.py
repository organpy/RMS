import pytest

HEADER = "First name,Last name,Email,Phone,Course,Group,Plan,Joined,Discount,Guardian\n"


def _upload(admin, text, dry_run=True, name="members.csv"):
    data = text.encode() if isinstance(text, str) else text
    return admin.post("/api/members/import", params={"dry_run": dry_run}, files={"file": (name, data, "text/csv")})


@pytest.fixture
def setup(admin):
    course = admin.post("/api/courses", json={"name": "Piano"}).json()
    admin.post(f"/api/courses/{course['id']}/groups", json={"name": "Beginners"})
    admin.post("/api/plans", json={"name": "Monthly", "price": "40", "interval_days": 30})
    return course


def test_dry_run_reports_rows_without_inserting(admin, setup):
    csv_text = HEADER + (
        "Ana,Silva,ana@example.com,+1555,piano,BEGINNERS,monthly,2026-09-01,10,Pat Silva\n"
        "Bo,Berg,not-an-email,,,,,,,\n"
        "Cy,Cole,,,Chess,,,,,\n"
        "Di,Dale,,,Piano,Advanced,,,,\n"
        "Ed,East,,,,,Gold,,,\n"
        "Fay,Fox,,,,,,01/09/2026,,\n"
        ",Gray,,,,,,,,\n"
    )
    r = _upload(admin, csv_text).json()
    assert (r["total"], r["valid"], r["created"]) == (7, 1, 0)
    assert r["preview"] == ["Ana Silva · ana@example.com"]
    messages = {e["row"]: e["message"] for e in r["errors"]}
    assert set(messages) == {3, 4, 5, 6, 7, 8}
    assert messages[3] == "Email is not a valid email address" and "Unknown course “Chess”" in messages[4]
    assert "Unknown group “Advanced”" in messages[5] and "Unknown plan “Gold”" in messages[6]
    assert messages[7] == "Joined date must look like 2026-09-01" and messages[8] == "First name is required"
    assert admin.get("/api/members").json()["total"] == 0


def test_import_inserts_valid_rows_and_resolves_names(admin, setup):
    r = _upload(admin, HEADER + "Ana,Silva,ana@example.com,+1555,piano,beginners,monthly,2026-09-01,10,Pat Silva\nBo,Berg,,,,,,,,\nCy,,,,,,,,,\n", dry_run=False).json()
    assert (r["total"], r["valid"], r["created"], len(r["errors"])) == (3, 2, 2, 1)
    ana = admin.get("/api/members", params={"q": "Ana"}).json()["items"][0]
    assert (ana["course_name"], ana["group_name"], ana["plan_name"], ana["joined_on"], ana["guardian_name"]) == ("Piano", "Beginners", "Monthly", "2026-09-01", "Pat Silva")
    assert float(ana["discount_percent"]) == 10
    assert any(a["action"] == "imported" and a["summary"] == "2 members from members.csv" for a in admin.get("/api/audit").json()["items"])


def test_duplicates_are_skipped_within_file_and_against_existing(admin, setup):
    admin.post("/api/members", json={"first_name": "Ana", "last_name": "Silva", "email": "ana@example.com"})
    r = _upload(admin, HEADER + "ana,SILVA,ANA@example.com,,,,,,,\nBo,Berg,,,,,,,,\nbo,berg,,,,,,,,\n", dry_run=False).json()
    assert (r["valid"], r["created"]) == (1, 1)
    assert [(e["row"], e["message"]) for e in r["errors"]] == [(2, "Already exists"), (4, "Already exists")]


def test_semicolons_bom_aliases_and_blank_lines(admin):
    text = "﻿Firstname;Surname;E-mail;Mobile\nAna;Silva;;+1555\n\n;;;\nBo;Berg;;\n"
    r = _upload(admin, text.replace("E-mail", "Email"), dry_run=False).json()
    assert (r["total"], r["created"]) == (2, 2)
    assert admin.get("/api/members", params={"q": "+1555"}).json()["total"] == 1


def test_file_limits_and_bad_files(admin):
    assert _upload(admin, "").status_code == 400
    assert _upload(admin, "Name,Email\nAna,a@example.com\n").status_code == 400  # no first/last name columns
    assert _upload(admin, HEADER + "Ana,Silva,,,,,,,,\n" * 5001).status_code == 400
    assert _upload(admin, b"x" * (2 * 1024 * 1024 + 10)).status_code == 400
    assert _upload(admin, HEADER + "Ana,Silva,,,,,,,,\n" * 5000).json()["valid"] == 1  # duplicates collapse, still within the cap


def test_template_download(admin):
    r = admin.get("/api/members/import/template.csv")
    assert r.status_code == 200 and r.text.splitlines()[0].startswith("First name,Last name,Email")
