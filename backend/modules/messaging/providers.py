"""Outbound delivery: SMTP for email, Twilio for SMS and WhatsApp. Configured via ``RMS_*`` env vars."""

from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

import httpx

from backend.core.config import get_settings

CHANNELS = ("email", "sms", "whatsapp")
TWILIO_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"

# Swapped for an ``httpx.MockTransport`` in tests.
transport: httpx.BaseTransport | None = None


class SendError(Exception):
    pass


def configured() -> dict[str, bool]:
    s = get_settings()
    twilio = bool(s.twilio_sid and s.twilio_token)
    return {
        "email": bool(s.smtp_host and (s.smtp_from or s.smtp_user)),
        "sms": twilio and bool(s.twilio_sms_from),
        "whatsapp": twilio and bool(s.twilio_whatsapp_from),
    }


def send_email(to: str, subject: str, body: str, attachment: tuple[str, bytes] | None = None) -> str:
    s = get_settings()
    msg = EmailMessage()
    msg["From"] = s.smtp_from or s.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if attachment:
        name, data = attachment
        msg.add_attachment(data, maintype="application", subtype="pdf", filename=name)
    try:
        if s.smtp_security == "ssl":
            server = smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=20, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20)
        with server:
            if s.smtp_security == "starttls":
                server.starttls(context=ssl.create_default_context())
            if s.smtp_user:
                server.login(s.smtp_user, s.smtp_password)
            server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise SendError(f"Email failed: {exc}") from exc
    return msg["Message-ID"] or ""


def send_twilio(channel: str, to: str, body: str) -> str:
    s = get_settings()
    sender = s.twilio_whatsapp_from if channel == "whatsapp" else s.twilio_sms_from
    prefix = "whatsapp:" if channel == "whatsapp" else ""
    data = {"From": f"{prefix}{sender.removeprefix('whatsapp:')}", "To": f"{prefix}{to}", "Body": body[:1600]}
    try:
        with httpx.Client(transport=transport, timeout=20) as client:
            r = client.post(TWILIO_URL.format(sid=s.twilio_sid), data=data, auth=(s.twilio_sid, s.twilio_token))
    except httpx.HTTPError as exc:
        raise SendError(f"Twilio unreachable: {exc}") from exc
    if r.status_code >= 400:
        detail = r.json().get("message", r.text) if r.headers.get("content-type", "").startswith("application/json") else r.text
        raise SendError(f"Twilio error {r.status_code}: {detail}")
    return r.json().get("sid", "")


def deliver(channel: str, to: str, subject: str, body: str, attachment: tuple[str, bytes] | None = None) -> str:
    if not configured().get(channel):
        raise SendError(f"{channel.capitalize()} is not configured")
    if channel == "email":
        return send_email(to, subject, body, attachment)
    return send_twilio(channel, to, body)
