"""评审稿版式。暖纸色、墨色、铜棕色，用来区分结构说明和专利边界。"""

from lxml import etree
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_AUTO_SIZE, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

FONT = "微软雅黑"

SLIDE_W = 13.333333
SLIDE_H = 7.5
MARGIN_L = 0.48
MARGIN_R = 12.85
CONTENT_TOP = 1.18
CONTENT_BOTTOM = 7.0
CONTENT_W = MARGIN_R - MARGIN_L
CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP

INK = "1C2430"
PAPER = "F7F4EE"
WHITE = "FFFFFF"
LINE = "E3DCD0"
TEAL = "1F4E5F"
TEAL_SOFT = "E7EFF1"
COPPER = "A85A32"
COPPER_SOFT = "F8EFE8"
COPPER_ON_DARK = "E0B08A"
AMBER = "8A5A12"
AMBER_SOFT = "F8F1DE"
GREEN = "1E6B45"
GREEN_SOFT = "E6F3EC"
MUTED = "5C6570"
ON_DARK = "F7F4EE"
ON_DARK_SOFT = "D9D3C7"

RISK_FILL = {"高": AMBER_SOFT, "中": TEAL_SOFT, "低": GREEN_SOFT}
RISK_INK = {"高": AMBER, "中": TEAL, "低": GREEN}

ALIGN = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT}
ANCHOR = {"top": "t", "middle": "ctr", "bottom": "b"}


def rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def set_run_font(run, size, color, bold=False):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = rgb(color)
    run.font.name = FONT
    r_pr = run._r.get_or_add_rPr()
    for tag in ("a:latin", "a:ea", "a:cs"):
        element = r_pr.find(qn(tag))
        if element is None:
            element = etree.SubElement(r_pr, qn(tag))
        element.set("typeface", FONT)


def paint(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(color)
    shape.line.fill.background()
    shadow = getattr(shape, "shadow", None)
    if shadow is not None:
        shadow.inherit = False


def blank_slide(prs):
    layout = next((item for item in prs.slide_layouts if item.name.lower() == "blank"), prs.slide_layouts[-1])
    slide = prs.slides.add_slide(layout)
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(0), Emu(0), prs.slide_width, prs.slide_height)
    paint(shape, PAPER)
    tree = slide.shapes._spTree
    element = shape._element
    tree.remove(element)
    tree.insert(2, element)
    return slide


_BORDERED = {WHITE, "FBF8F3", COPPER_SOFT, TEAL_SOFT, AMBER_SOFT, GREEN_SOFT}


def rect(slide, x, y, w, h, color):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(color)
    shadow = getattr(shape, "shadow", None)
    if shadow is not None:
        shadow.inherit = False
    if color in _BORDERED:
        shape.line.color.rgb = rgb(LINE)
        shape.line.width = Pt(0.75)
    else:
        shape.line.fill.background()
    return shape


def panel(slide, x, y, w, h, fill, accent=None):
    rect(slide, x, y, w, h, fill)
    if accent:
        rect(slide, x, y, 0.07, h, accent)


def add_text(
    slide,
    x,
    y,
    w,
    h,
    paragraphs,
    *,
    size=15,
    color=INK,
    bold=False,
    align="left",
    anchor="top",
    spacing=1.08,
    after=4,
):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.word_wrap = True
    frame.auto_size = MSO_AUTO_SIZE.NONE
    frame.margin_left = Inches(0.02)
    frame.margin_right = Inches(0.02)
    frame.margin_top = Inches(0.01)
    frame.margin_bottom = Inches(0.01)
    frame._txBody.bodyPr.set("anchor", ANCHOR[anchor])
    if isinstance(paragraphs, str):
        paragraphs = [paragraphs]
    for index, paragraph in enumerate(paragraphs):
        block = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
        block.alignment = ALIGN[align]
        block.line_spacing = spacing
        block.space_after = Pt(after)
        block.space_before = Pt(0)
        runs = paragraph if isinstance(paragraph, list) else [{"text": paragraph}]
        for item in runs:
            run = block.add_run()
            run.text = item["text"]
            set_run_font(
                run,
                item.get("size", size),
                item.get("color", color),
                item.get("bold", bold),
            )
    return box


def footer_text(deck) -> str:
    parts = [
        deck["meta"]["short_name"],
        "内部评审",
        "非正式专利法律意见，未做检索",
    ]
    if deck["meta"].get("example"):
        parts.append("示例")
    return "  ·  ".join(parts)


def chrome(slide, kicker, title, deck, page, total):
    rect(slide, 0, 0, SLIDE_W, 0.07, TEAL)
    add_text(slide, MARGIN_L, 0.16, CONTENT_W, 0.26, kicker, size=13, color=TEAL, bold=True, spacing=1.0, after=0)
    add_text(slide, MARGIN_L, 0.42, CONTENT_W, 0.64, title, size=28, color=INK, bold=True, spacing=1.0, after=0)
    rect(slide, MARGIN_L, 7.1, CONTENT_W, 0.012, LINE)
    add_text(slide, MARGIN_L, 7.16, 9.6, 0.28, footer_text(deck), size=12, color=MUTED, spacing=1.0, after=0)
    add_text(
        slide,
        10.5,
        7.16,
        2.35,
        0.28,
        f"{page:02d}  /  {total:02d}",
        size=12,
        color=MUTED,
        align="right",
        spacing=1.0,
        after=0,
    )


def standard_note(extra=None) -> str:
    base = "未标注“已有数据”的内容都还没有试验。不要口头补充百分比、里程或专利公开号。"
    if extra:
        return extra.strip() + "\n" + base
    return base


def write_notes(slide, extra=None):
    slide.notes_slide.notes_text_frame.text = standard_note(extra)
