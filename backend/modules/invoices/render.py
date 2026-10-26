"""Minimal invoice rendered with ReportLab, entirely in memory."""

from __future__ import annotations

import io
from datetime import date
from decimal import Decimal

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, A5, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen.canvas import Canvas

from backend.modules.organization.models import Organization
from backend.modules.payments.models import Payment

INK = HexColor("#18181b")
MUTED = HexColor("#71717a")
LINE = HexColor("#e4e4e7")
RED = HexColor("#dc2626")
SYMBOLS = {"USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥", "CAD": "CA$", "AUD": "A$"}
COMMA_DECIMAL = ("fr", "de", "es", "it", "pt", "nl", "tr", "ru", "pl", "sv", "da", "nb", "fi")
METHODS = {"cash": "Cash", "card": "Card", "transfer": "Bank transfer", "other": "Other"}


def money(amount: Decimal, currency: str, locale: str) -> str:
    text = f"{amount:,.2f}"
    if locale.split("-")[0] in COMMA_DECIMAL:
        text = text.replace(",", " ").replace(".", ",")
        return f"{text} {SYMBOLS.get(currency, currency)}"
    symbol = SYMBOLS.get(currency)
    return f"{symbol}{text}" if symbol else f"{text} {currency}"


def fmt_date(value: date | None) -> str:
    return value.strftime("%d %b %Y") if value else "—"


def render_invoice(payment: Payment, org: Organization, logo: bytes | None, copies: int = 2) -> bytes:
    """Two identical halves on one A4 sheet (customer and office copy, cut along the dashed line),
    or a single A5 landscape page when ``copies`` is 1 (used for email)."""
    buf = io.BytesIO()
    width, height = A4 if copies == 2 else landscape(A5)
    c = Canvas(buf, pagesize=(width, height))
    c.setTitle(f"Invoice {payment.invoice_number}")
    c.setAuthor(org.name)
    image = ImageReader(io.BytesIO(logo)) if logo else None
    if copies == 2:
        half = height / 2
        _copy(c, payment, org, image, width, half, half, "Customer copy")
        _copy(c, payment, org, image, width, 0, half, "Office copy")
        _cut_line(c, width, half)
    else:
        _copy(c, payment, org, image, width, 0, height, None)
    c.showPage()
    c.save()
    return buf.getvalue()


