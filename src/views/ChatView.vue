<script>
import { MdPreview } from "md-editor-v3";
import ForwardMsg from "@/components/ForwardMsg.vue";
import InputEditor from "@/components/InputEditor.vue";
import FileBlock from "@/components/FileBlock.vue";
import ToolCallBar from "@/components/ToolCallBar.vue";
import ReasonBlock from "@/components/ReasonBlock.vue";
import "emoji-picker-element";
import html2canvas from "html2canvas";
import { client } from "@/lib/runtime.js";

export default {
  components: {
    MdPreview,
    ForwardMsg,
    InputEditor,
    ToolCallBar,
    FileBlock,
    ReasonBlock,
  },
  data() {
    const currentId = parseInt(this.$route.params.id);
    const contactor = client.getContactor(currentId);

    return {
      activeContactor: contactor,
      showwindow: true,
      showemoji: false,
      userInput: "",
      todld: false,
      client: client,
      extraOptions: [],
      wraperPresets: {},
      selectedWraper: null,
      currentDelay: 0,
      toupdate: false,
      seletedText: "",
      seletedImage: "",
      showMenu: false,
      menuTop: 0,
      menuLeft: 0,
      validMessageIndex: -1,
      repliedMessage: null,
      autoScroll: false,
      fullScreen: false,
      chatWindowRef: null,
    };
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
    activeMessageChain() {
      return this.activeContactor.options.opening
        ? [
            {
              role: "other",
              content: [
                {
                  type: "text",
                  data: {
                    text: this.activeContactor.options.opening,
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
    "$route.params.id"(newVal, oldVal) {
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
  mounted() {
    document.addEventListener("click", () => {
      this.showMenu = false;
      this.seletedText = "";
      this.seletedImage = "";
      // if( this.showemoji) this.showemoji = false;
    });
    this.chatWindowRef = this.$refs.chatWindow;
    console.log(this.$refs);
    this.chatWindowRef.addEventListener("scroll", this.scrollHandler);

    console.log(this.activeContactor);
    this.toButtom();

    const currentId = this.$route.params.id;
    const contactor = client.getContactor(currentId);
    this.initContactor(contactor);

    this.fullScreen = this.client.fullScreen;

    setInterval(() => {
      this.currentDelay = this.client.socket.delay;
    }, 3000);

    console.log(contactor.options);
  },
  updated() {
    if (this.toupdate && this.autoScroll) {
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
      if (clicked) this.$message("已滑至底部");
      setTimeout(() => {
        if (this.chatWindowRef) {
          this.chatWindowRef.scrollTop = this.chatWindowRef.scrollHeight;
        }
      }, 20);
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
      this.activeContactor.options.model = name;
      this.activeContactor.title = name;
      this.activeContactor.loadAvatar();
      await client.setLocalStorage(); //持久化存储
    },
    toimg() {
      // 使用html2canvas把 this.chatWindowRef 渲染为图片
      const rect = this.chatWindowRef.getBoundingClientRect();
      rect.height = this.chatWindowRef.scrollHeight;

      console.log(rect);

      // 获取当前浏览器真实缩放比例

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
    hasOpening() {
      return this.activeContactor.options.opening ? true : false;
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
                    text: this.activeContactor.options.opening,
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
        const messageIndex = e.index;
        const rawMessage = this.activeContactor.messageChain[messageIndex];
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

        this.$forceUpdate();
        this.toupdate = true;
        await this.activeContactor.loadName();
        await client.setLocalStorage(); //持久化存储
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
    messageMenuClick(event) {
      const copyTextToClipboard = (text) => {
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
          this.$message({ message: "复制失败", type: "error" });
        } finally {
          document.body.removeChild(textarea);
        }
      };

      const copyImageToClipboard = (imgSrc) => {
        try {
          fetch(imgSrc)
            .then((response) => {
              // 检查响应的状态
              if (!response.ok) {
                throw new Error("网络错误，无法获取图片");
              }
              return response.blob();
            })
            .then((blob) => {
              // 创建一个图像对象
              const img = new Image();
              const url = URL.createObjectURL(blob);

              img.onload = () => {
                // 创建一个 canvas 元素
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;

                // 在 canvas 上绘制图像
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                // 将 canvas 转换为 PNG Blob
                canvas.toBlob((pngBlob) => {
                  if (pngBlob) {
                    const item = new ClipboardItem({ "image/png": pngBlob });
                    navigator.clipboard
                      .write([item])
                      .then(() => {
                        this.$message({
                          message: "图片已复制到剪贴板",
                          type: "success",
                        });
                      })
                      .catch((err) => {
                        console.error("Copy image failed:", err);
                        this.$message({
                          message: "复制图片失败",
                          type: "error",
                        });
                      });
                  } else {
                    this.$message({
                      message: "转换为 PNG 失败",
                      type: "error",
                    });
                  }
                  // 释放 object URL
                  URL.revokeObjectURL(url);
                }, "image/png");
              };

              img.src = url; // 触发图像加载
            })
            .catch((err) => {
              console.error("Fetch error:", err);
              this.$message({ message: "复制图片失败", type: "error" });
            });
        } catch (err) {
          console.error("Error while copying image:", err);
          this.$message({ message: "复制图片失败", type: "error" });
        }
      };

      const downloadImage = (imgSrc) => {
        const link = document.createElement("a");
        link.href = imgSrc;
        link.download = "image.png";
        link.click();
      };

      // 处理菜单项点击事件
      switch (event) {
        case "copy": {
          let text = "";
          // Construct the text to copy
          const message =
            this.activeContactor.messageChain[this.validMessageIndex]; // Corrected typo
          message.content.forEach((element) => {
            if (element.type === "text") {
              text += element.data.text;
            } else if (element.type === "image") {
              text += "[图片]";
            }
          });
          copyTextToClipboard(text);
          break;
        }
        case "copySeletedText":
          copyTextToClipboard(this.seletedText);
          break;
        case "copySeletedImage":
          copyImageToClipboard(this.seletedImage);
          break;
        case "saveSeletedImage":
          downloadImage(this.seletedImage);
          break;
        case "reply":
          if (this.activeContactor.platform === "onebot") {
            this.repliedMessage =
              this.activeContactor.messageChain[this.validMessageIndex];
            this.$message({ message: "已引用该消息", type: "success" });
          } else {
            this.userInput +=
              this.getReplyText(
                this.activeContactor.messageChain[this.validMessageIndex].id,
              ) + "\n\n";
          }
          break;
        case "delete":
          if (this.activeContactor.platform === "onebot")
            this.activeContactor.messageChain.splice(this.validMessageIndex, 1);
          else {
            this.activeContactor.messageChain.splice(this.validMessageIndex, 1);
          }
          this.showMenu = false;
          break;
        default:
          break;
      }
      this.seletedText = "";
      this.seletedImage = "";
      this.showMenu = false;
    },
    scrollHandler() {
      this.showMenu = false;
      if (this.showemoji) this.showemoji = false;

      const scrollHeight = this.getChatwindowScrollheight();

      this.autoScroll = scrollHeight > 300 ? false : true;
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
      <div
        class="name-area"
        @click="$router.push(`/profile/${activeContactor.id}`)"
      >
        {{ activeContactor.name }}
        <span :class="'delay-status ' + getDelayStatus"></span>
        <span class="delay-num">当前延迟: {{ currentDelay }} ms</span>
      </div>
      <div class="options">
        <div class="share" @click="toimg()">
          <i class="iconfont icon-share"></i>
        </div>
      </div>
    </div>
    <div ref="chatWindow" class="message-window">
      <div
        v-for="(item, index) of activeMessageChain"
        :key="index"
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
              @click="$router.push(`/profile/${activeContactor.id}`)"
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
                  :src="element.data.file"
                  :zoom-rate="1.2"
                  :max-scale="7"
                  :min-scale="0.2"
                  :preview-src-list="[element.data.file]"
                  :initial-index="4"
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
                  <span class="blank_loader"></span>
                </div>
                <ToolCallBar
                  v-else-if="element.type === 'tool_call'"
                  :tool_call="element.data"
                />
                <MdPreview
                  v-else
                  preview-theme="github"
                  :model-value="'未知的消息类型：\n```\n' + element + '\n```'"
                />
              </div>
            </div>
            <div
              v-if="showMenu && validMessageIndex === index"
              id="message-menu"
              :style="{ top: menuTop + 'px', left: menuLeft + 'px' }"
            >
              <div @click.stop="messageMenuClick('copy')">
                <i class="iconfont fuzhi"></i>
                <span>复制消息</span>
              </div>
              <div
                v-if="seletedText"
                @click.stop="messageMenuClick('copySeletedText')"
              >
                <i class="iconfont fuzhi"></i>
                <span>复制选中</span>
              </div>
              <div
                v-if="seletedImage"
                @click.stop="messageMenuClick('copySeletedImage')"
              >
                <i class="iconfont fuzhi"></i>
                <span>复制图片</span>
              </div>
              <div
                v-if="seletedImage"
                @click.stop="messageMenuClick('saveSeletedImage')"
              >
                <i class="iconfont fuzhi"></i>
                <span>保存图片</span>
              </div>
              <div @click.stop="messageMenuClick('reply')">
                <i class="iconfont yinyong"></i><span>引用消息</span>
              </div>
              <div @click.stop="messageMenuClick('delete')">
                <i class="iconfont shanchu"></i><span>删除消息</span>
              </div>
            </div>
          </div>
          <div v-else class="system-message">
            {{ item.content[0].data.text }}
          </div>
        </div>
      </div>
    </div>
    <InputEditor
      ref="inputEditor"
      :active-contactor="activeContactor"
      @stroge="client.setLocalStorage()"
      @set-model="setModel"
      @clean-screen="cleanScreen"
      @clean-history="cleanHistory"
      @send-message="toButtom"
      @to-buttom="toButtom"
    />
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
    background-color: #f2f2f2
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
    border-bottom: 0.0625rem solid #ebebeb

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

    .name-area
        cursor: pointer
        position: relative
        margin-left: 1.5rem
        margin-bottom: 0.5rem
        display: flex
        align-items: center

    .options
        flex-basis: 6rem
        display: flex
        height: 100%
        flex-wrap: wrap
        flex-direction: row-reverse
        align-items: flex-end


        .share
            margin-bottom:.4rem

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

.delay-status
    width: 0.5rem
    height: 0.5rem
    border-radius: 50%
    margin-left: .3rem

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
<style scoped>
@keyframes move {
  0% {
    left: -20%; /* 开始位置 */
  }
  100% {
    left: 120%; /* 结束位置 */
  }
}

.blank_loader {
  width: 10%;
  height: 200%;
  position: absolute;
  background: linear-gradient(
    to right,
    rgb(255, 255, 255),
    rgb(0, 0, 0) 50%,
    transparent 50%,
    transparent
  );
  top: -50%;
  transform: rotate(30deg);
  filter: blur(5px);
  animation: move 1s linear infinite; /* 每1s循环 */
}
</style>
