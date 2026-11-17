// Agent 运行时：Plan / Act / Observe / Finalize 状态机。
// 用一个带最大步数与超时的循环驱动模型进行多步推理和工具调用，
// 直到产出符合 Draft 契约的 JSON 文本，再交给上层 acceptModelDraft 严格校验。

import { agentSystemPrompt, continueInstruction, forceFinalizeInstruction } from "./prompts";
import { executeTool, toolSchemas } from "./tools";
import type {
  AgentEvent,
  AssistantMessage,
  ChatMessage,
  RunAgentInput,
  RunAgentResult,
  ToolCall,
} from "./types";

const MAX_ITERATIONS = 6;
const REQUEST_TIMEOUT_MS = 25_000;

// 带 HTTP 状态的运行时错误，便于路由层映射成对应的中文提示。
export class AgentError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AgentError";
    this.status = status;
  }
}

function stripFence(value: string): string {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
}

// 轻量判断 content 是否像最终成稿：能解析为对象且含 features / embodiments。
// 真正的字段级严格校验仍由 route 层的 acceptModelDraft 负责。
function tryParseDraft(content: string): unknown | null {
  if (!content.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(stripFence(content));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.features) || !Array.isArray(record.embodiments)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const { url, model, apiKey, prompt } = input;
  const trace: AgentEvent[] = [];

  // 真实的 chat 实现：闭包注入 url/model/apiKey。
  async function callModel(messages: ChatMessage[], includeTools: boolean): Promise<AssistantMessage> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages,
          ...(includeTools ? { tools: toolSchemas, tool_choice: "auto" } : {}),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new AgentError(502, "模型响应超时，请缩小提示范围后再试。");
      }
      throw new AgentError(502, "模型没有连上。请检查网络后再试。");
    }

    if (response.status === 401 || response.status === 403) {
      throw new AgentError(401, "这个密钥没有被模型接受。请核对密钥，以及选的是不是同一家。");
    }
    if (response.status === 429) {
      throw new AgentError(429, "模型这边太忙了，过一会儿再生成。");
    }
    // 400 通常意味着当前模型不支持 tools 或请求参数不被接受，交给路由层降级。
    if (response.status === 400) {
      throw new AgentError(400, "当前模型不支持工具调用参数，需要降级处理。");
    }
    if (!response.ok) {
      throw new AgentError(502, "模型没有写完。请把零件和方向写具体一点，再试一次。");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AgentError(502, "模型的回复读不出来，请再生成一次。");
    }

    const message = readAssistantMessage(payload);
    if (!message) throw new AgentError(502, "模型没有返回正文，请再生成一次。");
    return message;
  }

  function readAssistantMessage(payload: unknown): AssistantMessage | null {
    if (!payload || typeof payload !== "object") return null;
    const choices = (payload as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
    const message = (choices[0] as { message?: unknown }).message;
    if (!message || typeof message !== "object") return null;

    const record = message as Record<string, unknown>;
    const content = typeof record.content === "string" ? record.content : "";
    const rawToolCalls = Array.isArray(record.tool_calls) ? record.tool_calls : [];
    const tool_calls = rawToolCalls
      .map((item): ToolCall | null => {
        if (!item || typeof item !== "object") return null;
        const toolCall = item as Record<string, unknown>;
        const fn = toolCall.function;
        if (!fn || typeof fn !== "object") return null;
        const functionRecord = fn as Record<string, unknown>;
        return {
          id: typeof toolCall.id === "string" ? toolCall.id : crypto.randomUUID(),
          type: "function",
          function: {
            name: typeof functionRecord.name === "string" ? functionRecord.name : "",
            arguments: typeof functionRecord.arguments === "string" ? functionRecord.arguments : "{}",
          },
        };
      })
      .filter((item): item is ToolCall => Boolean(item && item.function.name));

    return { role: "assistant", content, ...(tool_calls.length ? { tool_calls } : {}) };
  }

  const messages: ChatMessage[] = [
    { role: "system", content: agentSystemPrompt },
    { role: "user", content: prompt },
  ];

  trace.push({ phase: "plan", at: new Date().toISOString(), thought: "已接收需求，开始规划并准备调用工具。" });

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    const assistant = await callModel(messages, true);
    messages.push(assistant);

    const toolCalls = assistant.tool_calls ?? [];
    if (toolCalls.length > 0) {
      trace.push({
        phase: "act",
        at: new Date().toISOString(),
        thought: assistant.content || undefined,
        tool: toolCalls.map((call) => call.function.name).join(", "),
        toolInput: toolCalls.map((call) => call.function.arguments),
      });

      for (const toolCall of toolCalls) {
        const result = await executeTool(toolCall.function.name, toolCall.function.arguments);
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: result.output });
        trace.push({
          phase: "observe",
          at: new Date().toISOString(),
          tool: toolCall.function.name,
          observation: result.output,
        });
      }
      continue;
    }

    // 没有工具调用：要么是最终成稿，要么是跑偏的文本。
    if (tryParseDraft(assistant.content) !== null) {
      trace.push({ phase: "finalize", at: new Date().toISOString() });
      return { content: assistant.content, trace, iterations: iteration };
    }

    // 内容无法解析，追加纠偏提示后继续。
    messages.push({ role: "user", content: continueInstruction });
  }

  // 达到最大步数：做一次不带工具的强制成稿。
  messages.push({ role: "user", content: forceFinalizeInstruction });
  const finalAssistant = await callModel(messages, false);
  if (tryParseDraft(finalAssistant.content) === null) {
    throw new AgentError(502, "模型没有按约定的格式返回，请再生成一次。");
  }
  trace.push({ phase: "finalize", at: new Date().toISOString() });
  return { content: finalAssistant.content, trace, iterations: MAX_ITERATIONS + 1 };
}
