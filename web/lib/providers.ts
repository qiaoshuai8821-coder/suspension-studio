export const providers = {
  deepseek: {
    label: "DeepSeek",
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
  },
  qwen: {
    label: "通义千问",
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-plus",
  },
  kimi: {
    label: "Kimi",
    url: "https://api.moonshot.cn/v1/chat/completions",
    model: "moonshot-v1-8k",
  },
  zhipu: {
    label: "智谱",
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4-flash",
  },
  openai: {
    label: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
} as const;

export type ProviderId = keyof typeof providers;

export function isProviderId(value: string): value is ProviderId {
  return Object.prototype.hasOwnProperty.call(providers, value);
}
