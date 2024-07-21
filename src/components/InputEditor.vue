<template>
  <div class="input-bar">
    <div class="options">
      <div class="bu-emoji">
        <emoji-picker
          v-show="showemoji"
          ref="emojiPicker"
          @emoji-click="getemoji"
        ></emoji-picker>
        <p id="ho-emoji">表情</p>
        <i @click="showemoji = !showemoji" class="iconfont smile"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">滑到底部</p>
        <i @click="$emit('toButtom',1)" class="iconfont download"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">重置人格</p>
        <i @click="$emit('cleanHistory')" class="iconfont reset"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">清除记录</p>
        <i @click="$emit('cleanScreen')" class="iconfont shanchu"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">上传</p>
        <i @click="uploadFile" class="iconfont upload"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">
          {{ acting.platform == "openai" ? "模型选择" : "工具选择" }}
        </p>
        <el-cascader
          v-model="selectedWraper"
          :options="wraperOptions"
          id="wraper-selector"
          @change="activeBotTools"
        />
        <i class="iconfont robot"></i>
      </div>
    </div>
    <div class="input-box">
      <div class="input-content">
        <div
          @keydown="handleKeyDown"
          @input="handleInput"
          class="input-area"
          ref="textarea"
          :v-html="userInput"
          contenteditable="true"
          placeholder="按 Ctrl + Enter 以发送消息"
          @click="updateCursorPosition"
        ></div>
      </div>
      <button
        @click.prevent="send"
        :disabled="!userInput || !isValidInput(userInput)"
        id="sendButton"
      >
        发送{{ getWraperName() ? ` | ${getWraperName()}` : "" }}
      </button>
    </div>
  </div>
</template>

<script>
import { client } from "@/lib/runtime.js"

