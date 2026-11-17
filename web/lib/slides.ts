import PptxGenJS from "pptxgenjs";

import type { Draft } from "./draft";

const font = "微软雅黑";
const ink = "1C2430";
const paper = "F7F4EE";
const white = "FFFFFF";
const line = "E3DCD0";
const teal = "1F4E5F";
const copper = "A85A32";
const muted = "5C6570";
const tealSoft = "E7EFF1";
const copperSoft = "F8EFE8";
const amber = "C98A2B";

const TOTAL_PAGES = 5;

export async function renderDraft(draft: Draft): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.author = "悬架创新工作台";
  pptx.title = draft.title;
  pptx.subject = draft.searched ? "完整创新提案，已联网检索" : "完整创新提案，未联网";

  slideOne(pptx, draft);
  slideTwo(pptx, draft);
  slideThree(pptx, draft);
  slideFour(pptx, draft);
  slideFive(pptx, draft);

  const output = await pptx.write({ outputType: "arraybuffer" });
  return new Uint8Array(output as ArrayBuffer);
}

// ===== 第1页：摘要与背景 =====
function slideOne(pptx: PptxGenJS, draft: Draft) {
  const slide = pptx.addSlide();
  slide.background = { color: paper };
  chrome(slide, `${draft.axle}  ·  摘要与背景`, draft.problemTitle, draft, 1);

  card(slide, 0.48, 1.2, 7.0, 5.55);
  label(slide, 0.68, 1.34, "现在卡在哪", teal);
  text(slide, 0.68, 1.7, 6.6, 1.8, draft.baseline, 16);
  label(slide, 0.68, 3.55, "改动边界", copper);
  text(slide, 0.68, 3.92, 6.6, 1.7, draft.onlyThis, 15);

  card(slide, 7.75, 1.2, 5.1, 3.35);
  label(slide, 7.95, 1.34, "一页看懂", teal);
  text(slide, 7.95, 1.72, 4.7, 2.7, draft.summary, 14);

  slide.addShape("rect", { x: 7.75, y: 4.72, w: 5.1, h: 2.03, fill: { color: tealSoft }, line: { color: teal } });
  label(slide, 7.95, 4.84, "风险等级", teal);
  text(slide, 7.95, 5.16, 4.7, 0.4, draft.riskLevel, 20, true, teal);
  text(slide, 7.95, 5.6, 4.7, 1.05, draft.riskReason, 12, false, muted);
}

// ===== 第2页：创新点与工作原理 =====
function slideTwo(pptx: PptxGenJS, draft: Draft) {
  const slide = pptx.addSlide();
  slide.background = { color: paper };
  chrome(slide, `${draft.axle}  ·  创新点与工作原理`, "核心发明点、区别特征与结构关系", draft, 2);

  card(slide, 0.48, 1.2, 5.9, 5.55);
  label(slide, 0.68, 1.32, "创新点", teal);
  draft.innovations.forEach((item, index) => {
    const y = 1.74 + index * 1.62;
    badge(slide, 0.68, y, item.id, copper);
    text(slide, 1.24, y - 0.04, 4.95, 0.7, item.point, 13, true);
    text(slide, 1.24, y + 0.62, 4.95, 0.85, item.distinction, 12, false, muted);
  });

  card(slide, 6.55, 1.2, 6.3, 4.0);
  label(slide, 6.75, 1.32, "结构关系", teal);
  draft.features.forEach((feature, index) => {
    const y = 1.74 + index * 0.82;
    badge(slide, 6.75, y, feature.id, teal);
    text(slide, 7.32, y - 0.05, 5.3, 0.72, feature.text, 12, false, ink);
  });

  slide.addShape("rect", { x: 6.55, y: 5.35, w: 6.3, h: 1.4, fill: { color: copperSoft }, line: { color: copper } });
  label(slide, 6.75, 5.46, "只动这些", copper);
  text(slide, 6.75, 5.8, 5.9, 0.85, draft.onlyThis, 12, false, ink);
}

