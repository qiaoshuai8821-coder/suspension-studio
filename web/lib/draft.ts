export type Draft = {
  title: string;
  axle: string;
  problemTitle: string;
  baseline: string;
  onlyThis: string;
  features: { id: string; text: string }[];
  embodiments: { name: string; structure: string; difference: string }[];
  setup: string;
  criterion: string;
  claim: string;
  riskReason: string;
};

const banned = [
  "赋能",
  "极致",
  "颠覆式",
  "行业领先",
  "国际领先",
  "行业第一",
  "国际第一",
  "闭环生态",
  "保证授权",
  "肯定能授权",
  "具备创造性",
  "具有创造性",
];

const structureWords = ["衬套", "控制臂", "副车架", "弹簧", "缓冲", "硬点", "毛坯", "安装孔", "稳定杆", "转向节", "纵梁", "摆臂", "支架", "限位", "内点", "减振", "球头", "横臂"];

export function draftFromPrompt(prompt: string): { ok: true; draft: Draft } | { ok: false; error: string } {
  const text = prompt.replace(/\s+/g, " ").trim();
  if (text.length < 12) {
    return { ok: false, error: "再写具体些：谁和谁连，力或者位移从哪走到哪。" };
  }
  if (text.length > 2000) {
    return { ok: false, error: "太长了，请收在两千字以内。" };
  }
  if (text.includes("电池")) {
    return { ok: false, error: "电池不归我们改。请只写悬架零件之间怎么传力。" };
  }
  const hit = banned.find((phrase) => text.includes(phrase));
  if (hit) {
    return { ok: false, error: `先把「${hit}」换成具体的零件关系，再生成。` };
  }
  if (!structureWords.some((word) => text.includes(word))) {
    return { ok: false, error: "还没写到零件。控制臂、衬套、副车架、弹簧、安装孔，至少点出一个。" };
  }

  const labeled = readLabeled(text);
  const structure = labeled.structure || text;
  const pieces = splitPieces(structure);
  if (pieces.length < 3) {
    return { ok: false, error: "再补两句：平时什么样，到了那个工况力走到哪，哪组孔或毛坯不动。" };
  }

  const features = pieces.slice(0, 4).map((piece, index) => ({
    id: `F${index + 1}`,
    text: clip(piece, 72),
  }));
  const axle = text.includes("前悬") ? "前悬架" : "后悬架";
  const title = clip(labeled.title || features[0].text, 22);
  const problemTitle = clip(labeled.title || features[0].text, 28);
  const baseline = labeled.baseline || "现有结构还没把这段关系定下来。这一页按你的描述整理，不是实测结论。";
  const embodiments = twoEmbodiments(structure, features.map((feature) => feature.text).join(""));

  return {
    ok: true,
    draft: {
      title,
      axle,
      problemTitle,
      baseline: clip(baseline, 120),
      onlyThis: "这两页只写你提到的结构。你没写到的接口，这里不展开。",
      features,
      embodiments,
      setup: "按你写的工况把零件装出来，量你提到的部位。",
      criterion: "两种状态的差别，要和你写的关系一致。没做过试验的限值先空着。",
      claim: buildClaim(axle, features.map((feature) => feature.text)),
      riskReason: "还没检索。这里只保留你写的结构，不判断新不新，也不判断值不值得申请。",
    },
  };
}

function readLabeled(text: string) {
  const take = (label: string) => {
    const match = text.match(new RegExp(`${label}[:：]\\s*([^]*?)(?=(?:标题|桥|基线|结构)[:：]|$)`));
    return match?.[1]?.trim();
  };
  return {
    title: take("标题"),
    baseline: take("基线"),
    structure: take("结构"),
  };
}

