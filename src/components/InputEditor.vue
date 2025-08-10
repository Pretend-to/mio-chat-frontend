<template>
  <div class="input-bar">
    <div class="options">
      <div class="bu-emoji">
        <emoji-picker v-show="showemoji" ref="emojiPicker" @emoji-click="getemoji"></emoji-picker>
        <p class="ho-emoji">表情</p>
        <i class="iconfont smile" @click.prevent="ctrlEmojiPanel"></i>
      </div>
      <div class="bu-emoji">
        <p class="ho-emoji">{{ activeContactor.platform == "openai" ? "模型选择" : "工具选择" }}</p>
        <el-tree-select id="wraper-selector" v-model="selectedOption" :data="extraOptions" accordion
          placement="top-start" @node-click="currentChange" />
        <i class="iconfont robot"></i>
      </div>
      <div class="bu-emoji">
        <p class="ho-emoji">重置人格</p>
        <i class="iconfont reset" @click="$emit('cleanHistory')"></i>
      </div>
      <div class="bu-emoji">
        <p class="ho-emoji">上传</p>
        <i class="iconfont upload" @click="uploadFile"></i>
      </div>
      <div class="bu-emoji">
        <p class="ho-emoji">清除记录</p>
        <el-popconfirm class="box-item" title="此操作不可撤销" confirm-button-text="确定" cancel-button-text="取消" placement="top"
          @confirm="$emit('cleanScreen')">
          <template #reference>
            <i class="iconfont shanchu"></i>
          </template>
        </el-popconfirm>
      </div>
      <div class="bu-emoji">
        <p class="ho-emoji">更多</p>
        <i class="iconfont more" @click="unsupportedTip"></i>
      </div>
    </div>

    <div class="input-box">
      <div class="input-content">
        <div ref="textarea" class="input-area" contenteditable="true" placeholder="按 Ctrl + Enter 以发送消息"
          @keydown="handleKeyDown" @click="updateCursorPosition"></div>
      </div>
      <button id="sendButton" :disabled="!hasInput()" @click.prevent="send">
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
      selectedOption: null,
      cursorPosition: [],
      showemoji: false,
      openaiModels: null,
      onebotPresets: [],
      host: "",
      uploaded: { files: [], images: [] },
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
      this.loadSelected();
    },
  },
  created() {
    this.loadSelected();
  },
  mounted() {
    this.textareaRef = this.$refs.textarea;
    this.textareaRef.addEventListener("input", this.adjustTextareaHeight);

    // 拖拽文件
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
    // this.textareaRef.addEventListener("paste", debounce(handlePaste.apply(this), 100));
    this.textareaRef.addEventListener("paste", this.handlePaste);

    this.host = window.location.origin;
    this.onebotPresets = config.onebotConfig.textwraper.options;
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
    unsupportedTip() {
      this.$message.warning("功能暂未开放");
    },
    hasInput() {
      const text = this.textareaRef?.innerText.trim();
      const hasImage = this.textareaRef?.querySelector("img");
      return !!(text || hasImage);
    },
    handleDroppedFile(file) {
      if (file.type.startsWith("image/")) {
        this.handleUploadImage(file);
      } else {
        this.uploadFile(file);
      }
    },
    handlePaste(e) {
      e.preventDefault();
      const clipboardData = e.clipboardData || window.clipboardData;
      const items = clipboardData.items;
      const imageFiles = [];
      let pastedText = '';

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          imageFiles.push(item.getAsFile());
        } else if (item.type === 'text/plain') {
          pastedText += clipboardData.getData('text/plain');
        }
      }

      // 防长文本卡死
      if (pastedText && pastedText.length > 2000) {
        this.$message.warning(`检测到长文本(${pastedText.length}字)，已作为文件处理`);
        const blob = new Blob([pastedText], { type: "text/plain;charset=utf-8" });
        const file = new File([blob], `pasted-${Date.now()}.txt`, { type: "text/plain" });
        this.handleFileUpload(file);
      } else if (pastedText) {
        document.execCommand('insertText', false, pastedText);
      }

      // 图片处理（异步队列）
      if (imageFiles.length) {
        this.$message.info(`检测到 ${imageFiles.length} 张图片，正在处理...`);
        setTimeout(() => {
          this.processImageQueue(imageFiles);
        }, 0);
      }
    },

    // 顺序处理图片，防止堆积卡顿
    async processImageQueue(files) {
      for (const file of files) {
        await this.handleUploadImage(file);
        // 让主线程有时间渲染
        await new Promise(r => setTimeout(r, 0));
      }
    },

    handleUploadImage(file) {
      return new Promise((resolve) => {
        const maxSizeMB = 5;
        const maxSizeByte = maxSizeMB * 1024 * 1024;

        const img = new Image();
        const blobUrl = URL.createObjectURL(file);
        img.src = blobUrl;

        img.onload = () => {
          URL.revokeObjectURL(blobUrl); // 释放内存

          const fileType = file.type.toLowerCase();

          // GIF 直接上传
          if (fileType === 'image/gif') {
            if (file.size > maxSizeByte) {
              this.$message.error(`GIF 图片不能超过 ${maxSizeMB}MB`);
              resolve();
              return;
            }
            const formData = new FormData();
            formData.append('image', file, file.name);
            client.uploadImage(formData)
              .then((upload) => {
                const imageUrl = upload.data.url;
                this.uploaded.images.push(imageUrl);
                this.insertImageToTextarea(imageUrl, file.name);
                this.$message.success('上传 GIF 成功');
              })
              .catch(() => this.$message.error('上传 GIF 失败'))
              .finally(resolve);
            return;
          }

          // 其他类型进行压缩
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          let mimeType, quality;
          if (fileType === 'image/png') {
            mimeType = 'image/png';
          } else if (fileType === 'image/webp') {
            mimeType = 'image/webp';
            quality = 0.7;
          } else {
            mimeType = 'image/jpeg';
            quality = 0.7;
          }
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                this.$message.error('图片压缩失败');
                resolve();
                return;
              }
              if (blob.size > maxSizeByte) {
                this.$message.error(`压缩后仍超过 ${maxSizeMB}MB，请选小点的图片`);
                resolve();
                return;
              }
              const formData = new FormData();
              formData.append('image', blob, file.name);
              client.uploadImage(formData)
                .then((upload) => {
                  const imageUrl = upload.data.url;
                  this.uploaded.images.push(imageUrl);
                  this.insertImageToTextarea(imageUrl, file.name);
                  this.$message.success('上传图片成功');
                })
                .catch(() => this.$message.error('上传失败'))
                .finally(resolve);
            },
            mimeType,
            quality
          );
        };
      });
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
      const availableImageFormats = ["png", "jpg", "jpeg", "webp"];
      const availableDocFormats = ["docx", "txt", "pdf", "pptx", "xlsx"];
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
        const fileUrl = `${upload.data.url}?size=${file.size}&name=${file.name}`;
        const container = this.activeContactor.getBaseUserContainer();
        container.content.push({
          type: "file",
          data: { file: this.host + fileUrl },
        });
        this.activeContactor.webSend(container, false);
      } catch (error) {
        console.error("文件上传失败:", error);
        this.$message.error("文件上传失败，请稍后再试");
      }
      this.$emit("stroge");
      this.$emit("toButtom");
    },
    insertImageToTextarea(imageUrl, imageName) {
      const imageElement = document.createElement("img");
      imageElement.src = imageUrl;
      imageElement.alt = imageName;
      imageElement.style.maxWidth = "10rem";
      imageElement.style.maxHeight = "10rem";
      const range = document.createRange();
      range.selectNodeContents(this.textareaRef);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      const fragment = range.createContextualFragment(
        `<span>${imageElement.outerHTML}</span>`
      );
      range.insertNode(fragment);
      setTimeout(() => {
        const newRange = document.createRange();
        newRange.selectNodeContents(this.textareaRef);
        newRange.collapse(false);
        const newSelection = window.getSelection();
        newSelection.removeAllRanges();
        newSelection.addRange(newRange);
      }, 0);
    },
    initLLMExtraOptions() {
      const allModels = client.config.getLlmModels();
      this.openaiModels = Object.entries(allModels).map(([provider, models]) => {
        return {
          value: provider,
          label: provider,
          children: models.map((modelGroup) => {
            return {
              value: modelGroup.owner,
              label: modelGroup.owner,
              children: modelGroup.models.map((model) => {
                return { value: model, label: model };
              }),
            };
          }),
        };
      });
    },
    getOpenaiModelArray(model) {
      const owner = client.config.getModelOwner(model);
      return [owner, model];
    },
    wrapText(rawText) {
      const preset = this.getOnebotPreset();
      if (!this.selectedOption || !preset) return rawText;
      const testText = "{xxx}";
      return preset.replace(testText, rawText);
    },
    getOnebotPreset() {
      const preset = this.onebotPresets
        .reduce((acc = [], item) => {
          const arr = item.children ?? [item];
          return [...acc, ...arr];
        }, [])
        .find((child) => child.value == this.selectedOption)?.preset;
      return preset;
    },
    loadSelected() {
      if (this.activeContactor.platform === "onebot") {
        if (this.activeContactor.preset) {
          this.selectedOption = this.activeContactor.preset;
        }
      } else {
        this.initLLMExtraOptions();
        this.selectedOption = this.activeContactor.options.base.model;
      }
    },
    adjustTextareaHeight() {
      const textarea = this.textareaRef;
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    },
    getWraperName() {
      const preset = this.getOnebotPreset();
      if (this.activeContactor.platform === "onebot" && preset) {
        if (!this.selectedOption) return "";
        return preset.replace("#", "").replace("{xxx}", "");
      } else {
        return "";
      }
    },
    getemoji(e) {
      const unicode = e.detail.unicode;
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(unicode));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
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
      const images = this.textareaRef.querySelectorAll("img");
      const ImageSrcs = Array.from(images).map((img) => img.src);
      let msg = this.getSafeText(this.textareaRef.innerText);
      const wrappedMessage =
        this.activeContactor.platform === "onebot" ? this.wrapText(msg) : msg;
      this.textareaRef.innerHTML = "";
      this.adjustTextareaHeight();
      const container = this.activeContactor.getBaseUserContainer();
      if (wrappedMessage.trim()) {
        container.content.push({
          type: "text",
          data: { text: wrappedMessage },
        });
      }
      ImageSrcs.forEach((imgUrl) => {
        container.content.unshift({
          type: "image",
          data: { file: imgUrl },
        });
      });
      if (this.repliedMessageId) {
        container.content.push({
          type: "reply",
          data: { id: this.repliedMessageId },
        });
      }
      return container;
    },
    async send() {
      this.$emit("toButtom");
      const container = this.presend();
      try {
        const message_id = await this.activeContactor.webSend(container);
        container.id = message_id;
        this.$emit("stroge");
        this.uploaded.images = [];
        this.uploaded.files = [];
      } catch (error) {
        this.$message.error("发送消息失败");
      }
    },
    getSafeText(text) {
      return text;
    },
    cleanScreen() {
      this.$emit("cleanScreen");
    },
    currentChange(data, event) {
      if (event.level === 3) {
        if (!event.parent || !event.parent.parent) {
          console.error("父节点不存在!");
          return;
        }
        const selectedValues = [
          event.parent.parent.data.value,
          event.parent.data.value,
          data.value,
        ];
        this.$message({
          message: "已切换到 " + selectedValues[2] + " 模型",
          type: "success",
        });
        const seletedProvider = selectedValues[0];
        if (seletedProvider !== this.activeContactor.options?.provider) {
          this.$message({
            message: "已切换到 " + seletedProvider + " 协议",
            type: "success",
          });
        }
        this.$emit("setModel", selectedValues);
      } else if (event.level === 2) {
        if (this.activeContactor.platform === "onebot") {
          if (this.getOnebotPreset() && !this.getOnebotPreset().includes("xxx")) {
            this.send();
          }
        }
      }
    },
    handleKeyDown(event) {
      if (event.key === "Enter") {
        if (event.ctrlKey) {
          if (this.hasInput()) {
            this.send();
          } else {
            this.$message({ message: "不能发送空消息", type: "warning" });
          }
        } else {
          document.execCommand("insertHTML", false, "\n");
        }
      }
      setTimeout(() => {
        this.updateCursorPosition();
      }, 0);
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
    width: 100%
    flex-direction: column-reverse
    position: fixed
    bottom: 0
    z-index: 1000
    background-color: hsla(0, 0%, 100%, 0.8)
    backdrop-filter: blur(0.5rem)

  .options
    display: flex
    border-top: 0.0625rem solid rgba(128, 128, 128, 0.502)
    padding: 0.25rem 0.5rem
    @media (max-width: $mobile)
      border: none
      justify-content: space-around

.bu-emoji
  position: relative
  white-space: nowrap
  @media screen and (min-width: $mobile)
    &:hover p.ho-emoji
      display: block

emoji-picker
  position: absolute
  top: -25.75rem
  right: -20rem

p.ho-emoji
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

    @media screen and (max-width: $mobile)
      flex-direction: row
      align-items: flex-end
      flex-wrap: nowrap

    .input-content
      flex-wrap: wrap
      display: flex
      background-color: #f1f1f1
      border: 0
      flex-grow: 1
      width: 100%

      @media screen and (max-width: $mobile)
        margin: 0.5rem 0.5rem 0.8rem 0
        min-height: 2rem
        flex-basis: calc( 100% - 4rem )
        max-width: calc( 100% - 4rem )
        flex-grow: 0
        background-color: #fff

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

        @media screen and (max-width: $mobile)
          background-color: transparent
          margin: 0.2rem
          caret-color: #14C1EB

    button
        white-space: nowrap
        color: #f0f8ff
        border-radius: .3125rem
        border: 0
        background-color: $icon-hover
        padding: .25rem 1rem
        margin-bottom: .8rem
        margin-right: .5rem
        cursor: pointer

        @media screen and (max-width: $mobile)
          height: 2rem
          margin-right: 0rem
</style>
