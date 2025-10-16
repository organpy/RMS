"""Database helpers for class/course entities."""

from __future__ import annotations

from typing import Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from backend.models.class_course import ClassCourse
from backend.models.member import Member
from backend.models.group import Group


class ClassCourseCRUD:
    """Persistence layer for classes/courses."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, class_id: int) -> Optional[ClassCourse]:
        """Fetch a class by identifier."""

        stmt = select(ClassCourse).options(selectinload(ClassCourse.groups)).where(ClassCourse.id == class_id)
        return self.session.execute(stmt).scalars().first()

    def list(
        self,
        *,
        business_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[list[ClassCourse], int]:
        """Return classes, optionally filtered by business."""

        stmt = select(ClassCourse).options(selectinload(ClassCourse.groups)).order_by(ClassCourse.id)
        count_stmt = select(func.count()).select_from(ClassCourse)
        if business_id is not None:
            stmt = stmt.where(ClassCourse.business_id == business_id)
            count_stmt = count_stmt.where(ClassCourse.business_id == business_id)
        stmt = stmt.offset(skip).limit(limit)
        classes = self.session.execute(stmt).scalars().all()
        total = int(self.session.execute(count_stmt).scalar_one())
        return classes, total

    def create(self, payload: dict) -> ClassCourse:
        """Insert a new class/course."""

        class_course = ClassCourse(**payload)
        self.session.add(class_course)
        self.session.commit()
        self.session.refresh(class_course)
        return class_course

    def update(self, class_course: ClassCourse, payload: dict) -> ClassCourse:
        """Update an existing class/course."""

        for field, value in payload.items():
            setattr(class_course, field, value)
        self.session.add(class_course)
        self.session.commit()
        self.session.refresh(class_course)
        return class_course

    def list_members(self, class_id: int, skip: int = 0, limit: int = 50) -> Tuple[list[Member], int]:
        """Return members enrolled in the supplied class."""

        stmt = (
            select(Member)
            .where(Member.class_id == class_id)
            .order_by(Member.id)
            .offset(skip)
            .limit(limit)
        )
        count_stmt = select(func.count()).select_from(Member).where(Member.class_id == class_id)
        members = self.session.execute(stmt).scalars().all()
        total = int(self.session.execute(count_stmt).scalar_one())
        return members, total

    def list_groups(self, class_id: int) -> list[Group]:
        """Return groups associated with the class."""

        stmt = select(Group).where(Group.class_id == class_id).order_by(Group.id)
        return self.session.execute(stmt).scalars().all()
