from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.errors import AppError
from backend.core.security import current_staff
from backend.modules.messaging.router import MessageOut
from backend.modules.payments.service import get_payment

from . import service

router = APIRouter(prefix="/payments", tags=["invoices"], dependencies=[Depends(current_staff)])


@router.get("/{payment_id}/invoice.pdf")
def invoice_pdf(payment_id: int, download: bool = False, copies: int = Query(2, ge=1, le=2), db: Session = Depends(get_db)) -> Response:
    payment = get_payment(db, payment_id)
    disposition = "attachment" if download else "inline"
    return Response(
        service.invoice_pdf(db, payment, copies),
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{payment.invoice_number}.pdf"'},
    )


@router.post("/{payment_id}/email", response_model=MessageOut)
def email_invoice(payment_id: int, db: Session = Depends(get_db), staff=Depends(current_staff)):
    message = service.email_invoice(db, get_payment(db, payment_id), staff.id)
    db.commit()
    if message.status == "failed":
        raise AppError(f"Invoice not sent: {message.error}")
    return message
