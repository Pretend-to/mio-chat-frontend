import { config } from "@/lib/runtime.js";
import { getAvatarByOwner } from "@/utils/avatar.js";
import { numberString } from "../utils/generate.js";
import Onebot from "./adapter/onebot.js";
import Openai from "./adapter/openai.js";
import EventEmmiter from "./event.js";

const avatarPolicy = ["MODEL", "CUSTOM"];

const namePolicy = ["MODEL", "CUSTOM", "SUMMARY"];

export default class Contactor extends EventEmmiter {
  /**
   * Contactor 构造函数
   * @param {string} platform - 平台 (e.g., "onebot", "openai")
   * @param {object} config - 配置对象
   * @param {string} config.id - ID
   * @param {string} config.name - 名称
   * @param {string} config.avatar - 头像 URL
   * @param {string} config.title - 标题
   * @param {object} config.options - 选项
   * @param {number} config.priority - 优先级 (0 最高)
   * @param {number} config.namePolicy - 名称策略 (默认 0)
   * @param {number} config.avatarPolicy - 头像策略 (默认 0)
   * @param {number} config.firstMessageIndex - 首条消息索引 (默认 0)
   * @param {array} config.messageChain - 消息链 (默认 [])
   * @param {number} config.lastUpdate - 最后更新时间 (默认当前时间)
   * @param {number} config.createTime - 创建时间 (默认当前时间)
   */
  constructor(platform, config) {
    super();
    this.platform = platform;
    this.id = config.id;
    this.namePolicy = config.namePolicy || 0;
    this.avatarPolicy = config.avatarPolicy || 0;
    this.title = config.title;
    this.name = config.name;
    this.avatar = config.avatar;
    this.priority = config.priority;
    this.firstMessageIndex = config.firstMessageIndex || 0;
    this.messageChain = config.messageChain || [];
    this.active = false;
    this.lastUpdate = config.lastUpdate || Date.now(); // 使用 Date.now()
    this.createTime = config.createTime || Date.now(); // 使用 Date.now()
    this.lastMessageSummary = this.getLastMessageSummary();
    this.options = this.loadOptions(config.options);
    this.kernel =
      platform === "onebot" ? new Onebot(config) : new Openai(config); // 简化条件判断

    if (platform === "openai") {
      this.enableOpenaiListener();
    }
  }

  /**
   * 将 Contactor 对象转换为 JSON 格式
   * @returns {object} - 包含 Contactor 属性的 JSON 对象
   */
  toJSON() {
    return {
      platform: this.platform,
      id: this.id,
      options: this.options,
      namePolicy: this.namePolicy,
      avatarPolicy: this.avatarPolicy,
      title: this.title,
      name: this.name,
      avatar: this.avatar,
      priority: this.priority,
      messageChain: this.messageChain,
      active: this.active,
      lastUpdate: this.lastUpdate,
      createTime: this.createTime,
      lastMessageSummary: this.lastMessageSummary,
      firstMessageIndex: this.firstMessageIndex,
    };
  }

  enableOpenaiListener() {
    this.kernel.on("updateReasoning", this.handleUpdateReasoning.bind(this));
    this.kernel.on("updateMessage", this.handleUpdateMessage.bind(this));
    this.kernel.on("updateToolCall", this.handleUpdateToolCall.bind(this));
    this.kernel.on("syncMessage", this.handleSyncMessage.bind(this));
    this.kernel.on("completeMessage", this.handleCompleteMessage.bind(this));
    this.kernel.on("failedMessage", this.handleFailedMessage.bind(this));
  }

  /**
   * 处理全量结构化同步消息 (确保顺序)
   */
  handleSyncMessage(e) {
    const { chunks, status, messageId } = e;

    const rawMessage = this.getRawMessage(messageId);
    if (!rawMessage) return;

    const newContent = [];

    if (chunks && Array.isArray(chunks)) {
      const now = Date.now();

      chunks.forEach((chunk) => {
        if (chunk.type === "reasoningContent") {
          newContent.push({
            type: "reason",
            data: { 
              text: chunk.content,
              startTime: now
            },
          });
        } else if (chunk.type === "content") {
          newContent.push({
            type: "text",
            data: { text: chunk.content },
          });
        } else if (chunk.type === "toolCall") {
          newContent.push({
            type: "tool_call",
            data: chunk.content,
          });
        }
      });
    }

    rawMessage.content = newContent;

    if (status === "completed") {
      rawMessage.status = "completed";
    } else if (status === "failed") {
      rawMessage.status = "failed";
    }

    this.emitMessageUpdated();
  }

