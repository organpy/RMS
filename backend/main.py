"""FastAPI application factory."""

from fastapi import APIRouter, FastAPI

from .core import errors
from .core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, docs_url="/api/docs", openapi_url="/api/openapi.json")
    errors.register(app)

    api = APIRouter(prefix="/api")

    @api.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api)
    return app


app = create_app()
