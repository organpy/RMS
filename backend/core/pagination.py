"""Offset pagination shared by list endpoints."""

from typing import Annotated, Generic, TypeVar

from fastapi import Depends, Query
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int


class PageParams(BaseModel):
    page: int
    size: int


def _params(page: int = Query(1, ge=1), size: int = Query(25, ge=1, le=100)) -> PageParams:
    return PageParams(page=page, size=size)


Paging = Annotated[PageParams, Depends(_params)]


def paginate(db: Session, stmt: Select, params: PageParams) -> tuple[list, int]:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.limit(params.size).offset((params.page - 1) * params.size)).all()
    return rows, total
