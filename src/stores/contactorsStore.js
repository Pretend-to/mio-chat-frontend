import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getAvatarByOwner, getAvatarByAdapterType } from "@/utils/avatar.js";
import { numberString } from "@/utils/generate.js";
import { config, client } from "@/lib/runtime.js";

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

export const useContactorsStore = defineStore("contactors", () => {
  // State
  const contactors = ref({});
  const activeContactorId = ref(null);

  // Getters
  const sortedContactors = computed(() => {
    return Object.values(contactors.value).sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
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
        priority: item.priority ?? 1,
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
          tokenWatermark: 64000,
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
        tokenWatermark: 64000,
      };
    }

    loadContactorName(newContactor);
    loadContactorAvatar(newContactor);
    updateContactorSummary(newContactor);

    contactors.value[id] = newContactor;
    client.setLocalStorage();
    return newContactor;
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
          tokenWatermark: 64000,
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
      contactor.priority = priority;
      client.setLocalStorage();
    }
  }

  function loadContactorAvatar(contactor) {
    let avatar = "/static/icons/512*512.png";
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

  function recordMemory(contactorId, parameters, result = null) {
    const contactor = contactors.value[contactorId];
    if (!contactor || !parameters) return;

    // 1. 如果有后端返回的全新 summary，直接覆盖！(最优、最干净的 CRUD 同步路径)
    if (result && result.summary !== undefined) {
      if (!contactor.options.crystallization) {
        contactor.options.crystallization = {
          enabled: true,
          latestSummary: "",
          tokenWatermark: 64000,
        };
      }
      contactor.options.crystallization.latestSummary = result.summary;
      contactor.options.crystallization.lastUpdatedAt = Date.now();
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
      contactor.options?.crystallization?.enabled &&
      contactor.options.crystallization.latestSummary !== undefined
    ) {
      const fact = `Q: ${question}\nA: ${answer}`;
      const summary = contactor.options.crystallization.latestSummary || "";
      contactor.options.crystallization.latestSummary = appendToXmlZone(
        summary,
        "long_term_profile",
        fact,
      );
      contactor.options.crystallization.lastUpdatedAt = Date.now();
      client.setLocalStorage();
      return;
    }

    // 未开启结晶时，使用原始的 history 追加方式
    if (!contactor.options.presetSettings) {
      contactor.options.presetSettings = { opening: "", history: [] };
    }
    if (!contactor.options.presetSettings.history) {
      contactor.options.presetSettings.history = [];
    }

    const isDuplicate = contactor.options.presetSettings.history.some(
      (item, idx, arr) => {
        if (item.role === "user" && item.content === question) {
          const next = arr[idx + 1];
          return next && next.role === "assistant" && next.content === answer;
        }
        return false;
      },
    );

    if (isDuplicate) return;

    contactor.options.presetSettings.history.push({
      role: "user",
      content: question,
    });
    contactor.options.presetSettings.history.push({
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
      if (!contactor.options.crystallization) {
        contactor.options.crystallization = {
          enabled: true,
          latestSummary: "",
          tokenWatermark: 64000,
        };
      }
      contactor.options.crystallization.latestSummary = displaySummary;
      contactor.options.crystallization.lastUpdatedAt = Date.now();

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
  function updateCrystallization(contactorId, patch) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;
    if (!contactor.options.crystallization) {
      contactor.options.crystallization = {
        enabled: true,
        latestSummary: "",
        tokenWatermark: 64000,
      };
    }
    Object.assign(contactor.options.crystallization, patch);
    client.setLocalStorage();
  }

  function syncMessage(contactorId, e) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;

    const { chunks, status, messageId, metaData } = e;
    const message = getOrCreateMessage(contactorId, messageId, {
      time: metaData?.timestamp,
    });

    if (message) {
      message.triggerType =
        metaData?.triggerType || (metaData?.isTask ? "task" : "chat");
      if (metaData?.timestamp) {
        message.time = metaData.timestamp;
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
      message.status = "completed";
      closeReasoningBlocks(message.content, true);
    } else if (status === "failed") {
      message.status = "failed";
      closeReasoningBlocks(message.content, true);
    }

    contactor.lastUpdate = Date.now();
    if (!contactor.active) {
      contactor.hasPendingTask = true;
    }
    client.setLocalStorage();
  }

  function completeMessage(contactorId, messageId) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;

    const message = getOrCreateMessage(contactorId, messageId);
    message.status = "completed";
    closeReasoningBlocks(message.content, true);

    contactor.lastUpdate = Date.now();
    updateContactorSummary(contactor);
    client.setLocalStorage();
  }

  function failedMessage(contactorId, messageId, error) {
    const contactor = contactors.value[contactorId];
    if (!contactor) return;

    const message = getOrCreateMessage(contactorId, messageId);
    message.status = "failed";
    closeReasoningBlocks(message.content, true);

    const errorJson = JSON.stringify(
      typeof error === "string" ? { message: error } : error,
      null,
      2,
    );
    const errorText = `Error : LLM 响应失败！\n\`\`\`json\n${errorJson}\n\`\`\``;

    replaceBlankOrAppend(message.content, {
      type: "text",
      data: { text: errorText },
    });

    message.status = "completed";
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

  function clearHistory(contactorId) {
    const contactor = contactors.value[contactorId];
    if (contactor) {
      contactor.messageChain = [];
      contactor.firstMessageIndex = 0;
      updateContactorSummary(contactor);
      client.setLocalStorage();
    }
  }

  function insertSystemMessage(contactorId, text) {
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
    };
    contactor.messageChain.push(systemMsg);
    contactor.lastUpdate = Date.now();
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
    removeContactor,
    selectContactor,
    updateDraft,
    setPriority,
    loadContactorAvatar,
    loadContactorName,
    updateContactorSummary,
    appendOrUpdateMessage,
    getOrCreateMessage,
    syncMessage,
    completeMessage,
    failedMessage,
    deleteMessage,
    deleteMessageById,
    clearHistory,
    insertSystemMessage,
    toJSON,
    // Crystallization
    handleCrystallizeEvent,
    updateCrystallization,
    appendToXmlZone,
  };
});
