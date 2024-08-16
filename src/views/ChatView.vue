<script>
import { MdPreview } from "md-editor-v3";
import ForwardMsg from "@/components/ForwardMsg.vue";
import InputEditor from "@/components/InputEditor.vue";
import "emoji-picker-element";
import { client } from "@/lib/runtime.js";

export default {
  data() {
    const currentId = parseInt(this.$route.params.id);
    const contactor = client.getContactor(currentId);
    console.log(contactor);

    return {
      activeContactor: contactor,
      showwindow: true,
      showemoji: false,
      userInput: "",
      todld: false,
      client: client,
      wraperOptions: [],
      wraperPresets: {},
      cursorPosition: [],
      selectedWraper: null,
      currentDelay: 0,
      toupdate: false,
      ydaKey: 0,
      showMenu: false,
      menuTop: 0,
      menuLeft: 0,
      longPressTimer: null,
      selectedMessageIndex: -1,
      repliedMessage: null,
      autoScroll: false,
      fullScreen: false,
    };
  },
  methods: {
    configFullScreen(status) {
      client.emit("screenChange", status)
      this.fullScreen = status;
    },
    toButtom(clicked) {
      if (clicked) this.$message("已滑至底部");
      const chatWindow = this.$refs.chatWindow;
      //console.log("滑动条位置顶部与元素顶部间距："+ chatWindow.scrollTop + "元素高度" + chatWindow.scrollHeight)
      setTimeout(() => (chatWindow.scrollTop = chatWindow.scrollHeight), 0);

      //console.log(chatWindow.scrollHeight)
    },
    cleanScreen() {
      this.activeContactor.messageChain = [];
      this.activeContactor.updateFirstMessage();
      client.setLocalStorage(); //持久化存储
      this.toupdate = true;
      this.$message({ message: "已清除会话记录", type: "success" });
    },
    cleanHistory() {
      this.activeContactor.updateFirstMessage();
      this.$message({
        message: "上下文信息已清除，之后的请求将不再记录上文记录",
        type: "success",
      });
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
      this.$router.push({ name: "toChat" });
    },

    setModel(name) {
      this.activeContactor.activeModel = name;
      this.activeContactor.name = name;
      this.activeContactor.avatar = this.activeContactor.getAvatar(name);
      client.setLocalStorage(); //持久化存储
    },

    showTime(index) {
      const thisTime = this.activeContactor.messageChain[index].time;
      if (index === 0) {
        return {
          show: true,
          time: this.activeContactor.getShownTime(thisTime),
        };
      } else {
        const earlyTime = this.activeContactor.messageChain[index - 1].time;
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
      const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
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
      var scrollTop = this.$refs.chatWindow.scrollTop; // 当前滚动条的垂直位置
      var clientHeight = this.$refs.chatWindow.clientHeight; // 可视区域高度
      var scrollHeight = this.$refs.chatWindow.scrollHeight; // 内容总高度

      // 计算滚动位置的实际像素长度
      var scrollPercentage = (scrollTop / (scrollHeight - clientHeight))
      var height = scrollPercentage * scrollHeight

      return scrollHeight - height

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

      contactor.on("updateMessage", (e) => {
        this.activeContactor.updateKey();
        this.ydaKey++;
        const rawMessage = this.activeContactor.messageChain[e.messageIndex];
        rawMessage.content[0].data.text = e.updatedMessage;
        // console.log(rawMessage.content[0].data.text)

        this.toupdate = true;
      });

      contactor.on(`completeMessage`, (e) => {
        const messageIndex = e.index;
        const rawMessage = this.activeContactor.messageChain[messageIndex];
        rawMessage.status = "completed";

        const formatedMessage = this.separateTextAndImages(e.text);

        rawMessage.content = formatedMessage;

        this.toupdate = true;
        client.setLocalStorage(); //持久化存储
      });
    },
    disableContactor(contactor) {
      contactor.active = false;
      contactor.off(`updateMessage`);
      contactor.off(`revMessage`);
      contactor.off(`delMessage`);
      contactor.off(`completeMessage`);
    },
    getReplyText(id) {
      let content = "";
      const message = this.activeContactor.messageChain.find((item) => item.id === id);
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
      console.log(messageIndex);
      this.selectedMessageIndex = messageIndex;
      event.preventDefault();
      this.showMenu = true;
      this.menuTop = event.clientY;
      this.menuLeft = event.clientX;
    },
    messageMenuClick(event) {
      // 处理菜单项点击事件
      switch (event) {
        case "copy": {
          // Construct the text to copy
          let text = "";
          const message = this.activeContactor.messageChain[this.selectedMessageIndex]; // Corrected typo
          console.log(this.selectedMessageIndex);
          message.content.forEach((element) => {
            if (element.type === "text") {
              text += element.data.text;
            } else if (element.type === "image") {
              text += "[图片]";
            }
          });

          // Create a new textarea, append it to the body, set its value, and select the text
          const textarea = document.createElement("textarea");
          textarea.style.position = "absolute";
          textarea.style.left = "-9999px"; // Move it off-screen
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          textarea.setSelectionRange(0, 99999); // For mobile devices

          // Copy the text and remove the textarea
          try {
            document.execCommand("copy");
            this.$message({ message: "复制成功", type: "success" });
          } catch (err) {
            console.error("Copy failed:", err);
          } finally {
            document.body.removeChild(textarea);
          }
          break;
        }
        case "reply":
          if (this.activeContactor.platform === "onebot") {
            this.repliedMessage =
              this.activeContactor.messageChain[this.selectedMessageIndex];
            this.$message({ message: "已引用该消息", type: "success" });
          } else {
            this.userInput +=
              this.getReplyText(
                this.activeContactor.messageChain[this.selectedMessageIndex].id
              ) + "\n\n";
          }

          break;
        case "delete":
          if (this.activeContactor.platform === "onebot")
            this.activeContactor.messageChain.splice(this.selectedMessageIndex, 1);
          else {
            if (
              this.activeContactor.messageChain[this.selectedMessageIndex].status === "completed" ||
              this.activeContactor.messageChain.filter(
                (item) => item.status === "pending"
              ).length === 1
            ) {
              this.activeContactor.messageChain.splice(this.selectedMessageIndex, 1);
            }
            else {
              this.$message({
                message: "当前有消息在更新，等等再删叭",
                type: "warning",
              });
            }
          }
          this.showMenu = false;
          break;
        default:
          break;
      }
      this.showMenu = false;
    },
  },
  mounted() {
    document.addEventListener("click", () => {
      this.showMenu = false;
      // if( this.showemoji) this.showemoji = false;
    });

    this.$refs.chatWindow.addEventListener("scroll", () => {
      this.showMenu = false;
      if (this.showemoji) this.showemoji = false;

      const scrollHeight = this.getChatwindowScrollheight()

      this.autoScroll = scrollHeight > 300 ? false : true;
    });

    console.log(this.activeContactor);
    this.toButtom();

    const currentId = this.$route.params.id;
    const contactor = client.getContactor(currentId);
    this.initContactor(contactor);

    this.fullScreen = this.client.fullScreen;

    setInterval(() => {
      this.currentDelay = this.client.socket.delay;
    }, 3000);
  },
  updated() {
    if (this.toupdate && this.autoScroll) {
      this.toButtom();
      this.toupdate = false;
    }
  },
  unmounted() {
    // 移除事件监听
    this.disableContactor(this.activeContactor);
    this.$refs.chatWindow.removeEventListener("scroll", () => {
      this.showMenu = false;
      if (this.showemoji) this.showemoji = false;
    });
  },
  computed: {
    getDelayStatus() {
      return this.currentDelay > 1000
        ? "high"
        : this.currentDelay > 500
          ? "mid"
          : this.currentDelay > 100
            ? "low"
            : "ultra";
    },
  },
  components: {
    MdPreview,
    ForwardMsg,
    InputEditor,
  },
  watch: {
    "$route.params.id"(newVal, oldVal) {
      const currentId = parseInt(newVal);
      const contactor = client.getContactor(currentId);
      this.activeContactor = contactor;
      this.initContactor(this.activeContactor);
      this.toButtom();
      if (oldVal) {
        const oldId = parseInt(oldVal);
        const oldContactor = client.getContactor(oldId);
        this.disableContactor(oldContactor);
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
      <div class="somebody">
        {{ activeContactor.name }}
        <span :class="'delay-status ' + getDelayStatus"></span>
        <span class="delay-num">当前延迟: {{ currentDelay }} ms</span>
      </div>
      <div class="options">
        <ul class="window-controls">
          <li class="button" @click="waiting()">
            <span class="window-min">—</span>
          </li>
          <li v-if="client.fullScreen" class="button" @click="configFullScreen(false)">
            <span class="window-inmax">⿹</span>
          </li>
          <li v-else class="button" @click="configFullScreen(true)">
            <span class="window-max">▢</span>
          </li>
          <li class="button" @click="waiting()" id="close">
            <span class="window-close">&times;</span>
          </li>
        </ul>
        <div class="share" @click="toimg()">
          <i class="iconfont icon-share"></i>
        </div>
      </div>
    </div>
    <div class="message-window" ref="chatWindow">
      <div v-for="(item, index) of activeContactor.messageChain" :key="index" class="message-container" ref="message">
        <div class="message-time" v-if="showTime(index).show">
          {{ showTime(index).time }}
        </div>
        <div class="message-body" :id="item.role">
          <div class="avatar" v-if="item.role !== 'system'">
            <img v-if="item.role === 'other'" :src="activeContactor.avatar" :alt="activeContactor.name" />
            <img v-else :src="client.avatar" :alt="client.name" />
          </div>
          <div class="msg" v-if="item.role !== 'system'">
            <div class="wholename">
              <div class="title">
                {{ item.role === "other" ? activeContactor.title : client.title }}
              </div>
              <div class="name">
                {{ item.role === "other" ? activeContactor.name : client.name }}
              </div>
            </div>
            <div class="content" @contextmenu.self="showMessageMenu($event, index)">
              <div v-for="(element, index) of item.content" :key="index">
                <MdPreview v-if="element.type === 'text'" :key="item?.status !== 'completed' ? ydaKey : ''"
                  previewTheme="github" editorId="preview-only" :modelValue="element.data.text" />
                <el-image v-else-if="element.type === 'image'"
                  style="margin: 8px 0; max-width: 20rem; border-radius: 1rem" :src="element.data.file" :zoom-rate="1.2"
                  :max-scale="7" :min-scale="0.2" :preview-src-list="[element.data.file]" :initial-index="4"
                  :key="index" fit="cover" />
                <MdPreview v-else-if="element.type === 'reply'" previewTheme="github" editorId="preview-only"
                  :modelValue="getReplyText(element.data.id)" />
                <ForwardMsg v-else-if="element.type === 'nodes'" :contactor="activeContactor"
                  :messages="element.data.messages" />
                <MdPreview v-else-if="element.type === 'file'" previewTheme="github" editorId="preview-only"
                  :modelValue="'> ' + element.data.file" />
                <MdPreview v-else previewTheme="github" editorId="preview-only"
                  :modelValue="'未知的消息类型：\n```\n' + element + '\n```'" />
              </div>
            </div>
            <div v-if="showMenu && selectedMessageIndex === index" id="message-menu"
              :style="{ top: menuTop + 'px', left: menuLeft + 'px' }">
              <div @click="messageMenuClick('copy')">
                <i class="iconfont fuzhi"></i><span>复制</span>
              </div>
              <div @click="messageMenuClick('reply')">
                <i class="iconfont yinyong"></i><span>引用</span>
              </div>
              <div @click="messageMenuClick('delete')">
                <i class="iconfont shanchu"></i><span>删除</span>
              </div>
            </div>
          </div>
          <div v-else class="system-message">
            {{ item.content[0].data.text }}
          </div>
        </div>
      </div>
    </div>
    <InputEditor ref="inputEditor" :activeContactor="activeContactor" @stroge="client.setLocalStorage()"
      @setModel="setModel" @cleanScreen="cleanScreen" @cleanHistory="cleanHistory" @sendMessage="toButtom" />
  </div>
</template>

<style lang="sass" scoped>
$mobile: 600px
$icon-hover: #09f

#chat-window
    z-index: 1
    min-width: 0.0625rem
    position: relative
    display: flex
    flex-grow: 1
    background-color: #f1f1f1
    flex-direction: column

    @media (max-width: $mobile)
        height: 100%

.upside-bar
    flex-basis: 3.75rem
    flex-shrink: 0
    height: 3.75rem
    display: flex
    align-items: flex-end
    justify-content: space-between
    border-bottom: 0.0625rem solid rgba(161, 154, 154, 0.626)

    @media (max-width: 600px)
        background: #00a8ff linear-gradient(to right, #00d2f8, #00a8ff)

        *
            color: white
            fill: white

    .return
        display: none

        &:hover
            color: $icon-hover

        @media (max-width: $mobile)
            display: block
            margin-left: 1rem
            margin-bottom: .8rem

    .somebody
        position: relative
        margin-left: 1.5rem
        margin-bottom: 0.5rem
        font-size: 1rem

    .options
        flex-basis: 6rem
        display: flex
        height: 100%
        flex-wrap: wrap
        flex-direction: row-reverse

        .window-controls
            display: flex
            flex-basis: 100%

            .button
                display: flex
                justify-content: center
                align-items: flex-start

                .window-min
                    font-size: .6rem
                    margin-top: .2rem

                .window-max
                    font-size: .9rem

                .window-close
                    margin-top: -.15rem

            @media (max-width: $mobile)
                display: none

        .share
            .iconfont
                font-size: 1.1rem
                margin-right: 1rem

                &:hover
                    color: $icon-hover

            @media (max-width: $mobile)
                display: flex
                align-items: flex-end
                margin-bottom: .6rem

                .iconfont
                    font-size: 1.5rem

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

.delay-status
    display: inline-block
    width: 0.5rem
    height: 0.5rem
    border-radius: 50%

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

@keyframes l
    to
        transform: rotate(1turn)

@media (max-width: 600px)
    #chatwindow
        height: 100%

    .upsidebar
        background: #00a8ff linear-gradient(to right, #00d2f8, #00a8ff)

    .upsidebar *
        color: white
        fill: white

    .delay-num
        color: black

    .window-controls
        display: none

    .somebody
        padding-bottom: 0.25rem

    .input-area
        overflow-y: auto

    .inputbar
        flex-basis: 4rem
</style>
