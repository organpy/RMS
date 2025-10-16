"""FastAPI routes for group management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.crud.group import GroupCRUD
from backend.crud.member import MemberCRUD
from backend.database import get_db
from backend.schemas.common import PaginationMeta
from backend.schemas.group import GroupCreate, GroupListResponse, GroupResponse, GroupUpdate
from backend.schemas.member import MemberListResponse
from .utils import serialize_member
from backend.exceptions import NotFoundError

router = APIRouter(prefix="/api/groups", tags=["Groups"])


def _get_group_or_404(group_id: int, crud: GroupCRUD):
    group = crud.get(group_id)
    if group is None:
        raise NotFoundError("Group not found")
    return group


@router.get("", response_model=GroupListResponse)
def list_groups(
    class_id: int | None = Query(default=None, ge=1),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> GroupListResponse:
    """Return groups filtered by class when provided."""

    crud = GroupCRUD(db)
    groups, total = crud.list(class_id=class_id, skip=skip, limit=limit)
    data = [GroupResponse.model_validate(group, from_attributes=True) for group in groups]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    return GroupListResponse(data=data, meta=meta)


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(payload: GroupCreate, db: Session = Depends(get_db)) -> GroupResponse:
    """Create a new group."""

    crud = GroupCRUD(db)
    group = crud.create(payload.model_dump())
    return GroupResponse.model_validate(group, from_attributes=True)


@router.put("/{group_id}", response_model=GroupResponse)
def update_group(group_id: int, payload: GroupUpdate, db: Session = Depends(get_db)) -> GroupResponse:
    """Update an existing group."""

    crud = GroupCRUD(db)
    group = _get_group_or_404(group_id, crud)
    group = crud.update(group, payload.model_dump(exclude_unset=True))
    return GroupResponse.model_validate(group, from_attributes=True)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a group."""

    crud = GroupCRUD(db)
    group = _get_group_or_404(group_id, crud)
    crud.delete(group)


@router.get("/{group_id}/members", response_model=MemberListResponse)
def list_members_for_group(
    group_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> MemberListResponse:
    """Return members assigned to the group."""

    group_crud = GroupCRUD(db)
    _get_group_or_404(group_id, group_crud)
    members_crud = MemberCRUD(db)
    members, total = members_crud.list(group_id=group_id, skip=skip, limit=limit)
    data = [serialize_member(member) for member in members]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    return MemberListResponse(data=data, meta=meta)
