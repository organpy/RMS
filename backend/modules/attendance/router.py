import csv
import io
from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.core import clock
from backend.core.db import get_db
from backend.core.errors import AppError, NotFound
from backend.core.security import current_staff
from backend.modules.courses.models import Group
from backend.modules.members.models import Member

from .models import Attendance, ClassSession

router = APIRouter(tags=["attendance"], dependencies=[Depends(current_staff)])

Status = Literal["present", "late", "absent"]


class Record(BaseModel):
    member_id: int
    status: Status


class RecordOut(BaseModel):
    member_id: int
    full_name: str
    status: Optional[Status]


class SessionIn(BaseModel):
    records: list[Record] = Field(max_length=2000)


class SessionOut(BaseModel):
    group_id: int
    held_on: date
    recorded: bool
    records: list[RecordOut]


def _group(db: Session, group_id: int) -> Group:
    group = db.get(Group, group_id)
    if group is None:
        raise NotFound("Group not found")
    return group


def _session(db: Session, group_id: int, held_on: date) -> ClassSession | None:
    return db.scalar(
        select(ClassSession)
        .options(selectinload(ClassSession.records))
        .where(ClassSession.group_id == group_id, ClassSession.held_on == held_on)
    )


def _out(db: Session, group_id: int, held_on: date) -> SessionOut:
    """Current group members plus anyone recorded that day (e.g. since moved), sorted by name."""
    session = _session(db, group_id, held_on)
    marks = {r.member_id: r.status for r in session.records} if session else {}
    members = db.scalars(
        select(Member)
        .where((Member.group_id == group_id) & Member.archived_at.is_(None) | Member.id.in_(marks))
        .order_by(Member.last_name, Member.first_name)
    )
    records = [RecordOut(member_id=m.id, full_name=m.full_name, status=marks.get(m.id)) for m in members]
    return SessionOut(group_id=group_id, held_on=held_on, recorded=session is not None, records=records)


@router.get("/groups/{group_id}/sessions/{held_on}", response_model=SessionOut)
def read_session(group_id: int, held_on: date, db: Session = Depends(get_db)) -> SessionOut:
    _group(db, group_id)
    return _out(db, group_id, held_on)


@router.put("/groups/{group_id}/sessions/{held_on}", response_model=SessionOut)
def save_session(group_id: int, held_on: date, body: SessionIn, db: Session = Depends(get_db)) -> SessionOut:
    _group(db, group_id)
    if held_on > clock.today():
        raise AppError("Attendance can't be taken for a future date")
    ids = {r.member_id for r in body.records}
    if len(ids) != len(body.records):
        raise AppError("Each member can only appear once")
    if ids and len(db.scalars(select(Member.id).where(Member.id.in_(ids))).all()) != len(ids):
        raise NotFound("Member not found")

    session = _session(db, group_id, held_on)
    if session is None:
        session = ClassSession(group_id=group_id, held_on=held_on)
        db.add(session)
    existing = {r.member_id: r for r in session.records}
    for record in body.records:
        if record.member_id in existing:
            existing[record.member_id].status = record.status
        else:
            session.records.append(Attendance(member_id=record.member_id, status=record.status))
    db.commit()
    return _out(db, group_id, held_on)


@router.get("/groups/{group_id}/attendance.csv")
def export_register(
    group_id: int,
    date_from: Optional[date] = Query(None, alias="from"),
    date_to: Optional[date] = Query(None, alias="to"),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Attendance register: one row per member, one column per session (P / L / A)."""
    group = _group(db, group_id)
    date_to = date_to or clock.today()
    date_from = date_from or date_to - timedelta(days=30)
    sessions = db.scalars(
        select(ClassSession)
        .options(selectinload(ClassSession.records))
        .where(ClassSession.group_id == group_id, ClassSession.held_on.between(date_from, date_to))
        .order_by(ClassSession.held_on)
    ).all()
    marks = {(s.id, r.member_id): r.status[0].upper() for s in sessions for r in s.records}
    recorded = {member_id for _, member_id in marks}
    members = db.scalars(
        select(Member)
        .where((Member.group_id == group_id) & Member.archived_at.is_(None) | Member.id.in_(recorded))
        .order_by(Member.last_name, Member.first_name)
    ).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Member", *(s.held_on.isoformat() for s in sessions)])
    for m in members:
        writer.writerow([m.full_name, *(marks.get((s.id, m.id), "") for s in sessions)])
    name = f"attendance-{group.name}-{date_from}-{date_to}.csv".replace(" ", "-").lower()
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{name}"'})
