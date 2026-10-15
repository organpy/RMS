"""Fake messaging backends shared by tests."""

import json

import httpx
import pytest

from backend.core.config import get_settings
from backend.modules.messaging import providers


class FakeSMTP:
    sent: list = []

    def __init__(self, host, port, timeout=None, **_):
        self.host = host

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        pass

    def login(self, user, password):
        pass

    def send_message(self, msg):
        FakeSMTP.sent.append(msg)


@pytest.fixture
def smtp(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "smtp_host", "smtp.test")
    monkeypatch.setattr(s, "smtp_from", "office@school.test")
    monkeypatch.setattr(providers.smtplib, "SMTP", FakeSMTP)
    FakeSMTP.sent = []
    return FakeSMTP.sent


@pytest.fixture
def twilio(monkeypatch):
    s = get_settings()
    for key, value in {"twilio_sid": "AC1", "twilio_token": "t", "twilio_sms_from": "+15550001", "twilio_whatsapp_from": "+15550002"}.items():
        monkeypatch.setattr(s, key, value)
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        form = dict(x.split("=", 1) for x in request.content.decode().split("&"))
        calls.append({k: httpx.QueryParams(f"v={v}")["v"] for k, v in form.items()})
        if "fail" in calls[-1]["To"]:
            return httpx.Response(400, json={"message": "invalid number"})
        return httpx.Response(201, json={"sid": f"SM{len(calls)}"})

    monkeypatch.setattr(providers, "transport", httpx.MockTransport(handler))
    return calls


__all__ = ["FakeSMTP", "smtp", "twilio", "json"]
