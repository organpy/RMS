"""Utility functions shared across routers."""

from __future__ import annotations

from backend.models.member import Member
from backend.models.payment import Payment
from backend.schemas.common import ClassSummary, GroupSummary
from backend.schemas.member import MemberResponse
from backend.schemas.payment import PaymentResponse


def serialize_member(member: Member) -> MemberResponse:
    """Convert a Member ORM instance into a response schema with relationship summaries."""

    response = MemberResponse.model_validate(member, from_attributes=True)
    if getattr(member, "class_course", None) is not None:
        response.class_info = ClassSummary.model_validate(member.class_course, from_attributes=True)
    if getattr(member, "group", None) is not None:
        response.group_info = GroupSummary.model_validate(member.group, from_attributes=True)
    return response


def serialize_payment(payment: Payment) -> PaymentResponse:
    """Convert a Payment ORM instance into a response schema."""

    response = PaymentResponse.model_validate(payment, from_attributes=True)
    reminder = getattr(payment, "reminder", None)
    if reminder is not None:
        response.reminder_status = reminder.status
        response.reminder_attempt_count = reminder.attempt_count or 0
        response.reminder_last_attempt_at = reminder.last_attempt_at
        response.reminder_next_scheduled_at = reminder.next_scheduled_at
    else:
        response.reminder_status = None
        response.reminder_attempt_count = 0
        response.reminder_last_attempt_at = None
        response.reminder_next_scheduled_at = None
    return response
