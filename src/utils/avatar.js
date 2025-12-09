const AVATAR_BASE_PATH =
  "https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons";

const AVATAR_MAP = {
  OpenAI: "openai.svg",
  Cohere: "cohere-color.svg",
  Anthropic: "claude-color.svg",
  Google: "gemini-color.svg",
  "X.AI": "grok.svg",
  DeepSeek: "deepseek-color.svg",
  智谱清言: "zhipu-color.svg",
  豆包: "doubao-color.svg",
  "月之暗面 (kimi)": "moonshot.svg",
  科大讯飞: "spark-color.svg",
  通义千问: "qwen-color.svg",
  腾讯混元: "hunyuan-color.svg",
};

/**
 * 根据模型所有者获取头像 URL
 * @param {string} modelOwner - 模型所有者名称
 * @returns {string} - 头像 URL
 */
export function getAvatarByOwner(modelOwner) {
  if (Object.keys(AVATAR_MAP).includes(modelOwner)) {
    return `${AVATAR_BASE_PATH}/${AVATAR_MAP[modelOwner]}`;
  }
  return `${AVATAR_BASE_PATH}/openai.svg`;
}

/**
 * 根据适配器类型获取对应的图标文件名
 * @param {string} adapterType - 适配器类型 (openai, gemini, vertex, onebot)
 * @returns {string} - 图标文件名
 */
export function getIconByAdapterType(adapterType) {
  const iconMap = {
    openai: "openai.svg",
    gemini: "gemini-color.svg",
    vertex: "gemini-color.svg", // Vertex AI 使用 Gemini 图标
    onebot: "openai.svg", // OneBot 暂时使用 OpenAI 图标作为默认
  };
  return iconMap[adapterType] || "openai.svg";
}

/**
 * 根据适配器类型获取完整的头像 URL
 * @param {string} adapterType - 适配器类型
 * @returns {string} - 完整的头像 URL
 */
export function getAvatarByAdapterType(adapterType) {
  const iconFile = getIconByAdapterType(adapterType);
  return `${AVATAR_BASE_PATH}/${iconFile}`;
}

export { AVATAR_BASE_PATH, AVATAR_MAP };
