import Onebot from "./adapter/onebot.js";
import Openai from "./adapter/openai.js";
import EventEmmiter from "./event.js";
import { config } from "@/lib/runtime.js";

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

const avatarPolicy = ["MODEL", "CUSTOM"];

const namePolicy = ["MODEL", "CUSTOM", "SUMMARY"];

export default class Contactor extends EventEmmiter {
  /**
   * Constructor of Contactor class
   * @param {string} platform - Platform of contactor
   * @param {object} config - Configuration of contactor
   * @param {string} config.id - ID of the contactor
   * @param {string} config.name - Name of the contactor
   * @param {string} config.avatar - Avatar of the contactor
   * @param {string} config.title - Title of the contactor
   * @param {object} config.options - Options of the contactor
   * @param {number} config.priority - Priority of the contactor,from 0 to 1, 0 means highest priority
   */
  constructor(platform, config) {
    super();
    this.platform = platform;
    this.id = config.id;
    this.options = config.options;
    this.namePolicy = config.namePolicy || 0;
    this.avatarPolicy = config.avatarPolicy || 0;
    this.title = config.title;
    this.name = config.name;
    this.avatar = config.avatar;
    this.priority = config.priority;
    this.firstMessageIndex = 0;
    this.messageChain = config.messageChain || [];
    this.active = false;
    this.lastUpdate = config.lastUpdate || new Date().getTime();
    this.createTime = config.createTime || new Date().getTime();
    this.lastMessageSummary = this.getLastMessageSummary();

    this.kernel =
      this.platform == "onebot" ? new Onebot(config) : new Openai(config);

    if (this.platform == "openai") this.enableOpenaiListener();
  }

  enableOpenaiListener() {
    this.kernel.on("updateReasoning", (e) => {
      const { reasoning_content, index } = e;
      const rawMessage = this.messageChain[index];
      if (!rawMessage) return;

      // 查找现有的 reason 块
      const existingReasonIndex = rawMessage.content.findIndex(
        (msgElm) => msgElm.type === "reason",
      );

      const msgElm = {
        type: "reason",
        data: {
          text: reasoning_content,
          startTime: new Date().getTime(),
          endTime: 0,
        },
      };

      if (existingReasonIndex !== -1) {
        // 如果已存在 reason 块，更新其内容
        msgElm.data.text =
          rawMessage.content[existingReasonIndex].data.text + reasoning_content;
        msgElm.data.startTime =
          rawMessage.content[existingReasonIndex].data.startTime;
        rawMessage.content[existingReasonIndex] = msgElm;
      } else if (rawMessage.content[0].type === "blank") {
        // 如果是 blank 状态，直接更新第一个元素
        rawMessage.content[0] = msgElm;
      } else {
        // 其他情况，追加到末尾
        rawMessage.content.push(msgElm);
      }

      this.emit("updateMessage");
      this.emit("updateMessageSummary");
    });

    this.kernel.on("updateMessage", (e) => {
      const { chunk, index } = e;
      const rawMessage = this.messageChain[index];
      if (!rawMessage) return;

      rawMessage.content.forEach((msgElm) => {
        if (msgElm.type == "reason" && !msgElm.data.endTime)
          msgElm.data.endTime = new Date().getTime();
      });

      const lastMsgElm = rawMessage.content[rawMessage.content.length - 1];
      const isFirstElement = ["blank", "text"].includes(lastMsgElm.type);

      const msgElm = {
        type: "text",
        data: {
          text: (lastMsgElm.type == "text" ? lastMsgElm.data.text : "").concat(
            chunk,
          ),
        },
      };

      if (isFirstElement)
        rawMessage.content[rawMessage.content.length - 1] = msgElm;
      else rawMessage.content.push(msgElm);

      this.emit("updateMessage"); // 更新响应式数据
      this.emit("updateMessageSummary");
    });

    this.kernel.on("updateToolCall", (e) => {
      const { tool_call, index } = e;
      const rawMessage = this.messageChain[index];
      if (!rawMessage) return;

      const lastMsgElm = rawMessage.content[rawMessage.content.length - 1];
      const msgElm = {
        type: "tool_call",
        data: tool_call,
      };

      if (lastMsgElm.type == "blank") {
        // 这种情况一定是第一条空白消息，直接更新成 toolCall 消息
        rawMessage.content[0] = msgElm;
      } else {
        const previousCall = rawMessage.content.find(
          (msgElm) => msgElm.data.id == tool_call.id,
        );
        if (previousCall) {
          // 这种情况就是更新之前的 toolCall 消息
          previousCall.data = {
            ...tool_call,
            // params: previousCall.data.params += tool_call.params
          };
        } else {
          // 这种情况就是新增一条 toolCall 消息
          rawMessage.content.push(msgElm);
        }
      }

      this.emit("updateMessage"); // 更新响应式数据
      this.emit("updateMessageSummary");
    });

    this.kernel.on("completeMessage", (e) => {
      this.updateLastUpdate();
      const messageIndex = e.index;
      const rawMessage = this.messageChain[messageIndex];
      if (rawMessage) {
        this.emit("updateMessageSummary");

        this.emit("completeMessage", {
          index: messageIndex,
        });
      }
    });

    this.kernel.on("failedMessage", (e) => {
      console.error(e);
      this.updateLastUpdate();
      const messageIndex = e.index;
      const rawMessage = this.messageChain[messageIndex];
      if (rawMessage) {
        this.emit("updateMessageSummary");

        this.emit("completeMessage", {
          text: "请求发生错误！\n```json\n" + e.error + "\n```\n",
          index: messageIndex,
          error: true,
        });
      }
    });
  }