  /**
   * 获取消息
   */
  getRawMessage(messageId) {
    return this.getMessageById(messageId);
  }

  /**
   * 获取最后一个 content 元素
   */
  getLastContent(rawMessage) {
    const content = rawMessage.content || [];
    return content[content.length - 1];
  }

  /**
   * 统一触发消息更新
   */
  emitMessageUpdated() {
    this.emit("updateMessage");
    this.emit("updateMessageSummary");
  }

  /**
   * 替换 blank，或者追加新元素
   */
  replaceBlankOrAppend(rawMessage, msgElm) {
    const content = rawMessage.content;

    if (!content.length) {
      content.push(msgElm);
      return;
    }

    const blankIndex = content.findIndex((elm) => elm.type === "blank");

    if (blankIndex !== -1) {
      content.splice(blankIndex, 1, msgElm);
    } else {
      content.push(msgElm);
    }
  }

  /**
   * 处理 reasoning 增量
   */
  handleUpdateReasoning(e) {
    const { reasoning_content, messageId } = e;

    const rawMessage = this.getRawMessage(messageId);
    if (!rawMessage) return;

    const last = this.getLastContent(rawMessage);

    const now = Date.now();

    if (last?.type === "reason") {
      last.data.text += reasoning_content;
    } else {
      const msgElm = {
        type: "reason",
        data: {
          text: reasoning_content,
          startTime: now,
          endTime: 0,
        },
      };

      this.replaceBlankOrAppend(rawMessage, msgElm);
    }

    this.emitMessageUpdated();
  }

  /**
   * 处理普通文本增量
   */
  handleUpdateMessage(e) {
    const { chunk, messageId } = e;

    const rawMessage = this.getRawMessage(messageId);
    if (!rawMessage) return;

    const content = rawMessage.content || (rawMessage.content = []);

    this.closeReasoningBlocks(rawMessage);

    const last = this.getLastContent(rawMessage);

    if (last?.type === "text") {
      last.data.text += chunk;
    } else if (last?.type === "blank") {
      content.splice(content.length - 1, 1, {
        type: "text",
        data: {
          text: chunk,
        },
      });
    } else {
      content.push({
        type: "text",
        data: {
          text: chunk,
        },
      });
    }

    this.emitMessageUpdated();
  }

  /**
   * 关闭所有未结束的 reasoning 块
   */
  closeReasoningBlocks(rawMessage) {
    const now = Date.now();

    rawMessage.content.forEach((elm) => {
      if (elm.type === "reason" && !elm.data.endTime) {
        elm.data.endTime = now;
      }
    });
  }

  /**
   * 处理 tool call
   */
  handleUpdateToolCall(e) {
    const { tool_call, messageId } = e;

    const rawMessage = this.getRawMessage(messageId);
    if (!rawMessage) return;

    const content = rawMessage.content || (rawMessage.content = []);

    const msgElm = {
      type: "tool_call",
      data: {
        ...tool_call,
      },
    };

    const last = this.getLastContent(rawMessage);

    if (last?.type === "blank") {
      content.splice(content.length - 1, 1, msgElm);
      this.emitMessageUpdated();
      return;
    }

    this.closeReasoningBlocks(rawMessage);

    const index = content.findIndex(
      (elm) => elm.type === "tool_call" && elm.data?.id === tool_call.id,
    );

    if (index === -1) {
      content.push(msgElm);
    } else {
      content.splice(index, 1, this.mergeToolCall(content[index], tool_call));
    }

    this.emitMessageUpdated();
  }

  /**
   * 合并 tool call 增量
   */
  mergeToolCall(previousElm, incomingToolCall) {
    const previousData = previousElm.data || {};

    const merged = {
      ...previousElm,
      data: {
        ...previousData,
        ...incomingToolCall,
      },
    };

    /**
     * pending 阶段 parameters 通常是流式增量，需要拼接
     */
    if (incomingToolCall.action === "pending") {
      merged.data.parameters =
        String(previousData.parameters || "") +
        String(incomingToolCall.parameters || "");
    }

    return merged;
  }

