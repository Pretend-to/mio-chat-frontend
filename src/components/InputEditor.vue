<template>
  <div class="input-bar">
    <div class="options">
      <div class="bu-emoji">
        <emoji-picker v-show="showemoji" ref="emojiPicker" @emoji-click="getemoji"></emoji-picker>
        <p id="ho-emoji">表情</p>
        <i @click.prevent="ctrlEmojiPanel" class="iconfont smile"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">滑到底部</p>
        <i @click="$emit('toButtom', 1)" class="iconfont download"></i>
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
          {{ activeContactor.platform == "openai" ? "模型选择" : "工具选择" }}
        </p>
        <el-cascader v-model="selectedOptions" :options="extraOptions" id="wraper-selector" @change="activeBotTools" />
        <i class="iconfont robot"></i>
      </div>
    </div>
    <div class="input-box">
      <div class="input-content">
        <div @keydown="handleKeyDown" @input="handleInput" class="input-area" ref="textarea" :v-html="userInput"
          contenteditable="true" placeholder="按 Ctrl + Enter 以发送消息" @click="updateCursorPosition"></div>
      </div>
      <button @click.prevent="send" :disabled="!userInput || !isValidInput(userInput)" id="sendButton">
        发送{{ getWraperName() ? ` | ${getWraperName()}` : "" }}
      </button>
    </div>
  </div>
</template>

<script>
import { client, config } from "@/lib/runtime.js";

