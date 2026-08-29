import { useContactorsStore } from "@/stores/contactorsStore.js";
import { useConfigStore } from "@/stores/configStore.js";
import { client } from "@/lib/runtime.js";
import { assembleSystemPrompt } from "@/utils/SystemPromptAssembler.js";
import { buildUserProfileXml } from "@/lib/clientSettings.js";
import { sendGroupCompletions } from "@/lib/groupGateway.js";

/**
 * 消息落盘后再向服务端发送 ACK，通知其清除 streamCache。
 * 必须等 saveNow 落盘完成才能发，否则缓存已清而本地未持久化时消息会永久丢失。
 */
async function ackPersistedMessage(contactorId, messageId) {
  if (!contactorId || !messageId) return;
  try {
    await client.saveNow();
  } catch (err) {
    // 落盘失败就不 ACK，保留服务端缓存，下次 enter_chat 仍可同步回来
    console.error("持久化失败，跳过 ACK:", err);
    return;
  }
  client.socket?.ackMessage(contactorId, messageId);
}

function getFilePrompt(fileElms) {
  const start = "\n以下是用户上传的文件：\n";
  return start + fileElms.join("\n");
}

function getImagePrompt(imageElms) {
  const start = "\n以下是用户所上传的图片链接：\n";
  return start + imageElms.map((elm) => elm.content).join("\n");
}

/**
 * 清理高级采样参数（temperature, top_p, frequency_penalty, presence_penalty）。
 * 如果保持默认值则不传递给后端，避免给不支持特定参数的模型（如推理模型）发送冗余或不兼容参数。
 * 默认值规则：
 * - temperature: 1
 * - top_p: 1
 * - frequency_penalty: 0
 * - presence_penalty: 0
 *
 * 注：reasoning_effort 以及 tool_choice 等参数常驻保留；且返回结果始终为安全的对象格式（至少为 {}），避免后端解构报错。
 *
 * @param {Object} chatParams
 * @returns {Object} 过滤掉默认高级采样参数后的 chatParams 对象（保证始终为 Object）
 */
export function cleanChatParams(chatParams) {
  if (!chatParams || typeof chatParams !== "object") {
    return {};
  }

  const cleaned = { ...chatParams };

  // temperature: 默认值为 1，如果为 1 或未设置则删除
  if (
    cleaned.temperature === undefined ||
    cleaned.temperature === null ||
    Number(cleaned.temperature) === 1
  ) {
    delete cleaned.temperature;
  } else {
    cleaned.temperature = Number(cleaned.temperature);
  }

  // top_p: 默认值为 1，如果为 1 或未设置则删除
  if (
    cleaned.top_p === undefined ||
    cleaned.top_p === null ||
    Number(cleaned.top_p) === 1
  ) {
    delete cleaned.top_p;
  } else {
    cleaned.top_p = Number(cleaned.top_p);
  }

  // frequency_penalty: 默认值为 0，如果为 0 或未设置则删除
  if (
    cleaned.frequency_penalty === undefined ||
    cleaned.frequency_penalty === null ||
    Number(cleaned.frequency_penalty) === 0
  ) {
    delete cleaned.frequency_penalty;
  } else {
    cleaned.frequency_penalty = Number(cleaned.frequency_penalty);
  }

  // presence_penalty: 默认值为 0，如果为 0 或未设置则删除
  if (
    cleaned.presence_penalty === undefined ||
    cleaned.presence_penalty === null ||
    Number(cleaned.presence_penalty) === 0
  ) {
    delete cleaned.presence_penalty;
  } else {
    cleaned.presence_penalty = Number(cleaned.presence_penalty);
  }

  return cleaned;
}

/**
 * 格式化并合并要发送给 OpenAI 的上下文消息列表
 */
