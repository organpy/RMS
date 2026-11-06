from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.security import current_staff, require_admin
from backend.modules.courses.models import Course
from backend.modules.members.models import Member
from backend.modules.messaging import providers
from backend.modules.organization.service import get_org
from backend.modules.payments.models import Payment
from backend.modules.plans.models import Plan
from backend.modules.staff.models import Staff

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class Step(BaseModel):
    id: str
    done: bool
    optional: bool = False


class Onboarding(BaseModel):
    steps: list[Step]
    completed: int
    total: int
    dismissed: bool


class OnboardingUpdate(BaseModel):
    dismissed: bool


def _any(db: Session, model) -> bool:
    return bool(db.scalar(select(func.count()).select_from(model)))


def _state(db: Session) -> Onboarding:
    org = get_org(db)
    steps = [
        Step(id="organization", done=bool(org.email or org.phone or org.address or org.logo_mime)),
        Step(id="course", done=_any(db, Course)),
        Step(id="plan", done=_any(db, Plan)),
        Step(id="members", done=_any(db, Member)),
        Step(id="payment", done=_any(db, Payment)),
        Step(id="backups", done=org.backup_enabled),
        Step(id="messaging", done=any(providers.configured().values()), optional=True),
        Step(id="staff", done=(db.scalar(select(func.count()).select_from(Staff)) or 0) > 1, optional=True),
    ]
    return Onboarding(steps=steps, completed=sum(s.done for s in steps), total=len(steps), dismissed=org.onboarding_dismissed)


@router.get("", response_model=Onboarding, dependencies=[Depends(current_staff)])
def read(db: Session = Depends(get_db)) -> Onboarding:
    """Setup checklist: each step is done once the matching data exists, so it never goes stale."""
    return _state(db)


@router.put("", response_model=Onboarding, dependencies=[Depends(require_admin)])
def update(body: OnboardingUpdate, db: Session = Depends(get_db)) -> Onboarding:
    get_org(db).onboarding_dismissed = body.dismissed
    db.commit()
    return _state(db)
