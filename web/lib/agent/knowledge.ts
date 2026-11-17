// 悬架领域本地知识库与检索函数。
// 现在用结构化数据 + 关键词打分做检索，保证零外部依赖即可运行；
// 后续可把这里的召回替换成向量数据库（embedding + 混合检索 + Rerank），
// 工具层和运行时不需要改动，这就是 RAG 的可插拔接口。

export type PartKnowledge = {
  part: string;
  aliases: string[];
  purpose: string;
  hardpoints: string[];
  conflicts: string[];
  variables: string[];
  failureModes: string[];
};

export type LoadPathRule = {
  condition: string;
  keywords: string[];
  path: string;
  focus: string[];
};

export type PriorCase = {
  title: string;
  keywords: string[];
  idea: string;
  note: string;
};

export const partKnowledge: PartKnowledge[] = [
  {
    part: "控制臂",
    aliases: ["摆臂", "下控制臂", "上控制臂", "横臂", "拖臂", "纵臂"],
    purpose: "决定车轮相对车身的运动轨迹，承担纵向与侧向力，并约束除设计自由度外的其他运动。",
    hardpoints: ["外点（球头）", "内点（前/后衬套）", "弹簧或减振器接座"],
    conflicts: [
      "内点衬套要同时兼顾纵向柔顺（隔振、冲击）与侧向定位刚度（操控、轮心侧向位移）",
      "轻量化与抗弯/抗扭刚度、局部耐久的矛盾",
      "极限轮跳行程与避免干涉、保留缓冲块压实行程的矛盾",
    ],
    variables: ["内点连线角度", "前后衬套刚度比", "臂体截面形状与壁厚", "球头位置", "材料与工艺（冲压/铸铝/锻铝）"],
    failureModes: ["衬套偏磨与蠕变", "焊缝或截面高应力区开裂", "球头松旷"],
  },
  {
    part: "稳定杆",
    aliases: ["防倾杆", "横向稳定杆", "sway bar"],
    purpose: "利用杆身扭转提供侧倾刚度，调节左右侧载荷转移，不显著影响单轮同向跳动的柔顺性。",
    hardpoints: ["两端连杆（拉杆）球头/衬套", "车身衬套固定点", "杆身弯曲形状"],
    conflicts: [
      "侧倾刚度需求与单侧冲击舒适性、底盘噪声的矛盾",
      "布置空间、避让传动轴/排气与杆身有效长度、杠杆比的矛盾",
    ],
    variables: ["杆径（扭转刚度近似随直径四次方变化）", "杠杆臂长度", "衬套刚度", "连杆角度", "杆身材质与空心/实心"],
    failureModes: ["衬套异响", "杆身高应力区疲劳断裂", "连杆球头磨损"],
  },
  {
    part: "衬套",
    aliases: ["橡胶衬套", "液压衬套", "轴套"],
    purpose: "在传递力的同时提供指定方向的柔顺性，过滤高频振动，并通过非线性刚度塑造整车 K&C 特性。",
    hardpoints: ["内管", "外管", "橡胶主簧", "（液压衬套）流道与解耦膜"],
    conflicts: [
      "静刚度（定位）与动刚度（隔振）、损耗因子的矛盾",
      "不同方向（径向/轴向/扭转）需要差异极大的刚度，单一橡胶结构难兼顾",
    ],
    variables: ["橡胶硬度与配方", "主簧形状与镂空", "预压缩量", "限位结构", "液压腔与流道设计"],
    failureModes: ["橡胶老化开裂", "永久变形与刚度漂移", "液压衬套漏油异响"],
  },
  {
    part: "副车架",
    aliases: ["元宝梁", "subframe"],
    purpose: "为悬架提供刚性安装基准，集中传力并通过衬套与车身解耦，兼顾隔离路噪与定位精度。",
    hardpoints: ["控制臂内点", "转向机安装点", "车身连接衬套", "稳定杆固定点"],
    conflicts: [
      "车身衬套大刚度（精准、路感）与小刚度（隔振、舒适性）的矛盾",
      "整体刚度、模态频率与轻量化、成本的矛盾",
    ],
    variables: ["车身衬套刚度与位置", "腔体截面与加强筋", "材料（钢/铝）与工艺", "质量分配"],
    failureModes: ["衬套蠕变", "安装点局部应力集中开裂", "模态耦合引起共振"],
  },
  {
    part: "转向节",
    aliases: ["羊角", "upright", "hub carrier"],
    purpose: "连接控制臂、转向拉杆、轮毂与制动，是多力交汇的关键承力件，直接决定前轮定位与转向几何。",
    hardpoints: ["球头连接点", "转向拉杆外点", "轮毂轴承", "卡钳安装点"],
    conflicts: ["多硬点空间紧凑与刚度、装配可达性的矛盾", "簧下质量轻量化与高强度耐久的矛盾"],
    variables: ["硬点坐标", "材料工艺（铸/锻）", "截面与加强筋", "轴承配合"],
    failureModes: ["高应力区开裂", "轴承位磨损", "球头座变形"],
  },
  {
    part: "弹簧与缓冲块",
    aliases: ["螺旋弹簧", "缓冲块", "jounce bumper", "弹簧"],
    purpose: "弹簧承载并决定垂向弹性，缓冲块在极限行程提供递增刚度并限制金属撞击。",
    hardpoints: ["弹簧上下座", "缓冲块安装位置", "减振器活塞杆"],
    conflicts: ["标称行程舒适性与极限行程保护、避免打底的矛盾", "弹簧刚度与质量、并圈/并圈冲击的矛盾"],
    variables: ["弹簧刚度与自由长度", "缓冲块发泡曲线与形状", "预紧与限位", "减振器阻尼匹配"],
    failureModes: ["缓冲块压实后冲击", "弹簧疲劳松弛", "干涉异响"],
  },
];

