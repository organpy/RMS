"""Populate the development database with deterministic sample data."""

from __future__ import annotations

import random
from datetime import date, timedelta
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import SessionLocal, init_database
from backend.models import (
    Business,
    ClassCourse,
    Group,
    Member,
    MemberStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from sqlalchemy.orm import selectinload


def ensure_database() -> None:
    """Make sure tables exist before inserting data."""

    init_database()


def get_or_create_business(name: str) -> Business:
    session = SessionLocal()
    try:
        business = session.query(Business).filter(Business.name == name).one_or_none()
        if business is None:
            business = Business(name=name, primary_color="#2563EB", secondary_color="#1E293B")
            session.add(business)
            session.commit()
            session.refresh(business)
        return business
    finally:
        session.close()


def seed_classes_and_groups(business: Business) -> list[ClassCourse]:
    session = SessionLocal()
    try:
        existing = (
            session.query(ClassCourse)
            .options(selectinload(ClassCourse.groups))
            .filter(ClassCourse.business_id == business.id)
            .order_by(ClassCourse.id)
            .all()
        )
        if existing:
            return existing

        classes: list[ClassCourse] = []
        for idx, label in enumerate(["Strength Training", "Yoga Basics", "Swimming Lessons"], start=1):
            class_course = ClassCourse(
                business_id=business.id,
                name=label,
                description=f"Sample program #{idx}",
                grouping_type="cohort",
            )
            session.add(class_course)
            session.flush()

            for g_idx in range(1, 3 + 1):
                group = Group(
                    class_id=class_course.id,
                    name=f"Group {g_idx}",
                    description=f"Auto-generated group {g_idx}",
                )
                session.add(group)

            classes.append(class_course)

        session.commit()
        return (
            session.query(ClassCourse)
            .options(selectinload(ClassCourse.groups))
            .filter(ClassCourse.business_id == business.id)
            .order_by(ClassCourse.id)
            .all()
        )
    finally:
        session.close()


def seed_members(business: Business, classes: list[ClassCourse]) -> list[Member]:
    session = SessionLocal()
    try:
        members = (
            session.query(Member)
            .filter(Member.business_id == business.id)
            .order_by(Member.id)
            .all()
        )
        if members:
            return members

        first_names = [
            "Alex",
            "Jordan",
            "Taylor",
            "Riley",
            "Morgan",
            "Casey",
            "Jamie",
            "Avery",
            "Skyler",
            "Quinn",
        ]
        last_names = ["Smith", "Johnson", "Brown", "Williams", "Davis"]

        classes_with_groups = (
            session.query(ClassCourse)
            .options(selectinload(ClassCourse.groups))
            .filter(ClassCourse.business_id == business.id)
            .order_by(ClassCourse.id)
            .all()
        )

        random.seed(42)
        members = []
        groups = [group for class_course in classes_with_groups for group in class_course.groups]
        if not groups:
            raise RuntimeError("No groups available to assign members. Did class seeding run correctly?")

        for idx in range(20):
            first = random.choice(first_names)
            last = random.choice(last_names)
            class_choice = random.choice(classes_with_groups)
            group_choice = random.choice(groups)
            member = Member(
                business_id=business.id,
                class_id=class_choice.id,
                group_id=group_choice.id,
                first_name=first,
                last_name=last,
                email=f"{first.lower()}.{last.lower()}{idx}@example.com",
                status=random.choice(list(MemberStatus)),
                joined_at=date.today() - timedelta(days=random.randint(0, 365)),
            )
            session.add(member)
            members.append(member)

        session.commit()
        return members
    finally:
        session.close()


def seed_payments(members: list[Member]) -> None:
    session = SessionLocal()
    try:
        if session.query(Payment).count() >= 50:
            return

        random.seed(1337)
        today = date.today()
        for idx in range(50):
            member = random.choice(members)
            payment_date = today - timedelta(days=random.randint(0, 90))
            next_due = payment_date + timedelta(days=30)
            payment = Payment(
                member_id=member.id,
                amount=round(random.uniform(25.0, 120.0), 2),
                payment_date=payment_date,
                next_due_date=next_due,
                status=random.choice([PaymentStatus.PAID, PaymentStatus.OVERDUE]),
                method=random.choice(list(PaymentMethod)),
                receipt_number=f"receipt-{member.id}-{idx:04d}",
            )
            session.add(payment)

        session.commit()
    finally:
        session.close()


def main() -> None:
    ensure_database()
    business = get_or_create_business("Demo Fitness Center")
    classes = seed_classes_and_groups(business)
    members = seed_members(business, classes)
    seed_payments(members)
    print("Seed data applied successfully.")


if __name__ == "__main__":  # pragma: no cover - script entry point
    main()
