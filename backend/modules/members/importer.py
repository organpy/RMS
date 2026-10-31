"""Bulk member import from CSV: every row is validated, then the valid ones are inserted together."""

import csv
import io
from dataclasses import dataclass, field

from pydantic import BaseModel, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core.errors import AppError
from backend.modules.courses.models import Course, Group
from backend.modules.plans.models import Plan

from .models import Member
from .schemas import MemberIn
from .service import validate_links

MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 5000

# Accepted header spellings (compared lowercase, spaces/underscores ignored) -> field.
ALIASES = {
    "firstname": "first_name", "first": "first_name", "givenname": "first_name",
    "lastname": "last_name", "last": "last_name", "surname": "last_name", "familyname": "last_name",
    "email": "email", "emailaddress": "email",
    "phone": "phone", "telephone": "phone", "mobile": "phone",
    "course": "course", "group": "group", "plan": "plan",
    "joined": "joined_on", "joinedon": "joined_on", "joindate": "joined_on",
    "discount": "discount_percent", "discountpercent": "discount_percent",
    "guardian": "guardian_name", "guardianname": "guardian_name",
    "guardianphone": "guardian_phone", "guardianemail": "guardian_email",
    "notes": "notes",
}  # fmt: skip
TEMPLATE_HEADER = ["First name", "Last name", "Email", "Phone", "Course", "Group", "Plan", "Joined", "Discount", "Guardian", "Guardian phone", "Guardian email", "Notes"]
TEMPLATE_EXAMPLE = ["Ana", "Silva", "ana@example.com", "+1 555 0100", "Piano", "Beginners", "Monthly", "2026-09-01", "10", "", "", "", ""]


class RowError(BaseModel):
    row: int  # spreadsheet row number, the header being row 1
    message: str


class ImportResult(BaseModel):
    total: int
    valid: int
    created: int
    errors: list[RowError]
    preview: list[str]  # the first few valid rows, for the confirmation step


@dataclass
class _Lookup:
    courses: dict = field(default_factory=dict)
    groups: dict = field(default_factory=dict)
    plans: dict = field(default_factory=dict)
    existing: set = field(default_factory=set)


def _norm(text: str) -> str:
    return text.strip().lower()


def _lookup(db: Session) -> _Lookup:
    look = _Lookup()
    look.courses = {_norm(c.name): c.id for c in db.scalars(select(Course).where(Course.archived_at.is_(None)))}
    look.groups = {(g.course_id, _norm(g.name)): g.id for g in db.scalars(select(Group))}
    look.plans = {_norm(p.name): p.id for p in db.scalars(select(Plan).where(Plan.archived_at.is_(None)))}
    rows = db.execute(select(Member.first_name, Member.last_name, func.coalesce(Member.email, "")))
    look.existing = {(_norm(f), _norm(l), _norm(e)) for f, l, e in rows}
    return look


def _read(raw: bytes) -> csv.DictReader:
    if len(raw) > MAX_BYTES:
        raise AppError("The file is larger than 2 MB")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    head = text.splitlines()[0] if text.strip() else ""
    reader = csv.reader(io.StringIO(text), delimiter=";" if head.count(";") > head.count(",") else ",")
    header = next(reader, None)
    if not header:
        raise AppError("The file is empty")
    fields = [ALIASES.get(h.strip().lower().replace(" ", "").replace("_", "")) for h in header]
    if "first_name" not in fields or "last_name" not in fields:
        raise AppError("The file needs “First name” and “Last name” columns")
    rows = ({f: v.strip() for f, v in zip(fields, row) if f and v.strip()} for row in reader if any(c.strip() for c in row))
    return rows  # type: ignore[return-value]


def run(db: Session, raw: bytes, dry_run: bool) -> ImportResult:
    rows = list(_read(raw))
    if len(rows) > MAX_ROWS:
        raise AppError(f"Import at most {MAX_ROWS} rows at a time")
    look = _lookup(db)
    errors: list[RowError] = []
    members: list[Member] = []
    preview: list[str] = []

    for index, row in enumerate(rows, start=2):
        try:
            data = dict(row)
            course, group, plan = data.pop("course", None), data.pop("group", None), data.pop("plan", None)
            member = Member(**MemberIn(**data).model_dump(exclude_none=True))
            if course:
                member.course_id = look.courses.get(_norm(course)) or _fail(f"Unknown course “{course}”")
            if group:
                if member.course_id is None:
                    raise _Invalid("A group needs a course")
                member.group_id = look.groups.get((member.course_id, _norm(group))) or _fail(f"Unknown group “{group}” in that course")
            if plan:
                member.plan_id = look.plans.get(_norm(plan)) or _fail(f"Unknown plan “{plan}”")
            validate_links(db, member)
            key = (_norm(member.first_name), _norm(member.last_name), _norm(member.email or ""))
            if key in look.existing:
                raise _Invalid("Already exists")
            look.existing.add(key)
        except _Invalid as exc:
            errors.append(RowError(row=index, message=str(exc)))
        except ValidationError as exc:
            first = exc.errors()[0]
            errors.append(RowError(row=index, message=f"{first['loc'][0] if first['loc'] else 'row'}: {first['msg'].removeprefix('Value error, ')}"))
        except AppError as exc:
            errors.append(RowError(row=index, message=exc.detail))
        else:
            members.append(member)
            if len(preview) < 5:
                preview.append(f"{member.full_name}" + (f" · {data.get('email')}" if data.get("email") else ""))

    if not dry_run:
        db.add_all(members)
    return ImportResult(total=len(rows), valid=len(members), created=0 if dry_run else len(members), errors=errors[:200], preview=preview)


class _Invalid(Exception):
    pass


def _fail(message: str):
    raise _Invalid(message)