export default {
  data() {
    return {
      userInput: "",
      selectedWraper: null,
      selectedModel: null,
      selectedOptions: null,
      cursorPosition: [],
      showemoji: false,
      openaiModels: null,
      onebotPresets: null,
      host: "",
      uploaded: { files: [], images: [] },
      isPasting: false,
    };
  },
  props: {
    activeContactor: {
      type: Object,
      required: true,
    },
  },
  computed: {
    extraOptions() {
      if (this.activeContactor.platform == "openai") {
        return this.openaiModels;
      } else {
        return this.onebotPresets;
      }
    },
  },
  methods: {
    ctrlEmojiPanel() {
      this.showemoji = !this.showemoji;

      const editor = this.$refs.textarea;
      editor.focus();
    },
    uploadFile() {
      const availableImageFormats = ["png", "jpg", "jpeg"];
      const availableDocFormats = ["docx", "pdf", "pptx", "xlsx"];
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ""; // 初始化为空，然后拼接

      // 构建 accept 字符串，让用户只能选择指定类型的文件
      for (const format of [...availableDocFormats, ...availableImageFormats]) {
        fileInput.accept += `.${format},`; // 用逗号分隔多个文件类型
      }

      fileInput.click(); // 模拟点击，打开文件选择对话框

      fileInput.onchange = async (e) => {
        try {
          const file = e.target.files[0]; // 获取用户选择的第一个文件

          if (!file) {
            return; // 用户取消了选择，直接返回
          }

          if (file.size > 50 * 1024 * 1024) {
            // 检查文件大小，超过 50MB 给出提示
            this.$message({
              message: "文件大小超过50MB，无法上传",
              type: "error",
            });
            return; // 阻止上传
          }

          this.$message({
            message: "文件上传中...",
            type: "info",
          });

          if (file.type.startsWith("image/")) {
            // 如果是图片，调用图片处理函数
            this.handleUploadImage(file);
          } else {
            // 如果是文档，调用文档上传函数
            // const upload = await client.uploadFile(file, {
            //   onProgress: (percent) => {
            //     console.log(percent); // 显示上传进度
            //   },
            // });
            const upload = await client.uploadFile(file);

            this.$message({
              message: "文件上传成功",
              type: "success",
            });

            // 将上传成功的文件信息添加到已上传文件列表
            this.uploaded.files.push(`${upload.data.url}?size=${file.size}&name=${file.name}`);
          }
        } catch (error) {
          // 统一处理上传过程中的错误
          console.error("文件上传失败:", error);
          this.$message({
            message: "文件上传失败，请稍后再试",
            type: "error",
          });
        }
      };
    },
    handleUploadImage(file) {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (event) => {
        img.src = event.target.result;
      };

      img.onload = () => {
        // 创建canvas并绘制图像
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // 将canvas转换为Blob对象，质量为0.7
        canvas.toBlob((blob) => {
          const formData = new FormData();
          formData.append('image', blob, file.name); // 使用Blob而不是原始File对象

          // 通过uploadImage方法上传
          client.uploadImage(formData).then(upload => {
            const imageUrl = upload.data.url;
            // 将图片以image元素展示在输入框
            const imageElement = document.createElement("img");
            imageElement.src = imageUrl;
            imageElement.alt = file.name;
            imageElement.style.maxWidth = "10rem";

            const range = document.createRange();
            range.selectNodeContents(this.$refs.textarea);
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            const fragment = range.createContextualFragment(
              `<span>${imageElement.outerHTML}</span>`
            );
            range.insertNode(fragment);

            // 将光标移到span元素后面
            setTimeout(() => {
              const newRange = document.createRange();
              newRange.selectNodeContents(this.$refs.textarea);
              newRange.collapse(false);
              const newSelection = window.getSelection();
              newSelection.removeAllRanges();
              newSelection.addRange(newRange);
            }, 0);

            this.$message({
              message: '上传图片成功',
              type: 'success',
            });
          }).catch(error => {
            console.error('Error handling uploaded image:', error);
            this.$message({
              message: '上传图片失败',
              type: 'error',
            });
          });
        }, 'image/jpeg', 0.7); // 质量设置为 0.7
      };

      reader.readAsDataURL(file);
    },
    setModel() {
      this.selectedModel = [...this.selectedOptions];
      this.$emit("setModel", this.selectedModel[1]);
    },
    initExtraOptions() {
      this.openaiModels = client.models.map((modelGroup) => {
        return {
          value: modelGroup.owner,
          label: modelGroup.owner,
          children: modelGroup.models.map((model) => {
            return {
              value: model,
              label: model,
            };
          }),
        };
      });
      this.onebotPresets = config.onebotDefaultConfig.textwraper.options;
      this.loadSelectedArray();
    },
    loadSelectedArray() {
      if (this.activeContactor.platform == "openai") {
        this.selectedModel = this.getOpenaiModelArray(this.activeContactor.options.model)
        this.selectedOptions = [...this.selectedModel];
      } else {
        this.selectedWraper = [""]
        this.selectedOptions = [...this.selectedWraper];
      }
    },
    getOpenaiModelArray(model) {
      const activeArray = client.models.find((modelGroup) => modelGroup.models.includes(model))
      return [activeArray.owner, model]
    },
    wrapText(rawText) {
      if (!this.selectedWraper) return rawText;
      const wraper = this.selectedWraper[this.selectedWraper.length - 1];
      if (!wraper) return rawText;
      const testText = "{xxx}";

      const childrens = this.onebotPresets.find(
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
      if (this.activeContactor.platform === "onebot") {
        if (!this.selectedWraper) return "";
        const wraper = this.selectedWraper[this.selectedWraper.length - 1];
        if (!wraper) return "";
        const childrens = this.onebotPresets.find(
          (item) => item.value == this.selectedWraper[0]
        ).children;
        const preset = childrens.find(
          (child) => child.value == this.selectedWraper[1]
        ).preset;
        const name = preset.replace("#", "").replace("{xxx}", "");
        return name;
      } else {
        return "";
      }
    },
    waiting() {
      this.$message({ message: "此功能尚未开放", type: "warning" });
    },
    getemoji(e) {
      const inputer = this.$refs.textarea;
      inputer.focus();

      const range = document.createRange();
      const sel = window.getSelection();
      if (!sel) return;

      const unicode = e.detail.unicode;
      const startPos = this.cursorPosition[0];
      const endPos = this.cursorPosition[1];
      const textBeforeCursor = this.userInput.substring(0, startPos);
      const textAfterCursor = this.userInput.substring(endPos);
      this.userInput = textBeforeCursor + unicode + textAfterCursor;
      inputer.innerHTML = this.userInput;

      // 移动光标位置到表情符号之后
      setTimeout(() => {
        range.setStart(inputer.firstChild, startPos + unicode.length);
        range.setEnd(inputer.firstChild, startPos + unicode.length);
        sel.removeAllRanges();
        sel.addRange(range);
      }, 0);

      this.ctrlEmojiPanel();
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

      // 获取textarea中的所有img元素
      const images = this.$refs.textarea.querySelectorAll('img');

      // 提取每个img元素的src属性
      const ImageSrcs = Array.from(images).map(img => img.src);

      let msg = this.getSafeText(this.userInput);

      const wrappedMessage =
        this.activeContactor.platform === "onebot" ? this.wrapText(msg) : msg;

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

      ImageSrcs.forEach((imgUrl) => {
        container.content.push({
          type: "image",
          data: {
            file: imgUrl,
          },
        });
      });
      this.uploaded.files.forEach((file) => {
        container.content.push({
          type: "file",
          data: {
            file: this.host + file,
          },
        });
      });

      if (this.repliedMessage) {
        const replyData = {
          type: "reply",
          data: {
            id: this.repliedMessage.id,
          },
        };
        container.content.push(replyData);
      }

      return container;
    },
    async send() {
      this.$emit("sendMessage");
      const container = this.presend();
      this.userInput = "";
      const message_id = await this.activeContactor.webSend(container); //发送消息
      this.activeContactor.emit("updateMessageSummary")
      container.id = message_id;
      this.$emit("stroge");
      this.uploaded.images = [];
      this.uploaded.files = [];
    },
    getSafeText(text) {
      // return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return text;
    },
    cleanScreen() {
      this.$emit("cleanScreen");
    },
    async activeBotTools() {
      this.selectedWraper = [...this.selectedOptions];
      if (this.activeContactor.platform === "onebot") {
        const testMessage = "text";
        const testMessage2 = "test";
        const wrappedMessage = this.wrapText(testMessage);
        const wrappedMessage2 = this.wrapText(testMessage2);
        if (wrappedMessage2 === wrappedMessage) {
          this.userInput = this.textareaRef.value = wrappedMessage;
          await this.send();
        }
      } else {
        this.setModel();
        this.$message({
          message: "已切换到 " + this.selectedModel[1] + " 模型",
          type: "success",
        });
      }
    },
    isValidInput(input) {
      return input.trim().length > 0;
    },
    handleKeyDown(event) {
      if (event.key === "Enter") {
        if (event.ctrlKey) {
          if (this.userInput && this.isValidInput(this.userInput)) this.send();
          else this.$message({ message: "不能发送空消息", type: "warning" });
          // 处理按下 Ctrl+Enter 键的逻辑
        } else {
          this.userInput += "\n";
        }
      }

      setTimeout(() => {
        this.updateCursorPosition();
      }, 0);
    },
    handleInput() {
      if (!this.isPasting) this.userInput = this.$refs.textarea.innerText;
    },
  },
  created() {
    this.initExtraOptions();
  },
  mounted() {
    this.textareaRef = this.$refs.textarea;
    this.textareaRef.addEventListener("input", this.adjustTextareaHeight);

    // 将paste事件的处理函数定义为一个方法
    this.handlePaste = (e) => {
      e.preventDefault();
      this.isPasting = true;
      // 获取剪贴板的数据
      var items = (e.clipboardData || window.clipboardData).items;
      for (var i = 0; i < items.length; i++) {
        // 检查是否为文件类型
        if (items[i].type.indexOf("image") !== -1) {
          var blob = items[i].getAsFile();
          this.handleUploadImage(blob);
        } else if (items[i].type === "text/plain") {
          var text = (e.originalEvent || e).clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          this.userInput = this.$refs.textarea.innerText;
        }
      }
      this.isPasting = false;
    };

    // 添加paste事件监听器
    document.addEventListener("paste", this.handlePaste);

    this.host = window.location.origin;
  },

  unmounted() {
    this.textareaRef.removeEventListener("input", this.adjustTextareaHeight);
    this.textareaRef = null;

    // 移除paste事件监听器
    document.removeEventListener("paste", this.handlePaste);
  },
  watch: {
    "$route.params.id"() {
      this.loadSelectedArray();
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

    @media (max-width: $mobile)
        flex-basis: 7rem

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
