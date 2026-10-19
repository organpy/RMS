from sqlalchemy.orm import Session

from backend.core.config import get_settings
from backend.modules.messaging import service as messaging
from backend.modules.messaging.models import Message
from backend.modules.organization.service import get_org
from backend.modules.payments.models import Payment

from .render import render_invoice


def invoice_pdf(db: Session, payment: Payment, copies: int = 2) -> bytes:
    org = get_org(db)
    logo_path = get_settings().logo_path
    logo = logo_path.read_bytes() if org.logo_mime and logo_path.exists() else None
    return render_invoice(payment, org, logo, copies)


def email_invoice(db: Session, payment: Payment, staff_id: int | None = None) -> Message:
    """Email the invoice PDF to the member and log it; failures are logged, not raised."""
    org = get_org(db)
    member = payment.member
    body = (
        f"Hi {member.first_name},\n\nThank you for your payment. "
        f"Your invoice {payment.invoice_number} is attached.\n\n{org.name}"
    )
    return messaging.send(
        db,
        member,
        "email",
        "invoice",
        body,
        subject=f"Invoice {payment.invoice_number} · {org.name}",
        attachment=(f"{payment.invoice_number}.pdf", invoice_pdf(db, payment, copies=1)),
        staff_id=staff_id,
        payment_id=payment.id,
    )
