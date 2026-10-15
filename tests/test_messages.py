from datetime import date

from backend.core import clock


def _setup(admin, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 6, 1))
    admin.patch("/api/organization", json={"reminder_template": "Hi {first_name}, renew {plan}"})
    course = admin.post("/api/courses", json={"name": "Judo"}).json()
    plan = admin.post("/api/plans", json={"name": "Gold", "price": "50", "interval_days": 30}).json()
    ok = admin.post("/api/members", json={"first_name": "Ana", "last_name": "A", "email": "ana@example.com", "phone": "+1555", "course_id": course["id"], "plan_id": plan["id"]}).json()
    bad = admin.post("/api/members", json={"first_name": "Bob", "last_name": "B", "phone": "+1fail", "course_id": course["id"]}).json()
    return course, ok, bad


def test_status_reports_configured_channels(admin, smtp):
    assert admin.get("/api/messaging/status").json() == {"email": True, "sms": False, "whatsapp": False}


def test_send_reminders_logs_each_outcome(admin, smtp, monkeypatch):
    _, ok, bad = _setup(admin, monkeypatch)
    assert admin.post("/api/messages", json={"channel": "email", "member_ids": [ok["id"], bad["id"]]}).json() == {"sent": 1, "failed": 1}
    assert smtp[0]["To"] == "ana@example.com" and "Hi Ana, renew Gold" in smtp[0].get_content()

    failed = admin.get("/api/messages", params={"member_id": bad["id"]}).json()["items"][0]
    assert failed["status"] == "failed" and failed["error"] == "No email address"
    sent = admin.get("/api/messages", params={"member_id": ok["id"]}).json()["items"][0]
    assert sent["status"] == "sent" and sent["kind"] == "reminder"


def test_announcement_to_course_and_retry(admin, twilio, monkeypatch):
    course, ok, bad = _setup(admin, monkeypatch)
    res = admin.post("/api/messages", json={"channel": "sms", "kind": "announcement", "course_id": course["id"], "body": "No class on {first_name}day"})
    assert res.json() == {"sent": 1, "failed": 1}
    assert {c["Body"] for c in twilio} == {"No class on Anaday", "No class on Bobday"}

    failed = admin.get("/api/messages", params={"status": "failed"}).json()["items"][0]
    assert "invalid number" in failed["error"]
    admin.patch(f"/api/members/{bad['id']}", json={"phone": "+1556"})
    retried = admin.post(f"/api/messages/{failed['id']}/retry").json()
    assert retried["status"] == "sent" and retried["recipient"] == "+1556"
    assert admin.post(f"/api/messages/{failed['id']}/retry").status_code == 400


def test_send_validation(admin, monkeypatch):
    assert admin.post("/api/messages", json={"channel": "email"}).status_code == 422
    assert admin.post("/api/messages", json={"channel": "email", "kind": "announcement", "member_ids": [1]}).status_code == 422


def test_unconfigured_channel_fails_cleanly(admin, monkeypatch):
    _, ok, _ = _setup(admin, monkeypatch)
    assert admin.post("/api/messages", json={"channel": "whatsapp", "member_ids": [ok["id"]]}).json() == {"sent": 0, "failed": 1}


def test_test_send_is_admin_only(admin, smtp):
    assert admin.post("/api/messaging/test", json={"channel": "email", "to": "me@example.com"}).json() == {"status": "sent"}
    assert admin.post("/api/messaging/test", json={"channel": "sms", "to": "+1555"}).status_code == 400
