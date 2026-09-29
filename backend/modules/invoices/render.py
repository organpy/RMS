"""Minimal A4 invoice rendered with ReportLab, entirely in memory."""

from __future__ import annotations

import io
from datetime import date
from decimal import Decimal

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
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


def render_invoice(payment: Payment, org: Organization, logo: bytes | None) -> bytes:
    buf = io.BytesIO()
    width, height = A4
    left, right = 20 * mm, width - 20 * mm
    accent = HexColor(org.primary_color or "#18181b")
    c = Canvas(buf, pagesize=A4)
    c.setTitle(f"Invoice {payment.invoice_number}")
    c.setAuthor(org.name)

    # Header: logo or name on the left, title and number on the right.
    top = height - 22 * mm
    if logo:
        img = ImageReader(io.BytesIO(logo))
        iw, ih = img.getSize()
        h = 14 * mm
        w = min(h * iw / ih, 60 * mm)
        c.drawImage(img, left, top - h + 4 * mm, width=w, height=w * ih / iw, mask="auto")
    else:
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(left, top, org.name)

    c.setFillColor(INK)
    c.setFont("Helvetica", 22)
    c.drawRightString(right, top, "Invoice")
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    c.drawRightString(right, top - 6 * mm, payment.invoice_number)

    # Parties.
    y = top - 26 * mm
    member = payment.member
    billed = [member.full_name, member.email, member.phone]
    sender = [org.name, *(org.address or "").splitlines(), org.email, org.phone]
    if org.tax_id:
        sender.append(f"Tax ID {org.tax_id}")
    rows = max(_block(c, left, y, "Billed to", billed), _block(c, width / 2 + 5 * mm, y, "From", sender))

    # Meta row.
    y -= (rows * 4.6 + 16) * mm
    period = (
        f"{fmt_date(payment.period_start)} – {fmt_date(payment.period_end)}" if payment.period_start else "—"
    )
    meta = [("Issued", fmt_date(payment.paid_on)), ("Method", METHODS.get(payment.method, payment.method)), ("Period", period)]
    col = (right - left) / 3
    for i, (label, value) in enumerate(meta):
        x = left + i * col
        _label(c, x, y, label)
        c.setFont("Helvetica", 10)
        c.setFillColor(INK)
        c.drawString(x, y - 5.5 * mm, value)

    # Line items.
    y -= 20 * mm
    _label(c, left, y, "Description")
    _label(c, right, y, "Amount", align="right")
    y -= 3 * mm
    _rule(c, left, right, y)
    y -= 7 * mm
    amount = money(Decimal(payment.amount), org.currency, org.locale)
    c.setFont("Helvetica", 10)
    c.setFillColor(INK)
    for i, line in enumerate(simpleSplit(payment.description, "Helvetica", 10, col * 2)):
        c.drawString(left, y - i * 5 * mm, line)
    c.drawRightString(right, y, amount)
    y -= 8 * mm
    _rule(c, left, right, y)

    # Total.
    y -= 10 * mm
    c.setFont("Helvetica", 10)
    c.setFillColor(MUTED)
    c.drawRightString(right - 45 * mm, y, "Total")
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(INK)
    c.drawRightString(right, y, amount)

    # Status stamp.
    refunded = payment.refunded_at is not None
    label = "REFUNDED" if refunded else "PAID"
    color = RED if refunded else accent
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 9)
    w = c.stringWidth(label, "Helvetica-Bold", 9) + 8 * mm
    c.roundRect(left, y - 2.5 * mm, w, 7 * mm, 3.5 * mm, stroke=1, fill=0)
    c.drawCentredString(left + w / 2, y - 0.2 * mm, label)

    if payment.notes:
        y -= 18 * mm
        _label(c, left, y, "Notes")
        c.setFont("Helvetica", 9)
        c.setFillColor(INK)
        for i, line in enumerate(simpleSplit(payment.notes, "Helvetica", 9, right - left)[:6]):
            c.drawString(left, y - 5 * mm - i * 4.5 * mm, line)

    # Footer.
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    footer = " · ".join(filter(None, [org.name, org.email, org.phone]))
    c.drawCentredString(width / 2, 15 * mm, footer)

    c.showPage()
    c.save()
    return buf.getvalue()


def _label(c: Canvas, x: float, y: float, text: str, align: str = "left") -> None:
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    (c.drawRightString if align == "right" else c.drawString)(x, y, text.upper())


def _rule(c: Canvas, x1: float, x2: float, y: float) -> None:
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(x1, y, x2, y)


def _block(c: Canvas, x: float, y: float, title: str, lines: list[str | None]) -> int:
    _label(c, x, y, title)
    c.setFillColor(INK)
    lines = [line for line in lines if line]
    for i, line in enumerate(lines):
        c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 10 if i == 0 else 9)
        c.drawString(x, y - 6 * mm - i * 4.6 * mm, line[:70])
    return len(lines)
