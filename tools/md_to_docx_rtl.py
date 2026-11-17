"""
md_to_docx_rtl.py – ממיר Markdown לקובץ Word בעברית תקינה (RTL מלא).

שימוש:
    python tools/md_to_docx_rtl.py docs/phase2-redesign-draft.md
    python tools/md_to_docx_rtl.py input.md output.docx

מה נתמך: כותרות (# עד ####), פסקאות, **מודגש**, `קוד בשורה`, רשימות (- / 1.),
ציטוט (>), טבלאות Markdown, בלוקי ```קוד```, קו מפריד (---).
תגיות HTML כמו <div dir="rtl"> מדולגות.

כללי RTL (לפי CLAUDE.md, חוק יסוד 1):
- כל פסקה: w:bidi + יישור לימין.
- כל run עברי: w:rtl + גופן complex script (rFonts cs) + szCs.
- קטעים לטיניים (GPIO 6, read_raw()) נכתבים כ-run נפרד בלי rtl, כדי שלא יתהפכו.
- טבלאות: w:bidiVisual (העמודה הראשונה מימין).
- המקטע: w:bidi. ברירת מחדל למסמך: שפה he-IL.
- בלוקי קוד: LTR, יישור לשמאל, Consolas.
"""
import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm

FONT = "Arial"          # קיים בכל מחשב Windows/Mac, תומך עברית
CODE_FONT = "Consolas"
BASE_PT = 11
HEADING_PT = {1: 20, 2: 16, 3: 13, 4: 12}
HEADING_COLOR = RGBColor(0x2E, 0x6B, 0x30)

