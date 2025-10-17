"""Database helpers for receipt persistence."""

from __future__ import annotations

from typing import Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models import Receipt


class ReceiptCRUD:
    """Encapsulates CRUD operations for receipt records."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, receipt_id: int) -> Optional[Receipt]:
        return self.session.get(Receipt, receipt_id)

    def get_by_payment(self, payment_id: int) -> Optional[Receipt]:
        stmt = select(Receipt).where(Receipt.payment_id == payment_id)
        return self.session.execute(stmt).scalar_one_or_none()

    def list(self, *, skip: int = 0, limit: int = 50) -> Tuple[list[Receipt], int]:
        stmt = select(Receipt).order_by(Receipt.created_at.desc()).offset(skip).limit(limit)
        receipts = self.session.execute(stmt).scalars().all()

        count_stmt = select(func.count()).select_from(Receipt)
        total = self.session.execute(count_stmt).scalar_one()
        return receipts, int(total)

    def upsert(self, payment_id: int, file_path: str) -> Receipt:
        receipt = self.get_by_payment(payment_id)
        if receipt is None:
            receipt = Receipt(payment_id=payment_id, file_path=file_path)
        else:
            receipt.file_path = file_path
        self.session.add(receipt)
        self.session.commit()
        self.session.refresh(receipt)
        return receipt
