from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel

from backend.core.config import get_settings
from backend.core.db import get_db
from backend.core.security import current_staff, require_admin
from backend.modules.audit.service import audit

from . import service

router = APIRouter(prefix="/network", tags=["network"])


class NetworkOut(BaseModel):
    enabled: bool
    managed_by_env: bool
    listening: str | None  # host the running server is bound to, when started by ``python -m backend``
    port: int
    urls: list[str]
    restart_supported: bool


class NetworkIn(BaseModel):
    enabled: bool


def _out(request: Request) -> NetworkOut:
    state = request.app.state
    port = getattr(state, "port", None) or get_settings().port  # not the request's port: Vite's dev proxy is on another one
    listening = getattr(state, "listening", None)
    if listening is None:  # started without the launcher: find out instead of assuming
        listening = service.ALL if service.answers_on_lan(port) else service.LOOPBACK
    reachable = listening not in (None, service.LOOPBACK, "localhost")
    return NetworkOut(
        enabled=service.lan_enabled(),
        managed_by_env=service.managed_by_env(),
        listening=listening,
        port=port,
        urls=[f"http://{ip}:{port}" for ip in service.lan_addresses()] if reachable else [],
        restart_supported=callable(getattr(state, "restart", None)),
    )


@router.get("", response_model=NetworkOut, dependencies=[Depends(current_staff)])
def read(request: Request) -> NetworkOut:
    return _out(request)


@router.put("", response_model=NetworkOut)
def update(body: NetworkIn, request: Request, tasks: BackgroundTasks, staff=Depends(require_admin), db=Depends(get_db)) -> NetworkOut:
    """Save the choice and, when RMS runs through its launcher, rebind right after this response."""
    if not service.managed_by_env() and body.enabled != service.lan_enabled():
        service.set_lan(body.enabled)
        audit(db, staff, "updated", "settings", None, f"network access {'on' if body.enabled else 'off'}")
        db.commit()
        restart = getattr(request.app.state, "restart", None)
        if callable(restart):
            tasks.add_task(restart)
    return _out(request)