// ===== 第3页：具体实施方式（含工作原理示意图） =====
function slideThree(pptx: PptxGenJS, draft: Draft) {
  const slide = pptx.addSlide();
  slide.background = { color: paper };
  chrome(slide, `${draft.axle}  ·  具体实施方式`, "怎么实现：原理、材料、加工、装配", draft, 3);

  principleDiagram(slide, 0.48, 1.16, 12.37);

  const impl = draft.implementation;
  const cells = [
    { head: "材料", body: impl.material },
    { head: "加工", body: impl.machining },
    { head: "装配", body: impl.assembly },
    { head: "尺寸公差", body: impl.tolerance },
  ];
  cells.forEach((cell, index) => {
    const x = 0.48 + index * 3.13;
    card(slide, x, 2.72, 2.98, 1.5);
    label(slide, x + 0.18, 2.84, cell.head, teal);
    text(slide, x + 0.18, 3.18, 2.62, 0.95, cell.body, 11, false, ink);
  });

  draft.embodiments.forEach((item, index) => {
    const x = 0.48 + index * 6.4;
    card(slide, x, 4.36, 6.22, 2.39);
    text(slide, x + 0.2, 4.5, 5.8, 0.34, item.name, 15, true);
    text(slide, x + 0.2, 4.9, 5.82, 1.0, item.structure, 12);
    text(slide, x + 0.2, 5.92, 5.82, 0.7, item.difference, 11, false, muted);
  });
}

// 滑槽销三状态示意图：小侧倾（前段）→ 过渡（滑动）→ 大侧倾（末端限位）
function principleDiagram(slide: PptxGenJS.Slide, x: number, y: number, w: number) {
  card(slide, x, y, w, 1.42);
  label(slide, x + 0.2, y + 0.12, "工作原理示意（非比例）", teal);

  const states = [
    { tag: "小侧倾：销在前段，杠杆比稳定", pinAt: 0.22, locked: false },
    { tag: "过渡：销沿长孔滑动", pinAt: 0.5, locked: false },
    { tag: "大侧倾：销贴限位面，刚性连接", pinAt: 0.78, locked: true },
  ];
  const colW = (w - 0.4) / 3;
  states.forEach((state, index) => {
    const colX = x + 0.2 + index * colW;
    const slotY = y + 0.62;
    // 滑槽
    slide.addShape("rect", {
      x: colX,
      y: slotY,
      w: colW - 0.5,
      h: 0.16,
      fill: { color: tealSoft },
      line: { color: teal, width: 0.75 },
    });
    // 末端限位面
    slide.addShape("rect", {
      x: colX + colW - 0.58,
      y: slotY - 0.06,
      w: 0.08,
      h: 0.28,
      fill: { color: state.locked ? copper : line },
      line: { color: state.locked ? copper : line },
    });
    // 销
    slide.addShape("ellipse", {
      x: colX + (colW - 0.5) * state.pinAt - 0.1,
      y: slotY - 0.07,
      w: 0.3,
      h: 0.3,
      fill: { color: state.locked ? copper : amber },
      line: { color: state.locked ? copper : amber },
    });
    text(slide, colX, y + 0.98, colW - 0.2, 0.36, state.tag, 10.5, state.locked, state.locked ? copper : ink);
  });
}

// ===== 第4页：检索与规避 =====
function slideFour(pptx: PptxGenJS, draft: Draft) {
  const slide = pptx.addSlide();
  slide.background = { color: paper };
  chrome(slide, `${draft.axle}  ·  检索与规避`, "专利/竞品来源、特征对比与规避设计", draft, 4);

  slide.addShape("rect", {
    x: 0.48,
    y: 1.16,
    w: 12.37,
    h: 0.5,
    fill: { color: draft.searched ? tealSoft : copperSoft },
    line: { color: draft.searched ? teal : copper },
  });
  text(slide, 0.68, 1.26, 11.9, 0.32, draft.searchNote, 12, true, draft.searched ? teal : copper);

  card(slide, 0.48, 1.82, 5.6, 4.93);
  label(slide, 0.68, 1.94, "检索来源", teal);
  if (draft.priorArt.length === 0) {
    text(slide, 0.68, 2.34, 5.2, 1.2, "本轮没有可列出的真实来源。正式立项前需在专利系统人工检索。", 12, false, muted);
  } else {
    draft.priorArt.slice(0, 5).forEach((item, index) => {
      const y = 2.32 + index * 0.86;
      badge(slide, 0.68, y, item.kind, item.kind.includes("专利") ? copper : teal, 0.9);
      text(slide, 1.66, y - 0.04, 4.25, 0.42, item.title, 11, true);
      text(slide, 1.66, y + 0.36, 4.25, 0.4, item.url, 9, false, muted);
    });
  }

  card(slide, 6.25, 1.82, 6.6, 2.95);
  label(slide, 6.45, 1.94, "特征对比 FTO", teal);
  text(slide, 10.7, 1.94, 2.0, 0.3, `风险：${draft.riskLevel}`, 12, true, copper);
  if (draft.claimChart.length === 0) {
    text(slide, 6.45, 2.36, 6.2, 0.9, "命中专利后在此逐项比对相同/等同/缺失。", 12, false, muted);
  } else {
    draft.claimChart.slice(0, 4).forEach((row, index) => {
      const y = 2.34 + index * 0.58;
      text(slide, 6.45, y, 3.0, 0.5, row.feature, 10.5, false, ink);
      text(slide, 9.5, y, 2.4, 0.5, row.ours, 10.5, false, muted);
      text(slide, 11.95, y, 0.75, 0.5, row.match, 10.5, true, matchColor(row.match));
    });
  }

  card(slide, 6.25, 4.9, 6.6, 1.85);
  label(slide, 6.45, 5.02, "规避设计", copper);
  if (draft.designAround.length === 0) {
    text(slide, 6.45, 5.4, 6.2, 1.0, "针对相同或等同特征改用不同结构，并相应改写权利要求。", 12, false, muted);
  } else {
    draft.designAround.slice(0, 2).forEach((item, index) => {
      const y = 5.4 + index * 0.66;
      text(slide, 6.45, y, 6.2, 0.3, `${item.risk} → ${item.alternative}`, 10.5, true);
      text(slide, 6.45, y + 0.3, 6.2, 0.3, item.claimChange, 10, false, muted);
    });
  }
}