  /**
   * 处理完成
   */
  handleCompleteMessage(e) {
    const { messageId } = e;

    this.updateLastUpdate();

    const rawMessage = this.getRawMessage(messageId);
    if (!rawMessage) return;

    rawMessage.status = "completed";

    this.emit("updateMessageSummary");
    this.emit("completeMessage", {
      messageId,
    });
  }

  /**
   * 处理失败
   */
  handleFailedMessage(e) {
    console.error(e);

    const { messageId } = e;

    this.updateLastUpdate();

    const rawMessage = this.getRawMessage(messageId);
    if (!rawMessage) return;

    const errorText = this.formatLLMError(e.error);

    const errElm = {
      type: "text",
      data: {
        text: errorText,
      },
    };

    this.replaceBlankOrAppend(rawMessage, errElm);

    rawMessage.status = "completed";

    this.emit("updateMessageSummary");
    this.emit("completeMessage", {
      messageId,
    });
  }

  /**
   * 格式化 LLM 错误
   */
  formatLLMError(error) {
    const normalizedError = this.normalizeError(error);
    const errorJson = JSON.stringify(normalizedError, null, 2);

    return `Error : LLM 响应失败！\n\`\`\`json\n${errorJson}\n\`\`\``;
  }

  /**
   * 规范化错误对象
   */
  normalizeError(error) {
    if (typeof error === "string") {
      try {
        return JSON.parse(error);
      } catch {
        return {
          message: error,
        };
      }
    }

    if (error?.message && typeof error.message === "string") {
      try {
        return {
          ...error,
          message: JSON.parse(error.message),
        };
      } catch {
        return error;
      }
    }

    return error;
  }

  handleLLMMessageEvent(e) {
    this.kernel.handleMessageEvent(e);
  }

  loadOptions(options) {
    if (this.platform === "openai") {
      return config.getVerifiedLLMConfig(options);
    } else {
      return options || {};
    }
  }

  /**
   * Send message to contactor
   * @param {OnebotMessage} message
   */
  async send(message) {
    await this.kernel.send(message);
  }

  _getFilePrompt(fileElms) {
    const start = "\n以下是用户上传的文件：\n";
    return start + fileElms.join("\n");
  }

  _getImagePrompt(imageElms) {
    const start = "\n以下是用户所上传的图片链接：\n";
    const result = start + imageElms.map((elm) => elm.content).join("\n");
    return result;
  }

