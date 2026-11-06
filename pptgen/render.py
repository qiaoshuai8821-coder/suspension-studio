"""把校验后的提案画成 16:9 评审稿。"""

from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.util import Inches

from pptgen.model import planned_slide_count
from pptgen.theme import (
    CONTENT_BOTTOM,
    CONTENT_H,
    CONTENT_TOP,
    CONTENT_W,
    COPPER,
    COPPER_ON_DARK,
    COPPER_SOFT,
    INK,
    LINE,
    MARGIN_L,
    MARGIN_R,
    MUTED,
    ON_DARK,
    ON_DARK_SOFT,
    RISK_FILL,
    RISK_INK,
    SLIDE_H,
    SLIDE_W,
    TEAL,
    TEAL_SOFT,
    WHITE,
    add_text,
    blank_slide,
    chrome,
    footer_text,
    panel,
    rect,
    write_notes,
)

GAP = 0.12


def render_pptx(deck: dict, path: str | Path) -> Path:
    output = Path(path)
    builder = _Builder(deck)
    if deck["meta"].get("deck") == "intro":
        for index, proposal in enumerate(deck["proposals"], start=1):
            builder.intro_issue(proposal, index)
            builder.intro_practice(proposal, index)
    else:
        builder.cover()
        builder.platform()
        builder.contradictions()
        builder.overview()
        for index, proposal in enumerate(deck["proposals"], start=1):
            builder.problem(proposal, index)
            builder.solution(proposal, index)
            builder.embodiments(proposal, index)
            builder.effects(proposal, index)
            builder.patent(proposal, index)
        builder.family()
        builder.roadmap()
        builder.decisions()
        builder.appendix()
    if builder.page != builder.total:
        raise RuntimeError(f"页数不一致：画了 {builder.page} 页，计划 {builder.total} 页")
    builder.prs.save(output)
    return output


