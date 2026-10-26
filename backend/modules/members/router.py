import csv
import io
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.pagination import Page, Paging, paginate
from backend.core.security import current_staff, require_admin

from . import service
from .models import Member
from .schemas import MemberIn, MemberOut, MemberUpdate, Status

router = APIRouter(prefix="/members", tags=["members"], dependencies=[Depends(current_staff)])

Sort = Literal["name", "-name", "paid_until", "-paid_until", "joined_on", "-joined_on"]
SORTS = {"name": (Member.last_name, Member.first_name), "paid_until": (Member.paid_until,), "joined_on": (Member.joined_on,)}


def _query(
    db: Session,
    q: Optional[str],
    status: Optional[Status],
    course_id: Optional[int],
    group_id: Optional[int],
    plan_id: Optional[int],
    sort: Sort,
):
    status_col = service.status_expr(db)
    stmt = service.member_rows(db)
    if q:
        stmt = stmt.where(service.search_filter(q))
    if status:
        stmt = stmt.where(status_col == status)
    else:
        stmt = stmt.where(Member.archived_at.is_(None))
    for column, value in ((Member.course_id, course_id), (Member.group_id, group_id), (Member.plan_id, plan_id)):
        if value is not None:
            stmt = stmt.where(column == value)
    columns = SORTS[sort.lstrip("-")]
    order = [c.desc().nulls_last() if sort.startswith("-") else c.asc().nulls_first() for c in columns]
    return stmt.order_by(*order, Member.id)


@router.get("", response_model=Page[MemberOut])
def list_members(
    paging: Paging,
    q: Optional[str] = Query(None, max_length=100),
    status: Optional[Status] = None,
    course_id: Optional[int] = None,
    group_id: Optional[int] = None,
    plan_id: Optional[int] = None,
    sort: Sort = "name",
    db: Session = Depends(get_db),
) -> Page[MemberOut]:
    rows, total = paginate(db, _query(db, q, status, course_id, group_id, plan_id, sort), paging)
    return Page(items=[service.to_out(*r) for r in rows], total=total, page=paging.page, size=paging.size)


@router.get("/counts")
def counts(db: Session = Depends(get_db)) -> dict[str, int]:
    return service.count_by_status(db)


@router.get("/export.csv")
def export_csv(
    q: Optional[str] = Query(None, max_length=100),
    status: Optional[Status] = None,
    course_id: Optional[int] = None,
    group_id: Optional[int] = None,
    plan_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    rows = db.execute(_query(db, q, status, course_id, group_id, plan_id, "name")).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["First name", "Last name", "Email", "Phone", "Course", "Group", "Plan", "Joined", "Paid until", "Status"])
    for row in rows:
        m = service.to_out(*row)
        writer.writerow([m.first_name, m.last_name, m.email, m.phone, m.course_name, m.group_name, m.plan_name, m.joined_on, m.paid_until, m.status])
    headers = {"Content-Disposition": 'attachment; filename="members.csv"'}
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers=headers)


@router.get("/{member_id}", response_model=MemberOut)
def read_member(member_id: int, db: Session = Depends(get_db)) -> MemberOut:
    return service.read(db, member_id)


@router.post("", response_model=MemberOut, status_code=201)
def create_member(body: MemberIn, db: Session = Depends(get_db)) -> MemberOut:
    data = body.model_dump(exclude_none=True)
    member = Member(**data)
    service.validate_links(db, member)
    db.add(member)
    db.commit()
    return service.read(db, member.id)


@router.patch("/{member_id}", response_model=MemberOut)
def update_member(member_id: int, body: MemberUpdate, db: Session = Depends(get_db)) -> MemberOut:
    member = service.get_member(db, member_id)
    data = body.model_dump(exclude_unset=True)
    if "archived" in data:
        member.archived_at = datetime.now(timezone.utc) if data.pop("archived") else None
    if "course_id" in data and "group_id" not in data and data["course_id"] != member.course_id:
        member.group_id = None
    for key, value in data.items():
        setattr(member, key, value)
    service.validate_links(db, member)
    db.commit()
    return service.read(db, member.id)


@router.delete("/{member_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_member(member_id: int, db: Session = Depends(get_db)) -> None:
    """Permanently delete a member and their payment history (admins only)."""
    db.delete(service.get_member(db, member_id))
    db.commit()