def _copy(c: Canvas, payment: Payment, org: Organization, logo, width: float, bottom: float, height: float, label: str | None) -> None:
    left, right = 16 * mm, width - 16 * mm
    accent = HexColor(org.primary_color or "#18181b")
    top = bottom + height - 14 * mm

    # Header: logo or name on the left, title, number and copy label on the right.
    if logo:
        iw, ih = logo.getSize()
        h = 11 * mm
        w = min(h * iw / ih, 50 * mm)
        c.drawImage(logo, left, top - w * ih / iw + 3 * mm, width=w, height=w * ih / iw, mask="auto")
    else:
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left, top - 1 * mm, org.name)
    c.setFillColor(INK)
    c.setFont("Helvetica", 17)
    c.drawRightString(right, top - 1 * mm, "Invoice")
    c.setFont("Helvetica", 8.5)
    c.setFillColor(MUTED)
    c.drawRightString(right, top - 6 * mm, payment.invoice_number)
    if label:
        _label(c, right, top + 6 * mm, label, align="right")

    # Parties.
    y = top - 15 * mm
    member = payment.member
    if member.guardian_name:
        billed = [member.guardian_name, f"for {member.full_name}", member.guardian_email or member.email, member.guardian_phone or member.phone]
    else:
        billed = [member.full_name, member.email, member.phone]
    sender = [org.name, *(org.address or "").splitlines(), org.email, org.phone]
    if org.tax_id:
        sender.append(f"Tax ID {org.tax_id}")
    rows = max(_block(c, left, y, "Billed to", billed), _block(c, width / 2 + 4 * mm, y, "From", sender))

    # Meta row.
    y -= (rows * 4 + 11) * mm
    period = f"{fmt_date(payment.period_start)} – {fmt_date(payment.period_end)}" if payment.period_start else "—"
    staff = payment.recorder.name if payment.recorder else "—"
    meta = [("Issued", fmt_date(payment.paid_on)), ("Method", METHODS.get(payment.method, payment.method)), ("Period", period), ("Received by", staff)]
    widths = (0.2, 0.2, 0.35, 0.25)
    x = left
    for (name, value), share in zip(meta, widths):
        _label(c, x, y, name)
        c.setFont("Helvetica", 9)
        c.setFillColor(INK)
        c.drawString(x, y - 4.8 * mm, value[:40])
        x += (right - left) * share

    # Line item and total.
    y -= 13 * mm
    _label(c, left, y, "Description")
    _label(c, right, y, "Amount", align="right")
    y -= 2.5 * mm
    _rule(c, left, right, y)
    y -= 5.5 * mm
    amount = money(Decimal(payment.amount), org.currency, org.locale)
    c.setFont("Helvetica", 9.5)
    c.setFillColor(INK)
    lines = simpleSplit(payment.description, "Helvetica", 9.5, (right - left) * 0.7)[:2]
    for i, line in enumerate(lines):
        c.drawString(left, y - i * 4.5 * mm, line)
    c.drawRightString(right, y, amount)
    y -= (len(lines) - 1) * 4.5 * mm + 4 * mm
    _rule(c, left, right, y)

    y -= 8 * mm
    c.setFont("Helvetica", 9.5)
    c.setFillColor(MUTED)
    c.drawRightString(right - 40 * mm, y, "Paid")
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(INK)
    c.drawRightString(right, y, amount)
    owed = Decimal(payment.amount_due) - Decimal(payment.amount)
    _stamp(c, left, y, payment, accent, partial=owed > 0)
    if owed > 0 and payment.refunded_at is None:
        c.setFont("Helvetica", 9.5)
        c.setFillColor(MUTED)
        c.drawRightString(right - 40 * mm, y - 6 * mm, "Balance due")
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(RED)
        c.drawRightString(right, y - 6 * mm, money(owed, org.currency, org.locale))

    if payment.notes:
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        note = simpleSplit(payment.notes, "Helvetica", 8.5, (right - left) * 0.55)[0]
        c.drawString(left + 26 * mm, y, note)

    # Signatures.
    y = bottom + 25 * mm
    box = (right - left - 12 * mm) / 2
    for i, (name, value) in enumerate((("Received by", staff if payment.recorder else ""), ("Customer signature", ""))):
        x = left + i * (box + 12 * mm)
        _rule(c, x, x + box, y, color=MUTED)
        _label(c, x, y - 4 * mm, name)
        if value:
            c.setFont("Helvetica", 8.5)
            c.setFillColor(INK)
            c.drawRightString(x + box, y - 4 * mm, value)

    # Footer.
    c.setFont("Helvetica", 7.5)
    c.setFillColor(MUTED)
    footer = org.invoice_note or " · ".join(filter(None, [org.name, org.email, org.phone]))
    for i, line in enumerate(simpleSplit(footer, "Helvetica", 7.5, right - left)[:2]):
        c.drawCentredString(width / 2, bottom + 11 * mm - i * 3.5 * mm, line)


def _stamp(c: Canvas, x: float, y: float, payment: Payment, accent, partial: bool = False) -> None:
    refunded = payment.refunded_at is not None
    text = "REFUNDED" if refunded else "PARTIAL" if partial else "PAID"
    color = RED if refunded else accent
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(0.8)
    c.setFont("Helvetica-Bold", 8.5)
    w = c.stringWidth(text, "Helvetica-Bold", 8.5) + 7 * mm
    c.roundRect(x, y - 2.2 * mm, w, 6.4 * mm, 3.2 * mm, stroke=1, fill=0)
    c.drawCentredString(x + w / 2, y - 0.1 * mm, text)


def _cut_line(c: Canvas, width: float, y: float) -> None:
    """Dashed fold-and-cut line with small scissors drawn as vectors (no font dependency)."""
    c.saveState()
    c.setStrokeColor(MUTED)
    c.setLineWidth(0.5)
    c.setDash(3, 3)
    c.line(16 * mm, y, width - 10 * mm, y)
    c.setDash()
    x = 9 * mm
    for dy in (1.6 * mm, -1.6 * mm):
        c.circle(x, y + dy, 1.1 * mm, stroke=1, fill=0)
        c.line(x + 0.9 * mm, y + dy * 0.6, x + 5 * mm, y - dy * 0.35)
    c.restoreState()


def _label(c: Canvas, x: float, y: float, text: str, align: str = "left") -> None:
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    (c.drawRightString if align == "right" else c.drawString)(x, y, text.upper())


def _rule(c: Canvas, x1: float, x2: float, y: float, color=LINE) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(0.6)
    c.line(x1, y, x2, y)


def _block(c: Canvas, x: float, y: float, title: str, lines: list[str | None]) -> int:
    _label(c, x, y, title)
    c.setFillColor(INK)
    lines = [line for line in lines if line][:5]
    for i, line in enumerate(lines):
        c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 9.5 if i == 0 else 8.5)
        c.drawString(x, y - 5 * mm - i * 4 * mm, line[:60])
    return len(lines)