export function getValidOpenaiMessage(
  messageChain,
  firstMessageIndex = 0,
  maxMessagesNum = 20,
) {
  // Only include chat messages (filter out task messages)
  const chatMessages = messageChain.filter((msg) => msg.triggerType !== "task");

  const fromIndexMessages = chatMessages.slice(firstMessageIndex);

  // The default sliding window messages (last N messages)
  const slidingWindowMessages = fromIndexMessages.slice(-maxMessagesNum);

  // We want to keep a message if it's in the sliding window OR if it is pinned.
  // Pinned messages are identified by `isPinned === true`.
  const mergedList = fromIndexMessages.filter((msg) => {
    return (
      msg.isPinned === true ||
      slidingWindowMessages.some((m) => m.id === msg.id)
    );
  });

  const mergedMessages = mergedList.map((message) => {
    if (message.role === "mio_system") {
      const text = message.content?.[0]?.data?.text || "";
      if (
        text.includes("已注入相关元信息") ||
        text.includes("<user_profile>")
      ) {
        const configStore = useConfigStore();
        const profile =
          configStore.userProfile || client._clientSettings?.profile || {};
        return [{ role: "system", content: buildUserProfileXml(profile) }];
      }
      return [];
    }

    const fileList = [];
    const imageList = [];
    const subArray = [];
    const cmds = [];

    if (message.role === "assistant" || message.role === "other") {
      let currentAssistant = null;
      let pendingReasoning = "";
      let pendingToolMessages = [];

      const flushAssistant = () => {
        if (currentAssistant) {
          if (pendingReasoning) {
            currentAssistant.reasoning_content = pendingReasoning;
            pendingReasoning = "";
          }
          if (!currentAssistant.content) {
            delete currentAssistant.content;
          }
          if (
            !currentAssistant.tool_calls ||
            currentAssistant.tool_calls.length === 0
          ) {
            delete currentAssistant.tool_calls;
          }
          subArray.push(currentAssistant);
          currentAssistant = null;
        }
        if (pendingToolMessages.length > 0) {
          subArray.push(...pendingToolMessages);
          pendingToolMessages = [];
        }
      };

      message.content.forEach((elm) => {
        if (elm.type === "prompt_hint") {
          return;
        }

        if (elm.type === "reason") {
          if (
            currentAssistant &&
            currentAssistant.tool_calls &&
            currentAssistant.tool_calls.length > 0
          ) {
            flushAssistant();
          }
          pendingReasoning += elm.data.text || "";
        } else if (elm.type === "text") {
          if (
            currentAssistant &&
            currentAssistant.tool_calls &&
            currentAssistant.tool_calls.length > 0
          ) {
            flushAssistant();
          }
          if (!currentAssistant) {
            currentAssistant = { role: "assistant", content: "" };
          }
          currentAssistant.content =
            (currentAssistant.content || "") + (elm.data.text || "");
        } else if (elm.type === "tool_call") {
          if (!currentAssistant) {
            currentAssistant = { role: "assistant" };
          }
          if (!currentAssistant.tool_calls) {
            currentAssistant.tool_calls = [];
          }
          currentAssistant.tool_calls.push({
            id: elm.data.id,
            type: "function",
            function: {
              name: elm.data.name,
              arguments: elm.data.parameters,
            },
          });

          pendingToolMessages.push({
            role: "tool",
            content:
              typeof elm.data.result === "string"
                ? elm.data.result
                : JSON.stringify(elm.data.result),
            tool_call_id: elm.data.id,
            name: elm.data.name,
          });
        }
      });

      flushAssistant();

      if (pendingReasoning) {
        subArray.push({
          role: "assistant",
          content: "",
          reasoning_content: pendingReasoning,
        });
      }
    } else {
      message.content.forEach((elm) => {
        if (elm.type === "prompt_hint" && elm.data.prompt) {
          cmds.push(elm.data.prompt);
        }
      });

      const cmdPrefix = cmds.length > 0 ? cmds.join("\n") + "\n" : "";
      let firstTextElmRef = null;

      message.content.forEach((elm) => {
        if (elm.type === "prompt_hint") {
          return;
        }

        const role =
          elm.type === "tool_call"
            ? "tool"
            : message.role === "user"
              ? "user"
              : "assistant";

        const formatedMsg = {
          role: role,
          content: "none",
          _content_type: undefined,
        };

        if (role === "tool") {
          formatedMsg.role = "assistant";
          formatedMsg.content = null;
          formatedMsg.tool_calls = [
            {
              id: elm.data.id,
              function: {
                name: elm.data.name,
                arguments: elm.data.parameters,
              },
              type: "function",
            },
          ];
          subArray.push({ ...formatedMsg });

          delete formatedMsg.tool_calls;
          formatedMsg.role = "tool";
          formatedMsg.content = JSON.stringify(elm.data.result);
          formatedMsg.tool_call_id = elm.data.id;
          formatedMsg.name = elm.data.name;
          subArray.push({ ...formatedMsg });

          formatedMsg.role = role;
        } else if (role === "user" || role === "assistant") {
          if (elm.type === "image") {
            formatedMsg.content = elm.data.file;
            formatedMsg._content_type = "image";
            subArray.push(formatedMsg);
            imageList.push(elm.data.file.content);
          } else if (elm.type === "text") {
            let textContent = elm.data.text || "";

            // 在组装 API 请求体时处理 carryTimestamp（避免污染 UI 层消息）
            if (role === "user") {
              const store = useContactorsStore();
              const activeContactor = store.activeContactor;
              const carryTimestamp =
                activeContactor?.options?.messageEnhancement?.carryTimestamp ??
                client._clientSettings?.chat?.carryTimestamp ??
                false;

              if (
                carryTimestamp &&
                textContent &&
                !textContent.startsWith("<message time=")
              ) {
                const msgTime = message.time
                  ? new Date(message.time).toISOString()
                  : new Date().toISOString();
                textContent = `<message time="${msgTime}">\n${textContent}\n</message>`;
              }
            }

            formatedMsg.content = textContent;
            formatedMsg._content_type = "text";
            subArray.push(formatedMsg);
            if (!firstTextElmRef) {
              firstTextElmRef = formatedMsg;
            }
          } else if (elm.type === "file") {
            fileList.push(elm.data.file);
          }
        }
      });

      if (cmdPrefix) {
        if (firstTextElmRef) {
          firstTextElmRef.content = cmdPrefix + firstTextElmRef.content;
        } else {
          subArray.push({
            role: message.role === "user" ? "user" : "assistant",
            content: cmdPrefix.trim(),
            _content_type: "text",
          });
        }
      }

      if (fileList.length > 0) {
        const textElm = subArray.filter((elm) => elm._content_type === "text");
        if (textElm.length === 0) {
          subArray.push({
            role: "user",
            content: getFilePrompt(fileList),
            _content_type: "text",
          });
        }
      }
    }
    return subArray;
  });

  let finalMessages = [];
  mergedMessages.forEach((subArray) => {
    const textElm = subArray.filter((elm) => elm._content_type === "text");
    const imageElm = subArray.filter((elm) => elm._content_type === "image");
    const fileElm = subArray.filter((elm) => elm._content_type === "file");
    const filePrompt = fileElm.length > 0 ? getFilePrompt(fileElm) : "";
    const imagePrompt = imageElm.length > 0 ? getImagePrompt(imageElm) : "";

    let message = null;
    if (
      textElm.length > 0 &&
      imageElm.length > 0 &&
      imageElm[0].role === "user"
    ) {
      message = {
        role: "user",
        content: [
          ...imageElm.map((elm) => {
            return {
              type: "image_url",
              image_url: {
                url: elm.content,
              },
            };
          }),
          ...textElm.map((elm) => {
            return {
              type: "text",
              text: elm.content + filePrompt + imagePrompt,
            };
          }),
        ],
      };
    }
    if (message?.content.length === subArray.length) {
      finalMessages.push(message);
    } else {
      subArray.forEach((elm) => {
        delete elm._content_type;
      });
      finalMessages.push(...subArray);
    }
  });

  return finalMessages;
}

