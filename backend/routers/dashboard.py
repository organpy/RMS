"""FastAPI routes providing dashboard data for the admin console."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.dashboard import (
    DashboardAlertPayment,
    DashboardAlertsQuery,
    DashboardAlertsResponse,
    DashboardRecentActivityQuery,
    DashboardRecentActivityResponse,
    DashboardRecentPayment,
    DashboardQuickStatsQuery,
    DashboardQuickStatsResponse,
    DashboardWidgetsQuery,
    DashboardWidgetsResponse,
)
from backend.services import DashboardService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/widgets", response_model=DashboardWidgetsResponse)
async def read_dashboard_widgets(
    query: DashboardWidgetsQuery = Depends(),
    db: Session = Depends(get_db),
) -> DashboardWidgetsResponse:
    """Return the key dashboard metrics for the requested day."""

    service = DashboardService(db)
    widgets = service.get_widget_counts(reference_date=query.reference_date)
    return DashboardWidgetsResponse.model_validate(asdict(widgets))


@router.get("/alerts", response_model=DashboardAlertsResponse)
async def read_dashboard_alerts(
    query: DashboardAlertsQuery = Depends(),
    db: Session = Depends(get_db),
) -> DashboardAlertsResponse:
    """Return payment alerts for due-today and overdue buckets."""

    service = DashboardService(db)
    alerts = service.get_alerts(reference_date=query.reference_date, limit=query.limit)

    due_today = [DashboardAlertPayment.model_validate(asdict(item)) for item in alerts.due_today]
    overdue = [DashboardAlertPayment.model_validate(asdict(item)) for item in alerts.overdue]
    return DashboardAlertsResponse(due_today=due_today, overdue=overdue)


@router.get("/recent-activity", response_model=DashboardRecentActivityResponse)
async def read_dashboard_recent_activity(
    query: DashboardRecentActivityQuery = Depends(),
    db: Session = Depends(get_db),
) -> DashboardRecentActivityResponse:
    """Return the most recent payment activity records."""

    service = DashboardService(db)
    payments = service.get_recent_activity(limit=query.limit)
    payload = [DashboardRecentPayment.model_validate(asdict(item)) for item in payments]
    return DashboardRecentActivityResponse(payments=payload)


@router.get("/quick-stats", response_model=DashboardQuickStatsResponse)
async def read_dashboard_quick_stats(
    query: DashboardQuickStatsQuery = Depends(),
    db: Session = Depends(get_db),
) -> DashboardQuickStatsResponse:
    """Return quick statistics including upcoming dues."""

    service = DashboardService(db)
    stats = service.get_quick_stats(reference_date=query.reference_date, upcoming_days=query.upcoming_days, limit=query.limit)
    stats_dict = asdict(stats)
    stats_dict["upcoming_due"] = [DashboardAlertPayment.model_validate(asdict(item)).model_dump() for item in stats.upcoming_due]
    return DashboardQuickStatsResponse.model_validate(stats_dict)
