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

export async function renderDraft(draft: Draft): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.author = "悬架创新工作台";
  pptx.title = draft.title;
  pptx.subject = "内部讨论稿，还没检索";

  issueSlide(pptx, draft);
  practiceSlide(pptx, draft);

  const output = await pptx.write({ outputType: "arraybuffer" });
  return new Uint8Array(output as ArrayBuffer);
}

function issueSlide(pptx: PptxGenJS, draft: Draft) {
  const slide = pptx.addSlide();
  slide.background = { color: paper };
  chrome(slide, `${draft.axle}  ·  问题和结构`, draft.problemTitle, draft.title, 1);
  card(slide, 0.48, 1.22, 7.15, 5.55);
  text(slide, 0.68, 1.38, 6.75, 0.32, "现在卡在哪", { size: 13, color: teal, bold: true });
  text(slide, 0.68, 1.74, 6.75, 1.7, draft.baseline, { size: 16 });
  text(slide, 0.68, 3.6, 6.75, 0.32, "这两页只讲这件事", { size: 13, color: copper, bold: true });
  text(slide, 0.68, 3.96, 6.75, 1.5, draft.onlyThis, { size: 16 });

  card(slide, 7.75, 1.22, 5.1, 4.15);
  text(slide, 7.92, 1.34, 4.76, 0.3, "必须保住的结构", { size: 13, color: teal, bold: true });
  draft.features.forEach((feature, index) => {
    const y = 1.76 + index * 0.86;
    slide.addShape("roundRect", {
      x: 7.92,
      y,
      w: 0.46,
      h: 0.34,
      fill: { color: copper },
      line: { color: copper },
      rectRadius: 0.04,
    });
    text(slide, 7.92, y, 0.46, 0.34, feature.id, { size: 12, color: white, bold: true, align: "center", valign: "middle" });
    text(slide, 8.48, y - 0.06, 4.15, 0.78, feature.text, { size: 13, valign: "middle" });
  });
  slide.addShape("rect", {
    x: 7.75,
    y: 5.49,
    w: 5.1,
    h: 1.28,
    fill: { color: tealSoft },
    line: { color: teal },
  });
  text(slide, 7.92, 5.58, 4.76, 0.28, "检索风险  ·  中", { size: 13, color: teal, bold: true });
  text(slide, 7.92, 5.9, 4.76, 0.74, draft.riskReason, { size: 12 });
}

function practiceSlide(pptx: PptxGenJS, draft: Draft) {
  const slide = pptx.addSlide();
  slide.background = { color: paper };
  chrome(slide, `${draft.axle}  ·  怎么做、怎么判断`, "两种做法，对照的是同一组关系", draft.title, 2);
  draft.embodiments.forEach((item, index) => {
    const x = 0.48 + index * 6.4;
    card(slide, x, 1.22, 6.22, 2.05);
    text(slide, x + 0.18, 1.32, 5.86, 0.32, item.name, { size: 16, bold: true });
    text(slide, x + 0.18, 1.68, 5.86, 0.78, item.structure, { size: 13 });
    text(slide, x + 0.18, 2.5, 5.86, 0.62, item.difference, { size: 12, color: muted });
  });
  slide.addShape("rect", {
    x: 0.48,
    y: 3.4,
    w: 12.37,
    h: 1.45,
    fill: { color: white },
    line: { color: teal, width: 1.25 },
  });
  text(slide, 0.68, 3.5, 12, 0.28, "怎样算做成了", { size: 13, color: teal, bold: true });
  text(slide, 0.68, 3.82, 12, 0.4, draft.setup, { size: 14 });
  text(slide, 0.68, 4.24, 12, 0.46, draft.criterion, { size: 14 });
  slide.addShape("rect", {
    x: 0.48,
    y: 4.98,
    w: 12.37,
    h: 1.78,
    fill: { color: copperSoft },
    line: { color: copper, width: 1.25 },
  });
  text(slide, 0.68, 5.08, 12, 0.28, "权利要求先落在这些关系上，这还不是正式文本", { size: 13, color: copper, bold: true });
  text(slide, 0.68, 5.4, 12, 1.2, draft.claim, { size: 13 });
}

function chrome(slide: PptxGenJS.Slide, kicker: string, title: string, shortName: string, page: number) {
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: teal }, line: { color: teal } });
  text(slide, 0.48, 0.16, 12.3, 0.28, kicker, { size: 13, color: teal, bold: true });
  text(slide, 0.48, 0.44, 12.3, 0.62, title, { size: 26, bold: true });
  slide.addShape("rect", { x: 0.48, y: 7.12, w: 12.37, h: 0.01, fill: { color: line }, line: { color: line } });
  const name = shortName.length > 12 ? `${shortName.slice(0, 11)}…` : shortName;
  text(slide, 0.48, 7.18, 9.8, 0.26, `${name}  ·  内部讨论稿  ·  还没检索`, {
    size: 11,
    color: muted,
  });
  text(slide, 10.6, 7.18, 2.2, 0.26, `0${page}  /  02`, { size: 11, color: muted, align: "right" });
}

function card(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number) {
  slide.addShape("rect", { x, y, w, h, fill: { color: white }, line: { color: line, width: 0.75 } });
}

function text(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  options: { size: number; color?: string; bold?: boolean; align?: "left" | "center" | "right"; valign?: "top" | "middle" },
) {
  slide.addText(value, {
    x,
    y,
    w,
    h,
    fontFace: font,
    fontSize: options.size,
    color: options.color ?? ink,
    bold: options.bold,
    align: options.align ?? "left",
    valign: options.valign ?? "top",
    margin: 0,
    fit: "shrink",
  });
}
