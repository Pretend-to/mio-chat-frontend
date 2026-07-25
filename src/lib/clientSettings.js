/**
 * clientSettings.js — 客户端本地设置 & 预设存储
 *
 * localforage key:
 *   "client_settings" — { profile, appearance, chat, agentDefault }
 *   "local_presets"    — [ { id, name, title, avatar, options, createdAt } ]
 */

import localforage from "localforage";

// ==================== 默认值 ====================

const DEFAULTS = {
  profile: {
    name: "user",
    title: "Mio",
    avatar: null,
  },
  appearance: {
    theme: "auto",
    fontSize: "medium",
  },
  chat: {
    desktopEnterSend: false,
    autoReadAloud: false,
    readAloudVoice: "auto",
    carryTimestamp: true,
    carryProfile: false,
  },
  agentDefault: {
    presetId: null,
  },
};

// ==================== 工具函数 ====================

/** 深度合并：obj 中缺失的 key 从 defaults 补齐 */
function deepMerge(obj, defaults) {
  const result = {};
  for (const key of new Set([...Object.keys(obj), ...Object.keys(defaults)])) {
    if (!(key in obj)) {
      result[key] = defaults[key];
    } else if (
      typeof defaults[key] === "object" &&
      defaults[key] !== null &&
      !Array.isArray(defaults[key])
    ) {
      result[key] = deepMerge(obj[key], defaults[key]);
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

// ==================== client_settings ====================

/**
 * 获取完整客户端设置（缺失字段自动补全默认值）
 * @returns {Object}
 */
export async function getClientSettings() {
  try {
    const raw = await localforage.getItem("client_settings");
    if (!raw) return { ...DEFAULTS };
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return deepMerge(parsed, DEFAULTS);
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * 全量保存客户端设置
 * @param {Object} settings
 */
export async function setClientSettings(settings) {
  await localforage.setItem("client_settings", JSON.stringify(settings));
}

/**
 * 更新客户端设置的某个字段（浅合并）
 * @param {Object} patch
 */
export async function patchClientSettings(patch) {
  const current = await getClientSettings();
  Object.assign(current, patch);
  await setClientSettings(current);
}

// ==================== local_presets ====================

/**
 * 获取全部本地预设
 * @returns {Array}
 */
export async function getLocalPresets() {
  try {
    const raw = await localforage.getItem("local_presets");
    if (!raw) return [];
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
}

/**
 * 保存/更新一个预设
 * - 同 ID：直接覆盖
 * - 不同 ID：追加
 * @param {Object} preset  { id, name, title, avatar, options }
 * @returns {Object} { action: "created" | "updated" }
 */
export async function saveLocalPreset(preset) {
  if (!preset.id) {
    throw new Error("预设缺少 id 字段");
  }

  const presets = await getLocalPresets();
  const idx = presets.findIndex((p) => p.id === preset.id);

  const now = Date.now();
  const entry = { ...preset, createdAt: preset.createdAt || now, updatedAt: now };

  if (idx !== -1) {
    presets[idx] = entry;
    await localforage.setItem("local_presets", JSON.stringify(presets));
    return { action: "updated" };
  } else {
    presets.push(entry);
    await localforage.setItem("local_presets", JSON.stringify(presets));
    return { action: "created" };
  }
}

/**
 * 根据 ID 删除预设
 * @param {string} id
 * @returns {boolean} 是否成功删除
 */
export async function deleteLocalPreset(id) {
  const presets = await getLocalPresets();
  const filtered = presets.filter((p) => p.id !== id);
  if (filtered.length === presets.length) return false;
  await localforage.setItem("local_presets", JSON.stringify(filtered));
  return true;
}

/**
 * 根据 ID 查找单个预设
 * @param {string} id
 * @returns {Object|null}
 */
export async function getLocalPresetById(id) {
  const presets = await getLocalPresets();
  return presets.find((p) => p.id === id) || null;
}

// ==================== 实用元信息采集 ====================

/** 获取简化的操作系统平台名称 */
export function getOSPlatform() {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent || "";
  if (/mac/i.test(ua)) return "macOS";
  if (/win/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  return navigator.platform || "Unknown";
}

/**
 * 构建精简实用的 <user_profile> XML 字符串
 * @param {Object} profile  来自 client_settings.profile
 * @returns {string}
 */
export function buildUserProfileXml(profile) {
  const language = navigator.language || "zh-CN";
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  const os = getOSPlatform();
  const now = new Date();
  const timeString = now.toLocaleString("zh-CN", {
    hour12: false,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const lines = [
    "<user_profile>",
    `  <name>${escapeXml(profile?.name || "user")}</name>`,
    `  <language>${escapeXml(language)}</language>`,
    `  <timezone>${escapeXml(timezone)}</timezone>`,
    `  <current_time>${escapeXml(timeString)}</current_time>`,
    `  <os_platform>${escapeXml(os)}</os_platform>`,
    "</user_profile>",
  ];
  return lines.join("\n");
}

/** XML 转义 */
function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
