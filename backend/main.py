"""Entry point for the FastAPI application.

This module exposes a minimal "Hello World" endpoint so we can validate the
backend wiring during Phase 0. Future phases will expand this to include the
full API surface for the registration and payment system.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .error_handlers import register_exception_handlers
from .logging_config import configure_logging
from .routers import (
    analytics_router,
    classes_router,
    dashboard_router,
    groups_router,
    members_router,
    payments_router,
    receipts_router,
    settings_router,
)
from .tasks.backup_scheduler import backup_scheduler


def create_app() -> FastAPI:
    """Instantiate and configure the FastAPI application."""

    configure_logging()
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):  # pragma: no cover - exercised via startup/shutdown
        await backup_scheduler.start()
        try:
            yield
        finally:
            await backup_scheduler.stop()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health", tags=["Health"])
    def read_health() -> dict[str, str]:
        """Simple health check endpoint used during scaffolding."""

        return {"status": "ok", "message": "Hello World"}

    app.include_router(members_router)
    app.include_router(classes_router)
    app.include_router(groups_router)
    app.include_router(payments_router)
    app.include_router(receipts_router)
    app.include_router(analytics_router)
    app.include_router(dashboard_router)
    app.include_router(settings_router)
    register_exception_handlers(app)

    return app


app = create_app()
