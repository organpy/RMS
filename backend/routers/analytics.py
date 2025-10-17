"""FastAPI routes exposing analytics and reporting data."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.analytics import (
    ClassPopularityEntrySchema,
    ClassPopularityQuery,
    ClassPopularityResponse,
    PaymentTrendPointSchema,
    PaymentTrendQuery,
    PaymentTrendResponse,
    TimeSeriesPointSchema,
    TimeSeriesQuery,
    TimeSeriesResponse,
    YearlySeriesQuery,
)
from backend.services import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/revenue-monthly", response_model=TimeSeriesResponse)
async def read_monthly_revenue(
    query: TimeSeriesQuery = Depends(),
    db: Session = Depends(get_db),
) -> TimeSeriesResponse:
    service = AnalyticsService(db)
    points = await run_in_threadpool(service.monthly_revenue, query.last_periods)
    payload = [TimeSeriesPointSchema.model_validate(asdict(point)) for point in points]
    return TimeSeriesResponse(data=[item.model_dump() for item in payload])


@router.get("/revenue-yearly", response_model=TimeSeriesResponse)
async def read_yearly_revenue(
    query: YearlySeriesQuery = Depends(),
    db: Session = Depends(get_db),
) -> TimeSeriesResponse:
    service = AnalyticsService(db)
    points = await run_in_threadpool(service.yearly_revenue, query.last_years)
    payload = [TimeSeriesPointSchema.model_validate(asdict(point)) for point in points]
    return TimeSeriesResponse(data=[item.model_dump() for item in payload])


@router.get("/members-growth", response_model=TimeSeriesResponse)
async def read_members_growth(
    query: TimeSeriesQuery = Depends(),
    db: Session = Depends(get_db),
) -> TimeSeriesResponse:
    service = AnalyticsService(db)
    points = await run_in_threadpool(service.new_members_per_month, query.last_periods)
    payload = [TimeSeriesPointSchema.model_validate({"period": point.period, "total": point.total}) for point in points]
    return TimeSeriesResponse(data=[item.model_dump() for item in payload])


@router.get("/payment-trends", response_model=PaymentTrendResponse)
async def read_payment_trends(
    query: PaymentTrendQuery = Depends(),
    db: Session = Depends(get_db),
) -> PaymentTrendResponse:
    service = AnalyticsService(db)
    points = await run_in_threadpool(service.payment_trends, query.last_months)
    payload = [PaymentTrendPointSchema.model_validate(asdict(point)) for point in points]
    return PaymentTrendResponse(data=[item.model_dump() for item in payload])


@router.get("/class-popularity", response_model=ClassPopularityResponse)
async def read_class_popularity(
    query: ClassPopularityQuery = Depends(),
    db: Session = Depends(get_db),
) -> ClassPopularityResponse:
    service = AnalyticsService(db)
    entries = await run_in_threadpool(service.class_popularity, query.limit)
    payload = [ClassPopularityEntrySchema.model_validate(asdict(entry)) for entry in entries]
    return ClassPopularityResponse(data=[item.model_dump() for item in payload])


@router.get("/export")
async def export_analytics(db: Session = Depends(get_db)) -> StreamingResponse:
    service = AnalyticsService(db)
    filename, content = await run_in_threadpool(service.export_summary)
    response = StreamingResponse(iter([content]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response
