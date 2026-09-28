from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.errors import NotFound
from backend.core.security import current_staff
from backend.modules.courses.models import Course

from .models import Plan
from .schemas import PlanIn, PlanOut, PlanUpdate

router = APIRouter(prefix="/plans", tags=["plans"], dependencies=[Depends(current_staff)])


def _out(plan: Plan) -> PlanOut:
    return PlanOut.model_validate(plan).model_copy(
        update={"course_name": plan.course.name if plan.course else None, "archived": plan.archived_at is not None}
    )


def _check_course(db: Session, course_id: int | None) -> None:
    if course_id is not None and db.get(Course, course_id) is None:
        raise NotFound("Course not found")


@router.get("", response_model=list[PlanOut])
def list_plans(
    course_id: int | None = None, include_archived: bool = False, db: Session = Depends(get_db)
) -> list[PlanOut]:
    """Plans for a course include course-agnostic plans (``course_id`` null)."""
    stmt = select(Plan).order_by(Plan.price, Plan.name)
    if not include_archived:
        stmt = stmt.where(Plan.archived_at.is_(None))
    if course_id is not None:
        stmt = stmt.where(or_(Plan.course_id == course_id, Plan.course_id.is_(None)))
    return [_out(p) for p in db.scalars(stmt)]


@router.post("", response_model=PlanOut, status_code=201)
def create_plan(body: PlanIn, db: Session = Depends(get_db)) -> PlanOut:
    _check_course(db, body.course_id)
    plan = Plan(**body.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _out(plan)


@router.patch("/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: int, body: PlanUpdate, db: Session = Depends(get_db)) -> PlanOut:
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise NotFound("Plan not found")
    data = body.model_dump(exclude_unset=True)
    if "archived" in data:
        plan.archived_at = datetime.now(timezone.utc) if data.pop("archived") else None
    if "course_id" in data:
        _check_course(db, data["course_id"])
    for key, value in data.items():
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return _out(plan)
