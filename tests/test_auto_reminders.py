from datetime import date

from backend.modules.messaging import auto


def _member(admin, name, paid_until, **extra):
    m = admin.post("/api/members", json={"first_name": name, "last_name": "X", "email": f"{name.lower()}@example.com", **extra}).json()
    if paid_until:
        admin.post("/api/payments", json={"member_id": m["id"], "amount": "10", "description": "Fee", "paid_on": "2026-01-01", "period_start": "2026-01-01", "period_end": paid_until})
    return m


def _enable(admin, **days):
    admin.patch("/api/organization", json={"auto_remind": True, "remind_before_days": 3, "remind_after_days": 2, "reminder_template": "Hi {first_name}", **days})


def test_disabled_or_unconfigured_sends_nothing(admin, smtp):
    _member(admin, "Ana", "2026-06-02")
    assert auto.run(date(2026, 6, 1)) == 0
    _enable(admin)
    assert auto.run(date(2026, 6, 1)) == 1


def test_no_channel_configured(admin):
    _enable(admin)
    _member(admin, "Ana", "2026-06-02")
    assert auto.run(date(2026, 6, 1)) == 0


def test_before_and_after_once_per_period(admin, smtp):
    _enable(admin)
    ana = _member(admin, "Ana", "2026-06-03")
    _member(admin, "Far", "2026-06-20")
    _member(admin, "Old", "2026-03-01")  # fell behind long ago: left to the Reminders page

    assert auto.run(date(2026, 6, 1)) == 1  # Ana, 2 days before
    assert auto.run(date(2026, 6, 2)) == 0  # already reminded for this period
    assert auto.run(date(2026, 6, 4)) == 0  # ended, but within the after offset
    assert auto.run(date(2026, 6, 5)) == 1  # 2 days after
    assert auto.run(date(2026, 6, 6)) == 0
    assert [m["To"] for m in smtp] == ["ana@example.com"] * 2

    # Renewing starts a new period, which can be reminded again.
    admin.post("/api/payments", json={"member_id": ana["id"], "amount": "10", "description": "Fee", "paid_on": "2026-06-06", "period_start": "2026-06-04", "period_end": "2026-07-03"})
    assert auto.run(date(2026, 7, 1)) == 1


def test_falls_back_to_phone_channels(admin, twilio):
    _enable(admin)
    admin.post("/api/members", json={"first_name": "Pho", "last_name": "X", "phone": "+1555"})
    m = admin.get("/api/members").json()["items"][0]
    admin.post("/api/payments", json={"member_id": m["id"], "amount": "10", "description": "Fee", "paid_on": "2026-01-01", "period_start": "2026-01-01", "period_end": "2026-06-02"})
    assert auto.run(date(2026, 6, 1)) == 1
    assert twilio[0]["To"] == "whatsapp:+1555"
    assert admin.get("/api/messages", params={"member_id": m["id"]}).json()["items"][0]["channel"] == "whatsapp"
