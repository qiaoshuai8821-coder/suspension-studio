// Agent 运行时用到的核心类型定义。
// 全部对齐 OpenAI 兼容的 Chat Completions / Function Calling 格式，
// DeepSeek、通义千问、Kimi、智谱、OpenAI 都用同一套结构。

export type AgentPhase = "plan" | "act" | "observe" | "finalize";

// 一条聊天消息。用可辨识联合，让 TS 在 strict 模式下能收窄字段。
export type ChatMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage;

export type SystemMessage = {
  role: "system";
  content: string;
};

export type UserMessage = {
  role: "user";
  content: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    // 模型给出的参数是一段 JSON 字符串，执行前再解析。
    arguments: string;
  };
};

export type AssistantMessage = {
  role: "assistant";
  content: string;
  tool_calls?: ToolCall[];
};

export type ToolMessage = {
  role: "tool";
  tool_call_id: string;
  content: string;
};

// 工具的声明结构（OpenAI tools 字段）。
export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
};

// 轻量 JSON Schema 描述，够用即可。
export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

// 工具执行后的统一返回。
export type ToolResult = {
  ok: boolean;
  // 回灌给模型的观察结果，始终是字符串。
  output: string;
};

// 一次运行中每一步的可观测事件，用于前端展示执行轨迹与排查问题。
export type AgentEvent = {
  phase: AgentPhase;
  at: string;
  thought?: string;
  tool?: string;
  toolInput?: unknown;
  observation?: string;
};

export type RunAgentInput = {
  url: string;
  model: string;
  apiKey: string;
  prompt: string;
};

export type RunAgentResult = {
  // 模型最终产出的原始 JSON 文本，交给上层 acceptModelDraft 校验。
  content: string;
  trace: AgentEvent[];
  iterations: number;
};