  /**
   * Send message to contactor
   * @param {OnebotMessage} message
   */
  async send(message) {
    await this.kernel.send(message);
  }

  _getFilePrompt(fileElms) {
    const start = "以下是用户上传的文件：\n";
    return start + fileElms.join("\n");
  }

  _getValidOpenaiMessage(
    start = this.firstMessageIndex,
    end = this.messageChain.length,
    length = this.options.max_messages_num,
  ) {
    const cuttedMessageList = this.messageChain
      .slice(start, end)
      .slice(-length);

    const validMessageList = cuttedMessageList.filter(
      (msg) => msg.role != "mio_system",
    );

    const mergedMessages = validMessageList.map((message) => {
      const fileList = [];
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
                arguments: elm.data.params,
              },
              type: "function",
            },
          ];
          subArray.push({ ...formatedMsg });

          delete formatedMsg.tool_calls;
          formatedMsg.role = "tool";
          formatedMsg.content = JSON.stringify(elm.data.result);
          formatedMsg.tool_call_id = elm.data.id;
          subArray.push({ ...formatedMsg });

          formatedMsg.role = role;
        } else if (role == "user" || role == "assistant") {
          if (elm.type == "text") {
            formatedMsg.content = elm.data.text;
            formatedMsg._content_type = "text";
            subArray.push(formatedMsg);
          } else if (elm.type == "image") {
            formatedMsg.content = elm.data.file;
            formatedMsg._content_type = "image";
            subArray.push(formatedMsg);
          } else if (elm.type == "file") {
            fileList.push(elm.data.file);
          }
        }
      });
      if (fileList.length > 0) {
        const textElm = subArray.filter((elm) => elm._content_type == "text");
        textElm[0].content = textElm[0].content + this._getFilePrompt(fileList);
      }
      return subArray;
    });
    let finalMessages = [];

    mergedMessages.forEach((subArray) => {
      const textElm = subArray.filter((elm) => elm._content_type == "text");
      const imageElm = subArray.filter((elm) => elm._content_type == "image");
      const fileElm = subArray.filter((elm) => elm._content_type == "file");
      const filePrompt = fileElm.length > 0 ? this._getFilePrompt(fileElm) : "";
      let message = null;
      if (
        textElm.length > 0 &&
        imageElm.length > 0 &&
        imageElm[0].role == "user"
      ) {
        message = {
          role: "user",
          content: [
            ...textElm.map((elm) => {
              return {
                type: "text",
                text: elm.content + filePrompt,
              };
            }),
            ...imageElm.map((elm) => {
              return {
                type: "image_url",
                image_url: {
                  url: elm.content,
                },
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

    if (this.options.history) {
      finalMessages = this.options.history.concat(finalMessages);
    }

    return finalMessages;
  }
  /**
   * 从网页前端发来的消息
   */
  async webSend(message) {
    this.updateLastUpdate();
    this.messageChain.push(message);
    if (this.platform == "onebot") {
      return await this.kernel.send(this.id, message.content);
    } else {
      // 截取从this.firstMessageIndex到结尾的消息
      const finalMessages = this._getValidOpenaiMessage();

      // 立即发生回复消息
      this.revMessage({ content: [] });

      const replyIndex = this.messageChain.length - 1;

      this.kernel.send(finalMessages, replyIndex, this.options);

      return Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, "0");
    }
  }

  async retryMessage(index) {
    const message = this.messageChain[index];
    if (message) {
      message.content = [
        {
          type: "blank",
        },
      ];
      this.updateLastUpdate();
      const finalMessages = this._getValidOpenaiMessage(0, index);
      this.kernel.send(finalMessages, index, this.options);
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
      if (this.messageChain[i].id === message_id) {
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
      return `昨天${hours}:${minutes}`;
    } else if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
      // 小于7天，返回星期x+时间
      const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
      const weekday = new Date(timestamp).getDay();
      const hours = new Date(timestamp).getHours().toString().padStart(2, "0");
      const minutes = new Date(timestamp)
        .getMinutes()
        .toString()
        .padStart(2, "0");
      return `星期${weekdays[weekday]}${hours}:${minutes}`;
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
        default:
          return "[未知消息类型] " + element.type;
      }
    };

    const msg = message || this.messageChain[this.messageChain.length - 1];
    if (!msg) return "";

    return getMessageText(msg.content ? msg.content[0] : msg);
  }

  updateFirstMessage() {
    this.firstMessageIndex = this.messageChain.length;
  }

  updateLastUpdate() {
    this.lastUpdate = new Date().getTime();
  }

  loadAvatar() {
    let avatar = "/static/avatar/miobot.png";
    if (avatarPolicy[this.avatarPolicy] == "MODEL") {
      const model = this.options.model;
      avatar = Contactor.getAvatarByModel(model);
    } else if (avatarPolicy[this.avatarPolicy] == "CUSTOM") {
      avatar = this.avatar;
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
    const modelOwner = config.getOpenaiModelOwner(model);
    if (Object.keys(AVATAR_MAP).includes(modelOwner)) {
      return `${AVATAR_BASE_PATH}/${AVATAR_MAP[modelOwner]}`;
    }

    return `${AVATAR_BASE_PATH}/openai.svg`;
  }
}
