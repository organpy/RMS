"""FastAPI application factory."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .core import db, errors, migrate
from .core.jobs import Jobs
from .core.config import get_settings
from .modules.analytics.router import router as analytics_router
from .modules.attendance.router import router as attendance_router
from .modules.auth.router import router as auth_router
from .modules.backups import schedule as backup_schedule
from .modules.backups.router import router as backups_router
from .modules.courses.router import router as courses_router
from .modules.dashboard.router import router as dashboard_router
from .modules.invoices.router import router as invoices_router
from .modules.members.router import router as members_router
from .modules.messaging import auto as auto_reminders
from .modules.messaging.router import router as messaging_router
from .modules.organization.router import router as organization_router
from .modules.payments.router import router as payments_router
from .modules.plans.router import router as plans_router
from .modules.reminders.router import router as reminders_router
from .modules.reports.router import router as reports_router
from .modules.staff.router import router as staff_router


DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": (
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
        "frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'"
    ),
}

jobs = Jobs(backup_schedule.run_due_backup, auto_reminders.run)

ROUTERS = (
    auth_router,
    staff_router,
    organization_router,
    courses_router,
    attendance_router,
    plans_router,
    members_router,
    payments_router,
    invoices_router,
    reminders_router,
    reports_router,
    messaging_router,
    dashboard_router,
    analytics_router,
    backups_router,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    migrate.upgrade(db.engine)
    jobs.start()
    yield
    jobs.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name, lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json"
    )
    errors.register(app)

    api = APIRouter(prefix="/api")

    @api.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for router in ROUTERS:
        api.include_router(router)
    app.include_router(api)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        return response

    if DIST.exists():
        serve_frontend(app)
    return app


def serve_frontend(app: FastAPI) -> None:
    """Serve the built single-page app so one process hosts everything."""
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")
    index = DIST / "index.html"

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise errors.NotFound("Not found")
        file = (DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(DIST):
            return FileResponse(file)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


app = create_app()
