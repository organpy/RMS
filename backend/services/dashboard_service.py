"""Dashboard-related data aggregation services."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.member import Member, MemberStatus
from backend.models.payment import Payment, PaymentMethod, PaymentStatus
from backend.models.class_course import ClassCourse

_OPEN_PAYMENT_STATUSES: tuple[PaymentStatus, ...] = (
    PaymentStatus.UNPAID,
    PaymentStatus.OVERDUE,
)


@dataclass(frozen=True)
class DashboardWidgets:
    """High-level metrics surfaced on the admin dashboard."""

    active_members: int
    inactive_members: int
    suspended_members: int
    due_today: int
    overdue: int
    overdue_inactive: int


@dataclass(frozen=True)
class AlertPayment:
    """Small projection for payment alerts shown on the dashboard."""

    payment_id: int
    member_id: int
    member_name: str
    next_due_date: date
    amount: Decimal
    status: PaymentStatus


@dataclass(frozen=True)
class DashboardAlerts:
    """Aggregated alert buckets for due-today and overdue payments."""

    due_today: List[AlertPayment]
    overdue: List[AlertPayment]


@dataclass(frozen=True)
class DashboardQuickStats:
    """Snapshot of key dashboard statistics and upcoming dues."""

    total_members: int
    active_members: int
    inactive_members: int
    suspended_members: int
    due_today: int
    overdue: int
    total_revenue_30_days: Decimal
    upcoming_due: List[AlertPayment]
    upcoming_due_total: Decimal


@dataclass(frozen=True)
class RecentPayment:
    """Projection of recent payment activity."""

    payment_id: int
    member_id: int
    member_name: str
    class_name: Optional[str]
    payment_date: date
    amount: Decimal
    method: PaymentMethod
    status: PaymentStatus
    receipt_number: Optional[str]


class DashboardService:
    """Provides aggregated dashboard data derived from members and payments."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_widget_counts(self, *, reference_date: Optional[date] = None) -> DashboardWidgets:
        """Return the widget metrics for a given day (defaults to today)."""

        target_date = reference_date or date.today()
        status_counts = self._member_status_counts()

        due_today = self._payment_count(Payment.next_due_date == target_date)
        overdue = self._payment_count(Payment.next_due_date < target_date)
        overdue_inactive = self._overdue_inactive_members(target_date)

        return DashboardWidgets(
            active_members=status_counts.get(MemberStatus.ACTIVE, 0),
            inactive_members=status_counts.get(MemberStatus.INACTIVE, 0),
            suspended_members=status_counts.get(MemberStatus.SUSPENDED, 0),
            due_today=due_today,
            overdue=overdue,
            overdue_inactive=overdue_inactive,
        )

    def get_alerts(
        self,
        *,
        reference_date: Optional[date] = None,
        limit: int = 5,
    ) -> DashboardAlerts:
        """Return payment alerts for due-today and overdue buckets."""

        target_date = reference_date or date.today()
        limit = max(1, limit)
        due_today = self._alert_payments(Payment.next_due_date == target_date, limit)
        overdue = self._alert_payments(Payment.next_due_date < target_date, limit)
        return DashboardAlerts(due_today=due_today, overdue=overdue)

    def get_recent_activity(self, *, limit: int = 10) -> List[RecentPayment]:
        """Return the most recent payment activity records."""

        limit = max(1, limit)
        return self._recent_payments(limit)

    def get_quick_stats(
        self,
        *,
        reference_date: Optional[date] = None,
        upcoming_days: int = 7,
        limit: int = 5,
    ) -> DashboardQuickStats:
        """Return headline stats plus upcoming due payments for the dashboard."""

        target_date = reference_date or date.today()
        upcoming_days = max(1, upcoming_days)
        limit = max(1, limit)

        status_counts = self._member_status_counts()
        total_members = sum(status_counts.values())

        due_today = self._payment_count(Payment.next_due_date == target_date)
        overdue = self._payment_count(Payment.next_due_date < target_date)

        revenue_window_start = target_date - timedelta(days=30)
        total_revenue_30_days = self._sum_payments_between(revenue_window_start, target_date)

        upcoming_due = self._upcoming_due_payments(
            target_date + timedelta(days=1),
            target_date + timedelta(days=upcoming_days),
            limit,
        )
        upcoming_due_total = sum((item.amount for item in upcoming_due), Decimal("0"))

        return DashboardQuickStats(
            total_members=total_members,
            active_members=status_counts.get(MemberStatus.ACTIVE, 0),
            inactive_members=status_counts.get(MemberStatus.INACTIVE, 0),
            suspended_members=status_counts.get(MemberStatus.SUSPENDED, 0),
            due_today=due_today,
            overdue=overdue,
            total_revenue_30_days=total_revenue_30_days,
            upcoming_due=upcoming_due,
            upcoming_due_total=upcoming_due_total,
        )

    # ---------------------------------------------------------------------
    # Internal helpers
    # ---------------------------------------------------------------------

    def _member_status_counts(self) -> dict[MemberStatus, int]:
        """Count members by lifecycle status, excluding archived records."""

        stmt = (
            select(Member.status, func.count())
            .where(Member.archived_at.is_(None))
            .group_by(Member.status)
        )
        results = self.session.execute(stmt).all()
        return {row[0]: int(row[1]) for row in results}

    def _payment_count(self, *filters) -> int:
        """Count payments matching the provided filters and open statuses."""

        stmt = (
            select(func.count())
            .select_from(Payment)
            .join(Member, Member.id == Payment.member_id)
            .where(Member.archived_at.is_(None))
            .where(Payment.next_due_date.is_not(None))
            .where(Payment.status.in_(_OPEN_PAYMENT_STATUSES))
        )
        for clause in filters:
            stmt = stmt.where(clause)
        return int(self.session.execute(stmt).scalar_one())

    def _overdue_inactive_members(self, reference_date: date) -> int:
        """Count inactive members who still have overdue payments."""

        stmt = (
            select(func.count(func.distinct(Member.id)))
            .join(Payment, Payment.member_id == Member.id)
            .where(Member.archived_at.is_(None))
            .where(Member.status == MemberStatus.INACTIVE)
            .where(Payment.next_due_date.is_not(None))
            .where(Payment.next_due_date < reference_date)
            .where(Payment.status.in_(_OPEN_PAYMENT_STATUSES))
        )
        return int(self.session.execute(stmt).scalar_one())

    def _alert_payments(self, filter_clause, limit: int) -> List[AlertPayment]:
        """Return a limited number of payments matching the alert criteria."""

        stmt = (
            select(
                Payment.id,
                Member.id,
                Member.first_name,
                Member.last_name,
                Payment.next_due_date,
                Payment.amount,
                Payment.status,
            )
            .join(Member, Member.id == Payment.member_id)
            .where(Member.archived_at.is_(None))
            .where(Payment.next_due_date.is_not(None))
            .where(Payment.status.in_(_OPEN_PAYMENT_STATUSES))
            .where(filter_clause)
            .order_by(Payment.next_due_date.asc(), Payment.id.asc())
            .limit(limit)
        )
        rows = self.session.execute(stmt).all()
        alerts: List[AlertPayment] = []
        for payment_id, member_id, first_name, last_name, next_due, amount, status in rows:
            member_name = " ".join(part for part in [first_name, last_name] if part)
            alerts.append(
                AlertPayment(
                    payment_id=payment_id,
                    member_id=member_id,
                    member_name=member_name,
                    next_due_date=next_due,
                    amount=Decimal(amount),
                    status=status,
                )
            )
        return alerts

    def _recent_payments(self, limit: int) -> List[RecentPayment]:
        """Internal helper to fetch recent payments with member and class information."""

        stmt = (
            select(
                Payment.id,
                Member.id,
                Member.first_name,
                Member.last_name,
                ClassCourse.name,
                Payment.payment_date,
                Payment.amount,
                Payment.method,
                Payment.status,
                Payment.receipt_number,
            )
            .join(Member, Member.id == Payment.member_id)
            .outerjoin(ClassCourse, ClassCourse.id == Member.class_id)
            .where(Member.archived_at.is_(None))
            .order_by(Payment.payment_date.desc(), Payment.id.desc())
            .limit(limit)
        )
        rows = self.session.execute(stmt).all()
        recent: List[RecentPayment] = []
        for (
            payment_id,
            member_id,
            first_name,
            last_name,
            class_name,
            payment_date,
            amount,
            method,
            status,
            receipt_number,
        ) in rows:
            member_name = " ".join(part for part in [first_name, last_name] if part)
            recent.append(
                RecentPayment(
                    payment_id=payment_id,
                    member_id=member_id,
                    member_name=member_name,
                    class_name=class_name,
                    payment_date=payment_date,
                    amount=Decimal(amount),
                    method=method,
                    status=status,
                    receipt_number=receipt_number,
                )
            )
        return recent

    def _sum_payments_between(self, start_date: date, end_date: date) -> Decimal:
        stmt = (
            select(func.coalesce(func.sum(Payment.amount), 0))
            .where(Payment.payment_date >= start_date)
            .where(Payment.payment_date <= end_date)
            .where(Payment.status != PaymentStatus.REFUNDED)
        )
        total = self.session.execute(stmt).scalar_one()
        if isinstance(total, Decimal):
            return total
        return Decimal(str(total))

    def _upcoming_due_payments(self, start_date: date, end_date: date, limit: int) -> List[AlertPayment]:
        stmt = (
            select(
                Payment.id,
                Member.id,
                Member.first_name,
                Member.last_name,
                Payment.next_due_date,
                Payment.amount,
                Payment.status,
            )
            .join(Member, Member.id == Payment.member_id)
            .where(Member.archived_at.is_(None))
            .where(Payment.next_due_date.is_not(None))
            .where(Payment.status.in_(_OPEN_PAYMENT_STATUSES))
            .where(Payment.next_due_date >= start_date)
            .where(Payment.next_due_date <= end_date)
            .order_by(Payment.next_due_date.asc(), Payment.id.asc())
            .limit(limit)
        )
        rows = self.session.execute(stmt).all()
        upcoming: List[AlertPayment] = []
        for payment_id, member_id, first_name, last_name, next_due, amount, status in rows:
            member_name = " ".join(part for part in [first_name, last_name] if part)
            upcoming.append(
                AlertPayment(
                    payment_id=payment_id,
                    member_id=member_id,
                    member_name=member_name,
                    next_due_date=next_due,
                    amount=Decimal(amount),
                    status=status,
                )
            )
        return upcoming
