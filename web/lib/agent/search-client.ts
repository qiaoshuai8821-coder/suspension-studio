// 联网搜索客户端：调用 DeepSeek 开放的 Search / Fetch 原始接口。
// 与 Chat Completions 使用同一个 Bearer Key，原生 fetch，不引入任何依赖。
// 其他厂商若提供同构 /v1/tools/search 端点，只需在工具层放开 provider 判断即可复用。

const SEARCH_TIMEOUT_MS = 15_000;

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  summary: string;
  siteName: string;
};

// 从 Chat Completions 的完整地址推导站点 origin，例如：
// https://api.deepseek.com/chat/completions -> https://api.deepseek.com
export function deriveOrigin(chatUrl: string): string {
  try {
    const parsed = new URL(chatUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "https://api.deepseek.com";
  }
}

// 调用 /v1/tools/search。need_content 关闭，只取摘要，控制响应体积。
export async function webSearch(
  chatUrl: string,
  apiKey: string,
  query: string,
  count = 6,
): Promise<SearchHit[]> {
  const origin = deriveOrigin(chatUrl);
  const response = await fetch(`${origin}/v1/tools/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, count, need_content: false }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`搜索接口返回 ${response.status}`);
  }

  const payload = (await response.json()) as { results?: unknown };
  const results = Array.isArray(payload.results) ? payload.results : [];
  return results.map((item): SearchHit => {
    const record = (item ?? {}) as Record<string, unknown>;
    return {
      title: typeof record.title === "string" ? record.title : "",
      url: typeof record.url === "string" ? record.url : "",
      snippet: typeof record.snippet === "string" ? record.snippet : "",
      summary: typeof record.summary === "string" ? record.summary : "",
      siteName: typeof record.site_name === "string" ? record.site_name : "",
    };
  });
}

// 调用 /v1/tools/fetch，把单个网页抓成 Markdown，供需要精读专利页时使用。
export async function webFetch(
  chatUrl: string,
  apiKey: string,
  url: string,
): Promise<{ title: string; content: string }> {
  const origin = deriveOrigin(chatUrl);
  const response = await fetch(`${origin}/v1/tools/fetch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`抓取接口返回 ${response.status}`);
  }
  const payload = (await response.json()) as { title?: unknown; content?: unknown };
  return {
    title: typeof payload.title === "string" ? payload.title : "",
    content: typeof payload.content === "string" ? payload.content : "",
  };
}

