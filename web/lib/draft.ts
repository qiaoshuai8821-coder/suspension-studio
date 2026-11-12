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
    return { ok: false, error: "再写具体一点：谁和谁连接，力或位移从哪走到哪。" };
  }
  if (text.length > 1500) {
    return { ok: false, error: "提示词请收在一千五百字以内。" };
  }
  if (text.includes("电池")) {
    return { ok: false, error: "电池不在悬架权限内。请只写悬架零件之间的关系。" };
  }
  const hit = banned.find((phrase) => text.includes(phrase));
  if (hit) {
    return { ok: false, error: `把「${hit}」换成具体的零件关系后再生成。` };
  }
  if (!structureWords.some((word) => text.includes(word))) {
    return { ok: false, error: "提示里还没有零件关系。写清控制臂、衬套、副车架、弹簧或安装孔里的至少一处。" };
  }

  const labeled = readLabeled(text);
  const structure = labeled.structure || text;
  const pieces = splitPieces(structure);
  if (pieces.length < 3) {
    return { ok: false, error: "再补两句结构：正常工况怎样，工况成立后力或位移走到哪，哪一组孔或毛坯保持不动。" };
  }

  const features = pieces.slice(0, 4).map((piece, index) => ({
    id: `F${index + 1}`,
    text: clip(piece, 72),
  }));
  const axle = text.includes("前悬") ? "前悬架" : "后悬架";
  const title = clip(labeled.title || features[0].text, 22);
  const problemTitle = clip(labeled.title || features[0].text, 28);
  const baseline = labeled.baseline || "基线没有把这段关系规定成结构。这一页按提示整理，不是实测结论。";
  const embodiments = twoEmbodiments(structure, features.map((feature) => feature.text).join(""));

  return {
    ok: true,
    draft: {
      title,
      axle,
      problemTitle,
      baseline: clip(baseline, 120),
      onlyThis: "这两页只整理提示里写下的结构关系。不解决提示里没有写到的接口。",
      features,
      embodiments,
      setup: "按提示里的工况装出结构，测量点名的部位。",
      criterion: "两种状态的差别和提示里写的关系一致。没有做过的限值保持待测。",
      claim: buildClaim(axle, features.map((feature) => feature.text)),
      riskReason: "未做检索。草案只保留提示里的结构关系，不判断是不是新的，也不判断值不值得申请。",
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
        name: "第一种结构",
        structure: clip(split[0], 90),
        difference: "相对第二种结构，连接关系按前半段提示直接实现。",
      },
      {
        name: "第二种结构",
        structure: clip(split[1], 90),
        difference: "相对第一种结构，差别落在后半段提示写出的零件上。",
      },
    ];
  }
  return [
    {
      name: "按提示的结构",
      structure: clip(joined, 90),
      difference: "相对可更换件方案，关系直接做在提示点名的零件上。",
    },
    {
      name: "可更换件",
      structure: "同一关系做在可更换件上，副车架毛坯和车身安装孔保持不动。",
      difference: "相对把关系做死在毛坯上，车型差别收在可更换件上。",
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
