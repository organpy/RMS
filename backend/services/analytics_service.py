"""Analytics services providing aggregated metrics for dashboards and reports."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import List

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from backend.models import ClassCourse, Member, Payment, PaymentStatus


@dataclass(frozen=True)
class TimeSeriesPoint:
    """Simple time-series point containing a label and total value."""

    period: str
    total: Decimal


@dataclass(frozen=True)
class PaymentTrendPoint:
    """Represents payment status counts aggregated for a time period."""

    period: str
    paid: int
    unpaid: int
    overdue: int
    refunded: int


@dataclass(frozen=True)
class ClassPopularityEntry:
    """Encapsulates class membership counts for popularity rankings."""

    class_id: int
    class_name: str
    member_count: int


class AnalyticsService:
    """Provides analytical aggregations over members and payments."""

    def __init__(self, session: Session) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Revenue aggregations
    # ------------------------------------------------------------------
    def monthly_revenue(self, last_months: int = 12) -> List[TimeSeriesPoint]:
        period_expr = func.strftime("%Y-%m", Payment.payment_date)
        stmt = (
            select(
                period_expr.label("period"),
                func.coalesce(func.sum(Payment.amount), 0),
            )
            .where(Payment.status != PaymentStatus.REFUNDED)
            .group_by(period_expr)
            .order_by(period_expr.desc())
            .limit(last_months)
        )
        rows = list(self.session.execute(stmt).all())
        rows.reverse()
        return [TimeSeriesPoint(period=row[0], total=self._to_decimal(row[1])) for row in rows]

    def yearly_revenue(self, last_years: int = 5) -> List[TimeSeriesPoint]:
        period_expr = func.strftime("%Y", Payment.payment_date)
        stmt = (
            select(
                period_expr.label("period"),
                func.coalesce(func.sum(Payment.amount), 0),
            )
            .where(Payment.status != PaymentStatus.REFUNDED)
            .group_by(period_expr)
            .order_by(period_expr.desc())
            .limit(last_years)
        )
        rows = list(self.session.execute(stmt).all())
        rows.reverse()
        return [TimeSeriesPoint(period=row[0], total=self._to_decimal(row[1])) for row in rows]

    # ------------------------------------------------------------------
    # Member growth & payment trends
    # ------------------------------------------------------------------
    def new_members_per_month(self, last_months: int = 12) -> List[TimeSeriesPoint]:
        period_expr = func.strftime("%Y-%m", Member.created_at)
        stmt = (
            select(period_expr.label("period"), func.count(Member.id))
            .where(Member.archived_at.is_(None))
            .group_by(period_expr)
            .order_by(period_expr.desc())
            .limit(last_months)
        )
        rows = list(self.session.execute(stmt).all())
        rows.reverse()
        return [TimeSeriesPoint(period=row[0], total=Decimal(row[1])) for row in rows]

    def payment_trends(self, last_months: int = 6) -> List[PaymentTrendPoint]:
        period_expr = func.strftime("%Y-%m", Payment.payment_date)
        stmt = (
            select(
                period_expr.label("period"),
                func.sum(case((Payment.status == PaymentStatus.PAID, 1), else_=0)),
                func.sum(case((Payment.status == PaymentStatus.UNPAID, 1), else_=0)),
                func.sum(case((Payment.status == PaymentStatus.OVERDUE, 1), else_=0)),
                func.sum(case((Payment.status == PaymentStatus.REFUNDED, 1), else_=0)),
            )
            .group_by(period_expr)
            .order_by(period_expr.desc())
            .limit(last_months)
        )
        rows = list(self.session.execute(stmt).all())
        rows.reverse()
        points: List[PaymentTrendPoint] = []
        for period, paid, unpaid, overdue, refunded in rows:
            points.append(
                PaymentTrendPoint(
                    period=period,
                    paid=int(paid or 0),
                    unpaid=int(unpaid or 0),
                    overdue=int(overdue or 0),
                    refunded=int(refunded or 0),
                )
            )
        return points

    # ------------------------------------------------------------------
    # Popularity & overdue metrics
    # ------------------------------------------------------------------
    def class_popularity(self, limit: int = 5) -> List[ClassPopularityEntry]:
        stmt = (
            select(
                ClassCourse.id,
                ClassCourse.name,
                func.count(Member.id).label("member_count"),
            )
            .join(Member, Member.class_id == ClassCourse.id)
            .where(Member.archived_at.is_(None))
            .group_by(ClassCourse.id, ClassCourse.name)
            .order_by(func.count(Member.id).desc(), ClassCourse.name.asc())
            .limit(limit)
        )
        rows = self.session.execute(stmt).all()
        return [
            ClassPopularityEntry(
                class_id=row[0],
                class_name=row[1],
                member_count=int(row[2] or 0),
            )
            for row in rows
        ]

    def overdue_payment_trend(self, last_months: int = 6) -> List[TimeSeriesPoint]:
        period_expr = func.strftime("%Y-%m", Payment.next_due_date)
        stmt = (
            select(period_expr.label("period"), func.count(Payment.id))
            .where(Payment.status == PaymentStatus.OVERDUE)
            .where(Payment.next_due_date.is_not(None))
            .group_by(period_expr)
            .order_by(period_expr.desc())
            .limit(last_months)
        )
        rows = list(self.session.execute(stmt).all())
        rows.reverse()
        return [TimeSeriesPoint(period=row[0], total=Decimal(row[1] or 0)) for row in rows]

    # ------------------------------------------------------------------
    # Export helpers
    # ------------------------------------------------------------------
    def export_summary(self) -> tuple[str, str]:
        """Return a CSV export containing key analytics summaries."""

        import csv
        from io import StringIO

        buffer = StringIO()
        writer = csv.writer(buffer)

        writer.writerow(["Section", "Label", "Value"])

        writer.writerow([])
        writer.writerow(["Monthly Revenue", "Period", "Total"])
        for point in self.monthly_revenue():
            writer.writerow(["monthly_revenue", point.period, f"{point.total:.2f}"])

        writer.writerow([])
        writer.writerow(["Member Growth", "Period", "Total"])
        for point in self.new_members_per_month():
            writer.writerow(["members_growth", point.period, f"{point.total:.0f}"])

        writer.writerow([])
        writer.writerow(["Class Popularity", "Class", "Members"])
        for entry in self.class_popularity():
            writer.writerow(["class_popularity", entry.class_name, entry.member_count])

        filename = "analytics-summary.csv"
        buffer.seek(0)
        return filename, buffer.read()

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------
    @staticmethod
    def _to_decimal(value) -> Decimal:
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))