// ===== 第5页：效益与验证 =====
function slideFive(pptx: PptxGenJS, draft: Draft) {
  const slide = pptx.addSlide();
  slide.background = { color: paper };
  chrome(slide, `${draft.axle}  ·  效益与验证`, "价值、验收与局限", draft, 5);

  const benefits = draft.benefits;
  const cells = [
    { head: "性能", body: benefits.performance },
    { head: "成本", body: benefits.cost },
    { head: "平台", body: benefits.platform },
    { head: "专利价值", body: benefits.patent },
  ];
  cells.forEach((cell, index) => {
    const x = 0.48 + index * 3.13;
    card(slide, x, 1.2, 2.98, 1.72);
    label(slide, x + 0.18, 1.32, cell.head, teal);
    text(slide, x + 0.18, 1.66, 2.62, 1.15, cell.body, 11, false, ink);
  });

  card(slide, 0.48, 3.08, 12.37, 1.68);
  label(slide, 0.68, 3.2, "验证方案", teal);
  text(slide, 0.68, 3.56, 11.9, 0.5, draft.setup, 12);
  text(slide, 0.68, 4.08, 11.9, 0.55, draft.criterion, 12, false, muted);

  slide.addShape("rect", { x: 0.48, y: 4.95, w: 12.37, h: 1.8, fill: { color: copperSoft }, line: { color: copper } });
  label(slide, 0.68, 5.07, "局限与免责", copper);
  text(slide, 0.68, 5.42, 11.9, 0.6, draft.risks, 12);
  text(slide, 0.68, 6.08, 11.9, 0.55, draft.disclaimer, 11.5, true, copper);
}

// ===== 通用辅助 =====
function chrome(
  slide: PptxGenJS.Slide,
  kicker: string,
  title: string,
  draft: Draft,
  page: number,
) {
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: teal }, line: { color: teal } });
  text(slide, 0.48, 0.16, 12.3, 0.28, kicker, 13, true, teal);
  text(slide, 0.48, 0.44, 12.3, 0.6, title, 24, true);
  slide.addShape("rect", { x: 0.48, y: 7.12, w: 12.37, h: 0.01, fill: { color: line }, line: { color: line } });

  const name = draft.title.length > 12 ? `${draft.title.slice(0, 11)}…` : draft.title;
  const status = draft.searched ? "已联网检索" : "未联网";
  text(slide, 0.48, 7.18, 9.8, 0.26, `${name}  ·  完整提案  ·  ${status}`, 11, false, muted);
  text(slide, 10.6, 7.18, 2.2, 0.26, `0${page}  /  0${TOTAL_PAGES}`, 11, false, muted, "right");
}

function card(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number) {
  slide.addShape("rect", { x, y, w, h, fill: { color: white }, line: { color: line, width: 0.75 } });
}

function label(slide: PptxGenJS.Slide, x: number, y: number, value: string, color: string) {
  text(slide, x, y, 6, 0.3, value, 13, true, color);
}

function badge(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  value: string,
  color: string,
  w = 0.5,
) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h: 0.32,
    fill: { color },
    line: { color },
    rectRadius: 0.04,
  });
  text(slide, x, y, w, 0.32, value, 9.5, true, white, "center", "middle");
}

function text(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  size: number,
  bold = false,
  color: string = ink,
  align: "left" | "center" | "right" = "left",
  valign: "top" | "middle" = "top",
) {
  slide.addText(value, {
    x,
    y,
    w,
    h,
    fontFace: font,
    fontSize: size,
    color,
    bold,
    align,
    valign,
    margin: 0,
    fit: "shrink",
  });
}

function matchColor(match: string): string {
  if (match === "相同") return copper;
  if (match === "等同") return amber;
  return teal;
}

