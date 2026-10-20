from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from backend.core.db import get_db
from backend.core.errors import Conflict, NotFound
from backend.core.security import current_staff
from backend.modules.members.models import Member
from backend.modules.members.service import status_expr

from .models import Course, Group
from .schemas import CourseIn, CourseOut, CourseUpdate, GroupIn, GroupOut, Roster, RosterGroup, RosterMember

router = APIRouter(tags=["courses"], dependencies=[Depends(current_staff)])


def _counts(db: Session, column) -> dict[int, int]:
    stmt = select(column, func.count()).where(Member.archived_at.is_(None), column.is_not(None)).group_by(column)
    return dict(db.execute(stmt).all())


def _out(course: Course, course_counts: dict, group_counts: dict) -> CourseOut:
    return CourseOut(
        id=course.id,
        name=course.name,
        description=course.description,
        archived=course.archived_at is not None,
        member_count=course_counts.get(course.id, 0),
        groups=[
            GroupOut.model_validate(g).model_copy(update={"member_count": group_counts.get(g.id, 0)})
            for g in course.groups
        ],
    )


def _get(db: Session, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise NotFound("Course not found")
    return course


def _single(db: Session, course: Course) -> CourseOut:
    return _out(course, _counts(db, Member.course_id), _counts(db, Member.group_id))


@router.get("/courses", response_model=list[CourseOut])
def list_courses(include_archived: bool = False, db: Session = Depends(get_db)) -> list[CourseOut]:
    stmt = select(Course).options(selectinload(Course.groups)).order_by(Course.name)
    if not include_archived:
        stmt = stmt.where(Course.archived_at.is_(None))
    course_counts, group_counts = _counts(db, Member.course_id), _counts(db, Member.group_id)
    return [_out(c, course_counts, group_counts) for c in db.scalars(stmt)]


@router.get("/courses/{course_id}/roster", response_model=Roster)
def roster(course_id: int, db: Session = Depends(get_db)) -> Roster:
    """Current members of a course, grouped by their group, with an Unassigned bucket."""
    course = _get(db, course_id)
    status = status_expr(db)
    rows = db.execute(
        select(Member, status)
        .where(Member.course_id == course_id, Member.archived_at.is_(None))
        .order_by(Member.last_name, Member.first_name)
    ).all()
    by_group: dict[int | None, list[RosterMember]] = {}
    for member, member_status in rows:
        by_group.setdefault(member.group_id, []).append(
            RosterMember(
                id=member.id,
                full_name=member.full_name,
                email=member.email,
                phone=member.phone,
                plan_name=member.plan.name if member.plan else None,
                paid_until=member.paid_until,
                status=member_status,
            )
        )
    groups = []
    for g in sorted(course.groups, key=lambda g: g.name):
        members = by_group.pop(g.id, [])
        groups.append(RosterGroup.model_validate(g).model_copy(update={"members": members, "member_count": len(members)}))
    unassigned = [m for members in by_group.values() for m in members]  # no group, or a group of another course
    return Roster(course=_single(db, course), groups=groups, unassigned=sorted(unassigned, key=lambda m: m.full_name))


@router.post("/courses", response_model=CourseOut, status_code=201)
def create_course(body: CourseIn, db: Session = Depends(get_db)) -> CourseOut:
    course = Course(**body.model_dump())
    db.add(course)
    db.commit()
    return _single(db, course)


@router.patch("/courses/{course_id}", response_model=CourseOut)
def update_course(course_id: int, body: CourseUpdate, db: Session = Depends(get_db)) -> CourseOut:
    course = _get(db, course_id)
    data = body.model_dump(exclude_unset=True)
    if "archived" in data:
        course.archived_at = datetime.now(timezone.utc) if data.pop("archived") else None
    for key, value in data.items():
        setattr(course, key, value)
    db.commit()
    return _single(db, course)


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: int, db: Session = Depends(get_db)) -> None:
    course = _get(db, course_id)
    if db.scalar(select(func.count()).where(Member.course_id == course_id)):
        raise Conflict("Course has members — archive it instead")
    db.delete(course)
    db.commit()


@router.post("/courses/{course_id}/groups", response_model=GroupOut, status_code=201)
def create_group(course_id: int, body: GroupIn, db: Session = Depends(get_db)) -> Group:
    _get(db, course_id)
    group = Group(course_id=course_id, **body.model_dump())
    db.add(group)
    db.commit()
    return group


@router.patch("/groups/{group_id}", response_model=GroupOut)
def update_group(group_id: int, body: GroupIn, db: Session = Depends(get_db)) -> Group:
    group = db.get(Group, group_id)
    if group is None:
        raise NotFound("Group not found")
    for key, value in body.model_dump().items():
        setattr(group, key, value)
    db.commit()
    return group


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: int, db: Session = Depends(get_db)) -> None:
    """Members of a deleted group stay enrolled in the course, just without a group."""
    group = db.get(Group, group_id)
    if group is None:
        raise NotFound("Group not found")
    db.delete(group)
    db.commit()
