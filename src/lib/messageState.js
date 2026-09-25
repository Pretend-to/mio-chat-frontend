const TERMINAL_STATUSES = new Set(["completed", "failed"]);
const ACTIVE_STATUSES = new Set([
  "pending",
  "retrying",
  "streaming",
  "uploading",
]);

/**
 * 状态别名归一化（写侧与水合侧均经过这里）：
 * - final → completed
 * - processing / running → streaming（历史别名：早期渠道占位与旧管线用过这两个名字，
 *   存量数据在被 upsert 或水合时就地吸收，链内不再保留这两个值）
 */
export function normalizeMessageStatus(status, fallback = "pending") {
  if (status === "final") return "completed";
  if (status === "processing" || status === "running") return "streaming";
  return status || fallback;
}

export function isTerminalMessage(message) {
  return TERMINAL_STATUSES.has(normalizeMessageStatus(message?.status, ""));
}

export function isActiveMessage(message) {
  return ACTIVE_STATUSES.has(normalizeMessageStatus(message?.status, ""));
}

/**
 * 「纯占位消息」：整条消息只剩一个 blank 块，不承载任何内容。
 * 它是前端渲染用的临时态，一旦被写进会话链就成了「发了一条空消息」——
 * 水合时必须丢掉，否则历史残留会一直跟着会话（移动端发不出消息时攒了一堆）。
 */
export function isBlankPlaceholder(message) {
  const content = message?.content;
  return (
    Array.isArray(content) &&
    content.length === 1 &&
    content[0]?.type === "blank"
  );
}

/**
 * UI 层「消息仍在生成中」的统一判定（打字机光标 / 右键停止 / 中断删除等入口共用）。
 * 规范三态：pending / streaming / retrying；历史别名（running / processing）经
 * normalizeMessageStatus 在读时吸收，避免旁路数据掉入"既无光标、也无停止入口"的空档。
 * 注意：uploading 是用户侧上传态，不属于生成态，刻意为 false。
 */
export function isStreamingMessage(message) {
  return ["pending", "streaming", "retrying"].includes(
    normalizeMessageStatus(message?.status, ""),
  );
}

export function normalizeMessage(message, defaults = {}) {
  const source = message && typeof message === "object" ? message : {};
  const id = source.id ?? defaults.id;
  if (id === undefined || id === null || String(id) === "") return null;

  return {
    ...defaults,
    ...source,
    id: String(id),
    role: source.role || defaults.role || "other",
    status: normalizeMessageStatus(
      source.status,
      normalizeMessageStatus(defaults.status, "pending"),
    ),
    time: source.time || defaults.time || Date.now(),
    content:
      Array.isArray(source.content) && source.content.length
        ? source.content
        : Array.isArray(defaults.content) && defaults.content.length
          ? defaults.content
          : [{ type: "blank", data: {} }],
  };
}

function contentWeight(content) {
  if (!Array.isArray(content)) return 0;
  return content.reduce((total, block) => {
    if (block?.type === "blank") return total;
    if (block?.type === "text" || block?.type === "reason") {
      return total + String(block.data?.text || "").length;
    }
    if (block?.type === "tool_call") {
      const args = block.data?.arguments || block.data?.parameters || "";
      const result = block.data?.result;
      return total + String(args).length + (result === undefined ? 1 : 100);
    }
    return total + 10;
  }, 0);
}

/**
 * Merge a second representation of the same logical message without allowing a
 * stale history page or reconnect snapshot to roll a terminal/live message back.
 */
export function mergeSameMessage(current, incoming, authority = "event") {
  const next = normalizeMessage(incoming, current);
  if (!next) return current;

  const currentTerminal = isTerminalMessage(current);
  const nextTerminal = isTerminalMessage(next);
  const currentActive = isActiveMessage(current);
  const nextActive = isActiveMessage(next);
  const merged = { ...current, ...next, id: String(current.id) };

  if (authority !== "replace" && currentTerminal && nextActive) {
    merged.status = current.status;
    merged.content = current.content;
  } else if (
    authority !== "replace" &&
    authority === "history" &&
    currentActive &&
    !nextTerminal &&
    contentWeight(current.content) >= contentWeight(next.content)
  ) {
    merged.status = current.status;
    merged.content = current.content;
  } else if (
    authority !== "replace" &&
    !nextTerminal &&
    contentWeight(next.content) < contentWeight(current.content)
  ) {
    merged.content = current.content;
  }

  return merged;
}

