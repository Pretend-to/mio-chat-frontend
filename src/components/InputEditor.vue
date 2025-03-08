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
        <i class="iconfont smile" @click.prevent="ctrlEmojiPanel"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">滑到底部</p>
        <i class="iconfont download" @click="$emit('toButtom', 1)"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">重置人格</p>
        <i class="iconfont reset" @click="$emit('cleanHistory')"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">清除记录</p>
        <i class="iconfont shanchu" @click="$emit('cleanScreen')"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">上传</p>
        <i class="iconfont upload" @click="uploadFile"></i>
      </div>
      <div class="bu-emoji">
        <p id="ho-emoji">
          {{ activeContactor.platform == "openai" ? "模型选择" : "工具选择" }}
        </p>
        <el-cascader
          id="wraper-selector"
          v-model="selectedOptions"
          :options="extraOptions"
          @change="activeBotTools"
        />
        <i class="iconfont robot"></i>
      </div>
    </div>
    <div class="input-box">
      <div class="input-content">
        <div
          ref="textarea"
          class="input-area"
          :v-html="userInput"
          contenteditable="true"
          placeholder="按 Ctrl + Enter 以发送消息"
          @keydown="handleKeyDown"
          @input="handleInput"
          @click="updateCursorPosition"
        ></div>
      </div>
      <button
        id="sendButton"
        :disabled="!userInput || !isValidInput(userInput)"
        @click.prevent="send"
      >
        发送{{ getWraperName() ? ` | ${getWraperName()}` : "" }}
      </button>
    </div>
  </div>
</template>

<script>
import { client, config } from "@/lib/runtime.js";

