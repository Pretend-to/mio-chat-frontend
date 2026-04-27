<script>
import ForwardMsg from "@/components/ForwardMsg.vue";
import InputEditor from "@/components/InputEditor.vue";
import FileBlock from "@/components/FileBlock.vue";
import ToolCallBar from "@/components/ToolCallBar.vue";
import ReasonBlock from "@/components/ReasonBlock.vue";
import ContextMenu from "@/components/ContextMenu.vue";
import MdRenderer from "mio-previewer";
import { mermaidPlugin, codeBlockPlugin, cursorPlugin, imageViewerPlugin } from 'mio-previewer/plugins/custom';
import { katexPlugin } from 'mio-previewer/plugins/markdown-it';
import "emoji-picker-element";
import { snapdom } from "@zumer/snapdom";
import { client } from "@/lib/runtime.js";
import { shareOrCopy } from "@/utils/tools.js";

export default {
  components: {
    MdRenderer,
    ContextMenu,
    ForwardMsg,
    InputEditor,
    ToolCallBar,
    FileBlock,
    ReasonBlock,
  },
  data() {
    let preview = false;
    let shareId = undefined;
    let contactor = undefined;
    let scroll = true;

    // 获取当前页面的URL
    const currentUrl = window.location.href;
    // 创建一个URL对象
    const url = new URL(currentUrl);
    // 获取URL参数
    const params = url.searchParams;
    // 检查URL参数是否有preview参数
    if (params.has("preview")) {
      if (params.get("preview") === "true") {
        preview = true;
      }
    }
    // 检查URL参数是否有shareId参数
    if (params.has("shareId")) {
      shareId = params.get("shareId");
    }
    if (params.has("scroll")) {
      scroll = params.get("scroll") || "true";
    }

    const currentId = parseInt(this.$route.params.id);
    try {
      contactor = client.getContactor(currentId);
      if (!contactor) {
        throw new Error("找不到联系人");
      }
    } catch (e) {
      const defaultId = client.contactList[0].id;
      this.$router.push({
        path: `/chat/${defaultId}`,
        query: {
          preview,
          shareId,
        },
      });
      contactor = client.getContactor(defaultId);
    }
    const mioPlugins = [{
      plugin: codeBlockPlugin,
    },
    {
      plugin: mermaidPlugin,
    },
    {
      plugin: cursorPlugin,
      options: {
        shape: 'circle'
      }
    },
    {
      plugin: imageViewerPlugin,
    }
    ]

    return {
      scroll,
      preview,
      shareId,
      activeContactor: contactor,
      showwindow: true,
      showemoji: false,
      userInput: "",
      client: client,
      extraOptions: [],
      wraperPresets: {},
      selectedOption: null,
      currentDelay: 0,
      toupdate: false,
      seletedText: "",
      seletedImage: "",
      retryList: [],
      showMenu: false,
      menuTop: 0,
      menuLeft: 0,
      validMessageIndex: -1,
      repliedMessageId: -1,
      autoScroll: false,
      fullScreen: false,
      chatWindowRef: null,
      prevScrollTop: 0,
      showRollDown: false,
      inputBarTop: 0,
      clearMessageTip: "以上的对话记录已清除",
      loadingIcon: "<span id='message-loading-icon'></span>",
      katexPlugin,
      mioPlugins,
      longPressTimer: null,
      lastClickTime: 0,
      isMultiSelect: false,
      selectedMessages: [],
    };
  },
  computed: {
    getMenuStyle() {
      // 判断屏幕宽度是否小于768px
      if (window.innerWidth < 768) {
        const basicHeight = 160;
        // 检查向上是否超出屏幕高度
        if (this.menuTop - basicHeight < 0) {
          return {
            top: basicHeight + "px",
          };
        }
        return {
          bottom: window.innerHeight - this.menuTop + 16 + "px",
        };
      } else {
        // 长度超出屏幕宽度，就向左移动
        if (this.menuLeft + 110 > window.innerWidth) {
          return {
            top: this.menuTop + "px",
            left: this.menuLeft - 110 + "px",
          };
        } else {
          return {
            top: this.menuTop + "px",
            left: this.menuLeft + "px",
          };
        }
      }
    },
    getDelayStatus() {
      return this.currentDelay > 1000
        ? "high"
        : this.currentDelay > 500
          ? "mid"
          : this.currentDelay > 100
            ? "low"
            : "ultra";
    },
    activeMessageChain() {
      return this.activeContactor.options.presetSettings?.opening
        ? [
          {
            role: "other",
            content: [
              {
                type: "text",
                data: {
                  text: this.activeContactor.options.presetSettings.opening,
                },
              },
            ],
            time: this.activeContactor.createTime,
          },
          ...this.activeContactor.messageChain,
        ]
        : this.activeContactor.messageChain;
    },
  },
  watch: {
    ["$route.params.id"](newVal, oldVal) {
      const currentId = parseInt(newVal);
      const contactor = client.getContactor(currentId);
      this.activeContactor = contactor;
      this.initContactor(this.activeContactor);
      if (this.chatWindowRef) this.toButtom();
      if (oldVal) {
        const oldId = parseInt(oldVal);
        const oldContactor = client.getContactor(oldId);
        this.disableContactor(oldContactor);
      }
    },
  },
  async mounted() {
    document.addEventListener("click", () => {
      this.showMenu = false;
      this.seletedText = "";
      this.seletedImage = "";
      // if( this.showemoji) this.showemoji = false;
    });
    this.chatWindowRef = this.$refs.chatWindow;
    this.chatWindowRef.addEventListener("scroll", this.scrollHandler);
    if (!this.preview && this.scroll) this.toButtom();
    this.scroll = true;
    this.initContactor(this.activeContactor);
    this.fullScreen = this.client.fullScreen;
    // setInterval(() => {
    //   this.currentDelay = this.client.socket.delay;
    // }, 3000);
    // 获取.input-bar在页面中的高度，给inputBarTop赋值
    const element = document.querySelector(".input-bar");
    if (element) {
      // 获取页面高度
      const pageHeight = window.innerHeight;
      this.inputBarTop = pageHeight - element.offsetTop;
      console.log(this.inputBarTop);
    }


    if (this.shareId) {
      const loadAble = await client.loadOriginalContactors(this.shareId);
      if (loadAble) {
        this.$router.push({
          path: "/chat/" + this.shareId,
          query: {
            preview: this.preview,
            scroll: false,
          },
        });
      } else {
        this.$message({
          message: "分享链接已失效",
          type: "error",
        });
      }
    }
  },
  updated() {
    if (this.toupdate && this.autoScroll && this.retryList.length === 0) {
      this.toButtom();
      this.toupdate = false;
    }
  },
  beforeUnmount() {
    // 移除事件监听
    this.disableContactor(this.activeContactor);
    this.chatWindowRef.removeEventListener("scroll", this.scrollHandler);
  },
  methods: {
    handleMouseUp() {
      const selectedText = window.getSelection().toString();
      if (selectedText) {
        this.seletedText = selectedText;
        console.log("选中的文本：" + selectedText);
      }
    },
    toButtom(clicked) {
      setTimeout(() => {
        const scrollToBottom = () => {
          const elm =
            this.chatWindowRef ||
            document.getElementById("main-messages-window");
          if (!elm) return;

          // 使用平滑滚动 or 立即滚动
          elm.scrollTo({
            top: elm.scrollHeight,
            behavior: clicked ? "smooth" : "instant",
          });
        };
        scrollToBottom();
      }, 1);
    },
    cleanScreen() {
      this.activeContactor.messageChain = [];
      this.activeContactor.updateFirstMessage();
      client.setLocalStorage(); //持久化存储
      this.activeContactor.emit("updateMessageSummary");

      this.toupdate = true;
      this.$message({ message: "已清除会话记录", type: "success" });
    },
    cleanHistory() {
      this.activeContactor.updateFirstMessage();
      this.$message({
        message: "上下文信息已清除，之后的请求将不再记录上文记录",
        type: "success",
      });
      // 先看看之前有没有清除提示
      for (let i = this.activeContactor.messageChain.length - 1; i >= 0; i--) {
        const message = this.activeContactor.messageChain[i];
        // role 为 "mio_system"
        if (
          message.role === "mio_system" &&
          message.content[0].type === "text" &&
          message.content[0].data.text === this.clearMessageTip
        ) {
          this.activeContactor.messageChain.splice(i, 1);
        }
      }
      this.activeContactor.makeSystemMessage(this.clearMessageTip);
      // 持久化
      client.setLocalStorage();
    },

    delSystemMessage(index) {
      const message = this.activeContactor.messageChain[index];
      // 判断是否是清除提示
      if (
        message.content[0].type === "text" &&
        message.content[0].data.text === this.clearMessageTip
      ) {
        this.activeContactor.firstMessageIndex = 0;
      }
      this.activeContactor.messageChain.splice(index, 1);
      // 持久化
      client.setLocalStorage();
    },

    isValidInput(input) {
      // 使用正则表达式检查用户输入是否只包含换行符和空格
      const regex = /^[ \n]+$/;
      const result = !regex.test(input);
      return result;
    },
    waiting() {
      this.$message({ message: "此功能尚未开放", type: "warning" });
    },

    tolist() {
      this.$router.push({ name: "home" });
    },

    async setModel(list) {
      const provider = list[0];
      const model = list[2];
      this.activeContactor.options.provider = provider;
      this.activeContactor.options.base.model = model;
      this.activeContactor.loadAvatar();
      await client.setLocalStorage(); //持久化存储
    },
    async toimg() {
      // 使用snapdom把 this.chatWindowRef 渲染为图片
      const result = await snapdom(this.chatWindowRef);
      await result.download({ format: 'png', filename: 'chat.png' });
    },
    async share() {
      const shareResult = await client.shareContactor(
        this.activeContactor.id,
      );
      if (shareResult && shareResult.shareUrl) {
        const { shareUrl } = shareResult;
        // 首先尝试调用分享api
        const { success, message } = shareOrCopy(shareUrl);
        if (success) {
          this.$message({
            message: message,
            type: "success",
          });
        } else {
          this.$message({
            message: message,
            type: "error",
          });
        }
      }
    },
    hasOpening() {
      return this.activeContactor.options.presetSettings?.opening
        ? true
        : false;
    },
    getFullMessages() {
      return this.hasOpening()
        ? [
          {
            role: "other",
            content: [
              {
                type: "text",
                data: {
                  text: this.activeContactor.options.presetSettings.opening,
                },
              },
            ],
            time: this.activeContactor.createTime,
          },
          ...this.activeContactor.messageChain,
        ]
        : this.activeContactor.messageChain;
    },
    showTime(index) {
      const list = this.getFullMessages();
      const thisTime = list[index].time;
      if (index === 0) {
        return {
          show: true,
          time: this.activeContactor.getShownTime(thisTime),
        };
      } else {
        const earlyTime = list[index - 1].time;
        if (thisTime - earlyTime > 600000) {
          return {
            show: true,
            time: this.activeContactor.getShownTime(thisTime),
          };
        } else {
          return {
            show: false,
            time: "",
          };
        }
      }
    },
    separateTextAndImages(markdownText) {
      // 使用正则表达式匹配Markdown图片格式
      const regex = /!\[([^\]]*)\]\((.*)\)/g;
      let result = [];
      let lastIndex = 0;

      // 查找所有匹配的图片
      let matches;
      while ((matches = regex.exec(markdownText)) !== null) {
        // 处理匹配到的文本部分
        if (matches.index > lastIndex) {
          const textContent = markdownText
            .slice(lastIndex, matches.index)
            .trim();
          if (textContent) {
            result.push({
              type: "text",
              data: {
                text: textContent,
              },
            });
          }
        }

        // 处理匹配到的图片部分
        result.push({
          type: "image",
          data: {
            // file: matches[2].length > 200 ? matches[2] : `/api/proxy?url=${matches[2]}`,
            file: matches[2],
          },
        });

        // 更新lastIndex到当前匹配结束的位置
        lastIndex = regex.lastIndex;
      }

      // 处理最后一部分文本（如果有的话）
      if (lastIndex < markdownText.length) {
        const textContent = markdownText.slice(lastIndex).trim();
        if (textContent) {
          result.push({
            type: "text",
            data: {
              text: textContent,
            },
          });
        }
      }

      return result;
    },

    getChatwindowScrollheight() {
      var scrollTop = this.chatWindowRef.scrollTop; // 当前滚动条的垂直位置
      var clientHeight = this.chatWindowRef.clientHeight; // 可视区域高度
      var scrollHeight = this.chatWindowRef.scrollHeight; // 内容总高度

      // 计算滚动位置的实际像素长度
      var scrollPercentage = scrollTop / (scrollHeight - clientHeight);
      var height = scrollPercentage * scrollHeight;

      return scrollHeight - height;
    },

    initContactor(contactor) {
      contactor.active = true;

      contactor.on("revMessage", (message) => {
        this.activeContactor.messageChain.push(message);
        this.toupdate = true;
      });
      contactor.on("delMessage", (index) => {
        console.log(`删除消息${index}`);
        // 从消息链中删除消息
        this.activeContactor.messageChain.splice(index, 1);
        this.toupdate = true;
      });

      contactor.on("updateMessage", () => {
        if (!this._updateRaf) {
          this._updateRaf = requestAnimationFrame(() => {
            this.$forceUpdate();
            this._updateRaf = null;
          });
        }
        this.toupdate = true;
        client.setLocalStorage(); //持久化存储
      });

      contactor.on(`completeMessage`, async (e) => {
        const messageId = e.messageId;
        const rawMessage = this.activeContactor.getMessageById(messageId);

        if (this.retryList.includes(messageId)) {
          this.retryList = this.retryList.filter((item) => item !== messageId);
        }

        rawMessage.content.forEach((element, index) => {
          if (
            element.type === "text" &&
            this.activeContactor.platform === "onebot"
          ) {
            const formatedMessage = this.separateTextAndImages(
              element.data.text,
            );
            // 把 formatedMessage 里的元素展开到 index 这个位置
            rawMessage.content.splice(index, 1, ...formatedMessage);
          }
        });

        this.toupdate = true;
        this.$forceUpdate();
        this.activeContactor.loadName();
        client.setLocalStorage(); //持久化存储
        console.log(e);
      });
    },
    disableContactor(contactor) {
      if (contactor) {
        contactor.active = false;
        contactor.off(`updateMessage`);
        contactor.off(`revMessage`);
        contactor.off(`delMessage`);
        contactor.off(`completeMessage`);
      }
    },
    getReplyText(id) {
      let content = "";
      const message = this.activeContactor.messageChain.find(
        (item) => item.id === id || String(item.id) === String(id),
      );
      if (message) {
        message.content.forEach((element) => {
          if (element.type === "text") {
            content += element.data.text;
          } else if (element.type === "image") {
            content += "[图片]";
          }
        });
        // if (content.length > 20) {
        //   return `${content.substr(0, 20)}...`;
        // } else {
        //   return `${content}`;
        // }
        return content.trim().slice(0, 20);
      } else {
        console.log("用户引用的消息不存在");
        // 打印消息列表和索引的id
        console.log(this.activeContactor.messageChain);
        console.log("引用的消息id：" + id);
        return "[消息已删除] ";
      }
    },
    imageLoaded() {
      // this.scroll && this.toButtom();
    },
    showMessageMenu(event, messageIndex) {
      // 确定右击的元素类型
      if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === "img") {
        const imgElement = event.target;
        const imgSrc = imgElement.src;
        this.seletedImage = imgSrc;
      } else {
        console.log("用户右击了非图片元素或合成事件");
      }
      this.validMessageIndex =
        this.activeContactor.platform === "openai" && this.hasOpening()
          ? messageIndex - 1
          : messageIndex;
      if (event.preventDefault) event.preventDefault();
      this.showMenu = true;
      this.menuTop = event.clientY;
      this.menuLeft = event.clientX;

      const currentSelectedText = window.getSelection().toString();
      if (currentSelectedText) {
        this.seletedText = currentSelectedText;
      } else {
        this.seletedText = "";
      }
    },
    handleTouchStart(event, index) {
      const now = Date.now();
      const delay = now - this.lastClickTime;

      if (delay < 300 && delay > 0) {
        // Double tap detected
        if (event.cancelable) event.preventDefault(); // 阻止浏览器缩放
        const touch = event.touches[0];
        const syntheticEvent = {
          clientX: touch.clientX,
          clientY: touch.clientY,
          target: event.target,
          preventDefault: () => {
            if (event.preventDefault) event.preventDefault();
          }
        };
        this.showMessageMenu(syntheticEvent, index);
        this.lastClickTime = 0;
      } else {
        this.lastClickTime = now;
      }
    },
    handleTouchEnd() { },
    handleTouchMove() { },
    toProfile() {
      this.$router.push({
        name: "profile_view",
        params: {
          id: this.activeContactor.id,
        },
      });
      // 弹出维护提示
      // this.$message({
      //   message: "此功能正在维护中",
      //   type: "warning",
      // });
    },
    scrollHandler() {
      // 获取当前的 scrollTop
      const currentScrollTop = this.chatWindowRef.scrollTop;

      // 判断滚动方向
      // 如果当前 scrollTop 大于上一次的 scrollTop，说明是向下滑动
      const isScrollingDown = currentScrollTop > this.prevScrollTop;
      // 如果当前 scrollTop 小于上一次的 scrollTop，说明是向上滑动
      const isScrollingUp = currentScrollTop < this.prevScrollTop;
      // 如果相等，通常意味着没有实际的滚动位移，或者是一些内部事件

      // 更新上一次的 scrollTop 为当前值，为下一次滚动做准备
      this.prevScrollTop = currentScrollTop;

      // --- 你原有的逻辑 (现在你可以根据需要使用 isScrollingDown 或 isScrollingUp) ---
      this.showMenu = false; // 隐藏菜单
      if (this.showemoji) this.showemoji = false; // 隐藏表情

      const scrollHeight = this.getChatwindowScrollheight(); // 获取总滚动高度

      this.autoScroll = scrollHeight > 100 ? false : true;

      const isAtBottom = scrollHeight <= 200 - 1; // 留一个小的容差，避免浮点数问题

      if (isScrollingDown && !this.autoScroll && !isAtBottom) {
        this.showRollDown = true;
      } else if (isScrollingUp || this.autoScroll || isAtBottom) {
        this.showRollDown = false;
      }
    },
    getseletedMessage() {
      return this.activeContactor.messageChain[this.validMessageIndex];
    },
    handleMessageOption(option) {
      const message = this.getseletedMessage();
      switch (option) {
        case "multi-select":
          this.isMultiSelect = true;
          if (message && message.id) {
            this.selectedMessages.push(message.id);
          }
          break;
        case "retry":
          if (this.activeContactor.platform === "onebot") {
            // 重新发送一样的消息
            if (message.role === "user") {
              this.activeContactor.webSend(message);
            } else {
              this.activeContactor.webSend({
                ...message,
                role: "user",
              });
            }
            this.$message({ message: "消息已重新发送", type: "success" });
          } else {
            const targetIndex =
              message.role === "user"
                ? this.validMessageIndex + 1
                : this.validMessageIndex;
            let validMessage = this.activeContactor.messageChain[targetIndex];
            if (!validMessage || validMessage.role !== "other") {
              // 是用户发送且下一条消息被删除,先插入一条空消息
              const baseContainer = this.activeContactor.getBaseUserContainer();
              baseContainer.role = "other";
              this.activeContactor.insertMessage(baseContainer, targetIndex);
              validMessage = baseContainer;
            }
            if (validMessage.status === "retrying") {
              this.$message({
                message: "该消息正在重试中",
                type: "warning",
              });
              return;
            }
            this.activeContactor.retryMessage(validMessage.id);
            validMessage.status = "retrying";
            this.retryList.push(validMessage.id);
          }
          this.toButtom();
          break;
        case "reply":
          if (this.activeContactor.platform === "onebot") {
            this.repliedMessageId = message.id;
            this.$message({ message: "已引用该消息", type: "success" });
          } else {
            this.userInput +=
              this.getReplyText(
                this.activeContactor.messageChain[this.validMessageIndex].id,
              ) + "\n\n";
          }
          break;
        case "delete":
          this.activeContactor.messageChain.splice(this.validMessageIndex, 1);
          client.setLocalStorage();
          break;
        default:
          break;
      }

      this.showMenu = false

    },
    toggleSelect(id) {
      if (!id) return;
      const index = this.selectedMessages.indexOf(id);
      if (index > -1) {
        this.selectedMessages.splice(index, 1);
      } else {
        this.selectedMessages.push(id);
      }
    },
    handleMessageClick(item) {
      if (this.isMultiSelect && item.role !== 'mio_system') {
        this.toggleSelect(item.id);
      }
    },
    cancelMultiSelect() {
      this.isMultiSelect = false;
      this.selectedMessages = [];
    },
    handleMultiDelete() {
      if (this.selectedMessages.length === 0) return;
      for (let i = this.activeContactor.messageChain.length - 1; i >= 0; i--) {
        if (this.selectedMessages.includes(this.activeContactor.messageChain[i].id)) {
          this.activeContactor.messageChain.splice(i, 1);
        }
      }
      client.setLocalStorage();
      this.cancelMultiSelect();
    },
    handleMultiCopy() {
      if (this.selectedMessages.length === 0) return;
      let text = "";
      this.getFullMessages().forEach((msg) => {
        if (this.selectedMessages.includes(msg.id)) {
          const senderName = msg.role === 'other' ? this.activeContactor.name : this.client.name;
          const time = this.activeContactor.getShownTime(msg.time);
          let msgText = "";
          msg.content.forEach((element) => {
            if (element.type === "text") {
              msgText += element.data.text;
            } else if (element.type === "image") {
              msgText += `[图片]`;
            }
          });
          text += `${senderName} ${time}\n${msgText}\n\n`;
        }
      });
      let textarea = document.createElement("textarea");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      textarea.value = text.trim();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      this.$message({ message: "已复制选中的消息", type: "success" });
      this.cancelMultiSelect();
    },
    handleMultiShareMD() {
      if (this.selectedMessages.length === 0) return;
      let mdText = `# 与${this.activeContactor.name}的对话记录\n\n`;
      this.getFullMessages().forEach((msg) => {
        if (this.selectedMessages.includes(msg.id)) {
          const senderName = msg.role === 'other' ? this.activeContactor.name : this.client.name;
          const time = this.activeContactor.getShownTime(msg.time);
          let msgText = "";
          msg.content.forEach((element) => {
            if (element.type === "text") {
              msgText += element.data.text;
            } else if (element.type === "image") {
              msgText += `![图片](${element.data.file})`;
            }
          });
          mdText += `### ${senderName} _${time}_\n${msgText}\n\n`;
        }
      });
      const blob = new Blob([mdText], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_export_${new Date().getTime()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.$message({ message: "已导出Markdown", type: "success" });
      this.cancelMultiSelect();
    },
    async handleMultiShareLink() {
      if (this.selectedMessages.length === 0) return;
      this.$message({ message: "正在生成分享链接...", type: "info" });
      const shareResult = await client.shareMessages(this.activeContactor.id, this.selectedMessages);
      if (shareResult && shareResult.shareUrl) {
        const { success, message } = shareOrCopy(shareResult.shareUrl);
        if (success) {
          this.$message({ message: "分享链接已复制到剪贴板", type: "success" });
        } else {
          this.$message({ message: message, type: "error" });
        }
      } else {
        this.$message({ message: "生成分享链接失败", type: "error" });
      }
      this.cancelMultiSelect();
    },
    async handleMultiShareImage() {
      if (this.selectedMessages.length === 0) return;
      let exportEl = null;

      try {
        this.$message({ message: "正在生成分享链接...", type: "info" });
        const shareResult = await client.shareMessages(this.activeContactor.id, this.selectedMessages);
        const shareUrl = shareResult?.shareUrl ?? window.location.origin;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(shareUrl)}`;

        // Build export container with mobile width, mirroring chatwindow bg
        exportEl = document.createElement('div');
        exportEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px;background-color:#f2f2f2;padding:0.5rem 0;box-sizing:border-box;overflow:hidden;';
        document.body.appendChild(exportEl);

        // Clone selected message DOM nodes (preserving real styles)
        const refs = this.$refs.message; // array of .message-container els
        this.activeMessageChain.forEach((item, i) => {
          if (!this.selectedMessages.includes(item.id)) return;
          const el = refs[i];
          if (!el) return;
          const clone = el.cloneNode(true);
          // Remove multi-select UI artifacts
          clone.querySelector('.multi-select-box')?.remove();
          const wrapper = clone.querySelector('.message-flex-wrapper');
          if (wrapper) wrapper.classList.remove('is-multi-select', 'is-selected');
          exportEl.appendChild(clone);
        });

        // Footer with QR code
        const footer = document.createElement('div');
        footer.style.cssText = 'border-top:1px solid #ddd;margin:0.5rem 0.625rem 0;padding-top:0.75rem;display:flex;align-items:center;justify-content:space-between;';
        const textDiv = document.createElement('div');
        textDiv.innerHTML = '<div style="font-weight:bold;font-size:15px;color:#333;">MioChat</div><div style="font-size:11px;color:#666;margin-top:3px;">扫码接续对话</div>';
        const qrImg = document.createElement('img');
        qrImg.src = qrUrl;
        qrImg.style.cssText = 'width:56px;height:56px;flex-shrink:0;';
        qrImg.crossOrigin = 'anonymous';
        footer.appendChild(textDiv);
        footer.appendChild(qrImg);
        exportEl.appendChild(footer);

        // Wait for QR image to load
        await new Promise((resolve) => {
          if (qrImg.complete) resolve();
          else { qrImg.onload = resolve; qrImg.onerror = resolve; setTimeout(resolve, 1500); }
        });

        const result = await snapdom(exportEl, { scale: 2 });
        await result.download({ format: 'png', filename: `chat_image_export_${Date.now()}.png` });

        this.$message({ message: "已导出图片", type: "success" });
      } catch (err) {
        console.error("生成图片失败", err);
        this.$message({ message: "生成图片失败", type: "error" });
      } finally {
        exportEl?.remove();
        this.cancelMultiSelect();
      }
    },
  },
};
</script>

<template>
  <div id="chat-window">
    <div class="upside-bar">
      <div class="return" @click="tolist()">
        <i class="iconfont icon-return"></i>
      </div>
      <div class="name-area" @click="toProfile">
        <div class="contactor-name">{{ activeContactor.name }}</div>
        <span :class="'delay-status ' + getDelayStatus"></span>
        <span class="delay-num">当前延迟: {{ currentDelay }} ms</span>
      </div>
      <ul class="options">
        <li class="share" @click="share()">
          <i class="iconfont icon-share"></i>
        </li>
      </ul>
    </div>
    <div id="main-messages-window" ref="chatWindow" :class="{
      'message-window': true,
      preview: preview,
    }">
      <div v-if="showRollDown" id="roll-buttom-button" :style="{ bottom: inputBarTop + 24 + 'px' }"
        @click="toButtom(true)">
        <i class="iconfont down1"></i>
      </div>
      <ContextMenu v-show="showMenu" type="message" :message="getseletedMessage()" :seleted-text :seleted-image
        :style="getMenuStyle" @message-option="handleMessageOption" @close="showMenu = false" />
      <div v-for="(item, index) of activeMessageChain" :key="`${activeContactor.id}-${item.id}`" ref="message"
        class="message-container">
        <div v-if="showTime(index).show" class="message-time">
          {{ showTime(index).time }}
        </div>
        <div class="message-flex-wrapper"
          :class="{ 'is-multi-select': isMultiSelect, 'is-selected': isMultiSelect && selectedMessages.includes(item.id) }"
          @click="handleMessageClick(item)">
          <div v-if="isMultiSelect && item.role !== 'mio_system'" class="multi-select-box">
            <div class="round-checkbox" :class="{ checked: selectedMessages.includes(item.id) }"
              @click.stop="toggleSelect(item.id)">
              <svg v-if="selectedMessages.includes(item.id)" viewBox="0 0 12 10" fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <polyline points="1,5 4.5,8.5 11,1" stroke="white" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
          </div>
          <div :id="item.role" class="message-body" :style="{ pointerEvents: isMultiSelect ? 'none' : 'auto' }">
            <div v-if="item.role !== 'mio_system'" class="avatar">
              <img v-if="item.role === 'other'" :src="activeContactor.avatar" :alt="activeContactor.name"
                @click="toProfile" />
              <img v-else :src="client.avatar" :alt="client.name" />
            </div>
            <div v-if="item.role !== 'mio_system'" class="msg">
              <div class="wholename">
                <div v-if="
                  item.role === 'other' ? activeContactor.title : client.title
                " class="title">
                  {{
                    item.role === "other" ? activeContactor.title : client.title
                  }}
                </div>
                <div class="name">
                  {{ item.role === "other" ? activeContactor.name : client.name }}
                </div>
              </div>
              <div :class="['content', item.status]" @mouseup="handleMouseUp"
                @contextmenu="showMessageMenu($event, index)" @touchstart="handleTouchStart($event, index)">
                <div v-for="(element, elmIndex) of item.content" :key="elmIndex" class="inner-content">
                  <MdRenderer v-if="element.type === 'text'" :md="element.data.text" :theme="'github'" :isStreaming="['pending', 'retrying'].includes(item.status) &&
                    item.content.length - 1 === elmIndex
                    " :custom-plugins="mioPlugins" :markdown-it-plugins="[{ plugin: katexPlugin }]"
                    :markdown-it-options="{ breaks: activeContactor.platform === 'onebot' }" />
                  <MdRenderer v-if="element.type === 'image'" :md="`![image](${element.data.file})`"
                    :custom-plugins="mioPlugins" :theme="'github'" :key="element.data.file" />
                  <div v-else-if="element.type === 'reply'" class="reply-block">
                    {{ getReplyText(element.data.id) }}
                  </div>
                  <ForwardMsg v-else-if="element.type === 'nodes'" :contactor="activeContactor"
                    :messages="element.data.messages" />
                  <FileBlock v-else-if="element.type === 'file'" :file-url="element.data.file" />
                  <span v-else-if="element.type === 'at'" />
                  <ReasonBlock v-else-if="element.type === 'reason'" :end-time="element.data.endTime"
                    :start-time="element.data.startTime" :content="element.data.text" />
                  <div v-else-if="element.type === 'blank'" class="blank-message"
                    style="width: 10rem; height: 28.8px; position: relative">
                    <span class="blank-loader"></span>
                  </div>
                  <ToolCallBar v-else-if="element.type === 'tool_call'" :tool-call="element.data" />
                </div>
              </div>
            </div>
            <div v-else class="system-message">
              <div class="system-message-content">
                {{ item.content[0].data.text }}
              </div>
              <div class="system-message-button">
                <i class="iconfont close" @click="delSystemMessage(index)"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <InputEditor v-if="!isMultiSelect" ref="inputEditor" :active-contactor="activeContactor"
      :replied-message-id="repliedMessageId" @stroge="client.setLocalStorage()" @set-model="setModel"
      @clean-screen="cleanScreen" @clean-history="cleanHistory" @to-buttom="toButtom" />
    <div v-else class="multi-select-action-bar">
      <div class="actions">
        <div class="action-btn" @click="handleMultiShareMD">
          <span class="action-icon"><i class="iconfont icon-share"></i></span>
          <span class="action-label">导出MD</span>
        </div>
        <div class="action-btn" @click="handleMultiShareImage">
          <span class="action-icon"><i class="iconfont icon-share"></i></span>
          <span class="action-label">导出图片</span>
        </div>
        <div class="action-btn" @click="handleMultiShareLink">
          <span class="action-icon"><i class="iconfont icon-share"></i></span>
          <span class="action-label">分享链接</span>
        </div>
        <div class="action-btn" @click="handleMultiCopy">
          <span class="action-icon"><i class="iconfont fuzhi"></i></span>
          <span class="action-label">复制</span>
        </div>
        <el-popconfirm title="此操作不可撤销" confirm-button-text="确定" cancel-button-text="取消" placement="top"
          @confirm="handleMultiDelete">
          <template #reference>
            <div class="action-btn">
              <span class="action-icon"><i class="iconfont shanchu"></i></span>
              <span class="action-label">删除</span>
            </div>
          </template>
        </el-popconfirm>
      </div>
      <div class="close-btn" @click="cancelMultiSelect">&times;</div>
    </div>

  </div>
</template>

<style lang="sass" scoped>
$mobile: 600px
$icon-hover: #09f

.preview
    position: fixed
    top: 0
    left: 0
    width: 100vw
    height: 100vh
    z-index: 10000

#chat-window
    z-index: 1
    min-width: 0.0625rem
    position: relative
    display: flex
    flex-grow: 1
    background-color: #f2f2f2
    flex-direction: column


.message-flex-wrapper
    display: flex
    align-items: flex-start
    width: 100%

    .message-body
        flex: 1
        min-width: 0

    &.is-multi-select
        cursor: pointer
        padding-left: 0.5rem
        transition: background-color 0.15s

        &:hover
            background-color: rgba(0, 0, 0, 0.04)

    &.is-selected
        background-color: rgba(0, 0, 0, 0.06)

        &:hover
            background-color: rgba(0, 0, 0, 0.08)

    .multi-select-box
        margin-right: 0.75rem
        display: flex
        align-items: center
        align-self: center
        flex-shrink: 0

        .round-checkbox
            width: 1rem
            height: 1rem
            border-radius: 50%
            border: 2px solid #ccc
            background-color: #fff
            display: flex
            align-items: center
            justify-content: center
            cursor: pointer
            transition: border-color 0.15s, background-color 0.15s
            flex-shrink: 0

            svg
                width: 0.7rem
                height: 0.7rem
                display: block

            &.checked
                border-color: rgb(0, 153, 255)
                background-color: rgb(0, 153, 255)

            &:hover:not(.checked)
                border-color: rgb(0, 153, 255)

.multi-select-action-bar
    flex-shrink: 0
    flex-basis: 11rem
    border-top: 0.0625rem solid rgba(128, 128, 128, 0.502)
    display: flex
    flex-direction: row
    align-items: center
    justify-content: center
    padding: 0 1.5rem
    position: relative

    @media (max-width: $mobile)
        flex-basis: 7rem

    .actions
        display: flex
        flex-direction: row
        align-items: center
        justify-content: center
        gap: 2.5rem
        flex: 1

    .action-btn
        display: flex
        flex-direction: column
        align-items: center
        justify-content: center
        cursor: pointer
        color: #333
        flex-shrink: 0
        gap: 0.4rem
        transition: opacity 0.2s

        &:hover
            opacity: 0.7

        .action-icon
            width: 2.8rem
            height: 2.8rem
            border-radius: 50%
            background-color: #fff
            display: flex
            align-items: center
            justify-content: center
            transition: background-color 0.2s

            i
                font-size: 1.25rem
                color: #333

        &:hover .action-icon
            background-color: #f2f2f2

        .action-label
            font-size: 0.72rem
            color: #555
            white-space: nowrap

    .close-btn
        position: absolute
        right: 1.25rem
        top: 50%
        transform: translateY(-50%)
        font-size: 1.4rem
        color: #999
        cursor: pointer
        line-height: 1
        padding: 0.25rem 0.5rem
        border-radius: 50%
        transition: color 0.2s, background-color 0.2s
        user-select: none

        &:hover
            color: #333
            background-color: #f2f2f2

.upside-bar
    flex-basis: 4rem
    flex-shrink: 0
    width: 100%
    display: flex
    align-items: flex-end
    justify-content: flex-start
    border-bottom: 0.0625rem solid #ebebeb
    -webkit-app-region: drag

    @media (max-width: $mobile)
      position: fixed
      height: 4rem
      z-index: 1000
      background-color: hsla(0, 0%, 100%, 0.8)
      backdrop-filter: blur(0.5rem)

    .return
        display: none

        &:hover
            color: $icon-hover

        @media (max-width: $mobile)
            display: block
            margin-left: 1rem
            margin-bottom: .8rem

    .name-area
        cursor: pointer
        position: relative
        display: flex
        align-items: center
        flex-basis: 10rem
        flex-grow: 1
        justify-content: flex-start
        margin: 0 0 .5rem 1rem

        .contactor-name
            text-overflow: ellipsis
            white-space: nowrap
            overflow: hidden
            max-width: 10rem

        .delay-status
            width: .8rem
            height: .8rem
            border-radius: 50%
            margin-left: .5rem
            position: relative
            top: .2rem

            @media screen and (max-width: $mobile)
              display: none


            &:hover + .delay-num
                display: inline-block

            &.ultra
                background-color: rgb(53, 233, 146)

            &.low
                background-color: rgb(255, 204, 0)

            &.mid
                background-color: rgb(255, 102, 102)

            &.high
                background-color: #ccc

        .delay-num
            display: none
            position: absolute
            font-size: 0.8rem
            bottom: 0rem
            background-color: #fff
            border: 1px dashed #000
            border-radius: 0.25rem
            padding: 0.125rem 0.25rem
            margin-left: 1rem
            white-space: nowrap

    .options
        flex-basis: 10rem
        display: flex
        height: 2rem
        flex-wrap: nowrap
        flex-direction: row-reverse
        align-items: flex-end
        margin: 0 1rem .5rem 0

        li
            margin-left: 0.5rem
            color: #000
            font-weight: 580

            &:hover
              color: $icon-hover

            i
                font-size: 1.25rem


.black-overlay
    position: fixed
    top: 0
    left: 0
    width: 100%
    height: 100%
    background-color: rgba(0, 0, 0, 0.4)
    z-index: 1001
/* z-index 属性设置元素的堆叠顺序。*/

#roll-buttom-button
    position: fixed
    right: 0.5rem
    cursor: pointer
    display: flex
    z-index: 1000
    background-color: #fff
    width: 4rem
    height: 1.5rem
    border-radius: 0.75rem
    align-items: center
    justify-content: center
    box-shadow: 0 0 0.25rem rgba(0, 0, 0, 0.2)
    transition: background-color 0.3s ease, transform 0.3s ease
    &:hover
        background-color: #f0f0f0
        transform: scale(1.1)

    &:hover
        color: $icon-hover
    i
        font-size: 1rem

#theimg
    position: fixed
    top: 50%
    left: 50%
    transform: translate(-50%, -50%)
    max-height: 75%
    max-width: 50%
.inner-content
  display: flex

.background img
    position: absolute
    top: 50%
    left: 50%
    transform: translate(-50%, -50%)

.message-body > .avatar
  cursor: pointer
  flex-basis: 2.65rem
  min-width: 2.65rem
  height: 2.65rem


.avatar > img
  width: 100%
  height: 100%
  border-radius: 50%


.window-controls
    display: flex
    flex-basis: 100%

    @media (max-width: $mobile)
        display: none

    .button
        display: flex
        justify-content: center
        padding-top: 0.5rem
        flex: 0 0 2rem

        &:hover
            background-color: rgb(231, 231, 231)

        &#close:hover
            background-color: rgb(255, 0, 0)
            color: white


.button#close:hover svg path
    fill: #fff


.voice-box
    display: flex
    width: 11.25rem
    height: 1.5rem
    margin: 0.25rem 0

    .icon
        flex-basis: 1.5rem
        background-color: rgb(0, 0, 0)
        display: flex
        justify-content: center
        align-items: center
        border-radius: 50%

    .wave
        display: flex
        justify-content: center
        align-items: center
        flex-grow: 1

.wave svg
    height: 1.25rem
    width: 80%

.loader
    width: 0.625rem
    padding: 0.25rem
    aspect-ratio: 1
    border-radius: 50%
    background: rgb(0, 153, 255)
    --_m: conic-gradient(#0000 10%, #000), linear-gradient(#000 0 0) content-box
    -webkit-mask: var(--_m)
    mask: var(--_m)
    -webkit-mask-composite: source-out
    mask-composite: subtract
    animation: l3 1s infinite linear
    position: absolute

@keyframes move
    0%
        left: -20% // 开始位置
    100%
        left: 120% // 结束位置

.blank-loader
    width: 10%
    height: 200%
    position: absolute
    background: linear-gradient(to right, rgb(255, 255, 255), rgb(0, 0, 0) 50%, transparent 50%, transparent)
    top: -50%
    transform: rotate(30deg)
    filter: blur(5px)
    animation: move 1s linear infinite // 每1s循环

@keyframes l
    to
        transform: rotate(1turn)

@media (max-width: 600px)
    #chatwindow
        height: 100%

    .upsidebar
        white-space: nowrap
        max-width: 7rem
        text-overflow: ellipsis
        overflow: hidden
        background: #00a8ff linear-gradient(to right, #00d2f8, #00a8ff)

    .upsidebar *
        color: white
        fill: white

    .delay-num
        color: black

    .window-controls
        display: none

    .name-area
        padding-bottom: 0.25rem

    .input-area
        overflow-y: auto

    .inputbar
        flex-basis: 4rem

    .delay-status
        position: relative
        top: -.2rem
</style>
