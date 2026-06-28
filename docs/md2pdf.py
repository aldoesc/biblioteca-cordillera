# -*- coding: utf-8 -*-
"""Convierte un .md a un PDF prolijo con reportlab.
Uso: python md2pdf.py [entrada.md] [salida.pdf]"""
import re, html, os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                Preformatted, HRFlowable, ListFlowable, ListItem)

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "SEO.md")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(SRC)[0] + ".pdf"

ACCENT = colors.HexColor("#4f46e5")
DARK = colors.HexColor("#1f2937")
MUTED = colors.HexColor("#6b7280")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("H1x", parent=styles["Title"], fontSize=22, textColor=DARK, spaceAfter=6))
styles.add(ParagraphStyle("H2x", parent=styles["Heading1"], fontSize=15, textColor=ACCENT, spaceBefore=14, spaceAfter=6))
styles.add(ParagraphStyle("H3x", parent=styles["Heading2"], fontSize=12.5, textColor=DARK, spaceBefore=10, spaceAfter=4))
styles.add(ParagraphStyle("H4x", parent=styles["Heading3"], fontSize=11, textColor=DARK, spaceBefore=8, spaceAfter=3))
styles.add(ParagraphStyle("Body", parent=styles["BodyText"], fontSize=10, leading=14, spaceAfter=5))
styles.add(ParagraphStyle("Quote", parent=styles["BodyText"], fontSize=9.5, leading=13, textColor=MUTED,
                          leftIndent=12, borderColor=ACCENT, italic=True))
styles.add(ParagraphStyle("Cell", parent=styles["BodyText"], fontSize=9, leading=12))
styles.add(ParagraphStyle("CellH", parent=styles["BodyText"], fontSize=9, leading=12, textColor=colors.white, fontName="Helvetica-Bold"))
CODE = ParagraphStyle("Code", parent=styles["Code"], fontSize=8.2, leading=11, backColor=colors.HexColor("#f3f4f6"),
                      borderPadding=6, leftIndent=4, textColor=colors.HexColor("#111827"))


def inline(text):
    """Convierte markdown inline a markup de reportlab, escapando XML."""
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`([^`]+?)`", r'<font face="Courier" size="8.5">\1</font>', text)
    text = re.sub(r"\[(.+?)\]\((.+?)\)", r'<link href="\2" color="#4f46e5">\1</link>', text)
    return text


def build():
    with open(SRC, encoding="utf-8") as f:
        lines = f.read().split("\n")

    story = []
    i = 0
    bullets = []

    def flush_bullets():
        nonlocal bullets
        if bullets:
            items = [ListItem(Paragraph(inline(b), styles["Body"]), leftIndent=10) for b in bullets]
            story.append(ListFlowable(items, bulletType="bullet", start="•", leftIndent=12))
            story.append(Spacer(1, 4))
            bullets = []

    while i < len(lines):
        line = lines[i].rstrip("\n")
        s = line.strip()

        # Code block
        if s.startswith("```"):
            flush_bullets()
            i += 1
            buf = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            story.append(Preformatted("\n".join(buf), CODE))
            story.append(Spacer(1, 6))
            i += 1
            continue

        # Table
        if s.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:\-|]+\|$", lines[i+1].strip()):
            flush_bullets()
            header = [c.strip() for c in s.strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            data = [[Paragraph(inline(c), styles["CellH"]) for c in header]]
            for r in rows:
                data.append([Paragraph(inline(c), styles["Cell"]) for c in r])
            t = Table(data, repeatRows=1, hAlign="LEFT")
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(t)
            story.append(Spacer(1, 8))
            continue

        if not s:
            flush_bullets()
            i += 1
            continue

        if s.startswith("#### "):
            flush_bullets(); story.append(Paragraph(inline(s[5:]), styles["H4x"]))
        elif s.startswith("### "):
            flush_bullets(); story.append(Paragraph(inline(s[4:]), styles["H3x"]))
        elif s.startswith("## "):
            flush_bullets(); story.append(Paragraph(inline(s[3:]), styles["H2x"]))
        elif s.startswith("# "):
            flush_bullets(); story.append(Paragraph(inline(s[2:]), styles["H1x"]))
        elif s.startswith("---"):
            flush_bullets(); story.append(Spacer(1, 4)); story.append(HRFlowable(width="100%", color=colors.HexColor("#e5e7eb"))); story.append(Spacer(1, 4))
        elif s.startswith("> "):
            flush_bullets(); story.append(Paragraph(inline(s[2:]), styles["Quote"])); story.append(Spacer(1, 4))
        elif s.startswith("- "):
            bullets.append(s[2:])
        else:
            flush_bullets(); story.append(Paragraph(inline(s), styles["Body"]))
        i += 1

    flush_bullets()

    doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=1.8*cm, bottomMargin=1.8*cm,
                            title="SEO - Biblioteca Cordillera")
    doc.build(story)
    print("OK ->", OUT)


build()