/**
 * 结晶模式下，获取应发送给后端的消息链。
 *
 * 逻辑：latestSummary 已代替了结晶点之前的所有历史，
 * 所以我们只发送「结晶点之后」的原始消息。
 *
 * 定位方式：
 * 1. 在 messageChain 中找到最后一条含 `crystallize_event` 的消息（结晶发生处）
 * 2. 从该消息开始向前再保留 keepTurns 个完整前端轮次（与后端 scanFrontendTurns 对称）
 * 3. 把这个范围内的消息格式化为 OpenAI 格式返回
 *
 * 如果从未发生过结晶（首次对话），退回到 maxMessagesNum 的普通滑动窗口。
 *
 * @param {Array} messageChain - 联系人的完整消息链
 * @param {number} firstMessageIndex
 * @param {number} keepTurns - 结晶点附近保留的前端轮次数（默认 2）
 * @returns {Array} OpenAI 格式消息列表（不含 system，由调用方注入）
 */
export function getCrystallizationMessages(
  messageChain,
  firstMessageIndex = 0,
  keepTurns = 1,
) {
  // Only include chat messages (filter out task messages)
  const chatMessages = messageChain.filter((msg) => msg.triggerType !== "task");

  const fromIndex = chatMessages.slice(firstMessageIndex);

  // 1. 找到最后一个含 crystallize_event 内容元素的消息的下标
  let crystalMsgIndex = -1;
  for (let i = fromIndex.length - 1; i >= 0; i--) {
    const msg = fromIndex[i];
    if (
      msg.role !== "mio_system" &&
      Array.isArray(msg.content) &&
      msg.content.some((elm) => elm.type === "crystallize_event")
    ) {
      crystalMsgIndex = i;
      break;
    }
  }

  let sliceFrom;

  if (crystalMsgIndex === -1) {
    // 从未发生过结晶：直接取全部（由 system prompt 中的 latestSummary 兜底）
    sliceFrom = 0;
  } else {
    // 2. 从 crystalMsgIndex 往前扫描，找到 keepTurns 个完整用户轮次的起点
    //    这与后端 scanFrontendTurns 保留的范围对称
    let turnsFound = 0;
    sliceFrom = crystalMsgIndex; // 默认至少包含结晶处的消息

    for (let i = crystalMsgIndex; i >= 0; i--) {
      if (fromIndex[i].role === "user") {
        turnsFound++;
        if (turnsFound >= keepTurns) {
          sliceFrom = i;
          break;
        }
        sliceFrom = i;
      }
    }
  }

  // 3. 过滤掉 mio_system 消息后格式化
  const windowMessages = fromIndex
    .slice(sliceFrom)
    .filter((msg) => msg.role !== "mio_system");

  // 4. 复用 getValidOpenaiMessage 的格式化逻辑（传 Infinity 让它不再截断）
  return getValidOpenaiMessage(windowMessages, 0, Infinity);
}

