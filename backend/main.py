"""Entry point for the FastAPI application.

This module exposes a minimal "Hello World" endpoint so we can validate the
backend wiring during Phase 0. Future phases will expand this to include the
full API surface for the registration and payment system.
"""

from fastapi import FastAPI

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
)


def create_app() -> FastAPI:
    """Instantiate and configure the FastAPI application."""

    configure_logging()
    settings = get_settings()
    app = FastAPI(title=settings.app_name)

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
    register_exception_handlers(app)

    return app


app = create_app()
