import json

from backend.core.config import get_settings
from backend.modules.network import service


def test_off_by_default_and_admin_toggles(admin, monkeypatch):
    monkeypatch.setattr(service, "lan_addresses", lambda: ["192.168.1.20"])
    r = admin.get("/api/network").json()
    assert r["enabled"] is False and r["managed_by_env"] is False and r["restart_supported"] is False

    calls = []
    state = admin.app.state  # what ``python -m backend`` sets on the app it serves
    state.restart, state.listening, state.port = lambda: calls.append(1), "0.0.0.0", 8000
    r = admin.put("/api/network", json={"enabled": True}).json()
    assert r["enabled"] is True and r["urls"] == ["http://192.168.1.20:8000"] and r["restart_supported"]
    assert json.loads((get_settings().data_dir / "network.json").read_text()) == {"lan": True}
    assert calls == [1]  # rebinds after the response
    admin.put("/api/network", json={"enabled": True})
    assert calls == [1]  # unchanged choice, no restart
    assert service.bind_host() == "0.0.0.0"
    admin.put("/api/network", json={"enabled": False})
    assert service.bind_host() == "127.0.0.1" and calls == [1, 1]


def test_staff_cannot_toggle(admin):
    admin.post("/api/staff", json={"username": "sam", "name": "Sam", "password": "password1", "role": "staff"})
    admin.post("/api/auth/logout")
    admin.post("/api/auth/login", json={"username": "sam", "password": "password1"})
    assert admin.get("/api/network").status_code == 200
    assert admin.put("/api/network", json={"enabled": True}).status_code == 403


def test_env_host_wins(admin, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "host", "0.0.0.0")
    monkeypatch.setattr(service, "managed_by_env", lambda: True)
    r = admin.put("/api/network", json={"enabled": False}).json()
    assert r["managed_by_env"] is True and r["enabled"] is True
    assert not (settings.data_dir / "network.json").exists()


def test_only_private_ipv4_addresses():
    assert service._private("192.168.1.5") and service._private("10.0.0.2")
    assert not service._private("127.0.0.1") and not service._private("8.8.8.8") and not service._private("169.254.1.1")
