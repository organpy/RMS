"""Dashboard-related data aggregation services."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.member import Member, MemberStatus
from backend.models.payment import Payment, PaymentStatus

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
