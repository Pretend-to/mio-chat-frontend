import { getAvatarByAdapterType } from "./avatar.js";

export const PRESETS = [
  { id: "deepseek", name: "DeepSeek", url: "https://api.deepseek.com/v1", proto: "openai-chat", conn: "api-key", group: "常用", letter: "D", color: "#4d6bfe", kw: "deepseek 深度求索 ds" },
  { id: "zhipu", name: "智谱 GLM", url: "https://open.bigmodel.cn/api/paas/v4/", proto: "openai-chat", conn: "api-key", group: "常用", letter: "智", color: "#3b6ef6", kw: "zhipu 智谱 清言 bigmodel glm" },
  { id: "volcengine", name: "火山方舟（豆包）", url: "https://ark.cn-beijing.volces.com/api/v3", proto: "openai-responses", conn: "api-key", group: "常用", letter: "火", color: "#2b6cf6", kw: "volcengine 火山 方舟 豆包 ark 字节" },
  { id: "xiaomimimo", name: "小米 MiMo", url: "https://api.xiaomimimo.com/v1", proto: "openai-chat", conn: "api-key", group: "常用", letter: "M", color: "#ff6900", kw: "xiaomimimo 小米 mimo" },
  { id: "moonshot", name: "月之暗面 Kimi", url: "https://api.moonshot.cn/v1", proto: "openai-chat", conn: "api-key", group: "常用", letter: "K", color: "#1f1f1f", kw: "moonshot 月之暗面 kimi" },
  { id: "minimax", name: "MiniMax 海螺", url: "https://api.minimax.chat/v1", proto: "openai-chat", conn: "api-key", group: "常用", letter: "M", color: "#e8443a", kw: "minimax 海螺 abab" },
  { id: "baichuan", name: "Baichuan 百川智能", url: "https://api.baichuan-ai.com/v1", proto: "openai-chat", conn: "api-key", group: "常用", letter: "百", color: "#2f6fed", kw: "baichuan 百川 百川智能" },
  { id: "stepfun", name: "Stepfun 阶跃星辰", url: "https://api.stepfun.com/v1", proto: "openai-chat", conn: "api-key", group: "常用", letter: "阶", color: "#5b5bd6", kw: "stepfun 阶跃 跃问" },
  { id: "zeroone", name: "01.AI 零一万物", url: "https://api.lingyiwanwu.com/v1", proto: "openai-chat", conn: "api-key", group: "常用", letter: "01", color: "#0f9d8f", kw: "01.ai 零一万物 yi zeroone" },
  { id: "openai", name: "OpenAI 官方", url: "https://api.openai.com/v1", proto: "openai-chat", conn: "api-key", group: "国际主流", letter: "O", color: "#10a37f", kw: "openai gpt chatgpt 官方" },
  { id: "anthropic", name: "Anthropic Claude", url: "https://api.anthropic.com", proto: "anthropic-messages", conn: "api-key", group: "国际主流", letter: "A", color: "#c1613e", kw: "anthropic claude 克劳德" },
  { id: "gemini", name: "Google Gemini", url: "https://generativelanguage.googleapis.com", proto: "gemini", conn: "api-key", group: "国际主流", letter: "G", color: "#2f9e6f", kw: "gemini google 谷歌 双子星" },
  { id: "xai", name: "xAI Grok", url: "https://api.x.ai/v1", proto: "openai-responses", conn: "api-key", group: "国际主流", letter: "X", color: "#1c1c1c", kw: "xai grok 马斯克" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1", proto: "openai-chat", conn: "api-key", group: "国际主流", letter: "R", color: "#6b4ee6", kw: "openrouter or 聚合" },
  { id: "groq", name: "Groq", url: "https://api.groq.com/openai/v1", proto: "openai-chat", conn: "api-key", group: "国际主流", letter: "Q", color: "#f55036", kw: "groq 高速推理" },
  { id: "perplexity", name: "Perplexity", url: "https://api.perplexity.ai", proto: "openai-chat", conn: "api-key", group: "国际主流", letter: "P", color: "#20808d", kw: "perplexity pplx 搜索" },
  { id: "github", name: "GitHub Models", url: "https://models.inference.ai.azure.com", proto: "openai-chat", conn: "api-key", group: "云端 / 企业", letter: "GH", color: "#24292f", kw: "github models copilot gh 微软" },
  { id: "agentplatform", avatarId: "google", name: "Vertex AI / Agent Platform", url: "https://aiplatform.googleapis.com", proto: "gemini", conn: "vertex-express", group: "云端 / 企业", letter: "V", color: "#4285f4", kw: "vertex aiplatform google cloud express adc 应用默认凭据 agent platform" },
  { id: "cloudcode", avatarId: "gemini", name: "Gemini Code Assist（OAuth）", url: "https://cloudcode-pa.googleapis.com", proto: "gemini", conn: "oauth", group: "云端 / 企业", letter: "GC", color: "#1a73e8", kw: "cloudcode code assist gemini oauth 谷歌 授权" },
].map((preset) => ({
  ...preset,
  avatar: getAvatarByAdapterType(preset.avatarId || preset.id),
}));

/**
 * 智能匹配预设 (根据已有实例的 base_url, name, 或 adapterType)
 */
export function matchPreset(adapter, adapterType) {
  const baseUrl = (adapter?.base_url || "").trim().toLowerCase();
  const name = (adapter?.name || "").trim().toLowerCase();
  const t = (adapterType || "").toLowerCase();

  // 1. URL 匹配（最精准，避免第三方兼容 OpenAI 协议服务商被识别为 OpenAI 官方）
  if (baseUrl) {
    const cleanUrl = baseUrl.replace(/\/+$/, "");
    const byUrl = PRESETS.find((p) => {
      if (!p.url) return false;
      const pUrl = p.url.toLowerCase().replace(/\/+$/, "");
      return cleanUrl === pUrl || cleanUrl.startsWith(pUrl) || pUrl.startsWith(cleanUrl);
    });
    if (byUrl) return byUrl;
  }

  // 2. 名字关键词匹配
  if (name) {
    const byName = PRESETS.find((p) => {
      if (p.name.toLowerCase() === name) return true;
      if (p.kw) {
        const keywords = p.kw.toLowerCase().split(/\s+/);
        return keywords.some((k) => k.length >= 2 && name.includes(k));
      }
      return false;
    });
    if (byName) return byName;
  }

  // 3. 适配器类型直接匹配
  if (t) {
    const byType = PRESETS.find((p) => p.id.toLowerCase() === t);
    if (byType) return byType;
  }

  return null;
}
