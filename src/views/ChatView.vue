<script>
import { MdPreview } from "md-editor-v3";
import ForwardMsg from "@/components/ForwardMsg.vue";
import InputEditor from "@/components/InputEditor.vue";
import FileBlock from "@/components/FileBlock.vue";
import ToolCallBar from "@/components/ToolCallBar.vue";
import ReasonBlock from "@/components/ReasonBlock.vue";
import ContextMenu from "@/components/ContextMenu.vue";
import "emoji-picker-element";
import html2canvas from "html2canvas";
import { client } from "@/lib/runtime.js";

export default {
  components: {
    MdPreview,
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
      scroll = params.get("scroll") === "true";
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
      clearMessageTip: "以上的对话记录已清除",
    };
  },
  computed: {
    getMenuStyle() {
      // return { top: this.menuTop + "px", left: this.menuLeft + "px" };
      // 长度超出屏幕宽度，就向左移动
      console.log(this.menuLeft);
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
    setInterval(() => {
      this.currentDelay = this.client.socket.delay;
    }, 3000);

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
        if (this.chatWindowRef) {
          this.chatWindowRef.scrollTop = this.chatWindowRef.scrollHeight;
        } else {
          const elm = document.getElementById("main-messages-window");
          elm.scrollTop = elm.scrollHeight;
        }
        if (clicked) this.$message("已滑至底部");
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

    async setModel(name) {
      this.activeContactor.options.base.model = name;
      this.activeContactor.title = name;
      this.activeContactor.loadAvatar();
      await client.setLocalStorage(); //持久化存储
    },
    toimg() {
      // 使用html2canvas把 this.chatWindowRef 渲染为图片
      const rect = this.chatWindowRef.getBoundingClientRect();
      rect.height = this.chatWindowRef.scrollHeight;

      html2canvas(this.chatWindowRef, {
        windowHeight: rect.height * 1.2,
        width: rect.width,
        // 例如: allowTaint: true, backgroundColor: null
      }).then((canvas) => {
        // 将canvas转换为图片
        const img = canvas.toDataURL("image/png");
        // 创建一个a标签，并设置下载属性和下载链接
        const link = document.createElement("a");
        link.download = "chat.png";
        link.href = img;
        // 模拟点击下载
        link.click();
      });
    },
    async share() {
      const shareResult = await client.shareContactor(this.activeContactor.id);
      if (shareResult) {
        this.$message({
          message: "分享链接已复制",
          type: "success",
        });
      } else {
        this.$message({
          message: "分享失败",
          type: "error",
        });
      }
    },
    hasOpening() {
      return this.activeContactor.options.presetSettings.opening ? true : false;
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
        this.$forceUpdate();
        this.toupdate = true;
      });

      contactor.on(`completeMessage`, async (e) => {
        const messageId = e.messageId;
        const rawMessage = this.activeContactor.getMessageById(messageId);
        if (rawMessage.status === "retrying") {
          this.retryList = this.retryList.filter((item) => item !== messageId);
        }
        rawMessage.status = "completed";

        if (!e.error) {
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
        } else {
          rawMessage.content = [
            {
              type: "text",
              data: {
                text: e.text,
              },
            },
          ];
        }

        this.toupdate = true;
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
        (item) => item.id === id,
      );
      if (message) {
        message.content.forEach((element) => {
          if (element.type === "text") {
            content += element.data.text;
          } else if (element.type === "image") {
            content += "[图片]";
          }
        });
        if (content.length > 20) {
          return `> ${content.substr(0, 20)}...`;
        } else {
          return `> ${content}`;
        }
      }
    },
    showMessageMenu(event, messageIndex) {
      // 确定右击的元素类型
      if (event.target.tagName.toLowerCase() === "img") {
        const imgElement = event.target;
        const imgSrc = imgElement.src;
        this.seletedImage = imgSrc;
      } else {
        console.log("用户右击了非图片元素");
      }
      this.validMessageIndex =
        this.activeContactor.platform === "openai" && this.hasOpening()
          ? messageIndex - 1
          : messageIndex;
      event.preventDefault();
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
      this.showMenu = false;
      if (this.showemoji) this.showemoji = false;

      const scrollHeight = this.getChatwindowScrollheight();

      this.autoScroll = scrollHeight > 300 ? false : true;
    },
    getseletedMessage() {
      return this.activeContactor.messageChain[this.validMessageIndex];
    },
    handleMessageOption(option) {
      const message = this.getseletedMessage();
      switch (option) {
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
            if (message.role === "user") {
              this.activeContactor.retryMessage(message.id);
            } else {
              this.activeContactor.retryMessage(message.id);
            }
            message.status = "retrying";
            this.retryList.push(message.id);
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
    <div
      id="main-messages-window"
      ref="chatWindow"
      :class="{
        'message-window': true,
        preview: preview,
      }"
    >
      <ContextMenu
        v-show="showMenu"
        type="message"
        :message="getseletedMessage()"
        :seleted-text
        :seleted-image
        :style="getMenuStyle"
        @message-option="handleMessageOption"
        @close="showMenu = false"
      />
      <div
        v-for="(item, index) of activeMessageChain"
        :key="`${activeContactor.id}-${item.id}`"
        ref="message"
        class="message-container"
      >
        <div v-if="showTime(index).show" class="message-time">
          {{ showTime(index).time }}
        </div>
        <div :id="item.role" class="message-body">
          <div v-if="item.role !== 'mio_system'" class="avatar">
            <img
              v-if="item.role === 'other'"
              :src="activeContactor.avatar"
              :alt="activeContactor.name"
              @click="toProfile"
            />
            <img v-else :src="client.avatar" :alt="client.name" />
          </div>
          <div v-if="item.role !== 'mio_system'" class="msg">
            <div class="wholename">
              <div
                v-if="
                  item.role === 'other' ? activeContactor.title : client.title
                "
                class="title"
              >
                {{
                  item.role === "other" ? activeContactor.title : client.title
                }}
              </div>
              <div class="name">
                {{ item.role === "other" ? activeContactor.name : client.name }}
              </div>
            </div>
            <div
              class="content"
              @mouseup="handleMouseUp"
              @contextmenu="showMessageMenu($event, index)"
            >
              <div
                v-for="(element, elmIndex) of item.content"
                :key="elmIndex"
                class="inner-content"
              >
                <MdPreview
                  v-if="element.type === 'text'"
                  :no-img-zoom-in="false"
                  preview-theme="github"
                  :code-foldable="false"
                  :model-value="element.data.text"
                />
                <el-image
                  v-else-if="element.type === 'image'"
                  :key="`${activeContactor.id}-${index}-${elmIndex}-${element.data.file}`"
                  :src="element.data.file"
                  :zoom-rate="1.2"
                  :max-scale="7"
                  :min-scale="0.2"
                  :preview-src-list="[element.data.file]"
                  :initial-index="4"
                  loading="lazy"
                  fit="contain"
                />
                <MdPreview
                  v-else-if="element.type === 'reply'"
                  preview-theme="github"
                  :model-value="getReplyText(element.data.id)"
                />
                <ForwardMsg
                  v-else-if="element.type === 'nodes'"
                  :contactor="activeContactor"
                  :messages="element.data.messages"
                />
                <FileBlock
                  v-else-if="element.type === 'file'"
                  :file-url="element.data.file"
                />
                <span v-else-if="element.type === 'at'" />
                <ReasonBlock
                  v-else-if="element.type === 'reason'"
                  :end-time="element.data.endTime"
                  :start-time="element.data.startTime"
                  :content="element.data.text"
                />
                <div
                  v-else-if="element.type === 'blank'"
                  class="blank-message"
                  style="width: 10rem; height: 28.8px; position: relative"
                >
                  <span class="blank-loader"></span>
                </div>
                <ToolCallBar
                  v-else-if="element.type === 'tool_call'"
                  :tool-call="element.data"
                />
                <!-- <MdPreview
                  v-else
                  preview-theme="github"
                  :model-value="
                    '未知的消息类型：\n```\n' +
                    JSON.stringify(element, null, 2) +
                    '\n```'
                  "
                /> -->
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
    <InputEditor
      ref="inputEditor"
      :active-contactor
      :replied-message-id
      @stroge="client.setLocalStorage()"
      @set-model="setModel"
      @clean-screen="cleanScreen"
      @clean-history="cleanHistory"
      @to-buttom="toButtom"
    />
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

    @media (max-width: $mobile)
        height: 100%

.upside-bar
    flex-basis: 4rem
    flex-shrink: 0
    width: 100%
    display: flex
    align-items: flex-end
    justify-content: flex-start
    border-bottom: 0.0625rem solid #ebebeb

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

#theimg
    position: fixed
    top: 50%
    left: 50%
    transform: translate(-50%, -50%)
    max-height: 75%
    max-width: 50%

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
