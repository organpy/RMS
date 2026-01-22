"""Payment domain service containing business logic for billing lifecycles."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Callable, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.config import Settings, get_settings
from backend.crud.payment import PaymentCRUD
from backend.exceptions import NotFoundError, ValidationError
from backend.models import ClassCourse, Member, MemberStatus, Payment
from backend.models.payment import PaymentStatus


class PaymentService:
    """Encapsulates payment business rules such as due-date calculations and status changes."""

    def __init__(
        self,
        session: Session,
        *,
        settings: Settings | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self._crud = PaymentCRUD(session)

    # ------------------------------------------------------------------
    # Core calculations
    # ------------------------------------------------------------------
    def calculate_next_due_date(self, payment_date: date, *, interval_days: Optional[int] = None) -> date:
        """Return the next due date by adding the configured interval to the payment date."""

        days = interval_days or self.settings.payment_due_interval_days
        return payment_date + timedelta(days=days)

    def validate_amount(self, amount: Decimal) -> None:
        """Ensure the payment amount is positive."""

        if amount <= Decimal("0"):
            raise ValidationError("Payment amount must be greater than zero.")

    # ------------------------------------------------------------------
    # Receipt helpers
    # ------------------------------------------------------------------
    def generate_receipt_number(self, member: Member, class_course: ClassCourse | None, payment_date: date) -> str:
        """Generate a unique, deterministic receipt number for the provided member and class."""

        date_fragment = payment_date.strftime("%y%m%d")
        member_slug = self._slugify(f"{member.first_name}-{member.last_name}")
        class_slug = self._slugify(class_course.name if class_course else "general")

        sequence = self._next_sequence_for_day(payment_date)
        receipt_number = self._format_receipt_number(member_slug, class_slug, date_fragment, sequence)

        # Ensure uniqueness in case of concurrent creations by checking existing records.
        while self._receipt_number_exists(receipt_number):
            sequence += 1
            receipt_number = self._format_receipt_number(member_slug, class_slug, date_fragment, sequence)

        return receipt_number

    # ------------------------------------------------------------------
    # CRUD orchestrations
    # ------------------------------------------------------------------
    def list_payments(self, **filters):
        """Proxy to PaymentCRUD.list for router consumption."""

        return self._crud.list(**filters)

    def get(self, payment_id: int) -> Payment:
        """Return a payment or raise if missing."""

        payment = self._crud.get(payment_id)
        if payment is None:
            raise NotFoundError("Payment not found")
        return payment

    def create_payment(self, payload: dict) -> Payment:
        """Create a payment after applying business rules and status transitions."""

        member_id = payload.get("member_id")
        member = self.session.get(Member, member_id)
        if member is None:
            raise NotFoundError("Member not found for payment creation")

        interval_days = payload.pop("interval_days", None)
        membership_plan = payload.pop("membership_plan", None)
        if membership_plan is not None and membership_plan.strip():
            member.membership_plan = membership_plan.strip()
            self.session.add(member)
        if interval_days is not None:
            member.payment_interval_days = interval_days
            self.session.add(member)

        amount = Decimal(str(payload.get("amount")))
        self.validate_amount(amount)

        payment_date: date = payload.get("payment_date")
        next_due_date: Optional[date] = payload.get("next_due_date")
        if next_due_date is None:
            interval_to_use = interval_days or member.payment_interval_days
            next_due_date = self.calculate_next_due_date(payment_date, interval_days=interval_to_use)
            payload["next_due_date"] = next_due_date

        class_course = member.class_course
        if not payload.get("receipt_number"):
            payload["receipt_number"] = self.generate_receipt_number(member, class_course, payment_date)

        # Determine payment status if not explicitly provided or to keep it in sync with due dates.
        payload["status"] = self._determine_payment_status(next_due_date, payload.get("status"))

        # Update the member lifecycle status before commit so the same transaction persists both entities.
        self._sync_member_status(member, next_due_date)

        payment = self._crud.create(payload)
        return payment

    def update_payment(self, payment: Payment, payload: dict) -> Payment:
        """Apply updates to an existing payment while keeping related entities in sync."""

        update_data = dict(payload)

        if "amount" in update_data and update_data["amount"] is not None:
            self.validate_amount(Decimal(str(update_data["amount"])))

        if "payment_date" in update_data and update_data.get("payment_date") is not None:
            payment_date: date = update_data["payment_date"]
            if "next_due_date" not in update_data or update_data["next_due_date"] is None:
                update_data["next_due_date"] = self.calculate_next_due_date(payment_date)

        next_due_date = update_data.get("next_due_date", payment.next_due_date)
        explicit_status = update_data.get("status")
        update_data["status"] = self._determine_payment_status(next_due_date, explicit_status)

        # Manage refund timestamps automatically.
        if update_data["status"] == PaymentStatus.REFUNDED:
            update_data.setdefault("refunded_at", self.clock())
        else:
            update_data.setdefault("refunded_at", None)

        member = payment.member or self.session.get(Member, payment.member_id)
        if member is None:
            raise NotFoundError("Member linked to payment is missing")

        self._sync_member_status(member, next_due_date)
        updated_payment = self._crud.update(payment, update_data)
        return updated_payment

    # ------------------------------------------------------------------
    # Status helpers
    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _slugify(self, value: str) -> str:
        normalized = value.strip().lower().replace(" ", "-")
        return "".join(ch for ch in normalized if ch.isalnum() or ch in {"-", "_"}) or "general"

    def _next_sequence_for_day(self, payment_date: date) -> int:
        stmt = select(func.count(Payment.id)).where(Payment.payment_date == payment_date)
        count = int(self.session.execute(stmt).scalar_one())
        return count + 1

    def _format_receipt_number(self, member_slug: str, class_slug: str, date_fragment: str, sequence: int) -> str:
        return f"receipt-{member_slug}-{class_slug}-{date_fragment}-{sequence:04d}"

    def _receipt_number_exists(self, receipt_number: str) -> bool:
        stmt = select(Payment.id).where(Payment.receipt_number == receipt_number)
        return self.session.execute(stmt).scalar_one_or_none() is not None

    def _determine_payment_status(
        self,
        next_due_date: Optional[date],
        current_status: PaymentStatus | None = None,
    ) -> PaymentStatus:
        """Infer the payment status based on due dates unless caller overrides it explicitly."""

        explicit = current_status
        if explicit and explicit != PaymentStatus.PAID:
            return explicit

        today = self.clock().date()
        # Treat payments with no due date or due today or in the future as PAID
        if next_due_date is None:
            return PaymentStatus.PAID
        if next_due_date >= today:
            return PaymentStatus.PAID
        return PaymentStatus.OVERDUE

    def _determine_member_status(self, next_due_date: Optional[date]) -> MemberStatus:
        if next_due_date is None:
            return MemberStatus.ACTIVE

        today = self.clock().date()
        # Give a one-day cushion before marking members INACTIVE so that
        # members falling exactly on the grace boundary are treated as SUSPENDED.
        inactive_threshold = today - timedelta(days=self.settings.payment_inactive_grace_days + 1)
        if next_due_date < inactive_threshold:
            return MemberStatus.INACTIVE
        if next_due_date < today:
            return MemberStatus.SUSPENDED
        return MemberStatus.ACTIVE

    def _sync_member_status(self, member: Member, next_due_date: Optional[date]) -> None:
        target_status = self._determine_member_status(next_due_date)
        if member.status != target_status:
            member.status = target_status
            self.session.add(member)


__all__ = ["PaymentService"]