class StreamBuffer {
  constructor(contactorId, messageId, store) {
    this.contactorId = contactorId;
    this.messageId = messageId;
    this.store = store;
    this.pendingContent = "";
    this.pendingReason = "";
    this.reasonMetadata = null;
    this.lastFlushTime = 0;
    this.lastUpdateTime = Date.now();
    this.timer = null;
    this.flushInterval = 80; // ms, 80ms 刷新节流防止高频重绘在 Safari 造成 OOM 崩溃
  }

  addContent(chunk) {
    this.pendingContent += chunk;
    this.lastUpdateTime = Date.now();
    this.scheduleFlush();
  }

  addReason(text, metadata) {
    this.pendingReason += text;
    this.lastUpdateTime = Date.now();
    if (metadata) {
      this.reasonMetadata = {
        startTime: metadata.startTime,
        duration: metadata.duration || 0,
      };
    }
    this.scheduleFlush();
  }

  scheduleFlush() {
    if (this.timer) return;
    const now = Date.now();
    const elapsed = now - this.lastFlushTime;
    const delay = Math.max(0, this.flushInterval - elapsed);

    this.timer = setTimeout(() => {
      this.flush();
    }, delay);
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    let updated = false;

    if (this.pendingReason) {
      this.store.appendOrUpdateMessage(
        this.contactorId,
        this.messageId,
        {
          reasoning_content: this.pendingReason,
          startTime: this.reasonMetadata?.startTime,
          duration: this.reasonMetadata?.duration || 0,
        },
        "reason",
      );
      this.pendingReason = "";
      this.reasonMetadata = null;
      updated = true;
    }

    if (this.pendingContent) {
      this.store.appendOrUpdateMessage(
        this.contactorId,
        this.messageId,
        {
          chunk: this.pendingContent,
        },
        "content",
      );
      this.pendingContent = "";
      updated = true;
    }

    if (updated) {
      this.lastFlushTime = Date.now();
    }
  }
}

const streamBuffers = new Map();

function getOrCreateBuffer(contactorId, messageId, store) {
  // TTL 垃圾回收：自动清理超过 20 秒无更新的挂死流，释放其对 store 的引用，解决重连/失效流内存泄露
  const now = Date.now();
  for (const [id, buf] of streamBuffers.entries()) {
    if (now - buf.lastUpdateTime > 20000) {
      buf.flush();
      streamBuffers.delete(id);
    }
  }

  let buffer = streamBuffers.get(messageId);
  if (!buffer) {
    buffer = new StreamBuffer(contactorId, messageId, store);
    streamBuffers.set(messageId, buffer);
  }
  buffer.lastUpdateTime = now;
  return buffer;
}

/**
 * 统一网关：发送消息、中断生成、处理 Socket 回调事件的单例
 */
