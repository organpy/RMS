"""Receipt rendering service leveraging WeasyPrint and HTML templates."""

from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Mapping

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config import Settings, get_settings
from backend.exceptions import NotFoundError
from backend.models import Business, Member, Payment, Receipt


# Suppress Fontconfig warning on Windows: "Cannot load default config file"
# This is harmless; WeasyPrint falls back to built-in font discovery.
os.environ.setdefault('FONTCONFIG_FILE', '')

logger = logging.getLogger(__name__)


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
        """Write PDF using WeasyPrint, or fallback to placeholder if unavailable."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{payment.receipt_number}.pdf"
        output_path = self.output_dir / file_name

        try:
            from weasyprint import HTML  # Imported lazily to avoid heavy startup costs during testing

            HTML(string=html_markup, base_url=str(self.output_dir.resolve())).write_pdf(str(output_path))
            logger.debug(f"PDF receipt generated: {output_path}")
            return output_path
        except Exception as exc:  # pragma: no cover - exercised via integration tests
            logger.warning(
                "WeasyPrint unavailable while generating receipt %s; falling back to placeholder PDF.",
                payment.receipt_number,
                exc_info=exc,
            )
            return self._write_placeholder_pdf(output_path, payment, reason=str(exc))

    # ------------------------------------------------------------------
    # Fallback helpers
    # ------------------------------------------------------------------
    def _write_placeholder_pdf(self, output_path: Path, payment: Payment, *, reason: str | None = None) -> Path:
        """Write a lightweight placeholder PDF when WeasyPrint is unavailable."""
        placeholder_bytes = self._build_placeholder_pdf(payment, reason=reason)
        output_path.write_bytes(placeholder_bytes)
        logger.info(f"Placeholder receipt written: {output_path}")
        return output_path

    def _build_placeholder_pdf(self, payment: Payment, *, reason: str | None = None) -> bytes:
        """Build a minimal valid PDF when WeasyPrint is unavailable."""
        message_lines = [
            "Receipt available offline",
            f"Receipt #: {payment.receipt_number}",
        ]
        if reason:
            message_lines.append("Renderer offline; using lightweight export.")

        sanitized_lines = [self._sanitize_pdf_text(line) for line in message_lines if line]

        stream_commands = ["BT", "/F1 14 Tf", "72 720 Td"]
        if sanitized_lines:
            first_line, *rest = sanitized_lines
            stream_commands.append(f"({first_line}) Tj")
            for line in rest:
                stream_commands.append("T*")
                stream_commands.append(f"({line}) Tj")
        else:
            stream_commands.append("(Receipt data unavailable) Tj")
        stream_commands.append("ET")

        stream_content = "\n".join(stream_commands).encode("latin-1")

        header = b"%PDF-1.4\n"
        objects: list[bytes] = []

        # PDF objects: Catalog, Pages, Page, Font, Stream
        objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
        objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
        objects.append(
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
        )
        objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
        objects.append(
            (
                f"5 0 obj\n<< /Length {len(stream_content)} >>\nstream\n".encode("latin-1")
                + stream_content
                + b"\nendstream\nendobj\n"
            )
        )

        # Build cross-reference table
        offsets: list[int] = []
        current = len(header)
        for obj in objects:
            offsets.append(current)
            current += len(obj)

        body_bytes = b"".join(objects)

        xref = [b"0000000000 65535 f \n"]
        xref.extend(f"{offset:010d} 00000 n \n".encode("latin-1") for offset in offsets)
        xref_table = f"xref\n0 {len(objects) + 1}\n".encode("latin-1") + b"".join(xref)

        startxref = len(header) + len(body_bytes)
        trailer = (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode("latin-1")
            + b"startxref\n"
            + str(startxref).encode("latin-1")
            + b"\n%%EOF\n"
        )

        return header + body_bytes + xref_table + trailer

    @staticmethod
    def _sanitize_pdf_text(value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


__all__ = ["ReceiptService"]
