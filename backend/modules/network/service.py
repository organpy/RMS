"""Whether other devices on the local network may reach RMS.

The choice lives in ``<data_dir>/network.json`` rather than the database because it is
needed before the server binds. ``RMS_HOST`` (environment or .env) always wins.
"""

from __future__ import annotations

import ipaddress
import json
import socket

from backend.core.config import get_settings

LOOPBACK = "127.0.0.1"
ALL = "0.0.0.0"


def _file():
    return get_settings().data_dir / "network.json"


def managed_by_env() -> bool:
    return "host" in get_settings().model_fields_set


def lan_enabled() -> bool:
    if managed_by_env():
        return get_settings().host not in (LOOPBACK, "localhost", "::1")
    try:
        return bool(json.loads(_file().read_text()).get("lan"))
    except (OSError, ValueError, AttributeError):
        return False


def set_lan(enabled: bool) -> None:
    _file().write_text(json.dumps({"lan": enabled}))


def bind_host() -> str:
    if managed_by_env():
        return get_settings().host
    return ALL if lan_enabled() else LOOPBACK


def _private(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return addr.version == 4 and addr.is_private and not addr.is_loopback and not addr.is_link_local


def lan_addresses() -> list[str]:
    """This computer's private IPv4 addresses, the default route's first."""
    found: list[str] = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("192.0.2.1", 9))  # UDP connect picks the outgoing interface; no packet is sent
            found.append(s.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.append(info[4][0])
    except OSError:
        pass
    return list(dict.fromkeys(ip for ip in found if _private(ip)))


def answers_on_lan(port: int) -> bool:
    """Whether this server can be reached on a network address: used when it was not started by
    ``python -m backend`` (plain uvicorn, the dev script), so the bind host is unknown."""
    for ip in lan_addresses():
        try:
            with socket.create_connection((ip, port), timeout=0.3):
                return True
        except OSError:
            continue
    return False
