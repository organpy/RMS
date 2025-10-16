"""Database helpers for group entities."""

from __future__ import annotations

from typing import Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.group import Group
from backend.models.member import Member


class GroupCRUD:
    """Group persistence operations."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, group_id: int) -> Optional[Group]:
        """Fetch a group by identifier."""

        return self.session.get(Group, group_id)

    def list(
        self,
        *,
        class_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[list[Group], int]:
        """Return groups with optional class filtering."""

        stmt = select(Group).order_by(Group.id)
        count_stmt = select(func.count()).select_from(Group)
        if class_id is not None:
            stmt = stmt.where(Group.class_id == class_id)
            count_stmt = count_stmt.where(Group.class_id == class_id)
        stmt = stmt.offset(skip).limit(limit)
        groups = self.session.execute(stmt).scalars().all()
        total = int(self.session.execute(count_stmt).scalar_one())
        return groups, total

    def create(self, payload: dict) -> Group:
        """Insert a new group."""

        group = Group(**payload)
        self.session.add(group)
        self.session.commit()
        self.session.refresh(group)
        return group

    def update(self, group: Group, payload: dict) -> Group:
        """Update an existing group."""

        for field, value in payload.items():
            setattr(group, field, value)
        self.session.add(group)
        self.session.commit()
        self.session.refresh(group)
        return group

    def delete(self, group: Group) -> None:
        """Delete a group record."""

        self.session.delete(group)
        self.session.commit()

    def list_members(self, group_id: int, skip: int = 0, limit: int = 50) -> Tuple[list[Member], int]:
        """Return members assigned to the supplied group."""

        stmt = (
            select(Member)
            .where(Member.group_id == group_id)
            .order_by(Member.id)
            .offset(skip)
            .limit(limit)
        )
        count_stmt = select(func.count()).select_from(Member).where(Member.group_id == group_id)
        members = self.session.execute(stmt).scalars().all()
        total = int(self.session.execute(count_stmt).scalar_one())
        return members, total
