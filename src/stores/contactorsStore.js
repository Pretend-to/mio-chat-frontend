import { defineStore } from "pinia";
import { ref, computed, markRaw } from "vue";
import { getAvatarByAdapterType } from "@/utils/avatar.js";
import { numberString } from "@/utils/generate.js";
import { config, client } from "@/lib/runtime.js";
import { resolveUnhandledMentions } from "@/lib/groupGateway.js";
import { isLegacyInteractionBubble } from "@/lib/interactionFrames.js";
import {
  isBlankPlaceholder,
  isStreamingMessage,
  isTerminalMessage,
  mergeMessageHistory,
  normalizeMessage,
  unmarkRaw,
  upsertMessage,
} from "@/lib/messageState.js";
import {
  addGlobalMemoryItem,
  updateGlobalMemoryItem,
  deleteGlobalMemoryItem,
} from "@/lib/clientSettings.js";

const avatarPolicy = ["MODEL", "CUSTOM"];
const namePolicy = ["MODEL", "CUSTOM", "SUMMARY"];

// Helper function to format timestamps for contact list view
export function getContactorLastTime(input) {
  let timeVal = null;
  if (typeof input === "number" && input > 0) {
    timeVal = input;
  } else if (Array.isArray(input)) {
    const last = input[input.length - 1];
    timeVal = last?.time || null;
  } else if (input && typeof input === "object") {
    timeVal = input.lastMessageTime || input.lastUpdate || input.time;
  }
  if (!timeVal) {
    return "";
  }

  const currentTime = Date.now();
  const lastTime = new Date(timeVal);
  const timeDiff = currentTime - lastTime.getTime();

  if (timeDiff < 24 * 60 * 60 * 1000) {
    const hours = lastTime.getHours().toString().padStart(2, "0");
    const minutes = lastTime.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  } else if (timeDiff < 48 * 60 * 60 * 1000) {
    return "昨天";
  } else if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const weekday = lastTime.getDay();
    return `星期${weekdays[weekday]}`;
  } else {
    const year = lastTime.getFullYear();
    const month = (lastTime.getMonth() + 1).toString().padStart(2, "0");
    const day = lastTime.getDate().toString().padStart(2, "0");
    return `${year}/${month}/${day}`;
  }
}

// Helper function to format timestamp in chat bubbles
export function getShownTime(timestamp) {
  const currentTime = Date.now();
  const timeDiff = currentTime - timestamp;
  if (timeDiff < 24 * 60 * 60 * 1000) {
    const hours = new Date(timestamp).getHours().toString().padStart(2, "0");
    const minutes = new Date(timestamp)
      .getMinutes()
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}`;
  } else if (timeDiff < 48 * 60 * 60 * 1000) {
    const hours = new Date(timestamp).getHours().toString().padStart(2, "0");
    const minutes = new Date(timestamp)
      .getMinutes()
      .toString()
      .padStart(2, "0");
    return `昨天 ${hours}:${minutes}`;
  } else if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const weekday = new Date(timestamp).getDay();
    const hours = new Date(timestamp).getHours().toString().padStart(2, "0");
    const minutes = new Date(timestamp)
      .getMinutes()
      .toString()
      .padStart(2, "0");
    return `星期${weekdays[weekday]} ${hours}:${minutes}`;
  } else {
    const year = new Date(timestamp).getFullYear();
    const month = (new Date(timestamp).getMonth() + 1)
      .toString()
      .padStart(2, "0");
    const day = new Date(timestamp).getDate().toString().padStart(2, "0");
    const hours = new Date(timestamp).getHours().toString().padStart(2, "0");
    const minutes = new Date(timestamp)
      .getMinutes()
      .toString()
      .padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }
}
export function getAvatarByModel(model, provider = null) {
  if (model) {
    // v=2: cache-bust，旧 301 缓存失效，确保头像映射更新后客户端无需手动清缓存
    return `/p/mava?model=${encodeURIComponent(model)}&provider=${encodeURIComponent(provider || "")}&v=2`;
  }
  if (provider) {
    const providers = config.baseConfig?.llm_providers || [];
    const targetProvider = providers.find((p) => p.displayName === provider);
    if (targetProvider?.adapterType) {
      return getAvatarByAdapterType(targetProvider.adapterType);
    }
  }
  return `/p/mava?provider=${provider || "OpenAI"}`;
}

export function getMessageText(element) {
  switch (element.type) {
    case "text":
      return element.data.text;
    case "image":
      return "[图片]";
    case "record":
      return "[语音]";
    case "video":
      return "[视频]";
    case "file":
      return "[文件]";
    case "tool_call":
      return `[调用工具] ${element.data.name}`;
    case "reason":
      return element.data.text;
    case "blank":
      return "思考中...";
    case "reply":
      return "";
    case "nodes":
      return "[转发消息]";
    default:
      return "[未知消息类型] " + element.type;
  }
}

export function getLastMessageSummary(messageChain, message = null) {
  let msg = message || messageChain[messageChain.length - 1];
  if (!msg) return "";
  if (msg.type === "node") {
    msg = msg.data;
  }

  return msg.content?.length > 0
    ? msg.content.find((c) => c.type === "text")?.data.text ||
        getMessageText(msg.content[0])
    : "[未知消息]";
}

export function formatErrorMessage(error) {
  if (!error) return "⚠️ **请求失败**: 未知错误";
  if (typeof error === "string") {
    return error.startsWith("⚠️") ? error : `⚠️ **请求失败**: ${error}`;
  }
  const msg = error.message || error.error;
  if (typeof msg === "string") {
    return msg.startsWith("⚠️") ? msg : `⚠️ **请求失败**: ${msg}`;
  }
  try {
    return `⚠️ **请求失败**\n\n\`\`\`json\n${JSON.stringify(msg || error, null, 2)}\n\`\`\``;
  } catch {
    return `⚠️ **请求失败**: ${String(msg || error)}`;
  }
}