  _getValidOpenaiMessage(
    start = this.firstMessageIndex,
    end = this.messageChain.length,
    length = this.options.base.max_messages_num,
  ) {
    const cuttedMessageList = this.messageChain
      .slice(start, end)
      .slice(-length);

    const validMessageList = cuttedMessageList.filter(
      (msg) => msg.role != "mio_system",
    );

    const mergedMessages = validMessageList.map((message) => {
      const fileList = [];
      const imageList = [];
      const subArray = [];
      message.content.forEach((elm) => {
        const role =
          elm.type == "tool_call"
            ? "tool"
            : message.role == "user"
              ? "user"
              : "assistant";
        const formatedMsg = {
          role: role,
          content: "none",
          _content_type: undefined,
        };
        if (role == "tool") {
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
        } else if (role == "user" || role == "assistant") {
          if (elm.type == "image") {
            formatedMsg.content = elm.data.file;
            formatedMsg._content_type = "image";
            subArray.push(formatedMsg);
            imageList.push(elm.data.file.content);
          } else if (elm.type == "text") {
            formatedMsg.content = elm.data.text;
            formatedMsg._content_type = "text";
            subArray.push(formatedMsg);
          } else if (elm.type == "file") {
            fileList.push(elm.data.file);
          }
        }
      });
      if (fileList.length > 0) {
        const textElm = subArray.filter((elm) => elm._content_type == "text");
        // 没有就创建一个
        if (textElm.length == 0) {
          subArray.push({
            role: "user",
            content: this._getFilePrompt(fileList),
            _content_type: "text",
          });
        }
      }
      return subArray;
    });
    let finalMessages = [];

    mergedMessages.forEach((subArray) => {
      const textElm = subArray.filter((elm) => elm._content_type == "text");
      const imageElm = subArray.filter((elm) => elm._content_type == "image");
      const fileElm = subArray.filter((elm) => elm._content_type == "file");
      const filePrompt = fileElm.length > 0 ? this._getFilePrompt(fileElm) : "";
      const imagePrompt =
        imageElm.length > 0 ? this._getImagePrompt(imageElm) : "";

      let message = null;
      if (
        textElm.length > 0 &&
        imageElm.length > 0 &&
        imageElm[0].role == "user"
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
      if (message?.content.length == subArray.length) {
        finalMessages.push(message);
      } else {
        subArray.forEach((elm) => {
          delete elm._content_type;
        });
        finalMessages.push(...subArray);
      }
    });

    const presetHistory = this.options.presetSettings.history;

    if (presetHistory) {
      finalMessages = presetHistory.concat(finalMessages);
    }

    return finalMessages;
  }
  updateMessageSummary() {
    this.lastMessageSummary = this.getLastMessageSummary();
  }

  getBaseUserContainer() {
    const userContainer = {
      role: "user",
      time: new Date().getTime(),
      status: "completed",
      id: numberString(16),
      content: [],
    };
    return userContainer;
  }

  /**
   * 从网页前端发来的消息
   */
  async webSend(message, toServer = true) {
    // --- 核心修复：前置校验连接状态 ---
    if (toServer && !this.kernel.isConnected) {
      throw new Error("连接已断开，请检查网络或刷新页面");
    }

    this.updateLastUpdate();
    this.messageChain.push(message);
    this.updateMessageSummary();
    if (!toServer) return;
    try {
      if (this.platform == "onebot") {
        const messageId = await this.kernel.send(this.id, message.content);

        return messageId;
      } else {
        // 截取从this.firstMessageIndex到结尾的消息
        const finalMessages = this._getValidOpenaiMessage();
        const messageId = numberString(16);
        await this.kernel.send(finalMessages, messageId, this.options);

        this.revMessage({
          id: messageId,
        });

        return numberString(16);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  insertMessage(message, index) {
    this.messageChain.splice(index, 0, message);
    this.updateMessageSummary();
  }

  async retryMessage(id) {
    // --- 核心修复：前置校验连接状态 ---
    if (!this.kernel.isConnected) {
      throw new Error("连接已断开，无法重试");
    }

    const message = this.getMessageById(id);
    if (message) {
      message.content = [
        {
          type: "blank",
        },
      ];
      this.updateLastUpdate();
      const index = this.messageChain.indexOf(message);
      const finalMessages = this._getValidOpenaiMessage(
        index < this.firstMessageIndex ? 0 : this.firstMessageIndex,
        index,
      );
      this.kernel.send(finalMessages, id, this.options);
      return true;
    }
  }

  /**
   * 接收到消息
   * @param {string} id - ID of the contactor
   * @param {object} message - Message received from contactor
   */
  revMessage(message) {
    this.updateLastUpdate();

    const webMessage = this.kernel.convertMessage(message);

    if (!this.active) this.messageChain.push(webMessage);
    else this.emit("revMessage", webMessage);

    this.emit("updateMessageSummary");
    return webMessage;
  }

  /**
   * 删除消息
   * @param {string} message_id - ID of the message to be deleted
   * @returns {boolean} - Whether the message is successfully deleted
   */
  delMessage(message_id) {
    for (let i = 0; i < this.messageChain.length; i++) {
      // 如果不是bot发的消息，跳过
      if (
        this.messageChain[i].id === message_id &&
        this.messageChain[i].role === "other"
      ) {
        if (this.active) this.emit("delMessage", i);
        else this.acting.messageChain.splice(i, 1);
        this.makeSystemMessage(`${this.name}撤回了一条消息`);
        return true; // 删除成功
      }
    }
    return false; // 没有找到要删除的消息
  }

  makeSystemMessage(text) {
    const container = {
      role: "mio_system",
      time: new Date().getTime(),
      id: new Date().getTime(),
      content: [
        {
          type: "text",
          data: {
            text: text,
          },
        },
      ],
    };
    if (this.active) this.emit("revMessage", container);
    else this.messageChain.push(container);
  }

  getLastTime() {
    const last = this.messageChain[this.messageChain.length - 1];
    if (!last) {
      return "";
    }

    const currentTime = new Date().getTime();
    const lastTime = new Date(last.time);
    const timeDiff = currentTime - lastTime.getTime();

    if (timeDiff < 24 * 60 * 60 * 1000) {
      this.toinit = false;
      // 小于24小时，返回 xx:xx (小时:分钟)
      const hours = lastTime.getHours().toString().padStart(2, "0");
      const minutes = lastTime.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    } else if (timeDiff < 48 * 60 * 60 * 1000) {
      // 小于48小时，显示昨天
      return "昨天";
    } else if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
      // 小于7天，返回星期x
      const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
      const weekday = lastTime.getDay();
      return `星期${weekdays[weekday]}`;
    } else {
      // 7天以上，返回xxxx/xx/xx（年/月/日）
      const year = lastTime.getFullYear();
      const month = (lastTime.getMonth() + 1).toString().padStart(2, "0");
      const day = lastTime.getDate().toString().padStart(2, "0");
      return `${year}/${month}/${day}`;
    }
  }

  getShownTime(timestamp) {
    const currentTime = new Date().getTime();
    // 如果传入时间和当前时间差在24h以内，则显示时间

    const timeDiff = currentTime - timestamp;
    if (timeDiff < 24 * 60 * 60 * 1000) {
      const hours = new Date(timestamp).getHours().toString().padStart(2, "0");
      const minutes = new Date(timestamp)
        .getMinutes()
        .toString()
        .padStart(2, "0");
      return `${hours}:${minutes}`;
    } else if (timeDiff < 48 * 60 * 60 * 1000) {
      // 小于48小时，显示昨天+时间
      const hours = new Date(timestamp).getHours().toString().padStart(2, "0");
      const minutes = new Date(timestamp)
        .getMinutes()
        .toString()
        .padStart(2, "0");
      return `昨天 ${hours}:${minutes}`;
    } else if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
      // 小于7天，返回星期x+时间
      const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
      const weekday = new Date(timestamp).getDay();
      const hours = new Date(timestamp).getHours().toString().padStart(2, "0");
      const minutes = new Date(timestamp)
        .getMinutes()
        .toString()
        .padStart(2, "0");
      return `星期${weekdays[weekday]} ${hours}:${minutes}`;
    } else {
      // 7天以上，返回xxxx/xx/xx（年/月/日）+时间
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

  getLastMessageSummary(message) {
    const getMessageText = (element) => {
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
          return "正在思考中...";
        case "reply":
          return ""; // 空字符串处理
        case "nodes":
          return "[转发消息]";
        default:
          return "[未知消息类型] " + element.type;
      }
    };

    let msg = message || this.messageChain[this.messageChain.length - 1];
    if (!msg) return "";
    msg = JSON.parse(JSON.stringify(msg));
    if (msg.type === "node") {
      msg = msg.data;
    }

    return msg.content?.length > 0
      ? getMessageText(msg.content[0])
      : "[未知消息]";
  }

  updateFirstMessage() {
    this.firstMessageIndex = this.messageChain.length;
  }

  updateLastUpdate() {
    this.lastUpdate = new Date().getTime();
  }

  getMessageById(id) {
    return this.messageChain.find((msg) => msg.id === id);
  }

  loadAvatar() {
    let avatar = "/static/icons/512*512.png";
    if (avatarPolicy[this.avatarPolicy] == "MODEL") {
      const model = this.options.base.model;
      avatar = Contactor.getAvatarByModel(model);
    } else if (avatarPolicy[this.avatarPolicy] == "CUSTOM") {
      avatar = this.avatar;
    }

    if (this.platform == "openai") {
      this.title = this.options.base.model;
    }

    this.avatar = avatar;
    return avatar;
  }

  async loadName() {
    let name = this.name ?? "未命名 Bot";
    if (namePolicy[this.namePolicy] == "MODEL") {
      const model = this.options.model;
      name = model;
    } else if (namePolicy[this.namePolicy] == "CUSTOM") {
      name = this.name;
    } else if (namePolicy[this.namePolicy] == "SUMMARY") {
      if (this.messageChain.length < 2) {
        name = "新建的 Bot";
      } else if (
        this.messageChain.length == 2 ||
        this.messageChain.length % 6 == 0
      ) {
        name = await this.getMessagesSummary();
      }
    }
    this.name = name;
    return name;
  }

  getMessagesSummary() {
    if (this.platform == "openai") {
      return this.kernel.getMessagesSummary(
        this._getValidOpenaiMessage().slice(-4),
      );
    } else {
      return "仅支持 OpenAI Chat Bot";
    }
  }

  static getAvatarByModel(model) {
    const modelOwner = config.getModelOwner(model);
    return getAvatarByOwner(modelOwner);
  }
}