export const gateway = {
  /**
   * 发送消息给对应的平台
   */
  async send(platform, contactorId, messagesChain, messageId, options) {
    if (platform === "onebot") {
      if (!client.isConnected) {
        throw new Error("连接已断开，请检查网络或刷新页面");
      }
      if (!client.socket) {
        throw new Error("WebSocket 链接未就绪");
      }

      const lastMsg = messagesChain[messagesChain.length - 1];
      const response = await client.socket.fetch(
        `/api/onebot/message/${contactorId}`,
        lastMsg.content,
      );

      return response.message_id;
    } else if (platform === "group") {
      if (!client.isConnected) {
        throw new Error("连接已断开，请检查网络或刷新页面");
      }
      const contactorStore = useContactorsStore();
      const contactor = contactorStore.contactors[contactorId];
      if (!contactor) {
        throw new Error("群聊联系人未找到");
      }
      const targetMsg = (messagesChain || []).find((m) => m.id === messageId);
      const targetMemberId =
        targetMsg?.sender_id || targetMsg?.senderMemberId || null;
      await sendGroupCompletions(contactor, messageId, targetMemberId);
    } else if (platform === "channel") {
      if (!client.isConnected || !client.socket) {
        throw new Error("连接已断开，请检查网络或刷新页面");
      }
      const contactorStore = useContactorsStore();
      const contactor = contactorStore.contactors[contactorId];
      if (!contactor) {
        throw new Error("渠道联系人未找到");
      }

      // 获取当前用户发送的最新一条消息（极轻量纯净当前轮输入，零上下文拼接）
      const lastUserMsg = (messagesChain || []).filter((m) => m.role === "user").pop();
      const text = lastUserMsg?.content?.find((c) => c.type === "text")?.data?.text || lastUserMsg?.text || "";
      const images = [];
      const files = [];

      if (Array.isArray(lastUserMsg?.content)) {
        for (const c of lastUserMsg.content) {
          if (c.type === "image" && (c.data?.file || c.data?.url)) {
            images.push(c.data.file || c.data.url);
          }
          if (c.type === "file" && c.data?.url) {
            files.push({ name: c.data.name || "file", url: c.data.url });
          }
        }
      }

      // 预先建立 StreamBuffer 确保实时流上屏
      getOrCreateBuffer(contactorId, messageId, contactorStore);

      const targetChannelId = contactor.channelId || contactor.id;
      const res = await client.socket.fetch(`/api/channel/message/${targetChannelId}`, {
        text,
        images,
        files,
        messageId,
      });

      return res?.messageId || messageId;
    } else {
      // OpenAI 平台
      if (!client.isConnected) {
        throw new Error("连接已断开，请检查网络或刷新页面");
      }
      if (!client.socket) {
        throw new Error("WebSocket 链接未就绪");
      }

      // 获取格式化后的上下文
      const contactorStore = useContactorsStore();
      const contactor = contactorStore.contactors[contactorId];
      const crystallization = contactor?.options?.crystallization;
      const crystallizationEnabled = crystallization?.enabled === true;

      let finalMessages;

      if (crystallizationEnabled) {
        // 结晶模式：只发送「结晶点之后」的原始消息（与后端 scanFrontendTurns 保留范围对称）
        // latestSummary 已经代替了结晶点之前的所有历史，无需重复发送
        const keepTurns = 1;
        finalMessages = getCrystallizationMessages(
          messagesChain,
          contactor?.firstMessageIndex || 0,
          keepTurns,
        );

        // 在消息链头部注入组装好的 system 消息（全局人格 + 全局长期记忆 + memory_crystal XML）
        const baseSystemPrompt = options?.presetSettings?.opening || "";
        const latestSummary = crystallization.latestSummary || "";
        const isGlobalMemOn = crystallization.globalMemoryEnabled !== false;
        const globalMem = isGlobalMemOn ? (client._clientSettings?.globalMemory || []) : [];
        const assembledSystem = assembleSystemPrompt(
          baseSystemPrompt,
          latestSummary,
          globalMem,
        );

        if (assembledSystem) {
          // 移除消息链中已有的 system 消息（避免重复）
          const withoutSystem = finalMessages.filter(
            (m) => m.role !== "system",
          );
          finalMessages = [
            { role: "system", content: assembledSystem },
            ...withoutSystem,
          ];
        }
      } else {
        // 普通模式：使用滑动窗口截取
        finalMessages = getValidOpenaiMessage(
          messagesChain,
          contactor?.firstMessageIndex || 0,
          contactor?.options?.base?.max_messages_num || 20,
        );

        const isGlobalMemOn = contactor?.options?.crystallization?.globalMemoryEnabled !== false;
        const globalMem = isGlobalMemOn ? (client._clientSettings?.globalMemory || []) : [];
        if (Array.isArray(globalMem) && globalMem.length > 0) {
          const hasGlobalMem = finalMessages.some(
            (m) =>
              m.role === "system" &&
              typeof m.content === "string" &&
              m.content.includes("<global_long_term_memory>"),
          );
          if (!hasGlobalMem) {
            const validItems = globalMem.filter((m) => m && m.content && m.content.trim());
            if (validItems.length > 0) {
              const memXml = [
                "<global_long_term_memory>",
                ...validItems.map((m) => {
                  const idStr = m.id ? `[#${m.id}] ` : "";
                  return `  ${idStr}${m.content.trim()}`;
                }),
                "</global_long_term_memory>",
              ].join("\n");
              finalMessages.unshift({
                role: "system",
                content: memXml,
              });
            }
          }
        }
      }

      const metaData = {
        contactorId,
        messageId,
        namePolicy: contactor?.namePolicy || 0,
        contactorName: contactor?.name || null,
      };

      // 在 settings 中注入结晶相关参数
      const enrichedOptions = { ...options };
      if (crystallizationEnabled) {
        enrichedOptions.crystallization_token_watermark =
          crystallization.tokenWatermark ?? 'auto';
        enrichedOptions.previous_summary = crystallization.latestSummary || "";
        enrichedOptions.crystallization_keep_turns = 1;
        enrichedOptions.pending_memory_events = crystallization.pendingMemoryEvents || [];
        // 移除 system prompt 中的 opening（已合并到消息链头部）
        if (enrichedOptions.presetSettings) {
          enrichedOptions.presetSettings = {
            ...enrichedOptions.presetSettings,
            opening: "",
          };
        }
      }

      // 检查全局 settings 中的 carryProfile 开关（保障 F12/WebSocket 载荷中 100% 具备用户画像）
      const cs = client._clientSettings || {};
      if (cs.chat?.carryProfile) {
        const hasProfile = finalMessages.some(
          (m) =>
            m.role === "system" &&
            typeof m.content === "string" &&
            m.content.includes("<user_profile>"),
        );
        if (!hasProfile) {
          const configStore = useConfigStore();
          const profile = configStore.userProfile || cs.profile || {};
          const profileXml = buildUserProfileXml(profile);
          finalMessages.unshift({
            role: "system",
            content: profileXml,
          });
        }
      }

      // 清理高级采样参数（默认值不传递），同时保证 chatParams 始终为对象格式以兼容后端解构
      if (enrichedOptions.chatParams || enrichedOptions.options?.chatParams) {
        enrichedOptions.chatParams = cleanChatParams(
          enrichedOptions.chatParams || enrichedOptions.options?.chatParams,
        );
      } else {
        enrichedOptions.chatParams = {};
      }

      console.log(
        "🚀 [gateway] 最终发送给模型 WebSocket 的 messages 载荷:",
        finalMessages,
      );

      const data = {
        settings: enrichedOptions,
        messages: finalMessages,
      };

      client.socket.streamCompletions(data, metaData);
    }
  },

  /**
   * 发送中断信号
   */
  async interrupt(platform, contactorId, messageId) {
    const buffer = streamBuffers.get(messageId);
    if (buffer) {
      buffer.flush();
      streamBuffers.delete(messageId);
    }

    // Set message status to completed locally immediately to stop the spinner
    const contactorStore = useContactorsStore();
    // 用户主动中断，不应触发群聊 Agent 连锁唤起
    contactorStore.completeMessage(contactorId, messageId, {
      triggerInvocation: false,
    });

    if (platform === "openai" || platform === "group") {
      if (!client.socket) return;
      client.socket.interruptGeneration(messageId, contactorId);
      // 主动 ACK：若服务端已无对应活跃事件，则不会回 complete 帧，
      // 缓存里的 streaming 记录会残留并在每次 enter_chat 被重复同步
      ackPersistedMessage(contactorId, messageId);
    }
  },

  /**
   * 处理流式 LLM 消息回调并分发给 Pinia Store
   */
  handleLlmMessageEvent(e) {
    const data = e.data;
    const { metaData } = data || {};
    const contactorId = metaData?.contactorId;
    const messageId = metaData?.messageId || e.request_id;

    if (!contactorId) return;

    const contactorStore = useContactorsStore();

    // Ensure the message has triggerType populated in the store
    const message = contactorStore.getOrCreateMessage(contactorId, messageId, {
      time: metaData?.timestamp,
    });
    if (message) {
      if (!message.triggerType) {
        message.triggerType =
          metaData?.triggerType || (metaData?.isTask ? "task" : "chat");
      }
      if (metaData?.timestamp) {
        message.time = metaData.timestamp;
      }
      if (metaData?.memberId || metaData?.memberName) {
        if (metaData.memberId) {
          message.sender_id = metaData.memberId;
          message.senderMemberId = metaData.memberId;
        }
        if (metaData.memberName) {
          message.sender_name = metaData.memberName;
          message.senderName = metaData.memberName;
        }
        if (metaData.memberAvatar) {
          message.sender_avatar = metaData.memberAvatar;
          message.senderAvatar = metaData.memberAvatar;
        }
      }
    }

    if (["update", "sync"].includes(e.message)) {
      if (e.message === "sync") {
        const buffer = streamBuffers.get(messageId);
        if (buffer) {
          buffer.flush();
          streamBuffers.delete(messageId);
        }
        contactorStore.syncMessage(contactorId, {
          chunks: data.chunks,
          status: data.status,
          messageId,
          metaData,
          error: data.error,
        });

        // 如果同步回来的是已完成/已失败的终态消息，也给后端发 ACK 清除流缓存
        if (["completed", "failed"].includes(data.status)) {
          ackPersistedMessage(contactorId, messageId);
        }
        // 断线同步恢复：若消息未完成/未失败，且同步的 chunks 中含有挂起待处理的 action，则还原至 interactionStore
        if (
          data.status !== "completed" &&
          data.status !== "failed" &&
          Array.isArray(data.chunks)
        ) {
          const actionChunk = data.chunks.find((c) => c.type === "action");
          if (actionChunk) {
            import("@/stores/interactionStore.js").then(
              ({ useInteractionStore }) => {
                const store = useInteractionStore();
                store.setInteraction({
                  contactorId,
                  actionType: actionChunk.content.actionType,
                  interactionId: actionChunk.content.interactionId,
                  requestId: messageId,
                  options: actionChunk.content.options,
                  prompt: actionChunk.content.prompt,
                  meta: actionChunk.content.meta,
                });
              },
            );
          }
        }
      } else {
        if (data.type === "reason") {
          const buffer = getOrCreateBuffer(
            contactorId,
            messageId,
            contactorStore,
          );
          buffer.addReason(data.data?.text ?? "", data.data);
        } else if (data.type === "content") {
          const buffer = getOrCreateBuffer(
            contactorId,
            messageId,
            contactorStore,
          );
          buffer.addContent(data.content);
        } else if (data.type === "toolCall") {
          const buffer = streamBuffers.get(messageId);
          if (buffer) {
            buffer.flush();
          }
          contactorStore.appendOrUpdateMessage(
            contactorId,
            messageId,
            {
              tool_call: data.content,
            },
            "tool_call",
          );
        } else if (data.type === "crystallize") {
          // 结晶事件：通知 store 更新 latestSummary 和 UI 事件条
          const buffer = streamBuffers.get(messageId);
          if (buffer) {
            buffer.flush();
          }
          contactorStore.handleCrystallizeEvent(
            contactorId,
            messageId,
            data.content,
          );
        } else if (data.type === "action") {
          // 原子动作拦截器：捕获长连接双向指令并存入 Store，驱动输入框上方就地交互面板渲染
          import("@/stores/interactionStore.js").then(
            ({ useInteractionStore }) => {
              const store = useInteractionStore();
              store.setInteraction({
                contactorId, // 绑定联系人ID
                actionType: data.content.actionType,
                interactionId: data.content.interactionId,
                requestId: messageId,
                options: data.content.options,
                prompt: data.content.prompt,
                meta: data.content.meta,
              });
            },
          );
        } else if (data.type === "usage" && data.content) {
          contactorStore.updateMessageUsage(
            contactorId,
            messageId,
            data.content,
          );
        }
      }
    } else if (["complete", "failed"].includes(e.message)) {
      const buffer = streamBuffers.get(messageId);
      if (buffer) {
        buffer.flush();
        streamBuffers.delete(messageId);
      }
      if (e.message === "complete") {
        contactorStore.completeMessage(contactorId, messageId);
      } else if (e.message === "failed") {
        contactorStore.failedMessage(contactorId, messageId, e.data);
      }
      ackPersistedMessage(contactorId, messageId);
    }
  },

  /**
   * 处理 Onebot 收到消息和撤回消息事件并分发给 Pinia Store
   */
  handleOnebotMessageEvent(e) {
    const data = e.data;
    const id = data.id;
    const content = data.content;
    const type = data.type;

    const contactorStore = useContactorsStore();

    if (type === "message") {
      let contactor = contactorStore.contactors[id];
      if (!contactor) {
        // 兜底机制：若因 ID 不匹配（例如前端生成了随机 Fake ID），则匹配列表中首个 platform === "onebot" 的联系人
        contactor = Object.values(contactorStore.contactors).find(
          (c) => c.platform === "onebot",
        );
      }
      if (contactor) {
        const webMessage = convertOnebotMessage(content);
        contactor.messageChain.push(webMessage);
        contactor.lastUpdate = Date.now();
        contactorStore.updateContactorSummary(contactor);
        client.setLocalStorage();
      }
    } else if (type === "del_msg") {
      const onebotContactors = Object.values(contactorStore.contactors).filter(
        (item) => item.platform === "onebot",
      );
      for (const onebotContactor of onebotContactors) {
        const index = onebotContactor.messageChain.findIndex(
          (msg) => msg.id === content.message_id,
        );
        if (index !== -1) {
          const originalMsg = onebotContactor.messageChain[index];
          if (originalMsg?.role === "user") {
            // 阻止撤回我自己的消息：直接忽略此撤回事件，保持消息在列表中不变
            console.log("Prevented recall of my own message");
            break;
          } else {
            // 他人撤回的消息在原位置显示系统消息
            const displayName = onebotContactor.name;
            const systemMsg = {
              role: "mio_system",
              time: originalMsg?.time || Date.now(),
              id: content.message_id,
              status: "completed",
              content: [
                {
                  type: "text",
                  data: {
                    text: `${displayName}撤回了一条消息`,
                  },
                },
              ],
            };
            onebotContactor.messageChain.splice(index, 1, systemMsg);
          }
          contactorStore.updateContactorSummary(onebotContactor);
          client.setLocalStorage();
          console.log("Message recalled successfully");
          break;
        }
      }
    }
  },

  handleChannelMessageEvent(e) {
    if (e.type === "channel_user_message") {
      const { contactorId, userMessage, assistantMessageId } = e.data || {};
      if (!contactorId || !userMessage) return;

      const contactorStore = useContactorsStore();
      const contactor = contactorStore.contactors[contactorId];
      if (!contactor) return;

      // 1. 检查并追加用户在渠道（微信等）端发送的消息
      const existsUser = contactor.messageChain.some((m) => m.id === userMessage.id);
      if (!existsUser) {
        const userContainer = {
          role: "user",
          id: userMessage.id || `msg_u_${Date.now()}`,
          time: userMessage.time || Date.now(),
          status: "completed",
          content: userMessage.content || [{ type: "text", data: { text: userMessage.text || "" } }],
          text: userMessage.text || "",
        };
        contactor.messageChain.push(userContainer);
      }

      // 2. 检查并创建 AI 回复的 Blank 占位及 StreamBuffer
      if (assistantMessageId) {
        const existsAi = contactor.messageChain.some((m) => m.id === assistantMessageId);
        if (!existsAi) {
          const aiContainer = {
            role: "other",
            id: assistantMessageId,
            time: Date.now(),
            status: "running",
            content: [{ type: "blank", data: {} }],
          };
          contactor.messageChain.push(aiContainer);
          getOrCreateBuffer(contactor.id, assistantMessageId, contactorStore);
        }
      }

      contactor.lastUpdate = Date.now();
      contactorStore.updateContactorSummary(contactor);
      client.setLocalStorage();
    }
  },

  flushAllBuffers() {
    for (const [, buffer] of streamBuffers.entries()) {
      buffer.flush();
    }
  },
};
/**
 * 转换 Onebot 消息格式为 UI 消息链格式
 */
export function convertOnebotMessage(data) {
  if (data.message && Array.isArray(data.message)) {
    data.message.forEach((element, index) => {
      if (element.type === "image") {
        const base64Data = element.data.file.replace(
          /^base64:\/\//,
          "data:image/jpeg;base64,",
        );
        data.message[index].data.file = base64Data;
      } else if (element.type === "nodes") {
        element.data.messages.forEach((node) => {
          if (node.type === "image") {
            const base64Data = node.data.file.replace(
              /^base64:\/\//,
              "data:image/jpeg;base64,",
            );
            node.data.file = base64Data;
          }
        });
      }
    });

    const rplMessage = data.message.filter(
      (element) => element.type === "reply",
    );
    const midMessage = data.message.filter(
      (element) => element.type !== "reply",
    );
    if (rplMessage.length > 0) {
      midMessage.unshift(rplMessage[0]);
    }

    const webMessage = {
      role: "other",
      time: new Date().getTime(),
      content: midMessage,
      id: data.message_id,
      status: "completed",
    };
    return webMessage;
  }
  return data;
}
