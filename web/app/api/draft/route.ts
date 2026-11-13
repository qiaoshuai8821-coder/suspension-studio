import { acceptModelDraft } from "@/lib/draft";
import { modelSystemPrompt } from "@/lib/model-prompt";
import { isProviderId, providers } from "@/lib/providers";

export const maxDuration = 60;

const bannedInPrompt = ["电池"];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("请求读不出来。", 400);
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const prompt = typeof record?.prompt === "string" ? record.prompt.replace(/\s+/g, " ").trim() : "";
  const providerId = typeof record?.provider === "string" ? record.provider : "";
  const apiKey = typeof record?.apiKey === "string" ? record.apiKey.trim() : "";

  if (!isProviderId(providerId)) return jsonError("请先选一个模型。", 400);
  if (apiKey.length < 8 || apiKey.length > 400) return jsonError("请填这台浏览器要用的模型密钥。", 400);
  if (prompt.length < 12) return jsonError("再写具体些：哪款车、哪个零件、想往哪个方向改。", 400);
  if (prompt.length > 2000) return jsonError("提示请收在两千字以内。", 400);
  if (bannedInPrompt.some((word) => prompt.includes(word))) {
    return jsonError("电池不归我们改。请只写悬架零件之间怎么传力。", 400);
  }

  const provider = providers[providerId];
  let response: Response;
  try {
    response = await askModel(provider.url, apiKey, provider.model, prompt, true);
    if (response.status === 400) {
      response = await askModel(provider.url, apiKey, provider.model, prompt, false);
    }
  } catch {
    return jsonError("模型没有连上。请检查网络后再试。", 502);
  }

  if (response.status === 401 || response.status === 403) {
    return jsonError("这个密钥没有被模型接受。请核对密钥，以及选的是不是同一家。", 401);
  }
  if (response.status === 429) return jsonError("模型这边太忙了，过一会儿再生成。", 429);
  if (!response.ok) return jsonError("模型没有写完。请把零件和方向写具体一点，再试一次。", 502);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return jsonError("模型的回复读不出来，请再生成一次。", 502);
  }
  const content = readContent(payload);
  if (!content) return jsonError("模型没有返回正文，请再生成一次。", 502);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(content));
  } catch {
    return jsonError("模型没有按约定的格式返回，请再生成一次。", 502);
  }
  const accepted = acceptModelDraft(parsed);
  if (!accepted.ok) return jsonError(accepted.error, 422);
  return Response.json({ draft: accepted.draft, source: "model" });
}

function askModel(url: string, apiKey: string, model: string, prompt: string, jsonMode: boolean) {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: modelSystemPrompt },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
}

function readContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return "";
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  return typeof message?.content === "string" ? message.content : "";
}

function stripFence(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
