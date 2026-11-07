"""Printable member list for a course or one of its groups: a plain A4 table, one group per page."""

from __future__ import annotations

import io
from datetime import date

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape

from backend.modules.organization.models import Organization

from .schemas import RosterMember

INK = HexColor("#18181b")
MUTED = HexColor("#71717a")
LINE = HexColor("#e4e4e7")
RED = HexColor("#dc2626")
MARGIN = 16 * mm
LEFT, RIGHT = MARGIN + 6, A4[0] - MARGIN - 6  # line up with the content frame, which pads 6pt

TITLE = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=INK)
SUB = ParagraphStyle("sub", fontName="Helvetica", fontSize=9, leading=12, textColor=MUTED)
CELL = ParagraphStyle("cell", fontName="Helvetica", fontSize=9, leading=11.5, textColor=INK)
CELL_MUTED = ParagraphStyle("cell-muted", parent=CELL, textColor=MUTED)
LATE = ParagraphStyle("late", parent=CELL, textColor=RED)  # overdue: the paid-until date is past
HEAD = ParagraphStyle("head", fontName="Helvetica", fontSize=7.5, leading=9, textColor=MUTED)

# Relative column widths:  #   Name  Phone  Email  Plan  Paid until
WEIGHTS = (8, 46, 30, 50, 23, 21)


def _p(text: str | None, style=CELL) -> Paragraph:
    return Paragraph(escape(text) if text else "<font color='#a1a1aa'>—</font>", style)


def _table(members: list[RosterMember], width: float) -> Table:
    rows = [[Paragraph(h.upper(), HEAD) for h in ("#", "Name", "Phone", "Email", "Plan", "Paid until")]]
    for i, m in enumerate(members, 1):
        until = m.paid_until.strftime("%d %b %Y") if m.paid_until else None
        late = m.status == "overdue"
        rows.append(
            [
                _p(str(i), CELL_MUTED),
                _p(m.full_name),
                _p(m.phone),
                _p(m.email),
                _p(m.plan_name, CELL_MUTED),
                Paragraph(escape(until), LATE) if late and until else _p(until, CELL_MUTED),
            ]
        )
    table = Table(rows, colWidths=[width * w / sum(WEIGHTS) for w in WEIGHTS], repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, INK),
                ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
            ]
        )
    )
    return table


def render_roster(course_name: str, sections: list[tuple[str, str | None, list[RosterMember]]], org: Organization, logo: bytes | None) -> bytes:
    """``sections`` is a list of (group name, schedule, members); each starts on a new page."""
    buf = io.BytesIO()
    today = date.today().strftime("%d %b %Y")
    image = ImageReader(io.BytesIO(logo)) if logo else None
    title = f"{course_name} members"

    def frame(canvas, doc) -> None:
        canvas.saveState()
        top = A4[1] - 11 * mm
        if image:
            iw, ih = image.getSize()
            h = 7 * mm
            w = min(h * iw / ih, 40 * mm)
            canvas.drawImage(image, LEFT, top - w * ih / iw + 2 * mm, width=w, height=w * ih / iw, mask="auto")
        else:
            canvas.setFont("Helvetica-Bold", 9)
            canvas.setFillColor(INK)
            canvas.drawString(LEFT, top - 1 * mm, org.name)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(RIGHT, top - 1 * mm, f"Printed {today}")
        canvas.drawRightString(RIGHT, 10 * mm, f"Page {doc.page}")
        canvas.drawString(LEFT, 10 * mm, title)
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=24 * mm, bottomMargin=18 * mm, title=title, author=org.name
    )
    story = []
    for i, (name, schedule, members) in enumerate(sections):
        if i:
            story.append(PageBreak())
        heading = course_name if name == course_name else f"{course_name} · {name}"
        count = f"{len(members)} member{'' if len(members) == 1 else 's'}"
        story += [Paragraph(escape(heading), TITLE), Spacer(0, 1.5 * mm), Paragraph(escape(" · ".join(filter(None, [schedule, count]))), SUB), Spacer(0, 7 * mm)]
        story.append(_table(members, doc.width - 12) if members else Paragraph("No members.", SUB))
    if not story:
        story.append(Paragraph("No members.", SUB))
    doc.build(story, onFirstPage=frame, onLaterPages=frame)
    return buf.getvalue()
