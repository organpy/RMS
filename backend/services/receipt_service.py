"""Receipt rendering service leveraging WeasyPrint and HTML templates."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Mapping

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config import Settings, get_settings
from backend.exceptions import NotFoundError
from backend.models import Business, Member, Payment, Receipt


class ReceiptService:
    """Generate and manage PDF receipts for recorded payments."""

    def __init__(
        self,
        session: Session,
        *,
        settings: Settings | None = None,
        templates_dir: Path | None = None,
        output_dir: Path | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.templates_dir = templates_dir or Path(__file__).resolve().parent.parent / "templates"
        self.output_dir = Path(output_dir or self.settings.receipt_output_dir)
        self._env = Environment(
            loader=FileSystemLoader(self.templates_dir),
            autoescape=select_autoescape(["html", "xml"]),
            enable_async=False,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def generate(self, payment: Payment, *, regenerate: bool = False) -> Receipt:
        """Generate (or regenerate) a receipt PDF for the provided payment."""

        payment = self._ensure_payment_loaded(payment)
        member = payment.member
        if member is None:
            raise NotFoundError("Member information is required to generate a receipt")
        business = member.business
        if business is None:
            raise NotFoundError("Business information is required to generate a receipt")

        context = self._build_context(payment, member, business)
        html_markup = self._render_template("receipt_template.html", context)
        output_path = self._write_pdf(payment, html_markup)

        receipt = payment.receipt
        if receipt is None:
            receipt = Receipt(payment_id=payment.id, file_path=str(output_path))
        else:
            receipt.file_path = str(output_path)

        self.session.add(receipt)
        self.session.commit()
        self.session.refresh(receipt)
        return receipt

    def list_receipts(self) -> list[Receipt]:
        """Return all generated receipts for administrative interfaces."""

        stmt = select(Receipt).order_by(Receipt.created_at.desc())
        return self.session.execute(stmt).scalars().all()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _ensure_payment_loaded(self, payment: Payment) -> Payment:
        if payment.member is None:
            payment = self.session.merge(payment)
            self.session.refresh(payment)
        # Eagerly load relationships we rely on.
        if payment.member is not None:
            self.session.refresh(payment.member)
            if payment.member.business is not None:
                self.session.refresh(payment.member.business)
            if payment.member.class_course is not None:
                self.session.refresh(payment.member.class_course)
        return payment

    def _build_context(self, payment: Payment, member: Member, business: Business) -> Mapping[str, object]:
        class_course = member.class_course
        context = {
            "business_name": business.name,
            "business_logo": business.logo_path,
            "primary_color": business.primary_color or "#1f2937",
            "secondary_color": business.secondary_color or "#4b5563",
            "member_name": f"{member.first_name} {member.last_name}",
            "member_email": member.email,
            "class_name": class_course.name if class_course else "General Membership",
            "payment_amount": payment.amount,
            "payment_method": payment.method.value,
            "payment_date": payment.payment_date,
            "next_due_date": payment.next_due_date,
            "receipt_number": payment.receipt_number,
            "generated_at": self.clock(),
        }
        return context

    def _render_template(self, template_name: str, context: Mapping[str, object]) -> str:
        template = self._env.get_template(template_name)
        return template.render(**context)

    def _write_pdf(self, payment: Payment, html_markup: str) -> Path:
        from weasyprint import HTML  # Imported lazily to avoid heavy startup costs during testing

        self.output_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{payment.receipt_number}.pdf"
        output_path = self.output_dir / file_name
        HTML(string=html_markup, base_url=str(self.output_dir.resolve())).write_pdf(str(output_path))
        return output_path


__all__ = ["ReceiptService"]
