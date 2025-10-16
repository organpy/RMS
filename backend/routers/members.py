"""FastAPI routes for member management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from backend.crud.member import MemberCRUD
from backend.database import get_db
from backend.models.member import MemberStatus
from backend.schemas.common import PaginationMeta
from backend.schemas.member import (
    MemberCreate,
    MemberListResponse,
    MemberResponse,
    MemberStatusUpdate,
    MemberUpdate,
)
from .utils import serialize_member
from backend.exceptions import NotFoundError

router = APIRouter(prefix="/api/members", tags=["Members"])


def _get_member_or_404(member_id: int, crud: MemberCRUD):
    member = crud.get(member_id)
    if member is None or member.archived_at is not None:
        raise NotFoundError("Member not found")
    return member


@router.get("", response_model=MemberListResponse)
def list_members(
    status_filter: MemberStatus | None = Query(default=None, alias="status"),
    class_id: int | None = Query(default=None, ge=1),
    group_id: int | None = Query(default=None, ge=1),
    search: str | None = Query(default=None, min_length=1, max_length=100),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    include_archived: bool = Query(default=False, description="Include archived members in the results"),
    db: Session = Depends(get_db),
) -> MemberListResponse:
    """Return members filtered and paginated according to the supplied query parameters."""

    crud = MemberCRUD(db)
    members, total = crud.list(
        status=status_filter,
        class_id=class_id,
        group_id=group_id,
        search=search,
        skip=skip,
        limit=limit,
        include_archived=include_archived,
    )
    data = [serialize_member(member) for member in members]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    return MemberListResponse(data=data, meta=meta)


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
def create_member(payload: MemberCreate, db: Session = Depends(get_db)) -> MemberResponse:
    """Create a new member record."""

    crud = MemberCRUD(db)
    data = payload.model_dump()
    member = crud.create(data)
    return serialize_member(member)


@router.put("/{member_id}", response_model=MemberResponse)
def update_member(member_id: int, payload: MemberUpdate, db: Session = Depends(get_db)) -> MemberResponse:
    """Update an existing member."""

    crud = MemberCRUD(db)
    member = _get_member_or_404(member_id, crud)
    update_data = payload.model_dump(exclude_unset=True)
    member = crud.update(member, update_data)
    return serialize_member(member)


@router.patch("/{member_id}/status", response_model=MemberResponse)
def update_member_status(
    member_id: int,
    payload: MemberStatusUpdate,
    db: Session = Depends(get_db),
) -> MemberResponse:
    """Update only the status field of a member."""

    crud = MemberCRUD(db)
    member = _get_member_or_404(member_id, crud)
    member = crud.set_status(member, payload.status)
    return serialize_member(member)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(member_id: int, db: Session = Depends(get_db)) -> Response:
    """Delete a member."""

    crud = MemberCRUD(db)
    member = _get_member_or_404(member_id, crud)
    crud.delete(member)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
