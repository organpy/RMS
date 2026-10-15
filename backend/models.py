"""Import every model so ``Base.metadata`` is complete (used by Alembic and tests)."""

from backend.core.db import Base
from backend.modules.courses.models import Course, Group
from backend.modules.members.models import Member
from backend.modules.organization.models import Organization
from backend.modules.payments.models import Payment
from backend.modules.plans.models import Plan
from backend.modules.messaging.models import Message
from backend.modules.staff.models import Staff

__all__ = ["Base", "Course", "Group", "Member", "Message", "Organization", "Payment", "Plan", "Staff"]