function splitPieces(structure: string): string[] {
  const sentences = structure
    .split(/[。！？；;\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 6);
  if (sentences.length >= 3) return sentences;
  const commas = structure
    .split(/[，,、]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 6);
  return commas.length >= 3 ? commas : sentences;
}

function twoEmbodiments(structure: string, joined: string): Draft["embodiments"] {
  const split = structure.split(/或者|也可以|另一种/).map((part) => part.trim()).filter((part) => part.length >= 6);
  if (split.length >= 2) {
    return [
      {
        name: "第一种做法",
        structure: clip(split[0], 90),
        difference: "相对第二种做法，连接按你前半段写的来。",
      },
      {
        name: "第二种做法",
        structure: clip(split[1], 90),
        difference: "相对第一种做法，差别在你后半段写的零件上。",
      },
    ];
  }
  return [
    {
      name: "按你写的结构",
      structure: clip(joined, 90),
      difference: "相对可更换件，关系直接做在你写到的零件上。",
    },
    {
      name: "可更换件",
      structure: "同一套关系做在可更换件上，副车架毛坯和车身安装孔不动。",
      difference: "相对直接改毛坯，车型之间的差别放在可更换件上。",
    },
  ];
}

function buildClaim(axle: string, features: string[]): string {
  const body = features.map((feature) => feature.replace(/[。；;]+$/g, "")).join("；");
  return `一种乘用车${axle}结构，其特征在于，${body}。`;
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

const judgment = "这些方案具备写成独立权利要求的结构关系。是不是新的、值不值得申请，要检索之后才知道。";

export function acceptModelDraft(value: unknown): { ok: true; draft: Draft } | { ok: false; error: string } {
  const record = asRecord(value);
  if (!record) return { ok: false, error: "模型没有按约定的格式返回，请再生成一次。" };

  const axle = textOf(record.axle);
  if (axle !== "前悬架" && axle !== "后悬架" && axle !== "前后悬架") {
    return { ok: false, error: "模型没有写清是前悬还是后悬，请在提示里点明，再生成一次。" };
  }

  const features = asList(record.features)
    .map((item, index) => {
      const row = asRecord(item);
      return { id: `F${index + 1}`, text: clip(row ? textOf(row.text) : "", 72) };
    })
    .filter((item) => item.text.length >= 6)
    .slice(0, 4);
  if (features.length < 3) {
    return { ok: false, error: "模型没写出三条结构关系。把零件和想改的方向再写具体一点，然后重试。" };
  }

  const embodiments = asList(record.embodiments)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      let difference = clip(textOf(row.difference), 80);
      if (difference && !difference.includes("相对")) difference = `相对另一种做法，${difference}`;
      return {
        name: clip(textOf(row.name) || "一种做法", 16),
        structure: clip(textOf(row.structure), 90),
        difference,
      };
    })
    .filter((item): item is Draft["embodiments"][number] => Boolean(item && item.structure && item.difference))
    .slice(0, 2);
  if (embodiments.length < 2) {
    return { ok: false, error: "模型没写出两种可以对照的做法，请再生成一次。" };
  }

  const draft: Draft = {
    title: clip(textOf(record.title) || features[0].text, 22),
    axle,
    problemTitle: clip(textOf(record.problemTitle) || textOf(record.title), 28),
    baseline: clip(textOf(record.baseline), 120),
    onlyThis: clip(textOf(record.onlyThis) || "这两页只写提示里点到的零件和传力路径。", 110),
    features,
    embodiments,
    setup: clip(textOf(record.setup) || "按提示里的工况把零件装出来，量提示里点到的部位。", 80),
    criterion: clip(textOf(record.criterion) || "两种做法的差别要和上面的结构关系一致。没做过试验的限值先空着。", 80),
    claim: clip(textOf(record.claim) || buildClaim(axle, features.map((feature) => feature.text)), 180),
    riskReason: judgment,
  };

  const joined = JSON.stringify(draft);
  if (joined.includes("电池")) return { ok: false, error: "模型写到了电池。请只让它改悬架零件之间的传力。" };
  const hit = banned.find((phrase) => joined.includes(phrase));
  if (hit) return { ok: false, error: `模型用了「${hit}」。请再生成一次。` };
  if (!draft.baseline) return { ok: false, error: "模型没写出现在卡在哪，请再生成一次。" };
  return { ok: true, draft };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
