import csv
import io
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core import clock
from backend.core.db import get_db
from backend.core.errors import NotFound
from backend.core.pagination import Paging, paginate
from backend.core.security import current_staff
from backend.modules.staff.models import Staff

from .models import Expense
from .schemas import ExpenseIn, ExpenseOut, ExpensePage, ExpenseUpdate, Method

router = APIRouter(prefix="/expenses", tags=["expenses"], dependencies=[Depends(current_staff)])


def _query(q, category, date_from, date_to):
    stmt = select(Expense, Staff.name).outerjoin(Staff, Staff.id == Expense.staff_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(Expense.description.ilike(like) | Expense.category.ilike(like))
    if category:
        stmt = stmt.where(Expense.category == category)
    if date_from:
        stmt = stmt.where(Expense.spent_on >= date_from)
    if date_to:
        stmt = stmt.where(Expense.spent_on <= date_to)
    return stmt


def _filters(
    q: Optional[str] = Query(None, max_length=100),
    category: Optional[str] = Query(None, max_length=60),
    date_from: Optional[date] = Query(None, alias="from"),
    date_to: Optional[date] = Query(None, alias="to"),
) -> dict:
    return dict(q=q, category=category, date_from=date_from, date_to=date_to)


def _out(expense: Expense, staff_name: Optional[str]) -> ExpenseOut:
    return ExpenseOut.model_validate(expense).model_copy(update={"staff_name": staff_name})


def _get(db: Session, expense_id: int) -> Expense:
    expense = db.get(Expense, expense_id)
    if expense is None:
        raise NotFound("Expense not found")
    return expense


@router.get("", response_model=ExpensePage)
def list_expenses(paging: Paging, filters: dict = Depends(_filters), db: Session = Depends(get_db)) -> ExpensePage:
    stmt = _query(**filters)
    total = db.scalar(stmt.with_only_columns(func.coalesce(func.sum(Expense.amount), 0)))
    rows, count = paginate(db, stmt.order_by(Expense.spent_on.desc(), Expense.id.desc()), paging)
    return ExpensePage(items=[_out(e, n) for e, n in rows], total=count, page=paging.page, size=paging.size, amount_total=Decimal(total or 0))


@router.get("/categories", response_model=list[str])
def categories(db: Session = Depends(get_db)) -> list[str]:
    """Categories already in use, most used first (the form offers them as suggestions)."""
    return list(db.scalars(select(Expense.category).group_by(Expense.category).order_by(func.count().desc(), Expense.category)))


@router.get("/export.csv")
def export_csv(filters: dict = Depends(_filters), db: Session = Depends(get_db)) -> StreamingResponse:
    rows = db.execute(_query(**filters).order_by(Expense.spent_on.desc(), Expense.id.desc())).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Date", "Category", "Description", "Amount", "Method", "Recorded by"])
    for e, name in rows:
        writer.writerow([e.spent_on, e.category, e.description, e.amount, e.method, name or ""])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="expenses.csv"'})


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(body: ExpenseIn, db: Session = Depends(get_db), staff=Depends(current_staff)) -> ExpenseOut:
    data = body.model_dump()
    data["spent_on"] = data["spent_on"] or clock.today()
    data["category"] = data["category"].strip()
    expense = Expense(**data, staff_id=staff.id)
    db.add(expense)
    db.commit()
    return _out(expense, staff.name)


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, body: ExpenseUpdate, db: Session = Depends(get_db)) -> ExpenseOut:
    expense = _get(db, expense_id)
    for key, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(expense, key, value)
    db.commit()
    return _out(expense, db.scalar(select(Staff.name).where(Staff.id == expense.staff_id)))


@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: Session = Depends(get_db)) -> None:
    db.delete(_get(db, expense_id))
    db.commit()
