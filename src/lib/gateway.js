import { useContactorsStore } from "@/stores/contactorsStore.js";
import { client } from "@/lib/runtime.js";

function getFilePrompt(fileElms) {
  const start = "\n以下是用户上传的文件：\n";
  return start + fileElms.join("\n");
}

function getImagePrompt(imageElms) {
  const start = "\n以下是用户所上传的图片链接：\n";
  return start + imageElms.map((elm) => elm.content).join("\n");
}

/**
 * 格式化并合并要发送给 OpenAI 的上下文消息列表
 */
export function getValidOpenaiMessage(messageChain, firstMessageIndex = 0, maxMessagesNum = 20) {
  const fromIndexMessages = messageChain.slice(firstMessageIndex);
  
  // The default sliding window messages (last N messages)
  const slidingWindowMessages = fromIndexMessages.slice(-maxMessagesNum);
  
  // We want to keep a message if it's in the sliding window OR if it is pinned.
  // Pinned messages are identified by `isPinned === true`.
  const mergedList = fromIndexMessages.filter(msg => {
    return msg.isPinned === true || slidingWindowMessages.some(m => m.id === msg.id);
  });

  const validMessageList = mergedList.filter(
    (msg) => msg.role !== "mio_system"
  );

  const mergedMessages = validMessageList.map((message) => {
    const fileList = [];
    const imageList = [];
    const subArray = [];
    const cmds = [];
    
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
          formatedMsg.content = elm.data.text;
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
        lastMsg.content
      );
      
      return response.message_id;
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
      const finalMessages = getValidOpenaiMessage(
        messagesChain,
        contactor?.firstMessageIndex || 0,
        contactor?.options?.base?.max_messages_num || 20
      );

      const metaData = {
        contactorId,
        messageId,
        namePolicy: contactor?.namePolicy || 0,
      };

      const data = {
        settings: options,
        messages: finalMessages,
      };

      client.socket.streamCompletions(data, metaData);
    }
  },

  /**
   * 发送中断信号
   */
  async interrupt(platform, contactorId, messageId) {
    if (platform === "openai") {
      if (!client.socket) return;
      client.socket.interruptGeneration(messageId, contactorId);
    }
  },

  /**
   * 处理流式 LLM 消息回调并分发给 Pinia Store
   */
  handleLlmMessageEvent(e) {
    const data = e.data;
    const { metaData } = data || {};
    let contactorId = metaData?.contactorId;
    const messageId = metaData?.messageId || e.request_id;

    const contactorStore = useContactorsStore();

    if (!contactorId && messageId) {
      // Fallback: search all contactors in the store for this message ID
      const found = Object.values(contactorStore.contactors).find((c) =>
        c.messageChain.some((m) => m.id === messageId)
      );
      if (found) {
        contactorId = found.id;
      }
    }

    if (!contactorId) return;

    if (["update", "sync"].includes(e.message)) {
      if (e.message === "sync") {
        contactorStore.syncMessage(contactorId, {
          chunks: data.chunks,
          status: data.status,
          messageId,
          metaData
        });
      } else {
        if (data.type === "reason") {
          contactorStore.appendOrUpdateMessage(contactorId, messageId, {
            reasoning_content: data.data?.text ?? "",
            startTime: data.data?.startTime,
            duration: data.data?.duration ?? 0
          }, "reason");
        } else if (data.type === "content") {
          contactorStore.appendOrUpdateMessage(contactorId, messageId, {
            chunk: data.content
          }, "content");
        } else if (data.type === "toolCall") {
          contactorStore.appendOrUpdateMessage(contactorId, messageId, {
            tool_call: data.content
          }, "tool_call");
        }
      }
    } else if (["complete", "failed"].includes(e.message)) {
      if (e.message === "complete") {
        contactorStore.completeMessage(contactorId, messageId);
      } else if (e.message === "failed") {
        contactorStore.failedMessage(contactorId, messageId, e.data);
      }
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
          (c) => c.platform === "onebot"
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
        (item) => item.platform === "onebot"
      );
      for (const onebotContactor of onebotContactors) {
        const index = onebotContactor.messageChain.findIndex(
          (msg) => msg.id === content.message_id
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
                    text: `${displayName}撤回了一条消息`
                  }
                }
              ]
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
  }
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
