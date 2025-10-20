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
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
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
        """Generate a compact PDF receipt using ReportLab."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{payment.receipt_number}.pdf"
        output_path = self.output_dir / file_name

        # Create PDF buffer with smaller margins for border effect
        buffer = BytesIO()
        
        def draw_border(canvas, doc):
            """Draw a subtle border around the page."""
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor(business.secondary_color or "#4b5563"))
            canvas.setLineWidth(0.5)
            canvas.rect(0.25 * inch, 0.25 * inch, 
                       letter[0] - 0.5 * inch, letter[1] - 0.5 * inch)
            canvas.restoreState()
        
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.5 * inch,
            leftMargin=0.5 * inch,
            topMargin=0.5 * inch,
            bottomMargin=0.5 * inch,
            onFirstPage=draw_border,
            onLaterPages=draw_border,
        )

        # Build story (content)
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles with smaller fonts
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor(business.primary_color or "#1f2937"),
            spaceAfter=8,
            alignment=1,  # Center
            fontName='Helvetica-Bold',
        )
        
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor(business.secondary_color or "#4b5563"),
            spaceAfter=15,
            alignment=1,
            fontName='Helvetica-Oblique',
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor(business.primary_color or "#1f2937"),
            spaceAfter=8,
            fontName='Helvetica-Bold',
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=10,
            leading=14,
            spaceAfter=6,
        )
        
        # Header with logo (top left) and business name (top center)
        if business.logo_path and Path(business.logo_path).exists():
            try:
                logo = Image(business.logo_path, width=1 * inch, height=1 * inch)
                # Create header table with logo on left, business name centered, empty right
                header_data = [[logo, business.name or 'Business Name', '']]
                header_table = Table(header_data, colWidths=[1.2 * inch, 4 * inch, 1.2 * inch])
                header_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (0, 0), 'LEFT'),  # Logo left-aligned
                    ('ALIGN', (1, 0), (1, 0), 'CENTER'),  # Business name centered
                    ('ALIGN', (2, 0), (2, 0), 'RIGHT'),  # Empty cell right-aligned
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('FONTNAME', (1, 0), (1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (1, 0), (1, 0), 24),
                    ('TEXTCOLOR', (1, 0), (1, 0), colors.HexColor(business.primary_color or "#1f2937")),
                ]))
                story.append(header_table)
            except Exception:
                # Fallback: just business name centered if logo fails
                business_name = Paragraph(business.name or 'Business Name', title_style)
                story.append(business_name)
        else:
            # No logo: just business name centered
            business_name = Paragraph(business.name or 'Business Name', title_style)
            story.append(business_name)
        
        # Generated date below
        generated_text = Paragraph(f"Generated: {self.clock().strftime('%B %d, %Y at %H:%M')}", subtitle_style)
        story.append(generated_text)
        story.append(Spacer(1, 15))

        # Receipt details in a highlighted box with wider receipt number column
        receipt_data = [
            ["Receipt Number", "Payment Date", "Status"],
            [payment.receipt_number, payment.payment_date.strftime("%B %d, %Y"), payment.status.value.title()],
        ]
        receipt_table = Table(receipt_data, colWidths=[3 * inch, 1.5 * inch, 1.5 * inch])
        receipt_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(business.primary_color or "#1f2937")),
            # Highlight receipt number with different background
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor("#fef3c7")),  # Light yellow background
            ('TEXTCOLOR', (0, 1), (0, 1), colors.HexColor("#92400e")),  # Dark brown text
            ('FONTNAME', (0, 1), (0, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 1), (0, 1), 12),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor(business.secondary_color or "#4b5563")),
        ]))
        story.append(receipt_table)
        story.append(Spacer(1, 15))

        # Bill To section with better formatting
        story.append(Paragraph("Bill To:", heading_style))
        member_table_data = [
            ["Name", f"{member.first_name} {member.last_name}"],
            ["Email", member.email],
        ]
        if member.class_course:
            member_table_data.append(["Class", member.class_course.name])
        
        member_table = Table(member_table_data, colWidths=[1.2 * inch, 5 * inch])
        member_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(business.secondary_color or "#4b5563")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(member_table)
        story.append(Spacer(1, 15))

        # Amount breakdown with enhanced styling
        story.append(Paragraph("Payment Details:", heading_style))
        amount_data = [
            ["Description", "Qty", "Unit Price", "Total"],
            [member.class_course.name if member.class_course else "General Membership", "1", f"${payment.amount:.2f}", f"${payment.amount:.2f}"],
            ["", "", "", ""],
            ["", "", "Total Amount", f"${payment.amount:.2f}"],
        ]
        amount_table = Table(amount_data, colWidths=[2.5 * inch, 0.8 * inch, 1.2 * inch, 1 * inch])
        amount_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(business.primary_color or "#1f2937")),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 12),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor(business.primary_color or "#1f2937")),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LINEABOVE', (0, -1), (-1, -1), 2, colors.HexColor(business.primary_color or "#1f2937")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        story.append(amount_table)
        story.append(Spacer(1, 15))

        # Payment method info
        payment_info = f"""
        <b>Payment Method:</b> {payment.method.value.title()}<br/>
        <b>Transaction Status:</b> {payment.status.value.title()}
        """
        if payment.next_due_date:
            payment_info += f"<br/><b>Next Due Date:</b> {payment.next_due_date.strftime('%B %d, %Y')}"
        
        payment_box = Table([[Paragraph(payment_info, normal_style)]], colWidths=[6 * inch])
        payment_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f9fafb")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor(business.secondary_color or "#4b5563")),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ]))
        story.append(payment_box)
        story.append(Spacer(1, 20))

        # Footer with business branding
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor(business.secondary_color or "#4b5563"),
            alignment=1,
            fontName='Helvetica-Oblique',
        )
        footer_text = f"""
        <b>Thank you for choosing {business.name or 'our services'}!</b><br/>
        For questions or support, please contact us at:<br/>
        Email: support@{business.name.lower().replace(' ', '') if business.name else 'company'}.com<br/>
        Phone: (555) 123-4567 | Website: www.{business.name.lower().replace(' ', '') if business.name else 'company'}.com<br/>
        <br/>
        <i>This is an electronically generated receipt. Keep for your records.</i>
        """
        story.append(Paragraph(footer_text, footer_style))

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        output_path.write_bytes(buffer.getvalue())
        logger.debug(f"PDF receipt generated: {output_path}")
        return output_path


__all__ = ["ReceiptService"]