# קטע LTR: מתחיל ונגמר באות/ספרה לטינית, יכול להכיל רווחים וסימנים באמצע.
# סוגריים וגרשיים לא נכללים בקצוות – אחרת סוגר אחד נשאר בצד העברי ומתהפך.
# חריג: "()" צמוד לשם פונקציה (read_raw()).
LTR_RE = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9_\-–\./:=,+*%# ]*[A-Za-z0-9])?(?:\(\))?")
# מפרידים "שקופים" בלבד – פסיק, רווח, לוכסן, מקף. סוגריים, תבליטים וגרשיים נשארים rtl.
NEUTRAL_SEP_RE = re.compile(r"[ ,/·–\-+:→←]+")
INLINE_RE = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`)")


# ---------- עזרי XML ----------
def _set(el, tag, **attrs):
    child = el.find(qn(tag))
    if child is None:
        child = OxmlElement(tag)
        el.append(child)
    for k, v in attrs.items():
        child.set(qn(k), v)
    return child


def para_rtl(p, align=WD_ALIGN_PARAGRAPH.RIGHT):
    pPr = p._p.get_or_add_pPr()
    _set(pPr, "w:bidi")
    p.alignment = align


def para_ltr(p):
    # bidi="0" מפורש – אחרת הפסקה יורשת RTL מסגנון Normal
    pPr = p._p.get_or_add_pPr()
    _set(pPr, "w:bidi", **{"w:val": "0"})
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT


def style_run(run, *, rtl, size=BASE_PT, bold=False, font=FONT, color=None):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.name = font
    if color is not None:
        run.font.color.rgb = color
    rPr = run._r.get_or_add_rPr()
    _set(rPr, "w:rFonts", **{"w:ascii": font, "w:hAnsi": font, "w:cs": font, "w:eastAsia": font})
    _set(rPr, "w:szCs", **{"w:val": str(int(size * 2))})
    if bold:
        _set(rPr, "w:bCs")
    if rtl:
        _set(rPr, "w:rtl")
        _set(rPr, "w:lang", **{"w:bidi": "he-IL"})


def add_text(p, text, *, size=BASE_PT, bold=False, color=None, code=False):
    """מוסיף טקסט לפסקה, מפוצל ל-runs עבריים (rtl) ולטיניים (ltr)."""
    if code:
        style_run(p.add_run(text), rtl=False, size=size - 1, bold=bold, font=CODE_FONT,
                  color=RGBColor(0x8B, 0x1A, 0x1A))
        return
    def other(chunk):
        # פיסוק בלי אותיות עבריות (", " בין שני מונחים באנגלית) לא מסומן rtl,
        # אחרת Word הופך את סדר הרשימה: "IP ,if ,GPIO"
        neutral = bool(NEUTRAL_SEP_RE.fullmatch(chunk)) and bool(re.search(r"[,/·+→←]", chunk))
        style_run(p.add_run(chunk), rtl=not neutral, size=size, bold=bold, color=color)

    pos = 0
    for m in LTR_RE.finditer(text):
        if m.start() > pos:
            other(text[pos:m.start()])
        style_run(p.add_run(m.group()), rtl=False, size=size, bold=bold, color=color)
        pos = m.end()
    if pos < len(text):
        other(text[pos:])


def add_inline(p, text, *, size=BASE_PT, bold=False, color=None):
    """מטפל ב-**מודגש** וב-`קוד` בתוך שורה."""
    text = re.sub(r"<[^>]+>", "", text)
    for part in INLINE_RE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            add_text(p, part[2:-2], size=size, bold=True, color=color)
        elif part.startswith("`") and part.endswith("`"):
            add_text(p, part[1:-1], size=size, code=True)
        else:
            add_text(p, part, size=size, bold=bold, color=color)


def shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    _set(tcPr, "w:shd", **{"w:val": "clear", "w:color": "auto", "w:fill": hex_fill})


def border_bottom(p, color="2E6B30"):
    pPr = p._p.get_or_add_pPr()
    pBdr = _set(pPr, "w:pBdr")
    _set(pBdr, "w:bottom", **{"w:val": "single", "w:sz": "6", "w:space": "1", "w:color": color})


def border_right(p, color="9BBF9D"):
    """פס צבעוני לציטוט – בצד ימין (תחילת השורה ב-RTL)."""
    pPr = p._p.get_or_add_pPr()
    pBdr = _set(pPr, "w:pBdr")
    _set(pBdr, "w:right", **{"w:val": "single", "w:sz": "18", "w:space": "8", "w:color": color})


# ---------- הגדרות מסמך ----------
def setup_document():
    doc = Document()
    sec = doc.sections[0]
    sec.left_margin = sec.right_margin = Cm(2)
    sec.top_margin = sec.bottom_margin = Cm(2)
    _set(sec._sectPr, "w:bidi")

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(BASE_PT)
    rPr = normal.element.get_or_add_rPr()
    _set(rPr, "w:rFonts", **{"w:ascii": FONT, "w:hAnsi": FONT, "w:cs": FONT, "w:eastAsia": FONT})
    _set(rPr, "w:szCs", **{"w:val": str(BASE_PT * 2)})
    _set(rPr, "w:lang", **{"w:val": "he-IL", "w:bidi": "he-IL"})
    pPr = normal.element.get_or_add_pPr()
    _set(pPr, "w:bidi")
    normal.paragraph_format.space_after = Pt(4)
    return doc


# ---------- בלוקים ----------
def add_heading(doc, level, text):
    p = doc.add_paragraph()
    para_rtl(p)
    p.paragraph_format.space_before = Pt(14 if level <= 2 else 10)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    add_inline(p, text, size=HEADING_PT.get(level, 12), bold=True, color=HEADING_COLOR)
    if level <= 2:
        border_bottom(p)


def add_paragraph(doc, text, *, indent_cm=0, prefix=None, quote=False):
    p = doc.add_paragraph()
    para_rtl(p)
    if indent_cm:
        p.paragraph_format.right_indent = Cm(indent_cm)
    if prefix:
        add_text(p, prefix)
    add_inline(p, text, color=RGBColor(0x44, 0x44, 0x44) if quote else None)
    if quote:
        border_right(p)
        shade_para(p, "F3F8F1")
    return p


def shade_para(p, fill):
    pPr = p._p.get_or_add_pPr()
    _set(pPr, "w:shd", **{"w:val": "clear", "w:color": "auto", "w:fill": fill})


def add_code(doc, lines):
    for line in lines:
        p = doc.add_paragraph()
        para_ltr(p)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.left_indent = Cm(0.5)
        shade_para(p, "F4F4F4")
        # הערה עברית (# ...) – run נפרד, rtl, בגופן עברי (ל-Consolas אין עברית)
        m = re.search(r"#\s*(?=.*[֐-׿])", line)
        code, comment = (line[:m.end()], line[m.end():]) if m else (line, "")
        style_run(p.add_run(code if code else " "), rtl=False, size=9.5, font=CODE_FONT)
        if comment:
            style_run(p.add_run(comment), rtl=True, size=9.5, color=RGBColor(0x6A, 0x73, 0x7D))
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def parse_row(line):
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def add_table(doc, rows):
    header, body = rows[0], rows[1:]
    ncols = len(header)
    table = doc.add_table(rows=1 + len(body), cols=ncols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    _set(table._tbl.tblPr, "w:bidiVisual")
    for r, row in enumerate([header] + body):
        row = (row + [""] * ncols)[:ncols]
        for c, txt in enumerate(row):
            cell = table.cell(r, c)
            p = cell.paragraphs[0]
            para_rtl(p)
            p.paragraph_format.space_after = Pt(0)
            for i, chunk in enumerate(txt.split("<br>")):
                if i:
                    p = cell.add_paragraph()
                    para_rtl(p)
                add_inline(p, chunk, size=10, bold=(r == 0))
            if r == 0:
                shade(cell, "DCEBD9")
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


# ---------- ההמרה ----------
def convert(md_path: Path, out_path: Path):
    lines = md_path.read_text(encoding="utf-8").splitlines()
    doc = setup_document()
    i = 0
    while i < len(lines):
        raw = lines[i]
        s = raw.strip()

        if not s or re.fullmatch(r"</?div[^>]*>", s):
            i += 1
            continue

        if s.startswith("```"):
            code = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i].rstrip())
                i += 1
            add_code(doc, code)
            i += 1
            continue

        if s.startswith("|"):
            block = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i])
                i += 1
            rows = [parse_row(b) for b in block if not re.fullmatch(r"\|?[\s:\-|]+\|?", b.strip())]
            if rows:
                add_table(doc, rows)
            continue

        m = re.match(r"(#{1,6})\s+(.*)", s)
        if m:
            add_heading(doc, len(m.group(1)), m.group(2))
        elif re.fullmatch(r"-{3,}|\*{3,}", s):
            p = doc.add_paragraph()
            para_rtl(p)
            border_bottom(p, "BBBBBB")
        elif s.startswith(">"):
            add_paragraph(doc, s.lstrip("> ").strip(), quote=True)
        elif re.match(r"[-*]\s+", s):
            level = (len(raw) - len(raw.lstrip())) // 2
            add_paragraph(doc, re.sub(r"^[-*]\s+", "", s), indent_cm=0.6 + 0.6 * level, prefix="•  ")
        elif re.match(r"\d+\.\s+", s):
            num, rest = s.split(".", 1)
            level = (len(raw) - len(raw.lstrip())) // 2
            add_paragraph(doc, rest.strip(), indent_cm=0.6 + 0.6 * level, prefix=f"{num}.  ")
        else:
            add_paragraph(doc, s)
        i += 1

    doc.save(out_path)
    return out_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("שימוש: python tools/md_to_docx_rtl.py input.md [output.docx]")
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".docx")
    print("נוצר:", convert(src, dst))
