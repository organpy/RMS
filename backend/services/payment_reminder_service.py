"""Service layer for scheduling and tracking payment reminders."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.exceptions import NotFoundError, ValidationError
from backend.models import Payment, ReminderAttemptResult, ReminderStatus

from .payment_service import PaymentService
from backend.crud.payment_reminder import PaymentReminderCRUD


class PaymentReminderService:
    """Manage reminder queue state and history for payments."""

    def __init__(self, session: Session, *, clock=None) -> None:
        self.session = session
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self._payment_service = PaymentService(session, clock=self.clock)
        self._crud = PaymentReminderCRUD(session)

    def _ensure_payment(self, payment_id: int) -> Payment:
        payment = self._payment_service.get(payment_id)
        if payment is None:
            raise NotFoundError("Payment not found")
        return payment

    def get_or_create(self, payment_id: int):
        payment = self._ensure_payment(payment_id)
        reminder = self._crud.get_by_payment(payment_id)
        if reminder is None:
            reminder = self._crud.ensure(payment_id, payment.member_id)
        return reminder

    def get_summary(self, payment_id: int):
        reminder = self.get_or_create(payment_id)
        return reminder

    def list_history(self, payment_id: int):
        reminder = self.get_or_create(payment_id)
        return list(reminder.logs)

    def queue(self, payment_id: int, *, scheduled_for: datetime | None = None, note: str | None = None):
        payment = self._ensure_payment(payment_id)
        reminder = self._crud.ensure(payment_id, payment.member_id)

        now = self.clock()
        scheduled_at = scheduled_for or now
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
        else:
            scheduled_at = scheduled_at.astimezone(timezone.utc)

        existing = self._crud.latest_attempt_for_day(reminder, now)
        if existing is not None:
            raise ValidationError("Reminder already queued for this payment today")

        update_data = {
            "status": ReminderStatus.QUEUED,
            "attempt_count": reminder.attempt_count + 1,
            "last_attempt_at": now,
            "next_scheduled_at": scheduled_at,
        }
        reminder = self._crud.update(reminder, update_data)
        log = self._crud.add_log(
            reminder,
            attempted_at=now,
            scheduled_for=scheduled_at,
            result=ReminderAttemptResult.QUEUED,
            note=note,
        )
        self.session.refresh(reminder)
        return reminder, log


__all__ = ["PaymentReminderService"]
