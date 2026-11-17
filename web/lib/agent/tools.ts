// 工具层：声明 OpenAI 风格的工具 schema，并提供统一执行器。
// 运行时拿到模型返回的 tool_calls 后，调用 executeTool 在后端执行，
// 模型本身不直接接触密钥或外部系统。

import { analyzeLoadPath, recallKnowledge, searchPriorArt } from "./knowledge";
import type { ToolResult, ToolSchema } from "./types";

export const toolSchemas: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "recall_domain_knowledge",
      description: "查询悬架部件的功能、关键硬点、常见设计矛盾、可调节设计变量与失效模式。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "部件名或关注点，例如：控制臂内点衬套、稳定杆杆径、液压衬套。",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_load_path",
      description: "分析指定工况下零件之间的传力路径和需要重点关注的衬套、硬点。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "工况描述，例如：极限轮跳缓冲块压实、侧倾过弯、制动纵向力。",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_prior_art",
      description: "检索可对标的已知做法与案例。返回的是演示数据，不是真实专利检索结果。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "要找的结构或关键词，例如：额外传力路径、内点解耦、可更换转接件。",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_claim",
      description: "根据部位和结构关系，生成专利独立权利要求的句式草稿。",
      parameters: {
        type: "object",
        properties: {
          axle: {
            type: "string",
            description: "前悬架、后悬架或前后悬架。",
          },
          features: {
            type: "array",
            description: "结构关系要点列表，每条写清谁和谁连。",
            items: { type: "string" },
          },
        },
        required: ["axle", "features"],
        additionalProperties: false,
      },
    },
  },
];

// 生成权利要求句式，保持与旧 buildClaim 一致的口径。
function buildClaim(axle: string, features: string[]): string {
  const body = features
    .map((feature) => String(feature).replace(/[。；;]+$/g, "").trim())
    .filter(Boolean)
    .join("；");
  return `一种乘用车${axle}结构，其特征在于，${body}。`;
}

// 从模型给出的 JSON 字符串里安全地取参数。
function parseArgs(argsJson: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(argsJson || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

// 统一执行入口。任何工具内部异常都被收敛成 ok=false，不让循环整体崩溃。
export async function executeTool(name: string, argsJson: string): Promise<ToolResult> {
  const args = parseArgs(argsJson);
  try {
    switch (name) {
      case "recall_domain_knowledge":
        return { ok: true, output: recallKnowledge(asString(args.query)) };
      case "analyze_load_path":
        return { ok: true, output: analyzeLoadPath(asString(args.query)) };
      case "search_prior_art":
        return { ok: true, output: searchPriorArt(asString(args.query)) };
      case "draft_claim": {
        const axle = asString(args.axle) || "后悬架";
        const features = asStringList(args.features);
        if (features.length === 0) {
          return { ok: false, output: "draft_claim 需要至少一条结构关系 features。" };
        }
        return { ok: true, output: buildClaim(axle, features) };
      }
      default:
        return { ok: false, output: `未知工具：${name}` };
    }
  } catch (error) {
    return {
      ok: false,
      output: `工具 ${name} 执行失败：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}
