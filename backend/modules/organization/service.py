from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.errors import NotFound

from .models import Organization


def get_org(db: Session) -> Organization:
    org = db.scalar(select(Organization).limit(1))
    if org is None:
        raise NotFound("Organization is not set up yet")
    return org