export const useContactorsStore = defineStore("contactors", () => {
  // State
  const contactors = ref({});
  const activeContactorId = ref(null);

  // Getters
  // 置顶语义统一为数字 0（置顶）/ 1（普通）。比较器对历史遗留的布尔值
  // （GroupSettingsView 曾把 el-switch 的 true/false 直接写入 priority）做归一化，
  // 否则 false - 1 = -1 会把未置顶的群排到所有普通会话之前、true - 1 = 0 会让置顶失效。
  const normPriority = (p) => (p === true || p === 0 ? 0 : 1);
  const sortedContactors = computed(() => {
    return Object.values(contactors.value).sort((a, b) => {
      const pa = normPriority(a.priority);
      const pb = normPriority(b.priority);
      if (pa !== pb) return pa - pb;
      return b.lastUpdate - a.lastUpdate;
    });
  });

  const activeContactor = computed(() => {
    if (!activeContactorId.value) return null;
    return contactors.value[activeContactorId.value] || null;
  });

  // Actions
  function loadContactors(list) {
    const newContactors = {};
    list.forEach((item) => {
      newContactors[item.id] = {
        platform: item.platform,
        id: String(item.id),
        agentId: item.agentId,
        sessionId: item.sessionId,
        parentSessionId: item.parentSessionId,
        runId: item.runId,
        groupId: item.groupId,
        runStatus: item.runStatus,
        readOnly: item.readOnly === true || item.platform === "sub_agent",
        namePolicy: item.namePolicy ?? 0,
        avatarPolicy: item.avatarPolicy ?? 0,
        title: item.title,
        name: item.name,
        avatar: item.avatar,
        intro: item.intro ?? "",
        notice: item.notice ?? "",
        maxInvocationDepth: item.maxInvocationDepth,
        defaultResponderId: item.defaultResponderId ?? "",
        toolCallContextMode: item.toolCallContextMode || "brief",
        members: item.members ?? [],
        priority:
          item.priority === true
            ? 0
            : item.priority === false
              ? 1
              : (item.priority ?? 1),
        firstMessageIndex: item.firstMessageIndex ?? 0,
        messageChain: Array.isArray(item.messageChain)
          ? item.messageChain
              // 存量数据清洗：历史状态别名（running / processing / final 等）就地归一，
              // 防止旧数据以非规范状态进入消息链
              .map((m) => (m && m.id ? normalizeMessage(m) : m))
              .filter((message) => !isLegacyInteractionBubble(message))
              // 存量清洗：丢掉只剩 blank 占位的历史消息（不承载内容，留着只会变成空消息）
              .filter((message) => !isBlankPlaceholder(message))
              .map((m) =>
                m && (m.status === "completed" || m.status === "failed")
                  ? markRaw(m)
                  : m,
              )
          : [],
        active: false,
        lastUpdate: item.lastUpdate ?? Date.now(),
        createTime: item.createTime ?? Date.now(),
        hasPendingTask: item.hasPendingTask ?? false,
        draft: item.draft ?? "",
        options: item.options || {},
        lastMessageSummary: item.lastMessageSummary || "",
      };

      if (
        item.platform === "openai" &&
        !newContactors[item.id].options.crystallization
      ) {
        newContactors[item.id].options.crystallization = {
          enabled: true,
          latestSummary: "",
          tokenWatermark: "auto",
        };
      }

      // Auto initialize details
      loadContactorName(newContactors[item.id]);
      loadContactorAvatar(newContactors[item.id]);
      updateContactorSummary(newContactors[item.id]);
    });
    contactors.value = newContactors;
  }

  function addContactor(platform, data) {
    const id = String(data.id || numberString(16));
    const newContactor = {
      platform,
      id,
      namePolicy: data.namePolicy ?? 0,
      avatarPolicy: data.avatarPolicy ?? 0,
      title: data.title,
      name: data.name,
      avatar: data.avatar,
      priority: data.priority ?? 1,
      firstMessageIndex: data.firstMessageIndex ?? 0,
      messageChain: data.messageChain ?? [],
      active: false,
      lastUpdate: data.lastUpdate || Date.now(),
      createTime: data.createTime || Date.now(),
      hasPendingTask: data.hasPendingTask ?? false,
      draft: data.draft ?? "",
      options: data.options || {},
      lastMessageSummary: "",
    };

    if (platform === "openai" && !newContactor.options.crystallization) {
      newContactor.options.crystallization = {
        enabled: true,
        latestSummary: "",
        tokenWatermark: "auto",
      };
    }

    loadContactorName(newContactor);
    loadContactorAvatar(newContactor);
    updateContactorSummary(newContactor);

    contactors.value[id] = newContactor;
    client.setLocalStorage();
    return newContactor;
  }

  async function addGroupContactor({
    name,
    intro = "",
    members = [],
    avatarPolicy = "composite",
    avatar = null,
  }) {
    const id = numberString(10);

    const newGroup = {
      platform: "group",
      id,
      name: name || "Agent 群聊",
      intro: intro || "",
      title: "group",
      avatarPolicy,
      avatar: avatar || null,
      members: members.map((m) => ({
        id: m.id || numberString(10),
        agentId: m.agentId || m.id,
        name: m.name || "Agent",
        avatar: m.avatar || "/static/icons/512x512.png",
        title: m.title || "成员",
        intro: m.intro || "",
        namePolicy: m.namePolicy !== undefined ? m.namePolicy : 0,
        avatarPolicy: m.avatarPolicy !== undefined ? m.avatarPolicy : 0,
        options: m.options
          ? JSON.parse(JSON.stringify(m.options))
          : client.config?.getLLMDefaultConfig?.() || {},
      })),
      priority: 1,
      firstMessageIndex: 0,
      messageChain: [],
      active: false,
      lastUpdate: Date.now(),
      createTime: Date.now(),
      hasPendingTask: false,
      draft: "",
      toolCallContextMode: "brief",
      options: {
        base: { max_messages_num: 20 },
      },
      lastMessageSummary: "",
    };

    contactors.value[id] = newGroup;
    client.setLocalStorage();
    return newGroup;
  }

  async function addAgentContactor({
    id,
    name,
    avatar,
    defaultSessionId,
    model,
    provider,
    intro,
    priority = 0,
    lastMessageSummary = "",
    lastUpdate = Date.now(),
  }) {
    const contactorId = id || `agent_${numberString(8)}`;
    if (contactors.value[contactorId]) {
      return contactors.value[contactorId];
    }
    const newChannel = {
      platform: "agent",
      id: contactorId,
      agentId: contactorId,
      sessionId: defaultSessionId || "",
      name: name || "Agent",
      avatar: avatar || "/static/icons/512x512.png",
      title: "agent",
      namePolicy: 1,
      avatarPolicy: 1,
      intro: intro || "Agent",
      notice: "",
      priority: priority ?? 0,
      firstMessageIndex: 0,
      messageChain: [],
      active: false,
      lastUpdate: lastUpdate || Date.now(),
      createTime: Date.now(),
      hasPendingTask: false,
      draft: "",
      options: {
        model: model || "",
        provider: provider || "",
      },
      lastMessageSummary: lastMessageSummary || "",
    };

    contactors.value[contactorId] = newChannel;
    client.setLocalStorage();
    return newChannel;
  }

  function upsertSubAgentContactor(run, { avatar = "" } = {}) {
    if (!run?.sessionId || !run?.agentId) return null;

    const id = `sub_agent_${run.sessionId}`;
    const existing = contactors.value[id];
    const lastUpdate = new Date(
      run.finishedAt || run.startedAt || run.createdAt || Date.now(),
    ).getTime();
    const name =
      run.role ||
      run.subagentRole ||
      run.title ||
      run.subagentKey ||
      run.jobKey ||
      "SubAgent";

    if (existing) {
      Object.assign(existing, {
        agentId: String(run.agentId),
        sessionId: String(run.sessionId),
        parentSessionId: String(run.parentSessionId || ""),
        runId: String(run.id || existing.runId || ""),
        groupId: String(run.groupId || existing.groupId || ""),
        runStatus: run.status || existing.runStatus || "",
        readOnly: true,
        name,
        title: run.status ? `SubAgent · ${run.status}` : "SubAgent",
        lastUpdate: Math.max(existing.lastUpdate || 0, lastUpdate || 0),
      });
      if (avatar) existing.avatar = avatar;
      if (run.model || run.provider) {
        existing.options = {
          ...(existing.options || {}),
          model: run.model || existing.options?.model || "",
          provider: run.provider || existing.options?.provider || "",
        };
      }
      return existing;
    }

    const contactor = {
      platform: "sub_agent",
      id,
      agentId: String(run.agentId),
      sessionId: String(run.sessionId),
      parentSessionId: String(run.parentSessionId || ""),
      runId: String(run.id || ""),
      groupId: String(run.groupId || ""),
      runStatus: run.status || "",
      readOnly: true,
      name,
      title: run.status ? `SubAgent · ${run.status}` : "SubAgent",
      namePolicy: 1,
      avatarPolicy: 1,
      avatar:
        avatar ||
        getAvatarByModel(run.model || "", run.provider || null) ||
        "/static/icons/512x512.png",
      intro: run.objective || "只读 SubAgent Session",
      priority: 1,
      firstMessageIndex: 0,
      messageChain: [],
      active: false,
      lastUpdate: lastUpdate || Date.now(),
      createTime: new Date(run.createdAt || Date.now()).getTime(),
      hasPendingTask: false,
      draft: "",
      options: {
        model: run.model || "",
        provider: run.provider || "",
      },
      lastMessageSummary: run.objective || "",
    };
    contactors.value[id] = contactor;
    client.setLocalStorage();
    return contactor;
  }

  function removeContactor(id) {
    if (contactors.value[id]) {
      delete contactors.value[id];
      if (activeContactorId.value === id) {
        activeContactorId.value = null;
      }
      if (client.removeContactorMessages) {
        client.removeContactorMessages(id);
      }
      client.setLocalStorage();
    }
  }

  function selectContactor(id) {
    activeContactorId.value = id;

    // Set active status flags
    Object.keys(contactors.value).forEach((cid) => {
      contactors.value[cid].active = cid === id;
    });

    if (id && contactors.value[id]) {
      const contactor = contactors.value[id];
      contactor.hasPendingTask = false;
      if (
        contactor.platform === "openai" &&
        !contactor.options.crystallization
      ) {
        contactor.options.crystallization = {
          enabled: true,
          latestSummary: "",
          tokenWatermark: "auto",
        };
        client.setLocalStorage();
      }
    }
  }

  function updateDraft(id, draftText) {
    const contactor = contactors.value[id];
    if (contactor) {
      contactor.draft = draftText;
      client.setLocalStorage();
    }
  }

  function setPriority(id, priority) {
    const contactor = contactors.value[id];
    if (contactor) {
      // 归一化：true/0 → 0 置顶，其余 → 1 普通，防止布尔值污染排序与置顶样式
      contactor.priority = priority === true || priority === 0 ? 0 : 1;
      client.setLocalStorage();
    }
  }

  function loadContactorAvatar(contactor) {
    if (contactor.platform === "agent" || contactor.platform === "sub_agent") {
      return;
    }
    let avatar = "/static/icons/512x512.png";
    if (avatarPolicy[contactor.avatarPolicy] === "MODEL") {
      const model = contactor.options?.base?.model || contactor.options?.model;
      avatar = getAvatarByModel(model, contactor.options?.provider);
    } else if (avatarPolicy[contactor.avatarPolicy] === "CUSTOM") {
      avatar = contactor.avatar || avatar;
    }

    if (contactor.platform === "openai" && contactor.options?.base?.model) {
      contactor.title = contactor.options.base.model;
    }

    contactor.avatar = avatar;
  }

  function loadContactorName(contactor) {
    if (contactor.platform === "agent" || contactor.platform === "sub_agent") {
      return;
    }
    let name = contactor.name ?? "未命名 Bot";
    if (namePolicy[contactor.namePolicy] === "MODEL") {
      const model = contactor.options?.base?.model || contactor.options?.model;
      name = model || name;
    } else if (namePolicy[contactor.namePolicy] === "CUSTOM") {
      name = contactor.name;
    } else if (namePolicy[contactor.namePolicy] === "SUMMARY") {
      name = contactor.name || "新建会话";
    }
    contactor.name = name;
  }

  function updateContactorSummary(contactor) {
    const summary = getLastMessageSummary(contactor.messageChain);
    if (summary) {
      contactor.lastMessageSummary = summary;
    } else if (
      contactor.platform !== "agent" &&
      contactor.platform !== "sub_agent"
    ) {
      contactor.lastMessageSummary = "";
    }
  }

  // Messaging operations
  function getOrCreateMessage(contactorId, messageId, defaults = {}) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return null;

    // ID 归一化：消息链内 id 恒为字符串（normalizeMessage / message.rekey 都做过 String()），
    // 但部分来源的 messageId 是后端数字型 id（如 OneBot 的 genMessageID() 返回值）。
    // 必须统一 String() 后再比较：否则严格相等失配会“找不到”消息，
    // 进而凭空 push 出一条 role:"other" 的幻影气泡，而真正的消息永远停在 pending。
    const targetId =
      messageId === undefined || messageId === null
        ? messageId
        : String(messageId);

    let message = contactor.messageChain.find(
      (msg) => String(msg?.id) === String(targetId),
    );
    if (!message) {
      message = {
        role: defaults.role || "other",
        time: defaults.time || Date.now(),
        status: defaults.status || "pending",
        id: targetId,
        content: defaults.content || [{ type: "blank", data: {} }],
      };
      contactor.messageChain.push(message);
    }
    return message;
  }

  /**
   * The only ingress for message state coming from UI, Socket.IO, stream-cache
   * replay, or persisted history. Compatibility helpers below remain available
   * for old callers, but transports must dispatch an event here instead of
   * mutating messageChain themselves.
   */
  function applyMessageEvent(event) {
    const contactorId = event?.contactorId;
    const contactor = contactors.value[contactorId];
    if (!contactor) return { accepted: false, message: null };

    let result = { accepted: false, message: null };
    switch (event.type) {
      case "message.upsert":
        result = upsertMessage(contactor.messageChain, event.message, {
          authority: event.authority,
          index: event.index,
          prepend: event.prepend,
        });
        break;
      case "message.patch": {
        const current = contactor.messageChain.find(
          (message) => String(message?.id) === String(event.messageId),
        );
        if (!current) break;
        result = upsertMessage(
          contactor.messageChain,
          { ...current, ...event.patch, id: current.id },
          { authority: "replace" },
        );
        break;
      }
      case "history.reconcile": {
        const merged = mergeMessageHistory(
          contactor.messageChain,
          event.messages,
          event.mode || "replace",
        );
        result = { accepted: true, ...merged };
        break;
      }
      case "message.chunk": {
        // 流式热路径必须保持纯内存、只做一次消息定位。摘要计算和持久化
        // 统一留到 complete/failed，避免每个 80ms chunk 重复扫描与序列化。
        let current = contactor.messageChain.find(
          (message) => String(message?.id) === String(event.messageId),
        );
        if (isTerminalMessage(current)) {
          // 用户中止时前端会“乐观地”先把消息置为终态，而服务端随后仍会补发这条
          // toolCall 的终态帧（action: finished + status: aborted）。这类终态更新
          // 必须放行，否则工具条永远停在 running，计时器会一直跑。
          const incoming = event.data?.tool_call;
          const isTerminalToolCallFrame =
            event.chunkType === "tool_call" &&
            incoming &&
            (incoming.action === "finished" ||
              incoming.action === "failed" ||
              incoming.status === "aborted" ||
              incoming.status === "failed" ||
              Boolean(incoming.result));
          if (!isTerminalToolCallFrame) {
            return { accepted: false, message: null };
          }
        }
        if (current?.__v_skip) {
          const idx = contactor.messageChain.indexOf(current);
          if (idx !== -1) {
            contactor.messageChain.splice(idx, 1, unmarkRaw(current));
            current = contactor.messageChain[idx];
          }
        }
        const message = appendOrUpdateMessage(
          contactorId,
          event.messageId,
          event.data,
          event.chunkType,
          { message: current, updateSummary: false },
        );
        result = {
          accepted: Boolean(message),
          message,
        };
        break;
      }
      case "message.snapshot":
        syncMessage(contactorId, {
          ...event.snapshot,
          messageId: event.messageId,
        });
        result = {
          accepted: true,
          message: getOrCreateMessage(contactorId, event.messageId),
        };
        break;
      case "message.complete":
        completeMessage(contactorId, event.messageId, event.options);
        result = {
          accepted: true,
          message: getOrCreateMessage(contactorId, event.messageId),
        };
        break;
      case "message.failed":
        failedMessage(contactorId, event.messageId, event.error);
        result = {
          accepted: true,
          message: getOrCreateMessage(contactorId, event.messageId),
        };
        break;
      case "message.usage":
        updateMessageUsage(contactorId, event.messageId, event.usage);
        result = {
          accepted: true,
          message: getOrCreateMessage(contactorId, event.messageId),
        };
        break;
      case "message.crystallize":
        handleCrystallizeEvent(contactorId, event.messageId, event.data);
        result = {
          accepted: true,
          message: getOrCreateMessage(contactorId, event.messageId),
        };
        break;
      case "message.remove": {
        const index = contactor.messageChain.findIndex(
          (message) => String(message?.id) === String(event.messageId),
        );
        if (index !== -1) {
          contactor.messageChain.splice(index, 1);
          result = { accepted: true, message: null };
        }
        break;
      }
      case "message.rekey": {
        const message = contactor.messageChain.find(
          (item) => String(item?.id) === String(event.messageId),
        );
        if (message && event.nextMessageId) {
          message.id = String(event.nextMessageId);
          result = { accepted: true, message };
        }
        break;
      }
      default:
        return result;
    }

    if (result.accepted && event.type === "message.chunk") {
      return result;
    }

    const lifecycleHandledByMutation = [
      "message.snapshot",
      "message.complete",
      "message.failed",
      "message.usage",
      "message.crystallize",
    ].includes(event.type);

    if (result.accepted && !lifecycleHandledByMutation) {
      contactor.lastUpdate = event.time || Date.now();
      if (event.markPending && !contactor.active) {
        contactor.hasPendingTask = true;
      }
      updateContactorSummary(contactor);
      if (event.persist !== false) {
        client.setLocalStorage();
        // 消息本体也要落盘：此前只有 complete/failed 等少数生命周期会写
        // mio_msg_*，入站消息走的 message.upsert 只写了元数据 → 一刷新就丢。
        // 守卫与文件内其余落盘点保持一致（单测里的 client 是部分 mock）。
        if (client.saveContactorMessages) {
          client.saveContactorMessages(contactorId);
        }
      }
    }
    return result;
  }

  function appendOrUpdateMessage(
    contactorId,
    messageId,
    data,
    type,
    options = {},
  ) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return null;

    const message =
      options.message || getOrCreateMessage(contactorId, messageId);
    if (!message) return null;

    contactor.lastUpdate = Date.now();
    if (!contactor.active) {
      contactor.hasPendingTask = true;
    }

    const content = message.content;

    if (type === "reason") {
      const last = content[content.length - 1];
      if (last?.type === "reason") {
        last.data.text += data.reasoning_content;
        if (data.duration) last.data.duration = data.duration;
      } else {
        const msgElm = {
          type: "reason",
          data: {
            text: data.reasoning_content,
            startTime: data.startTime || Date.now(),
            duration: data.duration || 0,
            endTime: 0,
          },
        };
        replaceBlankOrAppend(content, msgElm);
      }
    } else if (type === "content") {
      closeReasoningBlocks(content, true);
      const last = content[content.length - 1];
      if (last?.type === "text") {
        last.data.text += data.chunk;
      } else {
        const msgElm = {
          type: "text",
          data: { text: data.chunk },
        };
        replaceBlankOrAppend(content, msgElm);
      }
    } else if (type === "tool_call") {
      closeReasoningBlocks(content, true);
      const tool_call = data.tool_call;
      const index = content.findIndex(
        (elm) => elm.type === "tool_call" && elm.data?.id === tool_call.id,
      );

      const msgElm = {
        type: "tool_call",
        data: {
          ...tool_call,
        },
      };

      if (index === -1) {
        replaceBlankOrAppend(content, msgElm);
      } else {
        const merged = mergeToolCall(content[index], tool_call);
        content.splice(index, 1, merged);

        // Check memory and toolsmanager tool calls
        const toolName = (merged.data.name || "").split("_mid_")[0];
        if (toolName === "memory" && merged.data.result?.success) {
          recordMemory(
            contactorId,
            merged.data.parameters || merged.data.arguments,
            merged.data.result,
            message.senderMemberId || message.sender_id || null,
          );
        } else if (toolName === "toolsmanager" && merged.data.result?.success) {
          recordToolsUpdate(contactorId, merged.data.result);
        }
      }
    }

    if (options.updateSummary !== false) updateContactorSummary(contactor);
    return message;
  }

  function updateMessageUsage(contactorId, messageId, usage) {
    if (!usage) return;
    const contactor = contactors.value[contactorId];
    if (!contactor) return;
    const message = getOrCreateMessage(contactorId, messageId);
    if (!message) return;
    message.usage = { ...(message.usage || {}), ...usage };
    client.setLocalStorage();
  }

  function replaceBlankOrAppend(content, element) {
    if (!content.length) {
      content.push(element);
      return;
    }
    const blankIndex = content.findIndex((elm) => elm.type === "blank");
    if (blankIndex !== -1) {
      content.splice(blankIndex, 1, element);
    } else {
      content.push(element);
    }
  }

  function closeReasoningBlocks(content, force = false) {
    const now = Date.now();
    content.forEach((elm) => {
      if (elm.type !== "reason" || elm.data.endTime || elm.data.duration > 0)
        return;
      if (!force) return;
      elm.data.endTime = now;
      if (elm.data.startTime) {
        elm.data.duration = elm.data.endTime - elm.data.startTime;
      }
    });
  }

  function mergeToolCall(previousElm, incomingToolCall) {
    const previousData = previousElm.data || {};

    const merged = {
      ...previousElm,
      data: {
        ...previousData,
        ...incomingToolCall,
      },
    };
    if (incomingToolCall.action === "pending") {
      merged.data.parameters =
        String(previousData.parameters || "") +
        String(incomingToolCall.parameters || "");
    }
    return merged;
  }
  function recordToolsUpdate(contactorId, result) {
    if (!result || !result.success || !result.activeToolsList) return;
    const contactor = contactors.value[contactorId];
    if (contactor) {
      if (!contactor.options) contactor.options = {};
      if (!contactor.options.toolCallSettings)
        contactor.options.toolCallSettings = {};
      contactor.options.toolCallSettings.tools = result.activeToolsList;
      updateContactorSummary(contactor);
      client.setLocalStorage();
      console.log(
        `[Store] Contactor ${contactorId} tools updated persistently via toolsmanager toolcall result:`,
        result.activeToolsList,
      );
    }
  }

  /**
   * 解析「记忆结晶的宿主」。
   *
   * 单聊：宿主就是联系人本身，结晶挂在 contactor.options.crystallization。
   * 群聊：群共用一条 messageChain，但每个 Agent 成员对这条链的压缩进度和
   *       压缩结果都是独立的，所以宿主是成员，结晶挂在 member.options.crystallization。
   *       成员另有 lastCompressedIndex，记录它压缩到了群消息链的哪个下标。
   *
   * 两者的结晶结构完全一致，因此拿到宿主后续逻辑可以完全复用。
   *
   * @param {string} contactorId
   * @param {string|null} memberId 群成员 ID；单聊传 null
   * @returns {object|null} 宿主对象（contactor 或 member）
   */
  function getCrystalHost(contactorId, memberId = null) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return null;
    if (contactor.platform !== "group") return contactor;
    if (!memberId) return null; // 群聊必须指明成员，避免误写到群对象上
    return (
      (contactor.members || []).find(
        (m) => m.id === memberId || m.agentId === memberId,
      ) || null
    );
  }

  /**
   * 确保宿主上存在 crystallization 结构并返回它
   */
  function ensureCrystallization(host) {
    if (!host) return null;
    if (!host.options) host.options = {};
    if (!host.options.crystallization) {
      host.options.crystallization = {
        enabled: true,
        globalMemoryEnabled: true,
        latestSummary: "",
        tokenWatermark: "auto",
      };
    }
    return host.options.crystallization;
  }

  async function recordMemory(
    contactorId,
    parameters,
    result = null,
    memberId = null,
  ) {
    if (!parameters) return;

    let params = parameters;
    if (typeof params === "string") {
      try {
        params = JSON.parse(params);
      } catch (e) {
        console.error("[Memory] 解析参数失败:", e);
        return;
      }
    }

    // ==================== 1. 全局长期记忆 (scope: 'global') ====================
    if (params.scope === "global" || result?.scope === "global") {
      const action = params.action || result?.action || "add";
      const content = params.content || result?.content || "";
      const target = params.target || result?.target || "";
      const category = params.category || result?.category || "general";

      try {
        if (action === "add" && content) {
          await addGlobalMemoryItem({ content, category });
        } else if (action === "delete") {
          // target 可以是 id（如 mem_xxx）或匹配内容
          const currentMem = client._clientSettings?.globalMemory || [];
          const matched = currentMem.find(
            (m) => m.id === target || m.content.includes(target),
          );
          if (matched) {
            await deleteGlobalMemoryItem(matched.id);
          }
        } else if (action === "update") {
          const currentMem = client._clientSettings?.globalMemory || [];
          const matched = currentMem.find(
            (m) => m.id === target || m.content.includes(target),
          );
          if (matched) {
            await updateGlobalMemoryItem(matched.id, { content, category });
          } else if (content) {
            await addGlobalMemoryItem({ content, category });
          }
        }
        // 同步内存中的 client._clientSettings.globalMemory
        if (client._clientSettings) {
          const { getClientSettings } = await import("@/lib/clientSettings.js");
          client._clientSettings = await getClientSettings();
        }
      } catch (err) {
        console.error("[Memory] 全局长期记忆处理异常:", err);
      }
      return;
    }

    const contactor = contactors.value[contactorId];
    if (!contactor) return;

    // 群聊里 memory 工具是某个成员调用的，必须写进该成员自己的结晶，
    // 否则所有成员的记忆会串到一起。解析不到宿主就直接放弃，不要退化成写群对象。
    const host = getCrystalHost(contactorId, memberId);
    if (!host) return;

    const question =
      params.question || params.target || params.topic || params.key || "";
    const answer =
      params.answer ||
      params.content ||
      params.value ||
      (typeof result === "string"
        ? result
        : result?.content || result?.message || "");

    // 1. 如果开启了记忆结晶功能：
    // 为了保护大模型 Prompt Cache 输入缓存的稳定性，单次对话内的局部记忆变动（add/update/delete）
    // 不直接修改 latestSummary，而是先缓存进 pendingMemoryEvents。
    // 等到后续真正触发「上下文记忆压缩」时，由压缩服务全量提炼并统一覆盖，实现零缓存抖动！
    if (host.options?.crystallization?.enabled) {
      const crystal = ensureCrystallization(host);
      if (!Array.isArray(crystal.pendingMemoryEvents)) {
        crystal.pendingMemoryEvents = [];
      }
      crystal.pendingMemoryEvents.push({
        action: params.action || "add",
        zone: params.zone || "long_term_profile",
        content: params.content || answer || "",
        target: params.target || question || "",
        time: Date.now(),
      });
      client.setLocalStorage();
      return;
    }

    // 2. 如果未开启结晶功能，使用原始的 history 键值对追加
    if (!host.options) host.options = {};
    if (!host.options.presetSettings) {
      host.options.presetSettings = { opening: "", history: [] };
    }
    if (!host.options.presetSettings.history) {
      host.options.presetSettings.history = [];
    }

    const isDuplicate = host.options.presetSettings.history.some(
      (item, idx, arr) => {
        if (item.role === "user" && item.content === question) {
          const next = arr[idx + 1];
          return next && next.role === "assistant" && next.content === answer;
        }
        return false;
      },
    );

    if (isDuplicate) return;

    host.options.presetSettings.history.push({
      role: "user",
      content: question,
    });
    host.options.presetSettings.history.push({
      role: "assistant",
      content: answer,
    });

    client.setLocalStorage();
  }

  /**
   * 向 XML 分区字符串中的指定标签末尾追加内容
   */
  function appendToXmlZone(xmlStr, tagName, content) {
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;
    if (xmlStr.includes(openTag)) {
      return xmlStr.replace(closeTag, `\n${content}\n${closeTag}`);
    }
    return xmlStr + `\n${openTag}\n${content}\n${closeTag}`;
  }

  /**
   * 处理后端推送的结晶流式事件
   * - 'running': 在当前消息 content 中插入结晶事件条
   * - 'finished': 更新 latestSummary，持久化
   */
  function handleCrystallizeEvent(contactorId, messageId, data) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;

    const { status, summary } = data;

    if (status === "running") {
      const message = getOrCreateMessage(contactorId, messageId);
      if (message) {
        let eventElm = message.content.find(
          (c) => c.type === "crystallize_event",
        );
        if (!eventElm) {
          // 移除等待中的 blank 占位块
          const blankIndex = message.content.findIndex(
            (elm) => elm.type === "blank",
          );
          if (blankIndex !== -1) {
            message.content.splice(blankIndex, 1);
          }
          eventElm = {
            type: "crystallize_event",
            data: { status: "running", summary: summary || "" },
          };
          message.content.push(eventElm);
        } else {
          eventElm.data.status = "running";
          if (summary !== undefined) {
            eventElm.data.summary = summary;
          }
        }
      }
    } else if (status === "failed") {
      // 压缩失败只关闭状态条。不能覆盖已提交结晶，也不能清空待压缩记忆，
      // 否则一次临时 LLM 故障就会造成事实丢失。
      const message = getOrCreateMessage(contactorId, messageId);
      if (message) {
        const eventElm = message.content.find(
          (c) => c.type === "crystallize_event",
        );
        if (eventElm) {
          eventElm.data.status = "failed";
        } else {
          message.content.push({
            type: "crystallize_event",
            data: { status: "failed", summary: "" },
          });
        }
      }
    } else if (status === "finished") {
      const displaySummary = summary || "";

      // 群聊：结晶属于产出它的那个成员，写到成员自己身上；
      // 同时把「压缩到哪」记为该消息在群消息链中的下标 —— 群成员共用一条链，
      // 各自的压缩进度不同，必须用显式下标而非扫描 crystallize_event 来定位。
      const msgIndex = contactor.messageChain.findIndex(
        (m) => m.id === messageId,
      );
      const memberId =
        contactor.platform === "group" && msgIndex !== -1
          ? contactor.messageChain[msgIndex].senderMemberId ||
            contactor.messageChain[msgIndex].sender_id
          : null;

      const host = getCrystalHost(contactorId, memberId);
      if (host) {
        const crystal = ensureCrystallization(host);
        crystal.latestSummary = displaySummary;
        crystal.pendingMemoryEvents = []; // 压缩已将所有历史事实全量整合，清空待处理队列
        crystal.lastUpdatedAt = Date.now();

        if (contactor.platform === "group" && msgIndex !== -1) {
          // 存下标本身（含该条消息）：下次组装上下文时从这里往下取。
          // 取闭区间起点而非 msgIndex + 1，保证边界消息不会两头都不覆盖。
          host.lastCompressedIndex = msgIndex;
        }
      }

      const message = getOrCreateMessage(contactorId, messageId);
      if (message) {
        const eventElm = message.content.find(
          (c) => c.type === "crystallize_event",
        );
        if (eventElm) {
          eventElm.data.status = "finished";
          eventElm.data.summary = displaySummary;
        } else {
          // 兜底：如果错过了 running 事件直接渲染完成
          message.content.push({
            type: "crystallize_event",
            data: { status: "finished", summary: displaySummary },
          });
        }
      }

      client.setLocalStorage();
    }
  }

  /**
   * 更新联系人的结晶配置
   */
  /**
   * 更新联系人 options 中指定 section 的部分字段
   * @param {string} contactorId
   * @param {string} section - 如 "base"、"chatParams" 等
   * @param {Object} patch - 要合并的字段
   * @param {string|null} memberId - 群成员 ID，单聊留空
   */
  function updateContactorOption(contactorId, section, patch, memberId = null) {
    const host = getCrystalHost(contactorId, memberId);
    if (!host) return;
    if (!host.options) host.options = {};
    if (!host.options[section]) host.options[section] = {};
    Object.assign(host.options[section], patch);
    client.setLocalStorage();
  }

  function updateCrystallization(contactorId, patch, memberId = null) {
    const host = getCrystalHost(contactorId, memberId);
    if (!host) return;
    const crystal = ensureCrystallization(host);
    Object.assign(crystal, patch);
    client.setLocalStorage();
  }

  function syncMessage(contactorId, e) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;

    const { chunks, status, messageId, metaData, error } = e;
    const message = getOrCreateMessage(contactorId, messageId, {
      time: metaData?.timestamp,
    });

    if (message) {
      message.triggerType =
        metaData?.triggerType || (metaData?.isTask ? "task" : "chat");
      if (metaData?.wakeType) {
        message.wakeType = metaData.wakeType;
      }
      if (metaData?.timestamp) {
        message.time = metaData.timestamp;
      }
      if (metaData?.memberName || metaData?.memberId) {
        message.sender_id = metaData.memberId;
        message.sender_name = metaData.memberName;
        message.sender_avatar = metaData.memberAvatar;
        message.senderMemberId = metaData.memberId;
        message.senderName = metaData.memberName;
        message.senderAvatar = metaData.memberAvatar;
      }
    }

    const newContent = [];
    if (chunks && Array.isArray(chunks)) {
      const now = Date.now();
      chunks.forEach((chunk) => {
        if (chunk.type === "reason") {
          newContent.push({
            type: "reason",
            data: {
              text: chunk.data?.text ?? "",
              startTime: chunk.data?.startTime || now,
              duration: chunk.data?.duration ?? 0,
            },
          });
        } else if (chunk.type === "content") {
          newContent.push({
            type: "text",
            data: { text: chunk.content },
          });
        } else if (chunk.type === "toolCall") {
          let callStatus = "waiting";
          if (chunk.content.result) {
            callStatus = "done";
          } else if (
            chunk.content.action === "running" ||
            chunk.content.action === "pending"
          ) {
            callStatus = "running";
          }

          const toolCallData = {
            ...chunk.content,
            arguments:
              chunk.content.arguments || chunk.content.parameters || "",
            status: callStatus,
          };

          // Special tool handlers (memory and toolsmanager)
          const toolName = (toolCallData.name || "").split("_mid_")[0];
          if (toolName === "memory" && toolCallData.result?.success) {
            recordMemory(
              contactorId,
              toolCallData.parameters || toolCallData.arguments,
              toolCallData.result,
              metaData?.memberId ||
                message?.senderMemberId ||
                message?.sender_id ||
                null,
            );
          } else if (
            toolName === "toolsmanager" &&
            toolCallData.result?.success
          ) {
            recordToolsUpdate(contactorId, toolCallData.result);
          }

          newContent.push({
            type: "tool_call",
            data: toolCallData,
          });
        } else if (chunk.type === "crystallize") {
          newContent.push({
            type: "crystallize_event",
            data: {
              status: chunk.content?.status || "finished",
              summary: chunk.content?.summary || "",
            },
          });
        } else if (chunk.type === "usage" && chunk.content) {
          message.usage = { ...(message.usage || {}), ...chunk.content };
        }
      });
    }

    // Safety length & status guard
    const isCompletedOrFailed = status === "completed" || status === "failed";
    const isBlank =
      !message.content ||
      message.content.length === 0 ||
      (message.content.length === 1 && message.content[0].type === "blank");

    const getLen = (content) => {
      if (!content || !Array.isArray(content)) return 0;
      return content.reduce((acc, item) => {
        if (item.type === "text") return acc + (item.data?.text || "").length;
        if (item.type === "reason") return acc + (item.data?.text || "").length;
        if (item.type === "tool_call") {
          const args = item.data?.arguments || item.data?.parameters || "";
          return acc + args.length + 10;
        }
        if (item.type === "crystallize_event")
          return acc + (item.data?.summary || "").length + 10;
        return acc;
      }, 0);
    };

    if (
      isBlank ||
      getLen(newContent) >= getLen(message.content) ||
      (isCompletedOrFailed && getLen(newContent) > 0)
    ) {
      message.content = newContent;
    }

    if (status === "completed") {
      // 只在消息首次完成时触发 Agent 唤起，断线重连服务端回放的已完成消息不重复触发
      const wasAlreadyCompleted = message.status === "completed";
      message.status = "completed";
      closeReasoningBlocks(message.content, true);
      if (!wasAlreadyCompleted && contactor.platform === "group") {
        resolveUnhandledMentions(contactor, message);
      }
    } else if (status === "failed") {
      message.status = "failed";
      closeReasoningBlocks(message.content, true);

      // 过滤掉 type === "blank" 占位节点，防止界面显示思考中的转圈
      message.content = message.content.filter((elm) => elm.type !== "blank");

      // 格式化具体的错误信息并作为代码块塞进 message 的 content 中，避免重复塞入
      const errorText = formatErrorMessage(error);
      const lastElm = message.content[message.content.length - 1];
      if (
        !lastElm ||
        lastElm.type !== "text" ||
        lastElm.data?.text !== errorText
      ) {
        message.content.push({
          type: "text",
          data: { text: errorText },
        });
      }
    }

    contactor.lastUpdate = Date.now();
    if (!contactor.active) {
      contactor.hasPendingTask = true;
    }
    client.setLocalStorage();
  }

  function completeMessage(contactorId, messageId, options = {}) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;

    const message = getOrCreateMessage(contactorId, messageId);
    const wasAlreadyCompleted = message.status === "completed";
    message.status = "completed";
    closeReasoningBlocks(message.content, true);

    contactor.lastUpdate = Date.now();
    updateContactorSummary(contactor);
    markRaw(message);
    if (client.saveContactorMessages) {
      client.saveContactorMessages(contactorId);
    }
    client.setLocalStorage();

    // 群聊 Agent 连锁唤起：仅在 Agent 回复首次自然完成时触发。
    // 用户消息（role === "user"）的 @ 路由由 sendGroupCompletions 自行处理，
    // 用户主动中断的消息由调用方传 triggerInvocation: false 排除。
    if (
      options.triggerInvocation !== false &&
      !wasAlreadyCompleted &&
      contactor.platform === "group" &&
      message.role === "other"
    ) {
      resolveUnhandledMentions(contactor, message);
    }
  }

  function failedMessage(contactorId, messageId, _error) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;

    const message = getOrCreateMessage(contactorId, messageId);
    message.status = "failed";
    closeReasoningBlocks(message.content, true);

    // 过滤掉 type === "blank" 占位节点，防止界面显示思考中的转圈
    message.content = message.content.filter((elm) => elm.type !== "blank");

    // 用户消息失败时不要把错误文本塞进消息内容：
    // 1. 错误已由调用方 ElMessage 弹窗提示；
    // 2. 塞入后会被当作消息正文在重发/后续上下文里发给模型，污染对话。
    // 仅保留 assistant（role 非 user）消息的内联错误展示。
    if (message.role !== "user") {
      const errorText = formatErrorMessage(_error);
      const lastElm = message.content[message.content.length - 1];
      if (
        !lastElm ||
        lastElm.type !== "text" ||
        lastElm.data?.text !== errorText
      ) {
        message.content.push({
          type: "text",
          data: { text: errorText },
        });
      }
    }

    contactor.lastUpdate = Date.now();
    updateContactorSummary(contactor);
    markRaw(message);
    if (client.saveContactorMessages) {
      client.saveContactorMessages(contactorId);
    }
    client.setLocalStorage();
  }

  function deleteMessage(contactorId, index) {
    const contactor = contactors.value[contactorId];
    if (contactor && contactor.messageChain[index]) {
      const message = contactor.messageChain[index];
      // 删除进行中的消息时中断服务端生成（生成态判定与光标/停止入口共用）
      if (isStreamingMessage(message)) {
        client.socket?.interruptGeneration(message.id, contactorId);
      }
      contactor.messageChain.splice(index, 1);

      // 单聊：修正 firstMessageIndex
      if (
        contactor.firstMessageIndex !== undefined &&
        contactor.firstMessageIndex >= index
      ) {
        contactor.firstMessageIndex = Math.max(
          0,
          contactor.firstMessageIndex - 1,
        );
      }

      // 群聊：群成员的 lastCompressedIndex 指向群消息链的下标，删除会让其后及当天的所有
      // 下标整体前移。必须修正，防止标记越界导致上下文切空或跳过消息。
      if (contactor.platform === "group") {
        (contactor.members || []).forEach((m) => {
          const mark = Number(m.lastCompressedIndex) || 0;
          if (mark >= index) {
            m.lastCompressedIndex = Math.max(0, mark - 1);
          }
          if (contactor.messageChain.length === 0) {
            m.lastCompressedIndex = 0;
            if (m.options?.crystallization) {
              m.options.crystallization.latestSummary = "";
            }
          } else if (m.lastCompressedIndex >= contactor.messageChain.length) {
            m.lastCompressedIndex = contactor.messageChain.length - 1;
          }
        });
      } else {
        // 单聊若全部删空，同步清理单聊的记忆结晶
        if (contactor.messageChain.length === 0) {
          contactor.firstMessageIndex = 0;
          if (contactor.options?.crystallization) {
            contactor.options.crystallization.latestSummary = "";
          }
        }
      }

      updateContactorSummary(contactor);
      if (client.saveContactorMessages) {
        client.saveContactorMessages(contactorId);
      }
      client.setLocalStorage();
    }
  }

  function deleteMessageById(contactorId, messageId) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;
    const index = contactor.messageChain.findIndex(
      (msg) => String(msg?.id) === String(messageId),
    );
    if (index !== -1) {
      deleteMessage(contactorId, index);
    }
  }

  function discardTransientMessage(contactorId, messageId) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return false;
    const message = contactor.messageChain.find(
      (item) => String(item?.id) === String(messageId),
    );
    if (!message) return false;
    // Avoid sending an abort for a UI-only placeholder created by an older
    // client before interaction-only frames were separated from chat streams.
    message.status = "completed";
    deleteMessageById(contactorId, messageId);
    return true;
  }

  /**
   * 后端重启清扫：把消息链中仍处于"执行中"且没有结果的 tool_call
   * 直接置为 failed 终态，避免 UI 上永远显示"执行中"。
   * 由 client.js 在检测到 bootId 变化时调用。
   */
  function markInterruptedToolCalls() {
    let cleaned = 0;
    for (const contactorId of Object.keys(contactors.value)) {
      const contactor = contactors.value[contactorId];
      if (!contactor || !Array.isArray(contactor.messageChain)) continue;
      for (const message of contactor.messageChain) {
        if (!message || !Array.isArray(message.content)) continue;
        for (const elm of message.content) {
          if (elm.type !== "tool_call" || !elm.data) continue;
          const toolCall = elm.data;
          const isRunning =
            toolCall.action === "running" ||
            toolCall.action === "pending" ||
            toolCall.action === "started";
          if (isRunning && !toolCall.result) {
            toolCall.action = "failed";
            toolCall.status = "failed";
            toolCall.result = {
              error: "服务器重启，工具执行被打断",
            };
            cleaned++;
          }
        }
      }
    }
    if (cleaned > 0) {
      console.log(
        `[Contactors] 清扫 ${cleaned} 个因服务器重启而中断的工具调用`,
      );
      client.setLocalStorage();
    }
  }

  function clearHistory(contactorId) {
    const contactor = contactors.value[contactorId];
    if (contactor) {
      contactor.messageChain = [];
      contactor.firstMessageIndex = 0;

      // 链已清空，各成员的压缩标记与记忆结晶必须一并重置归零，防止残留历史幻觉与切断新消息。
      if (contactor.platform === "group") {
        (contactor.members || []).forEach((m) => {
          m.lastCompressedIndex = 0;
          if (m.options?.crystallization) {
            m.options.crystallization.latestSummary = "";
          }
        });
      } else {
        if (contactor.options?.crystallization) {
          contactor.options.crystallization.latestSummary = "";
        }
      }

      updateContactorSummary(contactor);
      if (client.saveContactorMessages) {
        client.saveContactorMessages(contactorId);
      }
      client.setLocalStorage();
    }
  }

  function insertSystemMessage(contactorId, text, extra = {}) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;

    const systemMsg = {
      role: "mio_system",
      time: Date.now(),
      id: numberString(16),
      content: [
        {
          type: "text",
          data: { text },
        },
      ],
      ...extra,
    };
    contactor.messageChain.push(systemMsg);
    contactor.lastUpdate = Date.now();
    updateContactorSummary(contactor);
    if (client.saveContactorMessages) {
      client.saveContactorMessages(contactorId);
    }
    client.setLocalStorage();
  }

  function updateContactor(id, patch) {
    const contactor = contactors.value[id];
    if (!contactor) return;
    const normalized = { ...patch };
    // 写入前归一化 priority，统一 0（置顶）/ 1（普通）数字语义
    if (normalized.priority !== undefined) {
      normalized.priority =
        normalized.priority === true || normalized.priority === 0 ? 0 : 1;
    }
    Object.assign(contactor, normalized);
    updateContactorSummary(contactor);
    client.setLocalStorage();
  }

  function hydrateContactorMessages(id, messages) {
    const contactor = contactors.value[id];
    if (!contactor || contactor.messageChain.length > 0 || !messages.length) {
      return false;
    }
    contactor.messageChain = messages
      // 存量数据清洗：与主加载路径一致，先归一化历史状态别名再标记终态
      .map((message) =>
        message && message.id ? normalizeMessage(message) : message,
      )
      .filter((message) => !isLegacyInteractionBubble(message))
      // 存量清洗：与主加载路径一致，丢掉只剩 blank 占位的历史消息
      .filter((message) => !isBlankPlaceholder(message))
      .map((message) =>
        message &&
        (message.status === "completed" || message.status === "failed")
          ? markRaw(message)
          : message,
      );
    updateContactorSummary(contactor);
    return true;
  }

  /**
   * 仅提取联系人纯元数据（不含巨型 messageChain，体积通常仅 1~5 KB）
   */
  function toMetadataJSON() {
    return Object.values(contactors.value).map((item) => ({
      platform: item.platform,
      id: item.id,
      channelId: item.channelId,
      agentId: item.agentId,
      sessionId: item.sessionId,
      parentSessionId: item.parentSessionId,
      runId: item.runId,
      groupId: item.groupId,
      runStatus: item.runStatus,
      readOnly: item.readOnly,
      options: item.options,
      namePolicy: item.namePolicy,
      avatarPolicy: item.avatarPolicy,
      title: item.title,
      name: item.name,
      avatar: item.avatar,
      intro: item.intro,
      notice: item.notice,
      maxInvocationDepth: item.maxInvocationDepth,
      defaultResponderId: item.defaultResponderId,
      toolCallContextMode: item.toolCallContextMode || "brief",
      members: item.members,
      priority: item.priority,
      active: item.active,
      lastUpdate: item.lastUpdate,
      createTime: item.createTime,
      hasPendingTask: item.hasPendingTask,
      firstMessageIndex: item.firstMessageIndex,
      draft: item.draft,
      lastMessageSummary: item.lastMessageSummary,
    }));
  }

  /**
   * 提取指定联系人的纯消息链数据
   * @param {string} contactorId
   */
  function toMessagesJSON(contactorId) {
    const contactor = contactors.value[contactorId];
    // 零本地存储：渠道 Bot 绝不导出消息链用于持久化
    if (
      !contactor ||
      contactor.platform === "agent" ||
      contactor.platform === "sub_agent" ||
      !Array.isArray(contactor.messageChain)
    )
      return [];
    return contactor.messageChain;
  }

  function toJSON() {
    return toMetadataJSON();
  }

  return {
    // State
    contactors,
    activeContactorId,

    // Getters
    sortedContactors,
    activeContactor,

    // Actions
    loadContactors,
    addContactor,
    addGroupContactor,
    addAgentContactor,
    upsertSubAgentContactor,
    removeContactor,
    selectContactor,
    updateDraft,
    setPriority,
    loadContactorAvatar,
    loadContactorName,
    updateContactorSummary,
    updateContactor,
    hydrateContactorMessages,
    applyMessageEvent,
    appendOrUpdateMessage,
    updateMessageUsage,
    getOrCreateMessage,
    syncMessage,
    completeMessage,
    failedMessage,
    deleteMessage,
    deleteMessageById,
    discardTransientMessage,
    markInterruptedToolCalls,
    clearHistory,
    insertSystemMessage,
    toJSON,
    toMetadataJSON,
    toMessagesJSON,
    // Crystallization
    handleCrystallizeEvent,
    updateCrystallization,
    updateContactorOption,
    getCrystalHost,
    appendToXmlZone,
  };
});