export const loadPathRules: LoadPathRule[] = [
  {
    condition: "极限轮跳（上跳末端）",
    keywords: ["轮跳", "上跳", "缓冲块", "压实", "行程", "打底"],
    path: "车轮—球头—控制臂—内点衬套—副车架—车身；缓冲块压实后出现额外的活塞杆/车身传力路径。",
    focus: ["内点衬套的极限偏扭", "缓冲块递增刚度", "是否存在把冲击绕开衬套导入纵梁的路径"],
  },
  {
    condition: "侧向/侧倾工况",
    keywords: ["侧倾", "侧向", "过弯", "稳定杆", "横向力", "载荷转移"],
    path: "轮胎侧向力—转向节—球头—控制臂—内点衬套—副车架；左右侧差通过稳定杆扭转载荷转移。",
    focus: ["内点衬套侧向刚度", "稳定杆杠杆比与杆径", "轮心侧向位移与外倾变化"],
  },
  {
    condition: "纵向制动/驱动工况",
    keywords: ["制动", "驱动", "纵向", "刹车", "启动", "冲击"],
    path: "纵向力—球头—控制臂—前/后内点衬套（按刚度比分配）—副车架—车身。",
    focus: ["内点前后衬套纵向刚度分配", "纵向柔顺与抗制动点头", "冲击隔离"],
  },
];

export const priorCases: PriorCase[] = [
  {
    title: "极限轮跳的额外传力路径",
    keywords: ["轮跳", "缓冲块", "传力路径", "纵梁", "衬套"],
    idea: "在缓冲块压实后，通过独立支架/转接件把冲击导入刚度更高的纵梁，绕开对内点衬套的极限偏扭。",
    note: "演示案例，非真实专利数据；落地需校核干涉、耐久与车身安装孔是否保持固定。",
  },
  {
    title: "分离式内点（解耦纵/侧向刚度）",
    keywords: ["内点", "衬套", "刚度", "解耦", "控制臂"],
    idea: "把控制臂内点拆成独立的纵向与侧向连接点，分别匹配软衬套（隔振）与硬定位（操控）。",
    note: "演示案例；需重新规划硬点与运动学，评估对 K&C 的影响。",
  },
  {
    title: "可更换件实现平台差异化",
    keywords: ["可更换", "平台", "转接板", "毛坯", "安装孔"],
    idea: "副车架毛坯与车身安装孔保持不变，把车型差异做在可更换的转接件/衬套座上，提升平台复用。",
    note: "演示案例；需评估重复定位精度与连接件耐久。",
  },
  {
    title: "稳定杆连杆角度与杠杆比优化",
    keywords: ["稳定杆", "连杆", "杠杆比", "侧倾", "拉杆"],
    idea: "调整连杆角度与有效杠杆长度，在不改变杆径的前提下重塑侧倾刚度并减小单侧冲击。",
    note: "演示案例；需做全行程运动校核避免连杆弯折。",
  },
];

// 统计查询文本命中关键词的数量，作为简单相关性打分。
function score(query: string, keywords: string[]): number {
  const text = query.toLowerCase();
  return keywords.reduce((total, keyword) => {
    const key = keyword.toLowerCase();
    return total + (text.includes(key) ? 1 : 0);
  }, 0);
}

function unique<T>(list: T[]): T[] {
  return Array.from(new Set(list));
}

// 召回与查询最相关的部件知识；命中多个时合并返回。
export function recallKnowledge(query: string): string {
  const ranked = partKnowledge
    .map((item) => ({
      item,
      score: score(query, [item.part, ...item.aliases, ...item.hardpoints]),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return "没有定位到具体部件。请在提示中点名控制臂、稳定杆、衬套、副车架、转向节或弹簧等零件。";
  }

  return ranked
    .slice(0, 2)
    .map(({ item }) =>
      [
        `部件：${item.part}（${item.aliases.join("、")}）`,
        `功能：${item.purpose}`,
        `关键硬点：${item.hardpoints.join("、")}`,
        `常见设计矛盾：${item.conflicts.join("；")}`,
        `可调节设计变量：${item.variables.join("、")}`,
        `失效模式：${item.failureModes.join("、")}`,
      ].join("\n"),
    )
    .join("\n\n");
}

export function analyzeLoadPath(query: string): string {
  const ranked = loadPathRules
    .map((rule) => ({ rule, score: score(query, rule.keywords) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return "没有匹配到明确工况。可说明是极限轮跳、侧倾过弯还是制动/驱动，以便分析力流。";
  }

  return ranked
    .slice(0, 2)
    .map(({ rule }) =>
      [`工况：${rule.condition}`, `传力路径：${rule.path}`, `关注点：${unique(rule.focus).join("；")}`].join("\n"),
    )
    .join("\n\n");
}

export function searchPriorArt(query: string): string {
  const ranked = priorCases
    .map((item) => ({ item, score: score(query, item.keywords) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return "案例库中没有匹配的已知做法。可作为全新方向处理，但仍需正式专利检索才能判断新颖性。";
  }

  return ranked
    .slice(0, 3)
    .map(({ item }) => [`参考方向：${item.title}`, `思路：${item.idea}`, `说明：${item.note}`].join("\n"))
    .join("\n\n");
}
