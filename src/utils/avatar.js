// 模型头像映射已移动至后端处理 (/p/mava)


/**
 * 根据模型所有者获取头像 URL
 * @param {string} modelOwner - 模型所有者名称
 * @returns {string} - 头像 URL
 */
export function getAvatarByOwner(modelOwner) {
  return `/p/mava?provider=${modelOwner || "OpenAI"}`;
}

/**
 * 根据适配器类型获取完整的头像 URL
 * @param {string} adapterType - 适配器类型
 * @returns {string} - 完整的头像 URL
 */
export function getAvatarByAdapterType(adapterType) {
  return `/p/mava?adapter=${adapterType}`;
}