export default {
  data() {
    return {
      userInput: "",
      selectedWraper: null,
      wraperOptions: [],
      cursorPosition: [],
      showemoji: false,
      host: "",
      uploaded: { files: [], images: [] },
    };
  },
  props: {
    acting: {
      type: Object,
      required: true,
    },
  },
  methods: {
    uploadFile() {
      const avaliableImageFromats = ["png", "jpg", "jpeg"];
      const avaliableDocFormats = ["docx", "pdf", "pptx", "xlsx"];
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ``;

      for (const format of avaliableImageFromats) {
        fileInput.accept += `.${format},`;
      }
      for (const format of avaliableDocFormats) {
        fileInput.accept += `.${format},`;
      }

      fileInput.click();

      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size <= 100 * 1024 * 1024) {
            // 检查文件大小是否小于等于100MB
            this.$message({
              message: "文件上传中...",
              type: "info",
            });

            if (file.type.startsWith("image/")) {
              const reader = new FileReader();
              reader.onload = async (e) => {
                const base64 = e.target.result;
                // const upload = await client.uploadImage(base64);
                // this.uploaded.images.push(upload.data.url);
                this.uploaded.images.push(base64);

              };
              reader.readAsDataURL(file);
            } else {
              const upload = await client.uploadFile(file);
              this.uploaded.files.push(upload.data.url);
            }
            this.$message({
              message: "文件上传成功",
              type: "success",
            })

          } else {
            this.$message({
              message: "文件大小超过10MB，无法上传",
              type: "error",
            });
          }
        }
      };
    },
    setModel(name) {
      this.$emit("setModel", name);
    },
    getBotTools() {
      this.selectedWraper = [""];
      const wraper = this.acting.options.textwraper;
      this.wraperOptions = wraper.options;
    },
    getBotModels() {
        console.log(this.acting.activeModel)
      this.selectedWraper = this.acting.activeModel
        ? [this.acting.activeModel]
        : ["gpt-4o-mini"];
      this.wraperOptions = this.acting.options.modelsOptions;
      this.setModel(this.selectedWraper[0]);
    },
    wrapText(rawText) {
      if (!this.selectedWraper) return rawText;
      const wraper = this.selectedWraper[this.selectedWraper.length - 1];
      if (!wraper) return rawText;
      const testText = "{xxx}";

      const childrens = this.wraperOptions.find(
        (item) => item.value == this.selectedWraper[0]
      ).children;
      const preset = childrens.find(
        (child) => child.value == this.selectedWraper[1]
      ).preset;

      const result = preset.replace(testText, rawText);
      return result;
    },
    adjustTextareaHeight() {
      const textarea = this.$refs.textarea;
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    },
    getWraperName() {
      if (this.acting.platform === "onebot") {
        if (!this.selectedWraper) return "";
        const wraper = this.selectedWraper[this.selectedWraper.length - 1];
        if (!wraper) return "";
        const childrens = this.wraperOptions.find(
          (item) => item.value == this.selectedWraper[0]
        ).children;
        const preset = childrens.find(
          (child) => child.value == this.selectedWraper[1]
        ).preset;
        const name = preset.replace("#", "").replace("{xxx}", "");
        return name;
      } else {
        return this.selectedWraper
          ? this.selectedWraper[this.selectedWraper.length - 1]
          : "";
      }
    },
    waiting() {
      this.$message({ message: "此功能尚未开放", type: "warning" });
    },
    getemoji(e) {
      const inputer = this.$refs.textarea;
      const range = document.createRange();
      const sel = window.getSelection();
      if (!sel) return;

      const unicode = e.detail.unicode;
      const startPos = this.cursorPosition[0];
      const endPos = this.cursorPosition[1];
      const textBeforeCursor = this.userInput.substring(0, startPos);
      console.log(textBeforeCursor);
      const textAfterCursor = this.userInput.substring(endPos);
      console.log(textAfterCursor);
      this.userInput = textBeforeCursor + unicode + textAfterCursor;

      // 移动光标位置到表情符号之后
      setTimeout(() => {
        range.selectNodeContents(inputer);
        range.setStart(inputer.firstChild, startPos + unicode.length);
        range.setEnd(inputer.firstChild, startPos + unicode.length);
        sel.removeAllRanges();
        sel.addRange(range);
      }, 0);

      this.showemoji = !this.showemoji;
    },
    updateCursorPosition() {
      const selection = window.getSelection();
      if (!selection) return;

      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        this.cursorPosition[0] = range.startOffset;
        this.cursorPosition[1] = range.endOffset;
      }
    },
    presend() {
      // console.log(this.userInput)
      this.$refs.textarea.focus();

      let msg = this.getSafeText(this.userInput);

      const wrappedMessage =
        this.acting.platform === "onebot" ? this.wrapText(msg) : msg;

      this.userInput = this.$refs.textarea.innerHTML = "";

      this.adjustTextareaHeight();

      const container = {
        role: "user",
        time: new Date().getTime(),
        status: "completed",
        content: [
          {
            type: "text",
            data: {
              text: wrappedMessage,
            },
          },
        ],
      };

        this.uploaded.images.forEach((file) => {
            container.content.push({
                type: "image",
                data: {
                    file: file.startsWith('/') ? this.host + file : file,
                },
            })
        })
        this.uploaded.files.forEach((file) => {
            container.content.push({
                type: "file",
                data: {
                    file: this.host + file,
                },
            })
        })


      if (this.repliedMessage) {
        const replyData = {
          type: "reply",
          data: {
            id: this.repliedMessage.id,
          },
        };
        container.content.push(replyData);
      }

      console.log(container)
      return container;
    },
    async send() {
      this.$emit("sendMessage");
      const container = this.presend();
      this.userInput = "";
      const message_id = await this.acting.webSend(container); //发送消息
      container.id = message_id;
      this.$emit("stroge");
      this.uploaded.images = [];
      this.uploaded.files = [];

    },
    getSafeText(text) {
      return text
        .replace(/<script>/g, "&lt;script&gt;")
        .replace(/<\/script>/g, "&lt;/script&gt;")
        .replace(/<style>/g, "&lt;style&gt;")
        .replace(/<\/style>/g, "&lt;/style&gt;");
    },
    cleanScreen() {
      this.$emit("cleanScreen");
    },
    async activeBotTools() {
      if (this.acting.platform === "onebot") {
        const testMessage = "text";
        const testMessage2 = "test";
        const wrappedMessage = this.wrapText(testMessage);
        const wrappedMessage2 = this.wrapText(testMessage2);
        if (wrappedMessage2 === wrappedMessage) {
          this.userInput = this.textareaRef.value = wrappedMessage;
          await this.send();
        }
      } else {
        this.setModel(this.selectedWraper[this.selectedWraper.length - 1]);
        this.$message({
          message: "已切换到" + this.acting.activeModel + "模型",
          type: "success",
        });
      }
    },
    isValidInput(input) {
      return input.trim().length > 0;
    },
    handleKeyDown(event) {
      if (event.ctrlKey && event.key === "Enter") {
        this.userInput = this.replaceDivTags(this.userInput);
        if (this.userInput && this.isValidInput(this.userInput)) this.send();
        else this.$message({ message: "不能发送空消息", type: "warning" });
        // 处理按下 Ctrl+Enter 键的逻辑
      }
      setTimeout(() => {
        this.updateCursorPosition();
      }, 0);
    },
    replaceDivTags(inputText) {
      // 使用正则表达式匹配并替换指定的div标签
      // 第一个div标签
      let result = inputText.replace(/<div>/, "\n");

      // 所有的成对div标签
      result = result.replace(/<div><\/div>/g, "\n");

      // 末尾的div标签
      result = result.replace(/<\/div>$/, "\n");

      return result;
    },
    handleInput() {
      this.userInput = this.$refs.textarea.innerHTML;
      console.log(this.userInput);
    },
  },
  mounted() {
    if (this.acting.platform === "onebot") this.getBotTools();
    else this.getBotModels();
    this.textareaRef = this.$refs.textarea;
    this.textareaRef.addEventListener("input", this.adjustTextareaHeight);
    document.addEventListener("paste", function (e) {
      e.preventDefault();
      var text = (e.originalEvent || e).clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    });

    this.host = window.location.origin;
  },
  unmounted() {
    this.textareaRef.removeEventListener("input", this.adjustTextareaHeight);
    this.textareaRef = null;
    document.removeEventListener("paste", this.adjustTextareaHeight);
  },
  watch: {
    "$route.params.id"() {
      if (this.acting.platform === "onebot") this.getBotTools();
      else this.getBotModels();
    },
  },
};
</script>

