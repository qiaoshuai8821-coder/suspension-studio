// 完整创新提案的数据契约与本地整理逻辑。
// 无 Key 时用本地规则整理、新字段以"待验证/待检索"兜底，不编造数据；
// acceptModelDraft 对模型结果做宽松收敛（核心 features 仍强制 ≥3），
// 事实性来源与检索状态最终由 route 层用真实 evidence 覆盖。

export type PriorArtItem = {
  title: string;
  kind: string;
  source: string;
  url: string;
  relevance: string;
};

export type ClaimRow = {
  feature: string;
  ours: string;
  match: string;
};

export type DesignAroundItem = {
  risk: string;
  alternative: string;
  claimChange: string;
};

export type Benefits = {
  performance: string;
  cost: string;
  platform: string;
  patent: string;
};

export type Implementation = {
  material: string;
  machining: string;
  assembly: string;
  tolerance: string;
};

export type Draft = {
  title: string;
  axle: string;
  problemTitle: string;
  baseline: string;
  summary: string;
  onlyThis: string;
  innovations: { id: string; point: string; distinction: string }[];
  features: { id: string; text: string }[];
  implementation: Implementation;
  embodiments: { name: string; structure: string; difference: string }[];
  searched: boolean;
  searchNote: string;
  priorArt: PriorArtItem[];
  claimChart: ClaimRow[];
  riskLevel: string;
  designAround: DesignAroundItem[];
  benefits: Benefits;
  setup: string;
  criterion: string;
  claim: string;
  risks: string;
  disclaimer: string;
  riskReason: string;
};

const DISCLAIMER = "本提案的检索与 FTO 结论为工程初判，非正式法律意见，需由专利律师复核。";

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
  const baseline = clip(
    labeled.baseline || "现有结构还没把这段关系定下来。这一页按你的描述整理，不是实测结论。",
    120,
  );
  const embodiments = twoEmbodiments(structure, features.map((feature) => feature.text).join(""));

  const draft: Draft = {
    title,
    axle,
    problemTitle,
    baseline,
    summary: clip(`${problemTitle}。${baseline} 具体做法与预期收益待验证。`, 160),
    onlyThis: clip("这份提案只写你提到的结构。你没写到的接口，这里不展开。", 110),
    innovations: localInnovations(features),
    features,
    implementation: localImplementation(),
    embodiments,
    searched: false,
    searchNote: "未联网：这是本地整理结果。填 DeepSeek Key 后可联网检索专利与竞品。",
    priorArt: [],
    claimChart: [],
    riskLevel: "待复核",
    designAround: [],
    benefits: localBenefits(),
    setup: "按你写的工况把零件装出来，量你提到的部位；具体加载限值待试验。",
    criterion: "两种状态的差别要和你写的关系一致。没做过试验的限值先空着。",
    claim: buildClaim(axle, features.map((feature) => feature.text)),
    risks: "本地结果未联网、未做强度与运动校核，存在与现有专利重叠或结构干涉的可能。",
    disclaimer: DISCLAIMER,
    riskReason: "还没检索，不判断新不新，也不判断值不值得申请，需联网后再评估。",
  };

  return { ok: true, draft };
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

// ===== 本地（无 Key）默认值，统一用待验证措辞，避免看起来像实测结论 =====

function localInnovations(features: { id: string; text: string }[]): Draft["innovations"] {
  return features.slice(0, 3).map((feature, index) => ({
    id: `I${index + 1}`,
    point: feature.text,
    distinction: "与现有固定结构的区别待联网检索后确认。",
  }));
}

function localImplementation(): Implementation {
  return {
    material: "承力件优先沿用现有冲压钢或铸铝，材料与热处理待强度校核后定。",
    machining: "滑槽与限位面在现有支架上铣削加工，优先避免新增模具。",
    assembly: "沿用现有装配顺序，销与滑槽配合后按原扭矩紧固，不增加专用工装。",
    tolerance: "滑槽与销的配合间隙、限位面角度待运动校核后给公差。",
  };
}

function localBenefits(): Benefits {
  return {
    performance: "目标工况的刚度递增与峰值力矩变化待仿真和台架验证，不写具体数值。",
    cost: "改动集中在少量零件，可更换件有助于降低售后成本，具体节省待 BOM 对比。",
    platform: "车身安装孔与硬点保持不变，有利于平台复用，适配范围待评估。",
    patent: "结构关系具备写权利要求的基础，是否可申请需检索后判断。",
  };
}

