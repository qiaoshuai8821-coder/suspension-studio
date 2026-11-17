// 工具层：声明 OpenAI 风格的工具 schema，并提供统一执行器。
// 运行时拿到模型返回的 tool_calls 后，调用 executeTool 在后端执行，
// 模型本身不直接接触密钥或外部系统。search_prior_art 走真实联网，
// 失败或当前厂商不支持时自动降级到本地演示数据。

import { analyzeLoadPath, recallKnowledge, searchPriorArt } from "./knowledge";
import { webSearch, type SearchHit } from "./search-client";
import type {
  PriorArtItem,
  ToolContext,
  ToolResult,
  ToolSchema,
} from "./types";

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
      description: "联网检索专利与竞品已知做法。命中结果含真实来源链接；当前厂商不支持联网时回退本地案例。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "要找的结构或关键词，例如：稳定杆连杆滑槽、内点解耦、可更换转接件。",
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

function classify(hit: SearchHit): string {
  return hit.url.includes("patents.google.com") ? "专利" : "竞品/技术资料";
}

// 把真实命中结果渲染成给模型阅读的观察文本，保留真实链接，禁止模型改写。
function formatForModel(items: PriorArtItem[]): string {
  const lines = items.map((item, index) =>
    [
      `[${index + 1}]（${item.kind}）${item.title}`,
      `来源：${item.source}`,
      `链接：${item.url}`,
      `要点：${item.relevance}`,
    ].join("\n"),
  );
  return `以下是联网检索到的真实来源，引用时必须原样保留链接，不要编造没有的条目：\n${lines.join("\n")}`;
}

// 真实联网检索：分别发专利（站点限定）与通用（竞品/资料）两组查询。
// 任何一组失败都不影响另一组；全部失败则抛错，由上层降级。
async function retrievePriorArt(ctx: ToolContext, query: string): Promise<string> {
  const patentQuery = `${query} site:patents.google.com lang:zh`;
  const generalQuery = `${query} 悬架 lang:zh`;

  const [patentHits, generalHits] = await Promise.all([
    webSearch(ctx.chatUrl, ctx.apiKey, patentQuery, 5).catch((): SearchHit[] => []),
    webSearch(ctx.chatUrl, ctx.apiKey, generalQuery, 5).catch((): SearchHit[] => []),
  ]);

  const items: PriorArtItem[] = [];
  const seen = new Set<string>();
  const push = (hit: SearchHit): void => {
    if (!hit.url || seen.has(hit.url)) return;
    seen.add(hit.url);
    items.push({
      title: hit.title,
      kind: classify(hit),
      source: hit.siteName || (hit.url.includes("patents.google.com") ? "Google Patents" : "网页"),
      url: hit.url,
      relevance: hit.summary || hit.snippet,
    });
  };

  patentHits.forEach(push);
  generalHits.forEach(push);

  const trimmed = items.slice(0, 8);
  if (trimmed.length === 0) {
    throw new Error("联网检索没有命中可用结果");
  }
  ctx.evidence.push(...trimmed);
  return formatForModel(trimmed);
}

// 统一执行入口。任何工具内部异常都被收敛成 ok=false，不让循环整体崩溃。
export async function executeTool(
  name: string,
  argsJson: string,
  ctx: ToolContext,
): Promise<ToolResult> {
  const parsedArgs = parseArgs(argsJson);
  try {
    switch (name) {
      case "recall_domain_knowledge":
        return { ok: true, output: recallKnowledge(asString(parsedArgs.query)) };
      case "analyze_load_path":
        return { ok: true, output: analyzeLoadPath(asString(parsedArgs.query)) };
      case "search_prior_art":
        // 第一版只对 DeepSeek 开启真实联网；其他厂商或无 Key 直接用本地案例。
        if (ctx.providerId === "deepseek" && ctx.apiKey) {
          try {
            return { ok: true, output: await retrievePriorArt(ctx, asString(parsedArgs.query)) };
          } catch {
            return { ok: true, output: searchPriorArt(asString(parsedArgs.query)) };
          }
        }
        return { ok: true, output: searchPriorArt(asString(parsedArgs.query)) };
      case "draft_claim": {
        const axle = asString(parsedArgs.axle) || "后悬架";
        const features = asStringList(parsedArgs.features);
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

