import { acceptModelDraft } from "@/lib/draft";
import { clientAddress, fromOurPage, openDraftGate } from "@/lib/draft-guard";
import { isProviderId, providers } from "@/lib/providers";

import { AgentError, runAgent } from "@/lib/agent/runtime";

export const maxDuration = 120;

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
  if (apiKey.length < 8 || apiKey.length > 400) return jsonError("请填模型密钥。生成时只转给你选的那一家，服务器不保存。", 400);
  if (prompt.length < 12) return jsonError("再写具体些：哪款车、哪个零件、想往哪个方向改。", 400);
  if (prompt.length > 2000) return jsonError("提示请收在两千字以内。", 400);
  if (bannedInPrompt.some((word) => prompt.includes(word))) {
    return jsonError("电池不归我们改。请只写悬架零件之间怎么传力。", 400);
  }
  if (!fromOurPage(request)) return jsonError("请从工作台页面发起。", 403);

  const proofId = typeof record?.proofId === "string" ? record.proofId : "";
  const nonce = typeof record?.nonce === "string" ? record.nonce : "";
  const salt = typeof record?.salt === "string" ? record.salt : "";
  const gate = await openDraftGate(clientAddress(request), { id: proofId, nonce, salt });
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const provider = providers[providerId];

  // 首选：运行 Agent（规划 + 工具调用 + 真实联网 + 成稿）。
  try {
    const result = await runAgent({
      url: provider.url,
      model: provider.model,
      apiKey,
      prompt,
      providerId,
    });

    const parsed = parseJsonText(result.content);
    if (parsed === null) {
      return await legacySingleShot(provider.url, provider.model, apiKey, prompt);
    }

    const accepted = acceptModelDraft(parsed);
    if (!accepted.ok) {
      return await legacySingleShot(provider.url, provider.model, apiKey, prompt);
    }

    // 用真实检索证据覆盖模型转述，保证来源真实、检索状态可信。
    accepted.draft.searched = result.evidence.searched;
    accepted.draft.searchNote = result.evidence.searchNote;
    accepted.draft.priorArt = result.evidence.priorArt;

    return Response.json({ draft: accepted.draft, source: "agent" });
  } catch (error) {
    if (error instanceof AgentError) {
      if (error.status === 400) {
        return await legacySingleShot(provider.url, provider.model, apiKey, prompt);
      }
      return jsonError(error.message, error.status);
    }
    return jsonError("模型没有写完。请再生成一次。", 502);
  } finally {
    gate.release();
  }
}

function parseJsonText(content: string): unknown | null {
  try {
    return JSON.parse(stripFence(content));
  } catch {
    return null;
  }
}

// 降级路径：保留单次 JSON 模式调用行为，不联网。
async function legacySingleShot(
  url: string,
  model: string,
  apiKey: string,
  prompt: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await askModel(url, apiKey, model, prompt, true);
    if (response.status === 400) {
      response = await askModel(url, apiKey, model, prompt, false);
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
  accepted.draft.searchNote = "降级为单次生成，未联网检索，正式立项前需人工专利检索。";
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
        { role: "system", content: legacySystemPrompt },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
}

const legacySystemPrompt = `你是乘用车底盘悬架工程师，帮同事把一句创新方向写成完整提案。只输出一个 JSON 对象，不要 Markdown。
只写悬架，不写电池、电驱、热管理、控制算法；不要编造实测值、专利号和授权结论；必要结构写 3 到 4 条，恰好两种做法，每条 difference 含"相对"。
JSON 形状：{"title":"","axle":"后悬架","summary":"","problemTitle":"","baseline":"","innovations":[{"id":"I1","point":"","distinction":""}],"onlyThis":"","features":[{"id":"F1","text":""}],"implementation":{"material":"","machining":"","assembly":"","tolerance":""},"embodiments":[{"name":"","structure":"","difference":""},{"name":"","structure":"","difference":""}],"claimChart":[{"feature":"","ours":"","match":""}],"riskLevel":"","designAround":[{"risk":"","alternative":"","claimChange":""}],"benefits":{"performance":"","cost":"","platform":"","patent":""},"setup":"","criterion":"","claim":"","risks":"","disclaimer":"","riskReason":""}`;

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