// ===== 模型结果的宽松收敛 =====

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

  const title = clip(textOf(record.title) || features[0].text, 22);
  const problemTitle = clip(textOf(record.problemTitle) || textOf(record.title) || features[0].text, 28);
  const baseline = textOf(record.baseline);
  if (!baseline) return { ok: false, error: "模型没写出现在卡在哪，请再生成一次。" };

  const draft: Draft = {
    title,
    axle,
    problemTitle,
    baseline: clip(baseline, 120),
    summary: clip(textOf(record.summary) || `${problemTitle}。${baseline}`, 160),
    onlyThis: clip(textOf(record.onlyThis) || "这份提案只写提示里点到的零件和传力路径。", 110),
    innovations: parseInnovations(record.innovations, features),
    features,
    implementation: parseImplementation(record.implementation),
    embodiments: parseEmbodiments(record.embodiments, features),
    // 检索状态与来源先给默认，route 层会用真实 evidence 覆盖。
    searched: false,
    searchNote: "",
    priorArt: parsePriorArt(record.priorArt),
    claimChart: parseClaimChart(record.claimChart),
    riskLevel: normalizeLevel(textOf(record.riskLevel)),
    designAround: parseDesignAround(record.designAround),
    benefits: parseBenefits(record.benefits),
    setup: clip(textOf(record.setup) || "按提示里的工况把零件装出来，量提示里点到的部位。", 110),
    criterion: clip(textOf(record.criterion) || "两种做法的差别要和上面的结构关系一致，限值先空着。", 110),
    claim: clip(textOf(record.claim) || buildClaim(axle, features.map((feature) => feature.text)), 220),
    risks: clip(textOf(record.risks) || "需补做强度、运动校核与正式专利检索。", 140),
    disclaimer: DISCLAIMER,
    riskReason: clip(textOf(record.riskReason) || "风险等级与可专利性需结合检索结果复核。", 140),
  };

  const joined = JSON.stringify(draft);
  if (joined.includes("电池")) return { ok: false, error: "模型写到了电池。请只让它改悬架零件之间的传力。" };
  const hit = banned.find((phrase) => joined.includes(phrase));
  if (hit) return { ok: false, error: `模型用了「${hit}」。请再生成一次。` };
  return { ok: true, draft };
}

function parseInnovations(
  value: unknown,
  features: { id: string; text: string }[],
): Draft["innovations"] {
  const rows = asList(value)
    .map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const point = textOf(row.point);
      if (!point) return null;
      return {
        id: `I${index + 1}`,
        point: clip(point, 70),
        distinction: clip(textOf(row.distinction) || "区别特征待检索确认。", 70),
      };
    })
    .filter((item): item is Draft["innovations"][number] => Boolean(item))
    .slice(0, 3);
  if (rows.length > 0) return rows;
  return localInnovations(features);
}

function parseImplementation(value: unknown): Implementation {
  const row = asRecord(value);
  const fallback = localImplementation();
  if (!row) return fallback;
  return {
    material: clip(textOf(row.material) || fallback.material, 110),
    machining: clip(textOf(row.machining) || fallback.machining, 110),
    assembly: clip(textOf(row.assembly) || fallback.assembly, 110),
    tolerance: clip(textOf(row.tolerance) || fallback.tolerance, 110),
  };
}

function parseEmbodiments(
  value: unknown,
  features: { id: string; text: string }[],
): Draft["embodiments"] {
  const rows = asList(value)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const structure = textOf(row.structure);
      if (!structure) return null;
      let difference = clip(textOf(row.difference), 80);
      if (difference && !difference.includes("相对")) difference = `相对另一种做法，${difference}`;
      return {
        name: clip(textOf(row.name) || "一种做法", 16),
        structure: clip(structure, 90),
        difference: difference || "相对另一种做法，差别待补充。",
      };
    })
    .filter((item): item is Draft["embodiments"][number] => Boolean(item))
    .slice(0, 2);
  if (rows.length >= 2) return rows;
  const local = twoEmbodiments("", features.map((feature) => feature.text).join(""));
  return rows.length === 1 ? [rows[0], local[1]] : local;
}

function parsePriorArt(value: unknown): PriorArtItem[] {
  return asList(value)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const title = textOf(row.title);
      const url = textOf(row.url);
      if (!title) return null;
      return {
        title: clip(title, 70),
        kind: clip(textOf(row.kind) || "资料", 16),
        source: clip(textOf(row.source) || "", 30),
        url,
        relevance: clip(textOf(row.relevance) || textOf(row.snippet) || "", 110),
      };
    })
    .filter((item): item is PriorArtItem => Boolean(item))
    .slice(0, 8);
}

function parseClaimChart(value: unknown): ClaimRow[] {
  return asList(value)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const feature = textOf(row.feature);
      if (!feature) return null;
      return {
        feature: clip(feature, 60),
        ours: clip(textOf(row.ours), 60),
        match: normalizeMatch(textOf(row.match)),
      };
    })
    .filter((item): item is ClaimRow => Boolean(item))
    .slice(0, 6);
}

function parseDesignAround(value: unknown): DesignAroundItem[] {
  return asList(value)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const risk = textOf(row.risk);
      const alternative = textOf(row.alternative);
      if (!risk || !alternative) return null;
      return {
        risk: clip(risk, 60),
        alternative: clip(alternative, 80),
        claimChange: clip(textOf(row.claimChange) || "权利要求相应改写。", 80),
      };
    })
    .filter((item): item is DesignAroundItem => Boolean(item))
    .slice(0, 4);
}

function parseBenefits(value: unknown): Benefits {
  const row = asRecord(value);
  const fallback = localBenefits();
  if (!row) return fallback;
  return {
    performance: clip(textOf(row.performance) || fallback.performance, 110),
    cost: clip(textOf(row.cost) || fallback.cost, 110),
    platform: clip(textOf(row.platform) || fallback.platform, 110),
    patent: clip(textOf(row.patent) || fallback.patent, 110),
  };
}

function normalizeLevel(value: string): string {
  return value === "高" || value === "中" || value === "低" ? value : "待复核";
}

function normalizeMatch(value: string): string {
  return value === "相同" || value === "等同" || value === "缺失" ? value : "待复核";
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

