"""Fill an empty install with realistic demo data.

Usage:  python -m scripts.seed [--members 150]
Signs in as ``admin`` / ``admin12345`` afterwards.
"""

import argparse
import random
from datetime import timedelta

from sqlalchemy import func, select

from backend.core import clock, db, migrate
from backend.core.security import hash_password
from backend.modules.courses.models import Course, Group
from backend.modules.members.models import Member
from backend.modules.organization.models import Organization
from backend.modules.payments.schemas import PaymentIn
from backend.modules.payments.service import record
from backend.modules.plans.models import Plan
from backend.modules.staff.models import Staff

FIRST = "Lina Omar Sara Yanis Ines Adam Nora Rayan Maya Ilyes Lea Hugo Emma Noah Jade Louis Chloe Liam Zoe Sami".split()
LAST = "Haddad Benali Martin Dubois Garcia Moreau Laurent Simon Michel Leroy Roux Fournier Girard Bonnet Mercier".split()
COURSES = {
    "Grade 5": ["Group A", "Group B"],
    "Piano": ["Beginners", "Intermediate"],
    "Fitness": ["Morning", "Evening"],
}


def seed(members: int) -> None:
    migrate.upgrade(db.engine)
    rng = random.Random(7)
    with db.SessionLocal() as s:
        if s.scalar(select(func.count()).select_from(Staff)):
            raise SystemExit("Database already has data — seed only runs on a fresh install.")
        s.add(Organization(name="Northside Academy", email="hello@northside.test", phone="+1 555 0100",
                           address="12 Market Street\nSpringfield", currency="USD", primary_color="#2563eb"))
        s.add(Staff(username="admin", name="Admin", role="admin", password_hash=hash_password("admin12345")))
        plans: list[Plan] = [Plan(name="Monthly", price=45, interval_days=30), Plan(name="Quarterly", price=120, interval_days=90)]
        groups: list[Group] = []
        for name, group_names in COURSES.items():
            course = Course(name=name)
            course.groups = [Group(name=g, capacity=20) for g in group_names]
            groups += course.groups
            s.add(course)
            plans.append(Plan(name=f"{name} term", price=300, interval_days=120, course=course))
        s.add_all(plans)
        s.commit()

        today = clock.today()
        for i in range(members):
            group = rng.choice(groups)
            plan = rng.choice([p for p in plans if p.course_id in (None, group.course_id)])
            joined = today - timedelta(days=rng.randint(0, 400))
            m = Member(first_name=rng.choice(FIRST), last_name=rng.choice(LAST), joined_on=joined,
                       email=f"member{i}@example.com", phone=f"+1 555 {1000 + i:04d}",
                       course_id=group.course_id, group_id=group.id, plan_id=plan.id)
            s.add(m)
            s.flush()
            paid_on = joined
            stop = today - timedelta(days=rng.choice([0, 0, 0, 20, 60]))
            while paid_on <= stop:
                p = record(s, PaymentIn(member_id=m.id, plan_id=plan.id, paid_on=paid_on,
                                        method=rng.choice(["cash", "card", "transfer"])))
                paid_on = p.period_end + timedelta(days=rng.randint(-3, 5))
        s.commit()
    print(f"Seeded {members} members. Sign in with admin / admin12345")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--members", type=int, default=150)
    seed(parser.parse_args().members)
