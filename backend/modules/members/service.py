from datetime import timedelta

from sqlalchemy import case, func, literal, or_, select
from sqlalchemy.orm import Session

from backend.core import clock
from backend.core.errors import AppError, NotFound
from backend.modules.courses.models import Course, Group
from backend.modules.organization.service import get_org
from backend.modules.plans.models import Plan

from .models import Member
from .schemas import MemberOut


def status_expr(db: Session):
    """SQL expression deriving a member's status from ``paid_until`` and today's date."""
    today = clock.today()
    grace_start = today - timedelta(days=get_org(db).grace_days)
    return case(
        (Member.archived_at.is_not(None), literal("archived")),
        (Member.paid_until >= today, literal("active")),
        (Member.paid_until.is_(None), literal("due")),
        (Member.paid_until >= grace_start, literal("due")),
        else_=literal("overdue"),
    ).label("status")


def search_filter(q: str):
    like = f"%{q.strip()}%"
    return or_(
        (Member.first_name + " " + Member.last_name).ilike(like),
        (Member.last_name + " " + Member.first_name).ilike(like),
        Member.email.ilike(like),
        Member.phone.ilike(like),
        Member.guardian_name.ilike(like),
        Member.guardian_phone.ilike(like),
    )


def to_out(member: Member, status: str) -> MemberOut:
    return MemberOut(
        id=member.id,
        first_name=member.first_name,
        last_name=member.last_name,
        full_name=member.full_name,
        email=member.email,
        phone=member.phone,
        notes=member.notes,
        guardian_name=member.guardian_name,
        guardian_phone=member.guardian_phone,
        guardian_email=member.guardian_email,
        course_id=member.course_id,
        course_name=member.course.name if member.course else None,
        group_id=member.group_id,
        group_name=member.group.name if member.group else None,
        plan_id=member.plan_id,
        plan_name=member.plan.name if member.plan else None,
        plan_price=member.plan.price if member.plan else None,
        joined_on=member.joined_on,
        paid_until=member.paid_until,
        status=status,
    )


def get_member(db: Session, member_id: int) -> Member:
    member = db.get(Member, member_id)
    if member is None:
        raise NotFound("Member not found")
    return member


def read(db: Session, member_id: int) -> MemberOut:
    row = db.execute(select(Member, status_expr(db)).where(Member.id == member_id)).first()
    if row is None:
        raise NotFound("Member not found")
    return to_out(*row)


def validate_links(db: Session, member: Member) -> None:
    """Ensure course/group/plan references exist and agree with each other."""
    if member.group_id is not None:
        group = db.get(Group, member.group_id)
        if group is None:
            raise NotFound("Group not found")
        if member.course_id is None:
            member.course_id = group.course_id
        elif group.course_id != member.course_id:
            raise AppError("Group does not belong to the selected course")
    if member.course_id is not None and db.get(Course, member.course_id) is None:
        raise NotFound("Course not found")
    if member.plan_id is not None:
        plan = db.get(Plan, member.plan_id)
        if plan is None:
            raise NotFound("Plan not found")
        if plan.course_id is not None and plan.course_id != member.course_id:
            raise AppError("Plan is not available for the selected course")


def count_by_status(db: Session) -> dict[str, int]:
    status = status_expr(db)
    rows = db.execute(select(status, func.count()).group_by(status)).all()
    counts = {"active": 0, "due": 0, "overdue": 0, "archived": 0}
    counts.update({s: n for s, n in rows})
    return counts
