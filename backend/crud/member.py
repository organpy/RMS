"""Database helpers for member related operations."""

from __future__ import annotations

from typing import Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from backend.models.member import Member, MemberStatus


class MemberCRUD:
    """Encapsulates member persistence operations."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, member_id: int) -> Optional[Member]:
        """Fetch a single member by identifier."""

        return self.session.get(Member, member_id)

    def list(
        self,
        *,
        status: Optional[MemberStatus] = None,
        class_id: Optional[int] = None,
        group_id: Optional[int] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 25,
    ) -> Tuple[list[Member], int]:
        """Return members filtered by the provided parameters."""

        stmt = (
            select(Member)
            .options(
                selectinload(Member.class_course),
                selectinload(Member.group),
            )
            .order_by(Member.id)
        )
        count_stmt = select(func.count()).select_from(Member)

        if status is not None:
            stmt = stmt.where(Member.status == status)
            count_stmt = count_stmt.where(Member.status == status)
        if class_id is not None:
            stmt = stmt.where(Member.class_id == class_id)
            count_stmt = count_stmt.where(Member.class_id == class_id)
        if group_id is not None:
            stmt = stmt.where(Member.group_id == group_id)
            count_stmt = count_stmt.where(Member.group_id == group_id)
        if search:
            search_term = f"%{search.lower()}%"
            search_filter = or_(
                func.lower(Member.first_name).like(search_term),
                func.lower(Member.last_name).like(search_term),
            )
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        stmt = stmt.offset(skip).limit(limit)
        members = self.session.execute(stmt).scalars().all()
        total = int(self.session.execute(count_stmt).scalar_one())
        return members, total

    def create(self, payload: dict) -> Member:
        """Insert a new member using the provided dictionary payload."""

        member = Member(**payload)
        self.session.add(member)
        self.session.commit()
        self.session.refresh(member)
        return member

    def update(self, member: Member, payload: dict) -> Member:
        """Apply updates to an existing member."""

        for field, value in payload.items():
            setattr(member, field, value)
        self.session.add(member)
        self.session.commit()
        self.session.refresh(member)
        return member

    def set_status(self, member: Member, status: MemberStatus) -> Member:
        """Change the status of a member."""

        member.status = status
        self.session.add(member)
        self.session.commit()
        self.session.refresh(member)
        return member

    def delete(self, member: Member) -> None:
        """Delete a member record. Currently performs a hard delete."""

        self.session.delete(member)
        self.session.commit()
