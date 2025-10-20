"""Database helpers for payment related operations."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional, Tuple

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, joinedload

from backend.models.payment import Payment, PaymentMethod, PaymentStatus


class PaymentCRUD:
    """Encapsulates payment persistence operations."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, payment_id: int) -> Optional[Payment]:
        """Fetch a payment by identifier."""

        stmt = select(Payment).options(joinedload(Payment.reminder)).where(Payment.id == payment_id)
        return self.session.execute(stmt).scalar_one_or_none()

    def list(
        self,
        *,
        status: Optional[PaymentStatus] = None,
        method: Optional[PaymentMethod] = None,
        member_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        due_before: Optional[date] = None,
        due_after: Optional[date] = None,
        due_on: Optional[date] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[list[Payment], int]:
        """Return payments filtered by the provided parameters."""

        stmt = (
            select(Payment)
            .options(joinedload(Payment.reminder))
            .order_by(Payment.payment_date.desc(), Payment.id.desc())
        )
        count_stmt = select(func.count()).select_from(Payment)

        conditions = []
        if status is not None:
            conditions.append(Payment.status == status)
        if method is not None:
            conditions.append(Payment.method == method)
        if member_id is not None:
            conditions.append(Payment.member_id == member_id)
        if start_date is not None:
            conditions.append(Payment.payment_date >= start_date)
        if end_date is not None:
            conditions.append(Payment.payment_date <= end_date)
        if due_before is not None:
            conditions.append(Payment.next_due_date.is_not(None))
            conditions.append(Payment.next_due_date < due_before)
        if due_after is not None:
            conditions.append(Payment.next_due_date.is_not(None))
            conditions.append(Payment.next_due_date > due_after)
        if due_on is not None:
            conditions.append(Payment.next_due_date == due_on)

        if conditions:
            compound = and_(*conditions)
            stmt = stmt.where(compound)
            count_stmt = count_stmt.where(compound)

        stmt = stmt.offset(skip).limit(limit)
        payments = self.session.execute(stmt).scalars().all()
        total = int(self.session.execute(count_stmt).scalar_one())
        return payments, total

    def create(self, payload: dict) -> Payment:
        """Insert a new payment using the provided dictionary payload."""

        payment = Payment(**payload)
        self.session.add(payment)
        self.session.commit()
        self.session.refresh(payment)
        return payment

    def update(self, payment: Payment, payload: dict) -> Payment:
        """Apply updates to an existing payment."""

        for field, value in payload.items():
            setattr(payment, field, value)
        self.session.add(payment)
        self.session.commit()
        self.session.refresh(payment)
        return payment

    def total_amount_for_member(
        self,
        member_id: int,
        *,
        status: Optional[PaymentStatus] = None,
    ) -> Decimal:
        """Aggregate the payment total for a member with optional status filter."""

        stmt = select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.member_id == member_id)
        if status is not None:
            stmt = stmt.where(Payment.status == status)
        result = self.session.execute(stmt).scalar_one()
        return Decimal(result)
