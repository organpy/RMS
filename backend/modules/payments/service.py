from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core import clock
from backend.core.errors import AppError, NotFound
from backend.modules.members.models import Member
from backend.modules.members.service import get_member
from backend.modules.organization.service import get_org
from backend.modules.plans.models import Plan

from .models import Payment
from .schemas import PaymentIn, PaymentOut


def next_invoice_number(db: Session, year: int) -> str:
    """Allocate ``PREFIX-YYYY-0001`` style numbers; the sequence restarts every year."""
    org = get_org(db)
    if org.invoice_year != year:
        org.invoice_year, org.invoice_seq = year, 0
    org.invoice_seq += 1
    db.flush()
    return f"{org.invoice_prefix}-{year}-{org.invoice_seq:04d}"


def refresh_paid_until(db: Session, member: Member) -> None:
    member.paid_until = db.scalar(
        select(func.max(Payment.period_end)).where(Payment.member_id == member.id, Payment.refunded_at.is_(None))
    )


def record(db: Session, body: PaymentIn) -> Payment:
    member = get_member(db, body.member_id)
    plan = db.get(Plan, body.plan_id) if body.plan_id else None
    if body.plan_id and plan is None:
        raise NotFound("Plan not found")

    paid_on = body.paid_on or clock.today()
    amount = body.amount if body.amount is not None else (plan.price if plan else None)
    if amount is None:
        raise AppError("Amount is required when no plan is selected")

    start, end = body.period_start, body.period_end
    if start is None and plan is not None:
        start = max(paid_on, member.paid_until + timedelta(days=1)) if member.paid_until else paid_on
        end = start + timedelta(days=plan.interval_days - 1)

    if plan is not None and member.plan_id != plan.id:
        member.plan_id = plan.id

    payment = Payment(
        member_id=member.id,
        invoice_number=next_invoice_number(db, paid_on.year),
        description=body.description or (plan.name if plan else "Payment"),
        amount=amount,
        method=body.method,
        paid_on=paid_on,
        period_start=start,
        period_end=end,
        notes=body.notes,
    )
    db.add(payment)
    db.flush()
    refresh_paid_until(db, member)
    db.commit()
    return payment


def get_payment(db: Session, payment_id: int) -> Payment:
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise NotFound("Payment not found")
    return payment


def to_out(payment: Payment) -> PaymentOut:
    return PaymentOut(
        id=payment.id,
        member_id=payment.member_id,
        member_name=payment.member.full_name,
        invoice_number=payment.invoice_number,
        description=payment.description,
        amount=payment.amount,
        method=payment.method,
        paid_on=payment.paid_on,
        period_start=payment.period_start,
        period_end=payment.period_end,
        notes=payment.notes,
        refunded_at=payment.refunded_at,
    )
