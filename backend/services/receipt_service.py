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
            """Draw a modern subtle border around the page."""
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor("#e5e7eb"))  # Modern light gray
            canvas.setLineWidth(0.8)
            # Rounded rectangle for modern look
            canvas.roundRect(0.3 * inch, 0.3 * inch, 
                           letter[0] - 0.6 * inch, letter[1] - 0.6 * inch, 8)
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
        
        # Custom styles with modern typography
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=28,
            textColor=colors.HexColor(business.primary_color or "#1f2937"),
            spaceAfter=12,
            alignment=1,  # Center
            fontName='Helvetica-Bold',
            letterSpacing=0.5,  # Modern letter spacing
        )
        
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor("#6b7280"),  # Modern gray
            spaceAfter=20,
            alignment=1,
            fontName='Helvetica',
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor(business.primary_color or "#1f2937"),
            spaceAfter=12,
            fontName='Helvetica-Bold',
            letterSpacing=0.3,
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=11,
            leading=16,
            spaceAfter=8,
            fontName='Helvetica',
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

        # Receipt details with prominent receipt number
        receipt_data = [
            ["Receipt Number", "Payment Date", "Status"],
            [payment.receipt_number, payment.payment_date.strftime("%B %d, %Y"), payment.status.value.title()],
        ]
        receipt_table = Table(receipt_data, colWidths=[4 * inch, 1.5 * inch, 1.5 * inch])  # Wider column for receipt number
        receipt_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(business.primary_color or "#1f2937")),
            # Highlight receipt number with consistent font size
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor("#fef3c7")),  # Light yellow background
            ('TEXTCOLOR', (0, 1), (0, 1), colors.HexColor("#92400e")),  # Dark brown text
            ('FONTNAME', (0, 1), (0, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 1), (0, 1), 10),  
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8), 
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8), 
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor(business.secondary_color or "#4b5563")),
        ]))
        story.append(receipt_table)
        story.append(Spacer(1, 15))

        # Bill To section with modern card styling
        story.append(Paragraph("Bill To:", heading_style))
        
        # Modern card-style background for member info
        member_card = Table([[Paragraph(f"""
        <b>{member.first_name} {member.last_name}</b><br/>
        <font color="#6b7280">{member.email}</font>
        {f'<br/><font color="#6b7280">Class: {member.class_course.name}</font>' if member.class_course else ''}
        """, normal_style)]], colWidths=[6 * inch])
        
        member_card.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),  # Light modern background
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e5e7eb")),  # Subtle border
            ('ROUNDEDCORNERS', [8, 8, 8, 8]),  # Modern rounded corners
            ('TOPPADDING', (0, 0), (-1, -1), 16),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
            ('LEFTPADDING', (0, 0), (-1, -1), 16),
            ('RIGHTPADDING', (0, 0), (-1, -1), 16),
        ]))
        story.append(member_card)
        story.append(Spacer(1, 20))

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

        # Payment method info with modern card styling
        payment_info = f"""
        <b>Payment Method:</b> {payment.method.value.title()}<br/>
        <font color="#6b7280"><b>Status:</b> {payment.status.value.title()}</font>
        {f'<br/><font color="#6b7280"><b>Next Due:</b> {payment.next_due_date.strftime("%B %d, %Y")}</font>' if payment.next_due_date else ''}
        """
        
        payment_card = Table([[Paragraph(payment_info, normal_style)]], colWidths=[6 * inch])
        payment_card.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0f9ff")),  # Light blue modern background
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#bae6fd")),  # Subtle blue border
            ('ROUNDEDCORNERS', [8, 8, 8, 8]),  # Modern rounded corners
            ('TOPPADDING', (0, 0), (-1, -1), 16),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
            ('LEFTPADDING', (0, 0), (-1, -1), 16),
            ('RIGHTPADDING', (0, 0), (-1, -1), 16),
        ]))
        story.append(payment_card)
        story.append(Spacer(1, 24))

        # Modern footer with better branding
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor("#6b7280"),
            alignment=1,
            fontName='Helvetica',
            leading=14,
        )
        footer_text = f"""
        <b style="color: {business.primary_color or '#1f2937'};">Thank you for choosing {business.name or 'our services'}!</b><br/>
        <br/>
        <font size="9">Questions? Contact us:<br/>
        📧 support@{business.name.lower().replace(' ', '') if business.name else 'company'}.com<br/>
        📞 (555) 123-4567<br/>
        🌐 www.{business.name.lower().replace(' ', '') if business.name else 'company'}.com</font><br/>
        <br/>
        <i style="color: #9ca3af;">This receipt was automatically generated on {self.clock().strftime('%B %d, %Y at %I:%M %p')}</i>
        """
        story.append(Paragraph(footer_text, footer_style))

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        output_path.write_bytes(buffer.getvalue())
        logger.debug(f"PDF receipt generated: {output_path}")
        return output_path


__all__ = ["ReceiptService"]
