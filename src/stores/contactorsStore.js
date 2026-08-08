import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getAvatarByOwner, getAvatarByAdapterType } from "@/utils/avatar.js";
import { numberString } from "@/utils/generate.js";
import { config, client } from "@/lib/runtime.js";
import { checkAndTriggerAgentInvocation } from "@/lib/groupGateway.js";

const avatarPolicy = ["MODEL", "CUSTOM"];
const namePolicy = ["MODEL", "CUSTOM", "SUMMARY"];

// Helper function to format timestamps for contact list view
export function getContactorLastTime(messageChain) {
  const last = messageChain?.[messageChain.length - 1];
  if (!last) {
    return "";
  }

  const currentTime = Date.now();
  const lastTime = new Date(last.time);
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
    return `/p/mava?model=${encodeURIComponent(model)}&provider=${encodeURIComponent(provider || "")}`;
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

function formatErrorMessage(error) {
  if (!error) return "未知错误";

  let errorMsg = "";
  let isJson = false;

  if (typeof error === "object") {
    if (error instanceof Error) {
      errorMsg = error.stack || error.message;
    } else {
      try {
        errorMsg = JSON.stringify(error, null, 2);
        isJson = true;
        if (errorMsg === "{}") {
          if (error.message) {
            errorMsg = error.message;
            isJson = false;
          } else if (error.toString && error.toString() !== "[object Object]") {
            errorMsg = error.toString();
            isJson = false;
          }
        }
      } catch {
        errorMsg = String(error);
      }
    }
  } else {
    const trimmed = String(error).trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        errorMsg = JSON.stringify(parsed, null, 2);
        isJson = true;
      } catch {
        errorMsg = trimmed;
}
    } else {
      errorMsg = trimmed;
    }
  }

  const lang = isJson ? "json" : "";
  return `\n\`\`\`${lang}\n${errorMsg}\n\`\`\``;
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
        namePolicy: item.namePolicy ?? 0,
        avatarPolicy: item.avatarPolicy ?? 0,
        title: item.title,
        name: item.name,
        avatar: item.avatar,
        intro: item.intro ?? "",
        notice: item.notice ?? "",
        maxInvocationDepth: item.maxInvocationDepth,
        defaultResponderId: item.defaultResponderId ?? "",
        toolCallContextMode: item.toolCallContextMode || "full",
        members: item.members ?? [],
        priority: item.priority === true ? 0 : item.priority === false ? 1 : (item.priority ?? 1),
        firstMessageIndex: item.firstMessageIndex ?? 0,
        messageChain: item.messageChain ?? [],
        active: false,
        lastUpdate: item.lastUpdate ?? Date.now(),
        createTime: item.createTime ?? Date.now(),
        hasPendingTask: item.hasPendingTask ?? false,
        draft: item.draft ?? "",
        options: item.options || {},
        lastMessageSummary: "",
      };

      if (
        item.platform === "openai" &&
        !newContactors[item.id].options.crystallization
      ) {
        newContactors[item.id].options.crystallization = {
          enabled: true,
          latestSummary: "",
          tokenWatermark: 200000,
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
        tokenWatermark: 200000,
      };
    }

    loadContactorName(newContactor);
    loadContactorAvatar(newContactor);
    updateContactorSummary(newContactor);

    contactors.value[id] = newContactor;
    client.setLocalStorage();
    return newContactor;
  }

  async function addGroupContactor({ name, intro = "", members = [], avatarPolicy = "composite", avatar = null }) {
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
      toolCallContextMode: "full",
      options: {
        base: { max_messages_num: 20 },
      },
      lastMessageSummary: "",
    };

    contactors.value[id] = newGroup;
    client.setLocalStorage();
    return newGroup;
  }

  function removeContactor(id) {
    if (contactors.value[id]) {
      delete contactors.value[id];
      if (activeContactorId.value === id) {
        activeContactorId.value = null;
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
          tokenWatermark: 200000,
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
    contactor.lastMessageSummary = getLastMessageSummary(
      contactor.messageChain,
    );
  }

  // Messaging operations
  function getOrCreateMessage(contactorId, messageId, defaults = {}) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return null;

    let message = contactor.messageChain.find((msg) => msg.id === messageId);
    if (!message) {
      message = {
        role: defaults.role || "other",
        time: defaults.time || Date.now(),
        status: defaults.status || "pending",
        id: messageId,
        content: defaults.content || [{ type: "blank", data: {} }],
      };
      contactor.messageChain.push(message);
    }
    return message;
  }

  function appendOrUpdateMessage(contactorId, messageId, data, type) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;

    const message = getOrCreateMessage(contactorId, messageId);
    if (!message) return;

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

    updateContactorSummary(contactor);
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
        latestSummary: "",
        tokenWatermark: 200000,
      };
    }
    return host.options.crystallization;
  }

  function recordMemory(
    contactorId,
    parameters,
    result = null,
    memberId = null,
  ) {
    const contactor = contactors.value[contactorId];
    if (!contactor || !parameters) return;

    // 群聊里 memory 工具是某个成员调用的，必须写进该成员自己的结晶，
    // 否则所有成员的记忆会串到一起。解析不到宿主就直接放弃，不要退化成写群对象。
    const host = getCrystalHost(contactorId, memberId);
    if (!host) return;

    // 1. 如果有后端返回的全新 summary，直接覆盖！(最优、最干净的 CRUD 同步路径)
    if (result && result.summary !== undefined) {
      const crystal = ensureCrystallization(host);
      crystal.latestSummary = result.summary;
      crystal.lastUpdatedAt = Date.now();
      client.setLocalStorage();
      return;
    }

    let params = parameters;
    if (typeof params === "string") {
      try {
        params = JSON.parse(params);
      } catch (e) {
        console.error("[Memory] 解析参数失败:", e);
        return;
      }
    }
    const { question, answer } = params;
    if (!question || !answer) return;

    // 开启结晶时，将记忆追加到 latestSummary 的 <long_term_profile>
    if (
      host.options?.crystallization?.enabled &&
      host.options.crystallization.latestSummary !== undefined
    ) {
      const fact = `Q: ${question}\nA: ${answer}`;
      const summary = host.options.crystallization.latestSummary || "";
      host.options.crystallization.latestSummary = appendToXmlZone(
        summary,
        "long_term_profile",
        fact,
      );
      host.options.crystallization.lastUpdatedAt = Date.now();
      client.setLocalStorage();
      return;
    }

    // 未开启结晶时，使用原始的 history 追加方式
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
      isCompletedOrFailed ||
      isBlank ||
      getLen(newContent) >= getLen(message.content)
    ) {
      message.content = newContent;
    }

    if (status === "completed") {
      // 只在消息首次完成时触发 Agent 唤起，断线重连服务端回放的已完成消息不重复触发
      const wasAlreadyCompleted = message.status === "completed";
      message.status = "completed";
      closeReasoningBlocks(message.content, true);
      if (!wasAlreadyCompleted && contactor.platform === "group") {
        checkAndTriggerAgentInvocation(contactor, message);
      }
    } else if (status === "failed") {
      message.status = "failed";
      closeReasoningBlocks(message.content, true);

      // 过滤掉 type === "blank" 占位节点，防止界面显示思考中的转圈
      message.content = message.content.filter((elm) => elm.type !== "blank");

      // 格式化具体的错误信息并作为代码块塞进 message 的 content 中，避免重复塞入
      const errorText = formatErrorMessage(error);
      const lastElm = message.content[message.content.length - 1];
      if (!lastElm || lastElm.type !== "text" || lastElm.data?.text !== errorText) {
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
      checkAndTriggerAgentInvocation(contactor, message);
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

    // 格式化具体的错误信息并作为代码块塞进 message 的 content 中，避免重复塞入
    const errorText = formatErrorMessage(_error);
    const lastElm = message.content[message.content.length - 1];
    if (!lastElm || lastElm.type !== "text" || lastElm.data?.text !== errorText) {
      message.content.push({
        type: "text",
        data: { text: errorText },
      });
    }

    contactor.lastUpdate = Date.now();
    updateContactorSummary(contactor);
    client.setLocalStorage();
  }

  function deleteMessage(contactorId, index) {
    const contactor = contactors.value[contactorId];
    if (contactor && contactor.messageChain[index]) {
      const message = contactor.messageChain[index];
      // Interrupt stream if it's pending/retrying
      if (["pending", "retrying"].includes(message.status)) {
        client.socket?.interruptGeneration(message.id, contactorId);
      }
      contactor.messageChain.splice(index, 1);

      // 群成员的 lastCompressedIndex 指向群消息链的下标，删除会让其后的所有
      // 下标整体前移。不修正的话标记会越界一位，导致该成员静默丢掉一条上下文。
      if (contactor.platform === "group") {
        (contactor.members || []).forEach((m) => {
          const mark = Number(m.lastCompressedIndex) || 0;
          if (mark > index) m.lastCompressedIndex = mark - 1;
        });
      }

      updateContactorSummary(contactor);
      client.setLocalStorage();
    }
  }

  function deleteMessageById(contactorId, messageId) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;
    const index = contactor.messageChain.findIndex(
      (msg) => msg.id === messageId,
    );
    if (index !== -1) {
      deleteMessage(contactorId, index);
    }
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

      // 链已清空，各成员的压缩标记必须一并归零，否则会指向不存在的下标。
      // 注意只重置进度，不动 latestSummary —— 结晶是长期记忆，不随聊天记录清除。
      if (contactor.platform === "group") {
        (contactor.members || []).forEach((m) => {
          m.lastCompressedIndex = 0;
        });
      }

      updateContactorSummary(contactor);
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

  function toJSON() {
    return Object.values(contactors.value).map((item) => ({
      platform: item.platform,
      id: item.id,
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
      toolCallContextMode: item.toolCallContextMode || "full",
      members: item.members,
      priority: item.priority,
      messageChain: item.messageChain,
      active: item.active,
      lastUpdate: item.lastUpdate,
      createTime: item.createTime,
      hasPendingTask: item.hasPendingTask,
      firstMessageIndex: item.firstMessageIndex,
      draft: item.draft,
    }));
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
    removeContactor,
    selectContactor,
    updateDraft,
    setPriority,
    loadContactorAvatar,
    loadContactorName,
    updateContactorSummary,
    updateContactor,
    appendOrUpdateMessage,
    getOrCreateMessage,
    syncMessage,
    completeMessage,
    failedMessage,
    deleteMessage,
    deleteMessageById,
    markInterruptedToolCalls,
    clearHistory,
    insertSystemMessage,
    toJSON,
    // Crystallization
    handleCrystallizeEvent,
    updateCrystallization,    updateContactorOption,
    getCrystalHost,
    appendToXmlZone,
  };
});