class _Builder:
    def __init__(self, deck: dict):
        self.deck = deck
        self.prs = Presentation()
        self.prs.slide_width = Inches(SLIDE_W)
        self.prs.slide_height = Inches(SLIDE_H)
        meta = deck["meta"]
        props = self.prs.core_properties
        props.title = f"{meta['platform_name']}{meta['module']}创新提案"
        props.author = meta["author"]
        props.subject = "非正式专利法律意见，未做检索"
        props.category = "底盘悬架创新提案"
        props.keywords = "悬架,创新提案,技术交底"
        self.page = 0
        self.total = planned_slide_count(deck)

    def _slide(self, kicker: str, title: str, note: str | None):
        self.page += 1
        slide = blank_slide(self.prs)
        chrome(slide, kicker, title, self.deck, self.page, self.total)
        write_notes(slide, note)
        return slide

    def _note(self, key: str) -> str | None:
        notes = self.deck.get("notes") or {}
        return notes.get(key)

    def intro_issue(self, proposal, index):
        total = len(self.deck["proposals"])
        label = proposal["name"] if total == 1 else f"提案 {index} / {total}"
        slide = self._slide(
            f"{label}  ·  问题与特征",
            proposal["problem_title"],
            _proposal_note(proposal, "problem"),
        )
        left_w = 7.15
        panel(slide, MARGIN_L, CONTENT_TOP, left_w, CONTENT_H, WHITE, TEAL)
        add_text(slide, MARGIN_L + 0.2, CONTENT_TOP + 0.14, left_w - 0.4, 0.26, "基线在哪里失败", size=13, color=TEAL, bold=True, spacing=1, after=0)
        add_text(slide, MARGIN_L + 0.2, CONTENT_TOP + 0.46, left_w - 0.4, 2.15, proposal["baseline_failure"], size=16, spacing=1.12, after=0)
        add_text(slide, MARGIN_L + 0.2, CONTENT_TOP + 2.75, left_w - 0.4, 0.26, "这两页只讲这一件事", size=13, color=COPPER, bold=True, spacing=1, after=0)
        add_text(slide, MARGIN_L + 0.2, CONTENT_TOP + 3.08, left_w - 0.4, 2.3, proposal["only_this"], size=16, spacing=1.12, after=0)
        right_x = MARGIN_L + left_w + GAP
        right_w = MARGIN_R - right_x
        features = proposal["essential_features"]
        list_h = CONTENT_H - 1.15
        rect(slide, right_x, CONTENT_TOP, right_w, list_h, WHITE)
        add_text(slide, right_x + 0.14, CONTENT_TOP + 0.1, right_w - 0.28, 0.26, "必要技术特征", size=13, color=TEAL, bold=True, spacing=1, after=0)
        row_h = (list_h - 0.46) / len(features)
        for feature_index, feature in enumerate(features):
            y = CONTENT_TOP + 0.46 + feature_index * row_h
            rect(slide, right_x + 0.14, y, 0.46, 0.34, COPPER)
            add_text(slide, right_x + 0.14, y, 0.46, 0.34, feature["id"], size=12, color=WHITE, bold=True, align="center", anchor="middle", spacing=1, after=0)
            add_text(slide, right_x + 0.7, y - 0.04, right_w - 0.86, row_h, feature["text"], size=14, anchor="middle", spacing=1.05, after=0)
        risk = proposal["patent"]["retrieval_risk"]
        risk_y = CONTENT_TOP + list_h + GAP
        panel(slide, right_x, risk_y, right_w, CONTENT_BOTTOM - risk_y, RISK_FILL[risk], RISK_INK[risk])
        add_text(slide, right_x + 0.14, risk_y + 0.08, right_w - 0.28, 0.24, f"检索风险  ·  {risk}", size=13, color=RISK_INK[risk], bold=True, spacing=1, after=0)
        add_text(slide, right_x + 0.14, risk_y + 0.34, right_w - 0.28, CONTENT_BOTTOM - risk_y - 0.42, proposal["patent"]["retrieval_risk_reason"], size=13, spacing=1.02, after=0)

    def intro_practice(self, proposal, index):
        total = len(self.deck["proposals"])
        label = proposal["name"] if total == 1 else f"提案 {index} / {total}"
        slide = self._slide(
            f"{label}  ·  实施与判断",
            proposal["embodiment_title"],
            _proposal_note(proposal, "embodiment"),
        )
        card_w = (CONTENT_W - GAP) / 2
        card_h = 2.05
        for item_index, item in enumerate(proposal["embodiments"]):
            x = MARGIN_L + item_index * (card_w + GAP)
            panel(slide, x, CONTENT_TOP, card_w, card_h, WHITE, COPPER if item_index == 0 else TEAL)
            add_text(slide, x + 0.16, CONTENT_TOP + 0.1, card_w - 0.32, 0.34, item["name"], size=16, color=INK, bold=True, spacing=1, after=0)
            add_text(slide, x + 0.16, CONTENT_TOP + 0.48, card_w - 0.32, 0.85, item["structure"], size=14, spacing=1.05, after=0)
            add_text(slide, x + 0.16, CONTENT_TOP + 1.36, card_w - 0.32, 0.6, item["difference"], size=13, color=MUTED, spacing=1.02, after=0)
        effect = next(item for item in proposal["effects"] if item["rank"] == "必要")
        mid_y = CONTENT_TOP + card_h + GAP
        mid_h = 1.7
        panel(slide, MARGIN_L, mid_y, CONTENT_W, mid_h, WHITE, TEAL)
        add_text(slide, MARGIN_L + 0.18, mid_y + 0.08, 4, 0.24, "怎么判断做成了", size=13, color=TEAL, bold=True, spacing=1, after=0)
        add_text(slide, MARGIN_L + 0.18, mid_y + 0.36, CONTENT_W - 0.36, 0.55, effect["setup"], size=14, spacing=1.05, after=0)
        add_text(slide, MARGIN_L + 0.18, mid_y + 0.96, CONTENT_W - 0.36, 0.62, effect["criterion"], size=14, spacing=1.05, after=0)
        claim_y = mid_y + mid_h + GAP
        panel(slide, MARGIN_L, claim_y, CONTENT_W, CONTENT_BOTTOM - claim_y, COPPER_SOFT, COPPER)
        add_text(slide, MARGIN_L + 0.18, claim_y + 0.08, CONTENT_W - 0.36, 0.24, "独立权利要求要落在这些关系上，非正式文本", size=12, color=COPPER, bold=True, spacing=1, after=0)
        add_text(slide, MARGIN_L + 0.18, claim_y + 0.34, CONTENT_W - 0.36, CONTENT_BOTTOM - claim_y - 0.42, proposal["patent"]["independent_claim"].strip(), size=13, spacing=1.05, after=0)

    def cover(self):
        self.page += 1
        slide = blank_slide(self.prs)
        deck = self.deck
        meta = deck["meta"]
        rect(slide, 0, 0, 6.22, SLIDE_H, INK)
        rect(slide, 6.22, 0, 0.08, SLIDE_H, COPPER)
        add_text(
            slide,
            0.48,
            0.42,
            5.4,
            0.36,
            "底盘悬架平台  ·  创新提案",
            size=14,
            color=COPPER_ON_DARK,
            bold=True,
            spacing=1,
            after=0,
        )
        add_text(slide, 0.48, 1.2, 5.4, 0.95, meta["platform_name"], size=40, color=ON_DARK, bold=True, spacing=1.0, after=0)
        add_text(slide, 0.48, 2.2, 5.4, 0.48, meta["module"], size=24, color=ON_DARK_SOFT, spacing=1, after=0)
        rect(slide, 0.48, 2.82, 1.35, 0.035, COPPER)
        add_text(slide, 0.48, 3.05, 5.3, 1.5, meta["purpose"], size=18, color=ON_DARK_SOFT, spacing=1.15, after=0)
        foot = "示例项目  ·  不是真实车型数据" if meta["example"] else meta["classification"]
        add_text(slide, 0.48, 6.7, 5.3, 0.36, foot, size=14, color=COPPER_ON_DARK, bold=True, spacing=1, after=0)

        add_text(slide, 6.62, 0.4, 6.2, 0.3, "评审信息", size=13, color=TEAL, bold=True, spacing=1, after=0)
        rows = [
            ("日期", meta["date"]),
            ("受众", meta["audience"]),
            ("范围", meta["scope_line"]),
            ("密级", meta["classification"]),
        ]
        for index, (label, value) in enumerate(rows):
            y = 0.82 + index * 0.48
            add_text(slide, 6.62, y, 1.15, 0.36, label, size=13, color=MUTED, spacing=1, after=0, anchor="middle")
            add_text(slide, 7.8, y, 4.7, 0.36, value, size=15, color=INK, spacing=1, after=0, anchor="middle")
        rect(slide, 6.62, 2.78, 6.15, 0.012, LINE)
        add_text(slide, 6.62, 2.95, 6.2, 0.3, "本册提案", size=13, color=TEAL, bold=True, spacing=1, after=0)
        block_top = 3.38
        block_bottom = 6.72
        pitch = (block_bottom - block_top) / len(deck["proposals"])
        for index, proposal in enumerate(deck["proposals"]):
            y = block_top + index * pitch
            risk = proposal["patent"]["retrieval_risk"]
            rect(slide, 6.62, y, 0.62, 0.42, RISK_FILL[risk])
            add_text(
                slide,
                6.62,
                y,
                0.62,
                0.42,
                f"{index + 1:02d}",
                size=14,
                color=RISK_INK[risk],
                bold=True,
                align="center",
                anchor="middle",
                spacing=1,
                after=0,
            )
            add_text(
                slide,
                7.4,
                y - 0.02,
                5.3,
                0.34,
                f"{proposal['name']}    {proposal['claim_type']}",
                size=16,
                color=INK,
                bold=True,
                spacing=1,
                after=0,
            )
            add_text(slide, 7.4, y + 0.34, 5.3, 0.4, proposal["one_liner"], size=13, color=MUTED, spacing=1, after=0)
        add_text(slide, 6.62, 6.95, 4.7, 0.28, "非正式专利法律意见，未做检索", size=12, color=MUTED, spacing=1, after=0)
        add_text(slide, 11.15, 6.95, 1.7, 0.28, f"{self.page:02d}  /  {self.total:02d}", size=12, color=MUTED, align="right", spacing=1, after=0)
        write_notes(slide, "先说明这是内部提案。示例项目要讲明没有测量数据。不要把封面讲成发布会。")

    def platform(self):
        slide = self._slide("平台边界", self.deck["titles"]["platform"], self._note("platform"))
        platform = self.deck["platform"]
        panel(slide, MARGIN_L, CONTENT_TOP, CONTENT_W, 0.86, WHITE, TEAL)
        add_text(slide, MARGIN_L + 0.2, CONTENT_TOP + 0.06, 2, 0.22, "范围", size=12, color=TEAL, bold=True, spacing=1, after=0)
        add_text(slide, MARGIN_L + 0.2, CONTENT_TOP + 0.28, CONTENT_W - 0.4, 0.52, platform["scope"], size=16, color=INK, spacing=1.05, after=0)

        top = CONTENT_TOP + 0.98
        column_w = (CONTENT_W - GAP) / 2
        column_h = 2.02
        self._stack_card(slide, MARGIN_L, top, column_w, column_h, "基线", [platform["baseline"]])
        self._stack_card(
            slide,
            MARGIN_L + column_w + GAP,
            top,
            column_w,
            column_h,
            "车型状态",
            [f"{item['name']}：{item['difference']}" for item in platform["variants"]],
        )
        lower = top + column_h + GAP
        lower_h = 1.5
        self._stack_card(slide, MARGIN_L, lower, column_w, lower_h, "这次不动", platform["frozen"])
        self._stack_card(slide, MARGIN_L + column_w + GAP, lower, column_w, lower_h, "相关接口", platform["interfaces"])

        assume_y = lower + lower_h + GAP
        assume_h = CONTENT_BOTTOM - assume_y
        panel(slide, MARGIN_L, assume_y, CONTENT_W, assume_h, TEAL_SOFT, TEAL)
        add_text(slide, MARGIN_L + 0.2, assume_y + 0.08, 3, 0.22, "本次假定", size=12, color=TEAL, bold=True, spacing=1, after=0)
        add_text(
            slide,
            MARGIN_L + 0.2,
            assume_y + 0.32,
            CONTENT_W - 0.4,
            assume_h - 0.4,
            [f"–  {item}" for item in platform["assumptions"]],
            size=13,
            color=INK,
            spacing=1.02,
            after=1,
        )

    def contradictions(self):
        slide = self._slide("技术矛盾", self.deck["titles"]["contradictions"], self._note("contradictions"))
        items = self.deck["contradictions"]
        band_h = (CONTENT_H - GAP * (len(items) - 1)) / len(items)
        for index, item in enumerate(items):
            y = CONTENT_TOP + index * (band_h + GAP)
            panel(slide, MARGIN_L, y, CONTENT_W, band_h, WHITE, COPPER)
            add_text(slide, MARGIN_L + 0.2, y + 0.08, 0.7, 0.3, item["id"], size=14, color=COPPER, bold=True, spacing=1, after=0)
            add_text(slide, MARGIN_L + 0.95, y + 0.08, 0.7, 0.3, "卡在", size=13, color=MUTED, anchor="middle", spacing=1, after=0)
            add_text(slide, MARGIN_L + 1.7, y + 0.08, 10, 0.3, item["clash"], size=16, color=INK, bold=True, anchor="middle", spacing=1, after=0)
            mid = y + 0.44
            half = (CONTENT_W - 0.55) / 2
            pair_h = max(0.42, band_h * 0.28)
            add_text(slide, MARGIN_L + 0.2, mid, half - 0.08, pair_h, item["left"], size=15, color=INK, spacing=1.02, after=0)
            add_text(slide, MARGIN_L + 0.28 + half, mid, half - 0.08, pair_h, item["right"], size=15, color=INK, spacing=1.02, after=0)
            fail_y = mid + pair_h + 0.04
            add_text(
                slide,
                MARGIN_L + 0.2,
                fail_y,
                CONTENT_W - 0.4,
                y + band_h - fail_y - 0.08,
                [[{"text": "基线  ", "bold": True, "color": TEAL, "size": 13}, {"text": item["baseline_failure"], "size": 13}]],
                size=13,
                spacing=1.02,
                after=0,
            )

    def overview(self):
        slide = self._slide("提案总览", self.deck["titles"]["overview"], self._note("overview"))
        proposals = self.deck["proposals"]
        if len(proposals) == 4:
            self._overview_grid(slide, proposals)
            return
        card_w = (CONTENT_W - GAP * (len(proposals) - 1)) / len(proposals)
        for index, proposal in enumerate(proposals):
            self._overview_card(
                slide,
                MARGIN_L + index * (card_w + GAP),
                CONTENT_TOP,
                card_w,
                CONTENT_H,
                proposal,
                index,
            )

    def _overview_grid(self, slide, proposals):
        card_w = (CONTENT_W - GAP) / 2
        card_h = (CONTENT_H - GAP) / 2
        for index, proposal in enumerate(proposals):
            column = index % 2
            row = index // 2
            self._overview_card(
                slide,
                MARGIN_L + column * (card_w + GAP),
                CONTENT_TOP + row * (card_h + GAP),
                card_w,
                card_h,
                proposal,
                index,
            )

    def _overview_card(self, slide, x, y, w, h, proposal, index):
        risk = proposal["patent"]["retrieval_risk"]
        rect(slide, x, y, w, h, WHITE)
        rect(slide, x, y, w, 0.42, RISK_FILL[risk])
        add_text(
            slide,
            x + 0.14,
            y,
            w - 0.28,
            0.42,
            f"{index + 1:02d}   {proposal['claim_type']}    检索风险 · {risk}",
            size=13,
            color=RISK_INK[risk],
            bold=True,
            anchor="middle",
            spacing=1,
            after=0,
        )
        body_top = y + 0.54
        body_h = h - 0.68
        name_h = 0.72 if h > 3 else 0.48
        add_text(slide, x + 0.16, body_top, w - 0.32, name_h, proposal["name"], size=18 if h > 3 else 16, color=INK, bold=True, spacing=1.02, after=0)
        cursor = body_top + name_h
        add_text(slide, x + 0.16, cursor, w - 0.32, 0.48, proposal["one_liner"], size=13, color=MUTED, spacing=1.02, after=0)
        cursor += 0.52
        remaining = y + h - 0.14 - cursor
        block_h = remaining / 3
        blocks = (
            ("问题", proposal["card"]["problem"]),
            ("必要特征", proposal["card"]["feature"]),
            ("判据", proposal["card"]["criterion"]),
        )
        for label, text in blocks:
            add_text(slide, x + 0.16, cursor, w - 0.32, 0.22, label, size=12, color=TEAL, bold=True, spacing=1, after=0)
            add_text(slide, x + 0.16, cursor + 0.22, w - 0.32, block_h - 0.24, text, size=13, color=INK, spacing=1.02, after=0)
            cursor += block_h

    def problem(self, proposal, index):
        kicker = f"提案 {index}  ·  问题"
        slide = self._slide(kicker, proposal["problem_title"], _proposal_note(proposal, "problem"))
        left_w = 8.15
        panel(slide, MARGIN_L, CONTENT_TOP, left_w, CONTENT_H, WHITE)
        add_text(slide, MARGIN_L + 0.22, CONTENT_TOP + 0.16, left_w - 0.4, 0.26, "工况", size=13, color=TEAL, bold=True, spacing=1, after=0)
        add_text(
            slide,
            MARGIN_L + 0.22,
            CONTENT_TOP + 0.48,
            left_w - 0.4,
            1.7,
            [f"–  {item}" for item in proposal["conditions"]],
            size=16,
            spacing=1.08,
            after=8,
        )
        add_text(slide, MARGIN_L + 0.22, CONTENT_TOP + 2.35, left_w - 0.4, 0.28, "基线在哪里失败", size=13, color=TEAL, bold=True, spacing=1, after=0)
        add_text(
            slide,
            MARGIN_L + 0.22,
            CONTENT_TOP + 2.72,
            left_w - 0.4,
            CONTENT_H - 2.95,
            proposal["baseline_failure"],
            size=16,
            spacing=1.12,
            after=0,
        )
        right_x = MARGIN_L + left_w + GAP
        right_w = MARGIN_R - right_x
        panel(slide, right_x, CONTENT_TOP, right_w, CONTENT_H, COPPER_SOFT, COPPER)
        add_text(slide, right_x + 0.2, CONTENT_TOP + 0.18, right_w - 0.36, 0.5, "本案只做这一件事", size=14, color=COPPER, bold=True, spacing=1.05, after=0)
        add_text(slide, right_x + 0.2, CONTENT_TOP + 0.78, right_w - 0.36, 3.3, proposal["only_this"], size=16, color=INK, spacing=1.12, after=0)
        refs = "、".join(proposal["contradiction_ids"])
        rect(slide, right_x + 0.07, CONTENT_BOTTOM - 0.7, right_w - 0.07, 0.7, WHITE)
        add_text(slide, right_x + 0.2, CONTENT_BOTTOM - 0.7, right_w - 0.36, 0.7, f"对应矛盾  {refs}", size=14, color=COPPER, bold=True, anchor="middle", spacing=1, after=0)

    def solution(self, proposal, index):
        slide = self._slide(f"提案 {index}  ·  方案", proposal["solution_title"], _proposal_note(proposal, "solution"))
        right_w = 5.05
        left_w = CONTENT_W - right_w - GAP
        preferred = proposal["preferred_features"]
        pref_h = 1.45 if preferred else 0
        list_bottom = CONTENT_BOTTOM - (pref_h + GAP if preferred else 0)
        add_text(slide, MARGIN_L, CONTENT_TOP, left_w, 0.28, "必要技术特征", size=13, color=TEAL, bold=True, spacing=1, after=0)
        features = proposal["essential_features"]
        row_top = CONTENT_TOP + 0.36
        row_h = (list_bottom - row_top) / len(features)
        for feature_index, feature in enumerate(features):
            y = row_top + feature_index * row_h
            rect(slide, MARGIN_L, y + 0.08, 0.48, 0.36, COPPER)
            add_text(slide, MARGIN_L, y + 0.08, 0.48, 0.36, feature["id"], size=12, color=WHITE, bold=True, align="center", anchor="middle", spacing=1, after=0)
            add_text(slide, MARGIN_L + 0.6, y, left_w - 0.6, row_h, feature["text"], size=15, color=INK, anchor="middle", spacing=1.05, after=0)
        if preferred:
            y = CONTENT_BOTTOM - pref_h
            panel(slide, MARGIN_L, y, left_w, pref_h, WHITE, TEAL)
            add_text(slide, MARGIN_L + 0.18, y + 0.08, left_w - 0.3, 0.24, "优选，不进独立权利要求", size=12, color=TEAL, bold=True, spacing=1, after=0)
            add_text(
                slide,
                MARGIN_L + 0.18,
                y + 0.36,
                left_w - 0.32,
                pref_h - 0.46,
                [f"{item['id']}   {item['text']}" for item in preferred],
                size=13,
                spacing=1.02,
                after=3,
            )
        self._diagram(slide, MARGIN_L + left_w + GAP, CONTENT_TOP, right_w, CONTENT_H, proposal["diagram"])

    def embodiments(self, proposal, index):
        slide = self._slide(f"提案 {index}  ·  实施方式", proposal["embodiment_title"], _proposal_note(proposal, "embodiment"))
        card_w = (CONTENT_W - GAP) / 2
        card_h = 2.28
        for item_index, item in enumerate(proposal["embodiments"]):
            x = MARGIN_L + item_index * (card_w + GAP)
            panel(slide, x, CONTENT_TOP, card_w, card_h, WHITE, COPPER if item_index == 0 else TEAL)
            add_text(slide, x + 0.18, CONTENT_TOP + 0.12, card_w - 0.32, 0.36, item["name"], size=18, color=INK, bold=True, spacing=1, after=0)
            add_text(slide, x + 0.18, CONTENT_TOP + 0.54, card_w - 0.32, 0.9, item["structure"], size=14, spacing=1.05, after=0)
            add_text(slide, x + 0.18, CONTENT_TOP + 1.5, card_w - 0.32, 0.66, item["difference"], size=13, color=MUTED, spacing=1.02, after=0)
        figure_y = CONTENT_TOP + card_h + GAP
        figure_h = CONTENT_BOTTOM - figure_y
        panel(slide, MARGIN_L, figure_y, CONTENT_W, figure_h, WHITE, TEAL)
        add_text(slide, MARGIN_L + 0.18, figure_y + 0.1, 4, 0.24, "图说  ·  交给后续制图，这里不画假机构", size=12, color=TEAL, bold=True, spacing=1, after=0)
        figure = proposal["figure"]
        cell_w = (CONTENT_W - 0.36 - GAP) / 2
        cell_h = (figure_h - 0.46 - 0.92) / 2
        cells = (
            (0, 0, "视图", figure["view"]),
            (1, 0, "零件", figure["parts"]),
            (0, 1, "不变", figure["invariant"]),
            (1, 1, "随车型变", figure["variant_delta"]),
        )
        origin_y = figure_y + 0.4
        for column, row, label, text in cells:
            x = MARGIN_L + 0.18 + column * (cell_w + GAP)
            y = origin_y + row * cell_h
            add_text(slide, x, y, cell_w, 0.22, label, size=12, color=TEAL, bold=True, spacing=1, after=0)
            add_text(slide, x, y + 0.22, cell_w, cell_h - 0.24, text, size=13, spacing=1.02, after=0)
        diff_y = origin_y + cell_h * 2
        add_text(slide, MARGIN_L + 0.18, diff_y, 2, 0.22, "相对基线", size=12, color=COPPER, bold=True, spacing=1, after=0)
        add_text(slide, MARGIN_L + 0.18, diff_y + 0.22, CONTENT_W - 0.4, 0.62, figure["difference_vs_baseline"], size=13, spacing=1.02, after=0)

    def effects(self, proposal, index):
        slide = self._slide(f"提案 {index}  ·  效果与判据", proposal["effect_title"], _proposal_note(proposal, "effect"))
        risks = proposal["risks"]
        risk_h = 1.22
        table_h = CONTENT_H - risk_h - GAP
        effects = proposal["effects"]
        header_h = 0.38
        row_h = (table_h - header_h) / len(effects)
        columns = (2.15, 3.15, 3.05, CONTENT_W - 2.15 - 3.15 - 3.05)
        headers = ("特征", "机理", "效果", "试验与判据")
        x = MARGIN_L
        rect(slide, MARGIN_L, CONTENT_TOP, CONTENT_W, header_h, TEAL)
        for width, header in zip(columns, headers):
            add_text(slide, x + 0.08, CONTENT_TOP, width - 0.1, header_h, header, size=13, color=WHITE, bold=True, anchor="middle", spacing=1, after=0)
            x += width
        for effect_index, effect in enumerate(effects):
            y = CONTENT_TOP + header_h + effect_index * row_h
            rect(slide, MARGIN_L, y, CONTENT_W, row_h, WHITE if effect_index % 2 == 0 else "FBF8F3")
            values = (
                f"{effect['feature_label']}\n{effect['rank']}  ·  {effect['status']}",
                effect["mechanism"],
                effect["effect"],
                f"{effect['setup']}\n{effect['criterion']}",
            )
            x = MARGIN_L
            for width, text in zip(columns, values):
                add_text(slide, x + 0.08, y + 0.06, width - 0.12, row_h - 0.1, text, size=12, spacing=1.02, after=2)
                x += width
        risk_y = CONTENT_TOP + table_h + GAP
        risk_w = (CONTENT_W - GAP * (len(risks) - 1)) / len(risks)
        for risk_index, risk in enumerate(risks):
            x = MARGIN_L + risk_index * (risk_w + GAP)
            panel(slide, x, risk_y, risk_w, risk_h, WHITE, COPPER)
            add_text(slide, x + 0.14, risk_y + 0.08, risk_w - 0.24, 0.22, "风险", size=12, color=COPPER, bold=True, spacing=1, after=0)
            add_text(slide, x + 0.14, risk_y + 0.32, risk_w - 0.24, risk_h - 0.4, risk, size=12, spacing=1.02, after=0)

    def patent(self, proposal, index):
        slide = self._slide(f"提案 {index}  ·  权利要求", proposal["patent_title"], _proposal_note(proposal, "patent"))
        patent = proposal["patent"]
        risk = patent["retrieval_risk"]
        banner_h = 0.9
        panel(slide, MARGIN_L, CONTENT_TOP, CONTENT_W, banner_h, RISK_FILL[risk], RISK_INK[risk])
        add_text(
            slide,
            MARGIN_L + 0.2,
            CONTENT_TOP + 0.08,
            CONTENT_W - 0.4,
            0.26,
            f"检索风险  ·  {risk}",
            size=13,
            color=RISK_INK[risk],
            bold=True,
            spacing=1,
            after=0,
        )
        add_text(slide, MARGIN_L + 0.2, CONTENT_TOP + 0.36, CONTENT_W - 0.4, 0.46, patent["retrieval_risk_reason"], size=14, color=INK, spacing=1.02, after=0)

        body_y = CONTENT_TOP + banner_h + GAP
        body_h = CONTENT_BOTTOM - body_y
        left_w = 7.35
        panel(slide, MARGIN_L, body_y, left_w, body_h, WHITE)
        add_text(slide, MARGIN_L + 0.16, body_y + 0.1, left_w - 0.3, 0.24, "独立权利要求骨架，非正式文本", size=12, color=TEAL, bold=True, spacing=1, after=0)
        add_text(slide, MARGIN_L + 0.16, body_y + 0.38, left_w - 0.32, 2.15, patent["independent_claim"].strip(), size=13, spacing=1.05, after=0)
        add_text(slide, MARGIN_L + 0.16, body_y + 2.6, left_w - 0.3, 0.24, "从属", size=12, color=TEAL, bold=True, spacing=1, after=0)
        add_text(
            slide,
            MARGIN_L + 0.16,
            body_y + 2.86,
            left_w - 0.32,
            body_h - 3.0,
            [f"–  {item}" for item in patent["dependents"]],
            size=13,
            spacing=1.02,
            after=3,
        )
        right_x = MARGIN_L + left_w + GAP
        right_w = MARGIN_R - right_x
        panel(slide, right_x, body_y, right_w, body_h, WHITE, COPPER)
        add_text(slide, right_x + 0.16, body_y + 0.1, right_w - 0.28, 0.24, "建议对比", size=12, color=TEAL, bold=True, spacing=1, after=0)
        add_text(
            slide,
            right_x + 0.16,
            body_y + 0.36,
            right_w - 0.28,
            1.35,
            [f"–  {item}" for item in patent["compare_with"]],
            size=12,
            spacing=1.0,
            after=2,
        )
        add_text(slide, right_x + 0.16, body_y + 1.75, right_w - 0.28, 0.24, "不要写进权利要求", size=12, color=COPPER, bold=True, spacing=1, after=0)
        add_text(
            slide,
            right_x + 0.16,
            body_y + 2.02,
            right_w - 0.28,
            1.45,
            [f"–  {item}" for item in patent["must_not_claim"]],
            size=12,
            spacing=1.0,
            after=2,
        )
        add_text(slide, right_x + 0.16, body_y + 3.5, right_w - 0.28, 0.22, "拿掉其他提案仍成立", size=12, color=TEAL, bold=True, spacing=1, after=0)
        add_text(slide, right_x + 0.16, body_y + 3.74, right_w - 0.28, body_h - 3.9, patent["standalone"], size=12, spacing=1.02, after=0)

    def family(self):
        slide = self._slide("专利族", self.deck["titles"]["family"], self._note("family"))
        family = self.deck["family"]
        principle_h = 0.95
        panel(slide, MARGIN_L, CONTENT_TOP, CONTENT_W, principle_h, WHITE, COPPER)
        add_text(slide, MARGIN_L + 0.2, CONTENT_TOP + 0.12, CONTENT_W - 0.4, principle_h - 0.2, family["principle"], size=16, anchor="middle", spacing=1.08, after=0)
        note_h = 1.15
        rules = family["rules"]
        rules_top = CONTENT_TOP + principle_h + GAP
        rules_bottom = CONTENT_BOTTOM - note_h - GAP
        row_h = (rules_bottom - rules_top - GAP * (len(rules) - 1)) / len(rules)
        for index, rule in enumerate(rules):
            y = rules_top + index * (row_h + GAP)
            rect(slide, MARGIN_L, y, CONTENT_W, row_h, WHITE)
            rect(slide, MARGIN_L, y, 0.48, row_h, TEAL)
            add_text(slide, MARGIN_L, y, 0.48, row_h, str(index + 1), size=16, color=WHITE, bold=True, align="center", anchor="middle", spacing=1, after=0)
            add_text(slide, MARGIN_L + 0.64, y, CONTENT_W - 0.8, row_h, rule, size=15, anchor="middle", spacing=1.05, after=0)
        note_y = CONTENT_BOTTOM - note_h
        panel(slide, MARGIN_L, note_y, CONTENT_W, note_h, COPPER_SOFT, COPPER)
        add_text(slide, MARGIN_L + 0.2, note_y + 0.1, 3, 0.22, "附图边界", size=12, color=COPPER, bold=True, spacing=1, after=0)
        add_text(slide, MARGIN_L + 0.2, note_y + 0.36, CONTENT_W - 0.4, note_h - 0.46, family["drawing_note"], size=14, spacing=1.05, after=0)

    def roadmap(self):
        slide = self._slide("验证顺序", self.deck["titles"]["roadmap"], self._note("roadmap"))
        steps = self.deck["roadmap"]
        card_w = (CONTENT_W - GAP * (len(steps) - 1)) / len(steps)
        for index, step in enumerate(steps):
            x = MARGIN_L + index * (card_w + GAP)
            rect(slide, x, CONTENT_TOP, card_w, CONTENT_H, WHITE)
            rect(slide, x, CONTENT_TOP, card_w, 0.1, COPPER if "检索" in step["phase"] + step["gate"] else TEAL)
            add_text(slide, x + 0.14, CONTENT_TOP + 0.24, card_w - 0.28, 0.3, f"0{index + 1}", size=14, color=COPPER, bold=True, spacing=1, after=0)
            add_text(slide, x + 0.14, CONTENT_TOP + 0.58, card_w - 0.28, 0.7, step["phase"], size=18, color=INK, bold=True, spacing=1.02, after=0)
            add_text(slide, x + 0.14, CONTENT_TOP + 1.4, card_w - 0.28, 2.5, step["work"], size=14, spacing=1.08, after=0)
            panel(slide, x + 0.12, CONTENT_BOTTOM - 1.45, card_w - 0.24, 1.28, TEAL_SOFT, TEAL)
            add_text(slide, x + 0.24, CONTENT_BOTTOM - 1.35, card_w - 0.46, 0.22, "关口", size=12, color=TEAL, bold=True, spacing=1, after=0)
            add_text(slide, x + 0.24, CONTENT_BOTTOM - 1.1, card_w - 0.46, 0.82, step["gate"], size=13, spacing=1.02, after=0)

    def decisions(self):
        slide = self._slide("评审决议", self.deck["titles"]["decisions"], self._note("decisions"))
        items = self.deck["decisions"]
        row_h = (CONTENT_H - GAP * (len(items) - 1)) / len(items)
        for index, item in enumerate(items):
            y = CONTENT_TOP + index * (row_h + GAP)
            rect(slide, MARGIN_L, y, CONTENT_W, row_h, WHITE)
            rect(slide, MARGIN_L, y, 0.7, row_h, COPPER)
            add_text(slide, MARGIN_L, y, 0.7, row_h, f"{index + 1:02d}", size=18, color=WHITE, bold=True, align="center", anchor="middle", spacing=1, after=0)
            add_text(slide, MARGIN_L + 0.9, y + 0.12, CONTENT_W - 1.1, 0.42, item["question"], size=16, color=INK, bold=True, spacing=1, after=0)
            add_text(slide, MARGIN_L + 0.9, y + 0.56, CONTENT_W - 1.1, row_h - 0.68, item["why"], size=14, color=MUTED, spacing=1.05, after=0)

    def appendix(self):
        slide = self._slide("不进入交底的方向", self.deck["titles"]["appendix"], self._note("appendix"))
        note_h = 1.85
        dropped = self.deck["dropped"]
        if dropped:
            area_h = CONTENT_H - note_h - GAP
            row_h = (area_h - GAP * (len(dropped) - 1)) / len(dropped)
            for index, item in enumerate(dropped):
                y = CONTENT_TOP + index * (row_h + GAP)
                rect(slide, MARGIN_L, y, CONTENT_W, row_h, WHITE)
                add_text(slide, MARGIN_L + 0.18, y + 0.08, CONTENT_W - 0.36, 0.32, item["idea"], size=16, color=INK, bold=True, spacing=1, after=0)
                add_text(slide, MARGIN_L + 0.18, y + 0.42, CONTENT_W - 0.36, row_h - 0.52, item["reason"], size=14, color=MUTED, spacing=1.02, after=0)
            note_y = CONTENT_BOTTOM - note_h
        else:
            note_y = CONTENT_TOP
            note_h = CONTENT_H
        panel(slide, MARGIN_L, note_y, CONTENT_W, note_h, TEAL_SOFT, TEAL)
        half = (CONTENT_W - 0.5) / 2
        add_text(slide, MARGIN_L + 0.2, note_y + 0.1, half, 0.24, "文件性质", size=12, color=TEAL, bold=True, spacing=1, after=0)
        add_text(slide, MARGIN_L + 0.2, note_y + 0.38, half, note_h - 0.5, self.deck["confidentiality"]["legal"], size=13, spacing=1.05, after=0)
        add_text(slide, MARGIN_L + 0.36 + half, note_y + 0.1, half, 0.24, "外发", size=12, color=COPPER, bold=True, spacing=1, after=0)
        add_text(
            slide,
            MARGIN_L + 0.36 + half,
            note_y + 0.38,
            half,
            note_h - 0.5,
            self.deck["confidentiality"]["supplier"],
            size=13,
            spacing=1.05,
            after=0,
        )

    def _stack_card(self, slide, x, y, w, h, label, lines):
        rect(slide, x, y, w, h, WHITE)
        add_text(slide, x + 0.16, y + 0.1, w - 0.32, 0.24, label, size=12, color=TEAL, bold=True, spacing=1, after=0)
        add_text(
            slide,
            x + 0.16,
            y + 0.38,
            w - 0.32,
            h - 0.5,
            lines if len(lines) == 1 else [f"–  {line}" for line in lines],
            size=13,
            spacing=1.02,
            after=3,
        )

    def _diagram(self, slide, x, y, w, h, diagram):
        rect(slide, x, y, w, h, WHITE)
        add_text(slide, x + 0.12, y + 0.08, w - 0.24, 0.4, diagram["caption"], size=12, color=TEAL, bold=True, spacing=1, after=0)
        note_h = 0.95
        paths = diagram["paths"]
        region_top = y + 0.52
        region_bottom = y + h - note_h - 0.1
        inner_gap = 0.1
        col_w = (w - 0.24 - inner_gap * (len(paths) - 1)) / len(paths)
        for index, path in enumerate(paths):
            tone = TEAL if path["tone"] == "stiff" else COPPER
            soft = TEAL_SOFT if path["tone"] == "stiff" else COPPER_SOFT
            cx = x + 0.12 + index * (col_w + inner_gap)
            add_text(slide, cx, region_top, col_w, 0.32, path["name"], size=13, color=tone, bold=True, align="center", spacing=1, after=0)
            steps = path["steps"]
            arrow_h = 0.2
            box_top = region_top + 0.36
            box_area = region_bottom - box_top
            box_h = min(0.62, (box_area - arrow_h * (len(steps) - 1)) / len(steps))
            for step_index, step in enumerate(steps):
                sy = box_top + step_index * (box_h + arrow_h)
                rect(slide, cx, sy, col_w, box_h, soft)
                add_text(slide, cx + 0.04, sy, col_w - 0.08, box_h, step, size=12, color=INK, align="center", anchor="middle", spacing=1, after=0)
                if step_index < len(steps) - 1:
                    add_text(slide, cx, sy + box_h, col_w, arrow_h, "↓", size=12, color=tone, align="center", anchor="middle", spacing=1, after=0)
        note_y = y + h - note_h
        add_text(slide, x + 0.12, note_y, w - 0.24, note_h - 0.08, diagram["note"], size=12, color=MUTED, spacing=1.02, after=0)


def _proposal_note(proposal, key):
    notes = proposal.get("notes") or {}
    return notes.get(key)