<style lang="sass" scoped>
$mobile: 600px
$icon-hover: #09f

i:hover
    color: rgb(0, 153, 255)

.input-bar
    flex-shrink: 0
    display: flex
    flex-direction: column
    border: 0 solid rgba(161, 154, 154, 0.626)
    flex-basis: 11rem

    .options
        display: flex
        border-top: 0.0625rem solid rgba(128, 128, 128, 0.502)
        padding: 0.25rem 0.5rem

.bu-emoji
    position: relative

    &:hover p#ho-emoji
        display: block

emoji-picker
    position: absolute
    top: -25.75rem
    right: -20rem

p#ho-emoji
    text-wrap: nowrap
    display: none
    font-size: 0.75rem
    padding: 0.125rem 0.25rem
    background-color: #fff
    border: none
    box-shadow: 0 0.125rem 0.25rem #0003
    position: absolute
    top: 80%
    left: 50%
    transform: translate(-60%)

i
    display: block
    padding: 0.25rem 0.5rem 0 0
    font-size: 1.25rem
    width: 1.5rem
    height: 1.5rem

.input-box
    flex-grow: 1
    padding: 0 0.5rem
    display: flex
    flex-direction: column
    align-items: end
    border: 0 solid black

    button
        white-space: nowrap
        color: #f0f8ff
        border-radius: 0.3125rem
        border: 0
        background-color: #09f
        padding: 0.25rem 1rem
        margin-bottom: 0.8rem
        margin-right: 0.5rem

.input-content
    flex-wrap: wrap
    display: flex
    background-color: #f1f1f1
    border: 0
    flex-grow: 1
    width: 100%

    .input-area
        overflow-y: auto
        max-height: 20rem
        resize: none
        font-size: 1rem
        background-color: #f1f1f1
        border: 0
        flex-grow: 1
        width: 100%

        moz-user-select: -moz-none
        -moz-user-select: none
        -o-user-select: none
        -khtml-user-select: none
        -webkit-user-select: none
        -ms-user-select: none
        user-select: none

        &:focus
            border: 0
            outline: none
</style>
