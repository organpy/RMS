"""Entry point for the FastAPI application.

This module exposes a minimal "Hello World" endpoint so we can validate the
backend wiring during Phase 0. Future phases will expand this to include the
full API surface for the registration and payment system.
"""

from fastapi import FastAPI

from .config import Settings, get_settings
from .routers import classes_router, groups_router, members_router


def create_app() -> FastAPI:
    """Instantiate and configure the FastAPI application."""

    settings = get_settings()
    app = FastAPI(title=settings.app_name)

    @app.get("/api/health", tags=["Health"])
    def read_health() -> dict[str, str]:
        """Simple health check endpoint used during scaffolding."""

        return {"status": "ok", "message": "Hello World"}

    app.include_router(members_router)
    app.include_router(classes_router)
    app.include_router(groups_router)

    return app


app = create_app()
