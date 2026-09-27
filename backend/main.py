"""FastAPI application factory."""

from fastapi import APIRouter, FastAPI

from .core import errors
from .core.config import get_settings
from .modules.auth.router import router as auth_router
from .modules.organization.router import router as organization_router
from .modules.staff.router import router as staff_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, docs_url="/api/docs", openapi_url="/api/openapi.json")
    errors.register(app)

    api = APIRouter(prefix="/api")

    @api.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for router in (auth_router, staff_router, organization_router):
        api.include_router(router)
    app.include_router(api)
    return app


app = create_app()
