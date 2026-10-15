import pytest

from backend.modules.messaging import providers


def test_nothing_configured_by_default():
    assert providers.configured() == {"email": False, "sms": False, "whatsapp": False}
    with pytest.raises(providers.SendError):
        providers.deliver("email", "a@b.c", "s", "b")


def test_email_with_attachment(smtp):
    providers.deliver("email", "parent@home.test", "Invoice", "Hello", ("INV-1.pdf", b"%PDF"))
    msg = smtp[0]
    assert msg["To"] == "parent@home.test" and msg["From"] == "office@school.test"
    assert [p.get_filename() for p in msg.iter_attachments()] == ["INV-1.pdf"]


def test_twilio_sms_and_whatsapp(twilio):
    assert providers.deliver("sms", "+33600", "", "Hi") == "SM1"
    providers.deliver("whatsapp", "+33600", "", "Hi")
    assert twilio[0]["From"] == "+15550001" and twilio[0]["To"] == "+33600"
    assert twilio[1]["From"] == "whatsapp:+15550002" and twilio[1]["To"] == "whatsapp:+33600"
    with pytest.raises(providers.SendError, match="invalid number"):
        providers.deliver("sms", "fail", "", "Hi")
