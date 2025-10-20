"""Receipt rendering service leveraging ReportLab for PDF generation."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Callable

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib import colors
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config import Settings, get_settings
from backend.exceptions import NotFoundError
from backend.models import Business, Member, Payment, Receipt


logger = logging.getLogger(__name__)


class ReceiptService:
    """Generate and manage PDF receipts for recorded payments using ReportLab."""

    def __init__(
        self,
        session: Session,
        *,
        settings: Settings | None = None,
        output_dir: Path | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.output_dir = Path(output_dir or self.settings.receipt_output_dir)

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

        output_path = self._write_pdf(payment, member, business)

        receipt = payment.receipt
        if receipt is None:
            receipt = Receipt(payment_id=payment.id, file_path=str(output_path))
        else:
            receipt.file_path = str(output_path)

        self.session.add(receipt)
        self.session.commit()
        self.session.refresh(receipt)
        logger.info(f"Receipt generated: {output_path}")
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

    def _write_pdf(self, payment: Payment, member: Member, business: Business) -> Path:
        """Generate a professional PDF receipt using ReportLab."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{payment.receipt_number}.pdf"
        output_path = self.output_dir / file_name

        # Create PDF buffer
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
        )

        # Build story (content)
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor(business.primary_color or "#1f2937"),
            spaceAfter=12,
            alignment=1,  # Center
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor(business.secondary_color or "#4b5563"),
            spaceAfter=6,
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=11,
            leading=14,
        )

        # Title
        story.append(Paragraph(business.name or "Receipt", title_style))
        story.append(Spacer(1, 12))

        # Header info
        header_data = [
            ["Receipt #", payment.receipt_number],
            ["Date", str(payment.payment_date)],
            ["Generated", self.clock().strftime("%Y-%m-%d %H:%M:%S")],
        ]
        header_table = Table(header_data, colWidths=[2 * inch, 3 * inch])
        header_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(business.secondary_color or "#4b5563")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 12))

        # Member info
        story.append(Paragraph("Bill To:", heading_style))
        member_info = f"{member.first_name} {member.last_name}<br/>{member.email}"
        story.append(Paragraph(member_info, normal_style))
        if member.class_course:
            story.append(Paragraph(f"Class: {member.class_course.name}", normal_style))
        story.append(Spacer(1, 12))

        # Amount breakdown
        amount_data = [
            ["Description", "Amount"],
            [member.class_course.name if member.class_course else "General Membership", f"${payment.amount:.2f}"],
            ["", ""],
            ["Total", f"${payment.amount:.2f}"],
        ]
        amount_table = Table(amount_data, colWidths=[3.5 * inch, 1.5 * inch])
        amount_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor(business.primary_color or "#1f2937")),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 12),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor(business.primary_color or "#1f2937")),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LINEABOVE', (0, -1), (-1, -1), 2, colors.HexColor(business.primary_color or "#1f2937")),
        ]))
        story.append(amount_table)
        story.append(Spacer(1, 20))

        # Payment details
        payment_info = [
            f"<b>Payment Method:</b> {payment.method.value.title()}",
            f"<b>Status:</b> {payment.status.value.title()}",
        ]
        if payment.next_due_date:
            payment_info.append(f"<b>Next Due:</b> {payment.next_due_date}")
        
        story.append(Paragraph("<br/>".join(payment_info), normal_style))
        story.append(Spacer(1, 20))

        # Footer
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.grey,
            alignment=1,
        )
        story.append(Paragraph("Thank you for your business!", footer_style))

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        output_path.write_bytes(buffer.getvalue())
        logger.debug(f"PDF receipt generated: {output_path}")
        return output_path


__all__ = ["ReceiptService"]
