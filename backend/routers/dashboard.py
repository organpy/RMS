"""FastAPI routes providing dashboard data for the admin console."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.dashboard import DashboardWidgetsQuery, DashboardWidgetsResponse
from backend.services import DashboardService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/widgets", response_model=DashboardWidgetsResponse)
async def read_dashboard_widgets(
    query: DashboardWidgetsQuery = Depends(),
    db: Session = Depends(get_db),
) -> DashboardWidgetsResponse:
    """Return the key dashboard metrics for the requested day."""

    service = DashboardService(db)
    widgets = await run_in_threadpool(service.get_widget_counts, reference_date=query.reference_date)
    return DashboardWidgetsResponse.model_validate(asdict(widgets))
