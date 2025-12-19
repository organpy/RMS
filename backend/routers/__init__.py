"""API routers exposed by the backend."""

from .auth import auth_router
from .members import router as members_router
from .classes import router as classes_router
from .groups import router as groups_router
from .payments import router as payments_router
from .receipts import router as receipts_router
from .dashboard import router as dashboard_router
from .analytics import router as analytics_router
from .settings import router as settings_router
from .backup import router as backup_router
from .backups import router as backups_router

__all__ = [
    "auth_router",
    "members_router",
    "classes_router",
    "groups_router",
    "payments_router",
    "receipts_router",
    "dashboard_router",
    "analytics_router",
    "settings_router",
    "backup_router",
    "backups_router",
]
