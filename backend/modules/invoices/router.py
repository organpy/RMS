from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.core.config import get_settings
from backend.core.db import get_db
from backend.core.security import current_staff
from backend.modules.organization.service import get_org
from backend.modules.payments.service import get_payment

from .render import render_invoice

router = APIRouter(prefix="/payments", tags=["invoices"], dependencies=[Depends(current_staff)])


@router.get("/{payment_id}/invoice.pdf")
def invoice_pdf(payment_id: int, download: bool = False, db: Session = Depends(get_db)) -> Response:
    payment = get_payment(db, payment_id)
    org = get_org(db)
    logo_path = get_settings().logo_path
    logo = logo_path.read_bytes() if org.logo_mime and logo_path.exists() else None
    pdf = render_invoice(payment, org, logo)
    disposition = "attachment" if download else "inline"
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{payment.invoice_number}.pdf"'},
    )
