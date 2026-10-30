from sqlalchemy.orm import Session

from backend.modules.staff.models import Staff

from .models import AuditLog


def audit(db: Session, staff: Staff | None, action: str, entity: str, entity_id: int | None, summary: str) -> None:
    """Queue an audit entry; it is saved together with the change when the route commits."""
    db.add(
        AuditLog(
            staff_id=staff.id if staff else None,
            staff_name=staff.name if staff else "System",
            action=action,
            entity=entity,
            entity_id=entity_id,
            summary=summary[:300],
        )
    )
