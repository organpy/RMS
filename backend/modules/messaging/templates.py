"""Placeholder rendering for reminder and announcement messages."""

import re

from backend.modules.invoices.render import money
from backend.modules.members.models import Member
from backend.modules.organization.models import Organization

PLACEHOLDER = re.compile(r"\{(\w+)\}")


def render(template: str, values: dict[str, str]) -> str:
    """Substitute ``{name}`` placeholders; unknown ones are left untouched."""
    return PLACEHOLDER.sub(lambda m: values.get(m.group(1), m.group(0)), template)


def member_values(member: Member, org: Organization) -> dict[str, str]:
    price = member.plan.price if member.plan else None
    return {
        "first_name": member.first_name,
        "last_name": member.last_name,
        "plan": member.plan.name if member.plan else "membership",
        "organization": org.name,
        "due_date": member.paid_until.strftime("%d %b %Y") if member.paid_until else "now",
        "amount": money(price, org.currency, org.locale) if price is not None else "",
    }
