"""FastAPI routes for class/course management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.crud.class_course import ClassCourseCRUD
from backend.crud.member import MemberCRUD
from backend.database import get_db
from backend.schemas.class_course import ClassCreate, ClassListResponse, ClassResponse, ClassUpdate
from backend.schemas.common import GroupSummary, PaginationMeta
from backend.schemas.member import MemberListResponse
from .utils import serialize_member
from backend.exceptions import NotFoundError

router = APIRouter(prefix="/api/classes", tags=["Classes"])


def _serialize_class(class_course) -> ClassResponse:
    response = ClassResponse.model_validate(class_course, from_attributes=True)
    response.groups = [GroupSummary.model_validate(group, from_attributes=True) for group in class_course.groups]
    return response


def _get_class_or_404(class_id: int, crud: ClassCourseCRUD):
    class_course = crud.get(class_id)
    if class_course is None:
        raise NotFoundError("Class not found")
    return class_course


@router.get("", response_model=ClassListResponse)
def list_classes(
    business_id: int | None = Query(default=None, ge=1),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> ClassListResponse:
    """Return classes with optional business scoping."""

    crud = ClassCourseCRUD(db)
    classes, total = crud.list(business_id=business_id, skip=skip, limit=limit)
    data = [_serialize_class(class_course) for class_course in classes]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    return ClassListResponse(data=data, meta=meta)


@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(payload: ClassCreate, db: Session = Depends(get_db)) -> ClassResponse:
    """Create a new class/course."""

    crud = ClassCourseCRUD(db)
    class_course = crud.create(payload.model_dump())
    return _serialize_class(class_course)


@router.put("/{class_id}", response_model=ClassResponse)
def update_class(class_id: int, payload: ClassUpdate, db: Session = Depends(get_db)) -> ClassResponse:
    """Update an existing class/course."""

    crud = ClassCourseCRUD(db)
    class_course = _get_class_or_404(class_id, crud)
    class_course = crud.update(class_course, payload.model_dump(exclude_unset=True))
    return _serialize_class(class_course)


@router.get("/{class_id}/members", response_model=MemberListResponse)
def list_members_for_class(
    class_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> MemberListResponse:
    """Return members enrolled in a specific class."""

    class_crud = ClassCourseCRUD(db)
    _get_class_or_404(class_id, class_crud)
    members_crud = MemberCRUD(db)
    members, total = members_crud.list(class_id=class_id, skip=skip, limit=limit)
    data = [serialize_member(member) for member in members]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    return MemberListResponse(data=data, meta=meta)