export function unmarkRaw(target) {
  if (!target || typeof target !== "object") return target;
  if (Array.isArray(target)) {
    return target.map((item) => unmarkRaw(item));
  }
  const clean = {};
  for (const key of Object.keys(target)) {
    clean[key] = unmarkRaw(target[key]);
  }
  return clean;
}

function replaceObject(target, source) {
  for (const key of Object.keys(target)) {
    if (!(key in source)) delete target[key];
  }
  Object.assign(target, source);
  return target;
}

export function upsertMessage(chain, incoming, options = {}) {
  const normalized = normalizeMessage(incoming, options.defaults);
  if (!normalized) return { accepted: false, message: null, created: false };

  const index = chain.findIndex((item) => String(item?.id) === normalized.id);
  if (index === -1) {
    const clean = unmarkRaw(normalized);
    if (Number.isInteger(options.index)) {
      chain.splice(Math.max(0, options.index), 0, clean);
    } else if (options.prepend) {
      chain.unshift(clean);
    } else {
      chain.push(clean);
    }
    return { accepted: true, message: clean, created: true };
  }

  const current = chain[index];
  const merged = mergeSameMessage(current, normalized, options.authority);

  // 关键：若当前消息曾被打上 markRaw（__v_skip），或者正在从终态重新激活为活跃态/非终态
  // 必须通过 splice 替换纯净对象，让 Vue 3 重新为此消息建立深度响应式代理
  const shouldReactivate =
    Boolean(current?.__v_skip) ||
    (isTerminalMessage(current) && !isTerminalMessage(merged));

  if (shouldReactivate) {
    const clean = unmarkRaw(merged);
    chain.splice(index, 1, clean);
    return {
      accepted: true,
      message: chain[index],
      created: false,
    };
  }

  return {
    accepted: true,
    message: replaceObject(current, merged),
    created: false,
  };
}

/**
 * Reconcile a page of persisted history with local state. History responses are
 * paginated snapshots, so their absence of an id must never delete a message
 * already received through the live stream (including completed messages).
 */
export function mergeMessageHistory(chain, messages, mode = "replace") {
  const incoming = (Array.isArray(messages) ? messages : [])
    .map((message) => normalizeMessage(message, { status: "completed" }))
    .filter(Boolean);

  const unique = [];
  const byId = new Map();
  for (const message of chain) {
    const normalized = normalizeMessage(message);
    if (!normalized) continue;
    const existing = byId.get(normalized.id);
    if (existing) {
      replaceObject(existing, mergeSameMessage(existing, normalized));
      continue;
    }
    byId.set(normalized.id, message);
    unique.push(message);
  }
  chain.splice(0, chain.length, ...unique);

  const resolvedIncoming = incoming.map((message) => {
    const current = byId.get(message.id);
    if (!current) {
      byId.set(message.id, message);
      return message;
    }
    replaceObject(current, mergeSameMessage(current, message, "history"));
    return current;
  });

  if (mode === "prepend") {
    const existingIds = new Set(chain.map((message) => String(message.id)));
    const additions = resolvedIncoming.filter(
      (message) => !existingIds.has(String(message.id)),
    );
    chain.unshift(...additions);
    return { added: additions.length, messages: resolvedIncoming };
  }

  const incomingIds = new Set(resolvedIncoming.map((message) => message.id));
  const localOnly = chain.filter(
    (message) => !incomingIds.has(String(message.id)),
  );
  // Keep the server page in order and insert local-only rows by their original
  // timestamps. This covers both older loaded pages and newer live completions.
  const combined = [...resolvedIncoming, ...localOnly];
  const timestamp = (message) => {
    const numeric = Number(message.time);
    return Number.isFinite(numeric) ? numeric : Date.parse(message.time) || 0;
  };
  combined.sort((left, right) => timestamp(left) - timestamp(right));
  chain.splice(0, chain.length, ...combined);
  return { added: resolvedIncoming.length, messages: resolvedIncoming };
}
