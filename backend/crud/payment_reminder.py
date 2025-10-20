"""Persistence helpers for payment reminder scheduling."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models import (
	PaymentReminder,
	PaymentReminderLog,
	ReminderAttemptResult,
	ReminderStatus,
)


class PaymentReminderCRUD:
	"""Encapsulates interactions with payment reminders."""

	def __init__(self, session: Session) -> None:
		self.session = session

	def get_by_payment(self, payment_id: int) -> PaymentReminder | None:
		stmt = select(PaymentReminder).where(PaymentReminder.payment_id == payment_id)
		return self.session.execute(stmt).scalar_one_or_none()

	def create(self, payload: dict) -> PaymentReminder:
		reminder = PaymentReminder(**payload)
		self.session.add(reminder)
		self.session.commit()
		self.session.refresh(reminder)
		return reminder

	def update(self, reminder: PaymentReminder, payload: dict) -> PaymentReminder:
		for field, value in payload.items():
			setattr(reminder, field, value)
		self.session.add(reminder)
		self.session.commit()
		self.session.refresh(reminder)
		return reminder

	def ensure(self, payment_id: int, member_id: int) -> PaymentReminder:
		reminder = self.get_by_payment(payment_id)
		if reminder is None:
			reminder = self.create(
				{
					"payment_id": payment_id,
					"member_id": member_id,
					"status": ReminderStatus.IDLE,
					"attempt_count": 0,
					"last_attempt_at": None,
					"next_scheduled_at": None,
				}
			)
		return reminder

	def add_log(
		self,
		reminder: PaymentReminder,
		*,
		attempted_at: datetime,
		scheduled_for: Optional[datetime] = None,
		result: ReminderAttemptResult = ReminderAttemptResult.QUEUED,
		note: str | None = None,
	) -> PaymentReminderLog:
		log = PaymentReminderLog(
			reminder=reminder,
			payment_id=reminder.payment_id,
			member_id=reminder.member_id,
			attempted_at=attempted_at,
			scheduled_for=scheduled_for,
			result=result,
			note=note,
		)
		self.session.add(log)
		self.session.commit()
		self.session.refresh(log)
		return log

	def latest_attempt_for_day(self, reminder: PaymentReminder, day: datetime) -> PaymentReminderLog | None:
		day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
		day_end = day_start.replace(hour=23, minute=59, second=59, microsecond=999999)
		stmt = (
			select(PaymentReminderLog)
			.where(
				PaymentReminderLog.reminder_id == reminder.id,
				PaymentReminderLog.attempted_at >= day_start,
				PaymentReminderLog.attempted_at <= day_end,
			)
			.order_by(PaymentReminderLog.attempted_at.desc())
			.limit(1)
		)
		return self.session.execute(stmt).scalar_one_or_none()


__all__ = ["PaymentReminderCRUD"]
