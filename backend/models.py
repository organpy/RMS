"""Import every model so ``Base.metadata`` is complete (used by Alembic and tests)."""

from backend.core.db import Base
from backend.modules.attendance.models import Attendance, ClassSession
from backend.modules.audit.models import AuditLog
from backend.modules.courses.models import Course, Group
from backend.modules.expenses.models import Expense
from backend.modules.members.models import Member
from backend.modules.organization.models import Organization
from backend.modules.payments.models import Payment
from backend.modules.plans.models import Plan
from backend.modules.messaging.models import Message
from backend.modules.staff.models import Staff

__all__ = ["Attendance", "AuditLog", "Base", "ClassSession", "Course", "Expense", "Group", "Member", "Message", "Organization", "Payment", "Plan", "Staff"]
