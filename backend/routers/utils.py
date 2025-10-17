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

    return PaymentResponse.model_validate(payment, from_attributes=True)