export default {
  props: {
    activeContactor: {
      type: Object,
      required: true,
    },
  },
  emits: ["toButtom", "cleanHistory", "cleanScreen", "setModel", "stroge"],
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
      uploaded: { files: [], images: [] }, // Keep original data structure
      isPasting: false,
    };
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
  watch: {
    "$route.params.id"() {
      this.loadSelectedArray();
    },
  },
  created() {
    this.initExtraOptions();
  },
  mounted() {
    this.textareaRef = this.$refs.textarea;
    this.textareaRef.addEventListener("input", this.adjustTextareaHeight);
    // 添加拖拽事件监听器
    this.handleDragOver = (e) => {
      e.preventDefault();
      this.textareaRef.style.backgroundColor = "#e0e0e0";
    };
    this.handleDragLeave = (e) => {
      e.preventDefault();
      this.textareaRef.style.backgroundColor = "#f1f1f1";
    };
    this.handleDrop = (e) => {
      e.preventDefault();
      this.textareaRef.style.backgroundColor = "#f1f1f1";
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleDroppedFile(files[0]);
      }
    };
    this.textareaRef.addEventListener("dragover", this.handleDragOver);
    this.textareaRef.addEventListener("dragleave", this.handleDragLeave);
    this.textareaRef.addEventListener("drop", this.handleDrop);
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
          this.userInput = this.textareaRef.innerText;
        }
      }
      this.isPasting = false;
    };
    // 添加paste事件监听器
    this.textareaRef.addEventListener("paste", this.handlePaste);
    this.host = window.location.origin;
  },
  unmounted() {
    this.textareaRef.removeEventListener("input", this.adjustTextareaHeight);
    this.textareaRef.removeEventListener("dragover", this.handleDragOver);
    this.textareaRef.removeEventListener("dragleave", this.handleDragLeave);
    this.textareaRef.removeEventListener("drop", this.handleDrop);
    this.textareaRef.removeEventListener("paste", this.handlePaste);
    this.textareaRef = null;
  },
  methods: {
    handleDroppedFile(file) {
      if (file.type.startsWith("image/")) {
        this.handleUploadImage(file);
      } else {
        this.uploadFile(file);
      }
    },
    ctrlEmojiPanel() {
      this.showemoji = !this.showemoji;
      const editor = this.textareaRef;
      editor.focus();
    },
    uploadFile(file) {
      if (file instanceof File) {
        this.handleFileUpload(file);
        return;
      }
      const availableImageFormats = ["png", "jpg", "jpeg", "gif", "bmp"];
      const availableDocFormats = ["docx", "pdf", "pptx", "xlsx"];
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = [...availableDocFormats, ...availableImageFormats]
        .map((format) => `.${format}`)
        .join(",");

      const handleChange = async (e) => {
        fileInput.removeEventListener("change", handleChange);
        const file = e.target.files[0];
        if (!file) return;
        this.handleFileUpload(file);
      };
      fileInput.addEventListener("change", handleChange);
      fileInput.click();
    },
    handleFileUpload(file) {
      if (file.size > 50 * 1024 * 1024) {
        this.$message.error("文件大小超过50MB，无法上传");
        return;
      }
      this.$message.info("文件上传中...");
      if (file.type.startsWith("image/")) {
        this.handleUploadImage(file);
      } else {
        this.uploadDocumentFile(file);
      }
    },
    async uploadDocumentFile(file) {
      try {
        const upload = await client.uploadFile(file);
        this.$message.success("文件上传成功");
        this.uploaded.files.push(
          `${upload.data.url}?size=${file.size}&name=${file.name}`,
        );
      } catch (error) {
        console.error("文件上传失败:", error);
        this.$message.error("文件上传失败，请稍后再试");
      }
    },
    handleUploadImage(file) {
      const maxSizeMB = 5;
      const maxSizeByte = maxSizeMB * 1024 * 1024;

      const img = new Image();
      const reader = new FileReader();
      reader.onload = (event) => {
        img.src = event.target.result;
      };

      img.onload = () => {
        const fileType = file.type.toLowerCase();

        // 处理 GIF 类型，上传原文件
        if (fileType === "image/gif") {
          // GIF 检查大小
          if (file.size > maxSizeByte) {
            this.$message.error(`图片大小不能超过 ${maxSizeMB}MB`);
            return;
          }
          const formData = new FormData();
          formData.append("image", file, file.name);
          client
            .uploadImage(formData)
            .then((upload) => {
              const imageUrl = upload.data.url;
              this.uploaded.images.push(imageUrl);
              this.insertImageToTextarea(imageUrl, file.name);
              this.$message.success("上传图片成功");
            })
            .catch((error) => {
              console.error("Error handling uploaded image:", error);
              this.$message.error("上传图片失败");
            });
          return;
        }

        // 非GIF类型，使用Canvas处理
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // 根据文件类型确定mimeType和quality, for toBlob
        let mimeType, quality;

        if (fileType === "image/png") {
          mimeType = "image/png";
          quality = undefined; // PNG的质量参数无效
        } else if (fileType === "image/webp") {
          mimeType = "image/webp";
          quality = 0.7;
        } else {
          // 默认为jpeg（处理jpg or其他类型）
          mimeType = "image/jpeg";
          quality = 0.7;
        }

        canvas.toBlob(
          (blob) => {
            if (blob.size > maxSizeByte) {
              this.$message.error(
                `图片压缩后仍然超过 ${maxSizeMB}MB，请选择更小的图片`,
              );
              return;
            }

            const formData = new FormData();
            formData.append("image", blob, file.name);
            client
              .uploadImage(formData)
              .then((upload) => {
                const imageUrl = upload.data.url;
                this.uploaded.images.push(imageUrl);
                this.insertImageToTextarea(imageUrl, file.name);
                this.$message.success("上传图片成功");
              })
              .catch((error) => {
                console.error("上传图片失败", error);
                this.$message.error("上传图片失败");
              });
          },
          mimeType,
          quality, // 对于不能使用quality参数的mime类型，此参数被忽略
        );
      };
      reader.readAsDataURL(file);
    },
    // 插入图片到文本域的方法
    insertImageToTextarea(imageUrl, imageName) {
      const imageElement = document.createElement("img");
      imageElement.src = imageUrl;
      imageElement.alt = imageName;
      imageElement.style.maxWidth = "10rem";
      imageElement.style.maxHeight = "10rem";

      const range = document.createRange();
      range.selectNodeContents(this.textareaRef);
      range.collapse(false); // 将范围折叠到末尾

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      const fragment = range.createContextualFragment(
        `<span>${imageElement.outerHTML}</span>`,
      );
      range.insertNode(fragment);

      // 保持光标在插入的图片之后
      setTimeout(() => {
        const newRange = document.createRange();
        newRange.selectNodeContents(this.textareaRef);
        newRange.collapse(false); // 将范围折叠到末尾

        const newSelection = window.getSelection();
        newSelection.removeAllRanges();
        newSelection.addRange(newRange);
      }, 0);
    },
    setModel() {
      this.selectedModel = [...this.selectedOptions];
      this.$emit("setModel", this.selectedModel[1]);
    },
    initExtraOptions() {
      const models = client.config.getOpenaiModels();
      this.openaiModels = models.map((modelGroup) => {
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
        this.selectedModel = this.getOpenaiModelArray(
          this.activeContactor.options.model,
        );
        this.selectedOptions = [...this.selectedModel];
      } else {
        this.selectedWraper = [""];
        this.selectedOptions = [...this.selectedWraper];
      }
    },
    getOpenaiModelArray(model) {
      const owner = client.config.getOpenaiModelOwner(model);
      return [owner, model];
    },
    wrapText(rawText) {
      if (!this.selectedWraper) return rawText;
      const wraper = this.selectedWraper[this.selectedWraper.length - 1];
      if (!wraper) return rawText;
      const testText = "{xxx}";
      const childrens = this.onebotPresets.find(
        (item) => item.value == this.selectedWraper[0],
      ).children;
      const preset = childrens.find(
        (child) => child.value == this.selectedWraper[1],
      ).preset;
      const result = preset.replace(testText, rawText);
      return result;
    },
    adjustTextareaHeight() {
      const textarea = this.textareaRef;
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    },
    getWraperName() {
      if (this.activeContactor.platform === "onebot") {
        if (!this.selectedWraper) return "";
        const wraper = this.selectedWraper[this.selectedWraper.length - 1];
        if (!wraper) return "";
        const childrens = this.onebotPresets.find(
          (item) => item.value == this.selectedWraper[0],
        ).children;
        const preset = childrens.find(
          (child) => child.value == this.selectedWraper[1],
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
      const inputer = this.textareaRef;
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
      this.textareaRef.focus();
      // 获取textarea中的所有img元素
      const images = this.textareaRef.querySelectorAll("img");
      const ImageSrcs = Array.from(images).map((img) => img.src);
      // let msg = this.getSafeText(this.textareaRef.innerText);  // Use innerText, not userInput
      let msg = this.getSafeText(this.userInput);
      const wrappedMessage =
        this.activeContactor.platform === "onebot" ? this.wrapText(msg) : msg;
      this.userInput = this.textareaRef.innerHTML = ""; // Clear the textarea
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

      if (this.repliedMessageId) {
        const replyData = {
          type: "reply",
          data: {
            id: this.repliedMessageId,
          },
        };
        container.content.push(replyData);
      }
      return container;
    },
    async send() {
      this.$emit("toButtom");
      const container = this.presend();
      // this.userInput = "";  // Already cleared in presend
      const message_id = await this.activeContactor.webSend(container); //发送消息
      this.activeContactor.emit("updateMessageSummary");
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
          // Send only if there's text OR files.
          if (this.userInput && this.isValidInput(this.userInput)) {
            this.send();
          } else {
            this.$message({ message: "不能发送空消息", type: "warning" });
          }
        } else {
          this.userInput += "\n";
        }
      }
      setTimeout(() => {
        this.updateCursorPosition();
      }, 0);
    },
    handleInput() {
      if (!this.isPasting) this.userInput = this.textareaRef.innerText;
    },
  },
};
</script>

<style lang="sass" scoped>
$mobile: 600px
$icon-hover: #09f

i:hover
  color: $icon-hover

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
    font-size: .75rem
    padding: .125rem .25rem
    background-color: #fff
    border: none
    box-shadow: 0 .125rem .25rem #0003
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
    padding: 0 .5rem
    display: flex
    flex-direction: column
    align-items: end
    border: 0 solid black

    button
        white-space: nowrap
        color: #f0f8ff
        border-radius: .3125rem
        border: 0
        background-color: $icon-hover
        padding: .25rem 1rem
        margin-bottom: .8rem
        margin-right: .5rem
        cursor: pointer  /* Add cursor pointer */

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
