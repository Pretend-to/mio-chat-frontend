import Onebot from "./adapter/onebot.js";
import Openai from "./adapter/openai.js";
import EventEmmiter from "./event.js";

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
    this.name = config.name;
    this.activeModel = config.activeModel || "gpt-4o-mini";
    this.avatar = config.avatar || this.getAvatar(config.activeModel);
    this.title = config.title;
    this.options = config.options;
    this.priority = config.priority;
    this.firstMessageIndex = 0;
    this.messageChain = config.messageChain || [];
    this.active = false;
    this.lastUpdate = config.lastUpdate || new Date().getTime();

    this.kernel =
      this.platform == "onebot" ? new Onebot(config) : new Openai(config);

    if (this.platform == "openai") this.enableOpenaiListener();
  }

  enableOpenaiListener() {
    this.kernel.on("updateMessage", (e) => {
      const { chunk,index } = e;
      const rawMessage = this.messageChain[index];
      if (!rawMessage) return;

      const lastMsgElm = rawMessage.content[rawMessage.content.length - 1];
      const isFirstElement = ["blank", "text"].includes(lastMsgElm.type);

      const msgElm = {
        type: "text",
        data: {
          text: (lastMsgElm.type == "text" ? lastMsgElm.data.text : "").concat(
            chunk
          ),
        },
      };

      if(isFirstElement) rawMessage.content[rawMessage.content.length - 1] = msgElm;
      else rawMessage.content.push(msgElm);

      if (this.active) this.emit("updateMessage"); // 更新响应式数据
    });

    this.kernel.on("updateToolCall", (e) => {
      const { tool_call, index } = e;
      const rawMessage = this.messageChain[index];
      if (!rawMessage) return;

      const lastMsgElm = rawMessage.content[rawMessage.content.length - 1];
      const isFirstElement = ["blank", "tool_call"].includes(lastMsgElm.type);
      const continuousCall = lastMsgElm.type == "tool_call" && lastMsgElm.data.id !== tool_call.id;

      const msgElm = {
        type: "tool_call",
        data: {
          ...tool_call,
          params: tool_call.action == 'pending' ? lastMsgElm.data.params += tool_call.params : tool_call.params
        },
      };


      if(isFirstElement && !continuousCall) rawMessage.content[rawMessage.content.length - 1] = msgElm;
      else rawMessage.content.push(msgElm);

      if (this.active) this.emit("updateMessage"); // 更新响应式数据
    });

    this.kernel.on("completeMessage", (e) => {
      this.updateLastUpdate();
      const messageIndex = e.index;
      const rawMessage = this.messageChain[messageIndex];
      if (rawMessage) {
        if (this.active)
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
        this.emit("completeMessage", {
          text:
            "请求发生错误！\n```json\n" +
            JSON.stringify(e.error, null, 2) +
            "\n```\n",
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

  /**
   * 从网页前端发来的消息
   */
  async webSend(message) {
    console.log(message);
    this.updateLastUpdate();
    this.messageChain.push(message);
    if (this.platform == "onebot") {
      return await this.kernel.send(this.id, message.content);
    } else {

      // 截取从this.firstMessageIndex到结尾的消息
      const cuttedMessageList = this.messageChain.slice(this.firstMessageIndex);
      const validMessageList = cuttedMessageList.filter(
        (msg) => msg.role != "mio_system"
      );

      const mergedMessages = validMessageList.map(message => {
        const subArray = []   
        message.content.forEach((elm)=>{
            const role = elm.type == "tool_call" ? "tool" : message.role == "user" ? "user" : "assistant";
            const formatedMsg = {
                role: role,
                content: undefined,
                _content_type:undefined
            }
            if(role == "tool"){
                formatedMsg.role = "assistant"
                formatedMsg.content = null
                formatedMsg.tool_calls = [{
                    id: elm.data.id,
                    function: {
                        name: elm.data.name,
                        arguments: JSON.stringify(elm.data.params)
                    },
                    type: "function"
                }]
                subArray.push({...formatedMsg})

                delete formatedMsg.tool_calls
                formatedMsg.role = "tool"
                formatedMsg.content = JSON.stringify(elm.data.result)
                formatedMsg.tool_call_id = elm.data.id
                subArray.push({...formatedMsg})

                formatedMsg.role = role

            }else if(role == "user" || role == "assistant"){
                if (elm.type == "text") {
                    formatedMsg.content = elm.data.text
                    formatedMsg._content_type = "text"
                    subArray.push(formatedMsg)
                } else if (elm.type == "image") {
                    formatedMsg.content = elm.data.file
                    formatedMsg._content_type = "image"
                    subArray.push(formatedMsg)
                }
                // TODO: 文件上传
            }
        })
        return subArray
      })
      const finalMessages = []

      mergedMessages.forEach((subArray)=>{
        const textElm = subArray.filter(elm => elm._content_type == "text")
        const imageElm = subArray.filter(elm => elm._content_type == "image")
        let message = null
        if(textElm.length > 0 && imageElm.length > 0 && imageElm[0].role == "user"){
            message = {
                role: "user",
                content: [...textElm.map((elm) => {
                    return {
                        type: "text",
                        text: elm.content
                    }
                }),...imageElm.map((elm) => {
                    return {
                        type: "image_url",
                        image_url: {
                            url: elm.content
                        }
                    }
                })]
            }
        }
        if (message?.content.length == subArray.length) {
            finalMessages.push(message)
        } else {
            subArray.forEach(elm => {
                delete elm._content_type
            });
            finalMessages.push(...subArray)
        }
      })


      // 立即发生回复消息
      this.revMessage({ content: [] });

      const settings = {
        model: this.activeModel,
      };

      const replyIndex = this.messageChain.length - 1;
      this.kernel.send(finalMessages, replyIndex, settings);

      return Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, "0");
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
    console.log(`收到消息，id:${this.id},激活状态:${this.active}`);
    console.log(webMessage);

    if (!this.active) this.messageChain.push(webMessage);
    else this.emit("revMessage", webMessage);

    console.log(this.messageChain);
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

  getMessageSummary(message) {
    const getMessageText = (element) => {
        switch (element.type) {
          case "text": return element.data.text;
          case "image": return "[图片]";
          case "record": return "[语音]";
          case "video": return "[视频]";
          case "file": return "[文件]";
          case "tool_call": return `[调用工具] ${element.data.name}`;
          case "blank": return "正在思考中...";
          case "reply": return ""; // 空字符串处理
          default: return "[未知消息类型] " + element.type;
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

  getAvatar(model) {
    console.log(model);
    const basePath = "/static/avatar";
    if (model.includes("gpt")) return `${basePath}/openai.png`;
    else if (model.includes("moon")) return `${basePath}/moonshot.png`;
    else if (model.includes("deepseek")) return `${basePath}/deepseek.png`;
    else if (model.includes("glm")) return `${basePath}/chatglm.png}`;
    else if (model.includes("gemini")) return `${basePath}/gemini.png`;
    else if (model.includes("claude")) return `${basePath}/claude.png`;
    else return `${basePath}/openai.png`;
  }
}
