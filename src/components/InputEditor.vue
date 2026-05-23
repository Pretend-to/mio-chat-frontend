<template>
  <div class="input-bar">
    <!-- Command Popup List -->
    <transition name="popup-fade">
      <div 
        v-if="showCommandPopup && filteredCommands.length > 0" 
        :class="[isMobileDevice ? 'mobile-command-popup' : 'desktop-command-popup']"
      >
        <div class="popup-header" v-if="isMobileDevice">
          <span class="popup-title">选择快捷指令</span>
        </div>
        <div class="command-list-wrapper">
          <div 
            v-for="(cmd, idx) in filteredCommands" 
            :key="idx" 
            class="command-item" 
            :class="{ active: idx === commandIndex }"
            @click="confirmCommand(cmd)"
            @mouseenter="commandIndex = idx"
          >
            <span class="command-label">
              <i v-if="cmd.type === 'tool'" class="mio-icon mio-icon-tool"></i>
              <i v-else-if="cmd.type === 'skill'" class="mio-icon mio-icon-skill"></i>
              {{ activeContactor.platform === 'onebot' ? '/' : '' }}{{ cmd.label }}
            </span>
            <span v-if="cmd.hash" class="command-preset">{{ cmd.hash }}</span>
            <span v-else-if="activeContactor.platform === 'onebot'" class="command-preset">{{ cmd.preset }}</span>
          </div>
        </div>
      </div>
    </transition>

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
        <div ref="textarea" class="input-area" contenteditable="true"
          @keydown="handleKeyDown" @click="updateCursorPosition"></div>
      </div>
      <button id="sendButton" @click.prevent="send">
        发送{{ getWraperName() ? ` | ${getWraperName()}` : "" }}
      </button>
    </div>
  </div>
</template>

<script>
import { client, config } from "@/lib/runtime.js";
import { debounce } from "../utils/tools.js";
import { useConfigStore } from "@/stores/configStore.js";
import { skillAPI } from "@/lib/configApi.js";

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
      isMobileDevice: window.innerWidth < 768,
      showCommandPopup: false,
      commandSearchQuery: "",
      commandIndex: 0,
      popupDismissed: false,
      availableSkills: [],
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
    availableCommands() {
      const list = [];
      if (this.activeContactor?.platform === 'onebot') {
        const options = this.onebotPresets || [];
        options.forEach(cat => {
          if (cat.children && Array.isArray(cat.children)) {
            cat.children.forEach(child => {
              if (child.preset) {
                list.push({
                  type: 'command',
                  label: child.label || child.value,
                  value: child.value,
                  preset: child.preset
                });
              }
            });
          }
        });
        if (list.length === 0) {
          list.push(
            { type: 'command', label: '画画', value: 'draw', preset: '#画图' },
            { type: 'command', label: '帮助', value: 'help', preset: '#帮助' }
          );
        }
      } else if (this.activeContactor?.platform === 'openai') {
        if (typeof config.llmTools === 'object' && config.llmTools !== null) {
          Object.keys(config.llmTools).forEach(pluginName => {
            const pluginTools = config.llmTools[pluginName];
            if (pluginTools && typeof pluginTools === 'object') {
              Object.keys(pluginTools).forEach(toolName => {
                const tool = pluginTools[toolName];
                
                let displayName = tool.name;
                let hash = "";
                if (tool.name.includes("_mid_")) {
                  const parts = tool.name.split("_mid_");
                  displayName = parts[0];
                  hash = parts[1];
                }
                
                list.push({
                  type: 'tool',
                  label: displayName,
                  hash: hash,
                  value: tool.name,
                  preset: tool.name,
                  description: tool.description
                });
              });
            }
          });
        }
        const skills = this.availableSkills || [];
        skills.forEach(skill => {
          let displayName = skill.name;
          let hash = "";
          if (skill.name.includes("_mid_")) {
            const parts = skill.name.split("_mid_");
            displayName = parts[0];
            hash = parts[1];
          }
          list.push({
            type: 'skill',
            label: displayName,
            hash: hash,
            value: skill.name,
            preset: skill.name,
            description: skill.description
          });
        });
      }
      return list;
    },
    filteredCommands() {
      if (!this.commandSearchQuery) return this.availableCommands;
      const query = this.commandSearchQuery.toLowerCase();
      return this.availableCommands.filter(c => 
        c.label.toLowerCase().includes(query) || 
        c.value.toLowerCase().includes(query) ||
        c.preset.toLowerCase().includes(query)
      );
    },
  },
  watch: {
    activeContactor(newVal, oldVal) {
      if (oldVal) {
        this.saveDraftTo(oldVal); // 显式保存到旧对象
      }
      this.textareaRef.innerHTML = ""; // 强制清空物理输入框
      this.loadSelected();
      this.loadDraft();
      if (newVal?.platform === 'openai' && this.availableSkills.length === 0) {
        this.fetchSkills();
      }
    },
  },
  created() {
    this.pendingImageFiles = new Map();
    this.loadSelected();
    this.debouncedAdjustHeight = debounce(this.adjustTextareaHeight, 100);
  },
  mounted() {
    this.textareaRef = this.$refs.textarea;
    this.loadDraft();
    this.textareaRef.addEventListener("input", this.debouncedAdjustHeight);

    this.handleInputEvent = (e) => {
      this.checkSlashCommand(e);
    };
    this.textareaRef.addEventListener("input", this.handleInputEvent);

    this.resizeHandler = () => {
      this.isMobileDevice = window.innerWidth < 768;
    };
    window.addEventListener("resize", this.resizeHandler);

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
    this.onebotPresets = config.onebotConfig?.textwraper?.options || [];

    const configStore = useConfigStore();
    if (!configStore.config) {
      configStore.fetchConfig().catch((err) => {
        console.error("Failed to load config in InputEditor:", err);
      });
    }

    this.clickOutsideHandler = (e) => {
      if (this.showCommandPopup) {
        const isClickInside = this.$el.contains(e.target);
        if (!isClickInside) {
          this.showCommandPopup = false;
        }
      }
    };
    document.addEventListener("click", this.clickOutsideHandler);

    if (this.activeContactor?.platform === "openai") {
      this.fetchSkills();
    }
  },
  unmounted() {
    this.textareaRef.removeEventListener("input", this.adjustTextareaHeight);
    this.textareaRef.removeEventListener("input", this.handleInputEvent);
    this.textareaRef.removeEventListener("dragover", this.handleDragOver);
    this.textareaRef.removeEventListener("dragleave", this.handleDragLeave);
    this.textareaRef.removeEventListener("drop", this.handleDrop);
    this.textareaRef.removeEventListener("paste", this.handlePaste);
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }
    if (this.clickOutsideHandler) {
      document.removeEventListener("click", this.clickOutsideHandler);
    }
    this.saveDraft(); // 离开组件前保存
    this.textareaRef = null;
  },
  methods: {
    async fetchSkills() {
      try {
        const res = await skillAPI.getSkills();
        if (res.success) {
          this.availableSkills = res.data || [];
        }
      } catch (err) {
        console.error("加载技能列表失败:", err);
      }
    },
    loadDraft() {
      if (this.activeContactor.draft) {
        this.textareaRef.innerHTML = this.activeContactor.draft;
        this.adjustTextareaHeight();
      } else {
        this.textareaRef.innerHTML = "";
      }
    },
    saveDraft() {
      this.saveDraftTo(this.activeContactor);
    },
    saveDraftTo(contactor) {
      if (!contactor || !this.textareaRef) return;
      const content = this.textareaRef.innerHTML;
      
      // 校验：是否有实际内容（图片或非空文字）
      const doc = new DOMParser().parseFromString(content, 'text/html');
      const hasImage = doc.querySelector('img') !== null;
      const text = (doc.body.textContent || "").trim();

      if (!hasImage && !text) {
        contactor.draft = "";
      } else {
        contactor.draft = content;
      }
      
      // emit is handled by the Proxy — this triggers contactorsStore.updateContactorSummary
      if (contactor.emit) contactor.emit("updateMessageSummary");
      client.setLocalStorage();
    },
    clearDraft() {
      this.activeContactor.draft = "";
      if (this.activeContactor.emit) this.activeContactor.emit("updateMessageSummary");
      client.setLocalStorage();
    },
    unsupportedTip() {
      this.$message.warning("功能暂未开放");
    },
    hasInput() {
      // const text = this.textareaRef?.innerText.trim();
      const hasText = this.textareaRef?.innerText.trim();
      const hasImage = this.textareaRef?.querySelector("img");
      return hasText || hasImage;
    },
    handleDroppedFile(file) {
      if (file.type.startsWith("image/")) {
        this.handleLocalImageInsert(file);
        this.adjustTextareaHeight();
      } else {
        this.uploadFile(file);
      }
    },
    // 把纯文本转换成可在contenteditable正确显示换行和空格的HTML
    textToHtml(text) {
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

      // 换行符变成 <br>，空格用&nbsp;保留
      return escaped
        .replace(/  /g, "&nbsp;&nbsp;") // 连续空格至少保留两个才需要转换，单个空格是正常空格
        .replace(/\n/g, "<br>");
    },

    // 在光标处插入HTML片段（带换行和空格）
    insertHtmlAtCursor(html) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        // 没有光标选区，追加到末尾
        this.textareaRef.innerHTML += html;
        this.setCursorToEnd(this.textareaRef);
        return;
      }
      const range = selection.getRangeAt(0);
      range.deleteContents();

      // 使用临时容器把html转成节点
      const tempEl = document.createElement("div");
      tempEl.innerHTML = html;

      const frag = document.createDocumentFragment();
      while (tempEl.firstChild) {
        frag.appendChild(tempEl.firstChild);
      }

      range.insertNode(frag);

      // 设置光标移动到插入节点后面
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    },

    // 粘贴事件处理：文本转html插入，图片插入本地缓存
    handlePaste(e) {
      e.preventDefault();
      const clipboardData = e.clipboardData || window.clipboardData;
      const items = clipboardData.items;
      let pastedText = "";
      const imageFiles = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          imageFiles.push(item.getAsFile());
        } else if (item.type === "text/plain") {
          pastedText += clipboardData.getData("text/plain");
        }
      }

      if (pastedText) {
        const html = this.textToHtml(pastedText);
        this.insertHtmlAtCursor(html);
      }

      if (imageFiles.length) {
        imageFiles.forEach(file => {
          this.handleLocalImageInsert(file);
        });
        this.adjustTextareaHeight();
      }
    },

    // 表情插入调用统一插入html方法，防止换行空格丢失
    getemoji(e) {
      const unicode = e.detail.unicode;
      // 直接插unicode字符对应的html文本（一般没换行空格）
      this.insertHtmlAtCursor(this.textToHtml(unicode));
      this.ctrlEmojiPanel();
    },

    // 光标移动到内容最后函数
    setCursorToEnd(element) {
      element.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    },

    handleLocalImageInsert(file) {
      const blobUrl = URL.createObjectURL(file);
      this.pendingImageFiles.set(blobUrl, file);
      this.insertImageToTextarea(blobUrl, file.name);
    },

    compressAndUploadImage(file) {
      return new Promise((resolve, reject) => {
        const maxSizeMB = 5;
        const maxSizeByte = maxSizeMB * 1024 * 1024;
        const fileType = file.type.toLowerCase();

        const img = new Image();
        const blobUrl = URL.createObjectURL(file);
        img.src = blobUrl;

        img.onload = () => {
          URL.revokeObjectURL(blobUrl);

          // GIF is uploaded directly
          if (fileType === 'image/gif') {
            if (file.size > maxSizeByte) {
              reject(new Error(`GIF 图片不能超过 ${maxSizeMB}MB`));
              return;
            }
            const formData = new FormData();
            formData.append('image', file, file.name);
            client.uploadImage(formData)
              .then((upload) => {
                resolve(upload.data.url);
              })
              .catch(reject);
            return;
          }

          // Other image formats compressed via canvas
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
                reject(new Error('图片压缩失败'));
                return;
              }
              if (blob.size > maxSizeByte) {
                reject(new Error(`压缩后仍超过 ${maxSizeMB}MB`));
                return;
              }
              const formData = new FormData();
              formData.append('image', blob, file.name);
              client.uploadImage(formData)
                .then((upload) => {
                  resolve(upload.data.url);
                })
                .catch(reject);
            },
            mimeType,
            quality
          );
        };

        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('图片加载失败'));
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
      if (file.type.startsWith("image/")) {
        this.handleLocalImageInsert(file);
        this.adjustTextareaHeight();
      } else {
        this.uploadDocumentFile(file);
      }
    },
    async uploadDocumentFile(file) {
      const localBlobUrl = URL.createObjectURL(file);
      const fileUrl = `${localBlobUrl}?size=${file.size}&name=${file.name}`;
      
      const container = this.activeContactor.getBaseUserContainer();
      container.status = "uploading";
      container.content.push({
        type: "file",
        data: { file: fileUrl },
      });
      
      this.activeContactor.messageChain.push(container);
      this.$emit("stroge");
      this.$emit("toButtom");
      
      try {
        const upload = await client.uploadFile(file);
        URL.revokeObjectURL(localBlobUrl);
        const remoteFileUrl = `${upload.data.url}?size=${file.size}&name=${file.name}`;
        
        // 从 messageChain 中查找响应式代理对象，更新它以正确触发 Vue 3 响应式系统
        const msgInChain = this.activeContactor.messageChain.find(m => m.id === container.id);
        if (msgInChain) {
          msgInChain.content[0].data.file = remoteFileUrl;
          msgInChain.status = "completed";
        }
        
        container.content[0].data.file = remoteFileUrl;
        container.status = "completed";
        this.$message.success("文件上传成功");
      } catch (error) {
        console.error("文件上传失败:", error);
        this.$message.error("文件上传失败，请稍后再试");
        
        const msgInChain = this.activeContactor.messageChain.find(m => m.id === container.id);
        if (msgInChain) {
          msgInChain.status = "failed";
        }
        container.status = "failed";
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
      
      let msg = "";
      let isCommand = false;
      let openaiCmdElement = null;
      
      const badge = this.textareaRef.querySelector(".command-badge");
      if (badge) {
        const preset = badge.getAttribute("data-preset");
        const type = badge.getAttribute("data-type");
        const clone = this.textareaRef.cloneNode(true);
        const cloneBadge = clone.querySelector(".command-badge");
        if (cloneBadge) {
          cloneBadge.remove();
        }
        const remainingText = clone.innerText.trim();
        
        if (this.activeContactor.platform === "onebot") {
          if (preset.includes("{xxx}")) {
            msg = preset.replace("{xxx}", remainingText);
          } else {
            msg = remainingText ? `${preset} ${remainingText}` : preset;
          }
          isCommand = true;
        } else if (this.activeContactor.platform === "openai") {
          if (type === "tool") {
            if (!this.activeContactor.options) this.activeContactor.options = {};
            if (!this.activeContactor.options.toolCallSettings) this.activeContactor.options.toolCallSettings = {};
            if (!Array.isArray(this.activeContactor.options.toolCallSettings.tools)) this.activeContactor.options.toolCallSettings.tools = [];
            if (!this.activeContactor.options.toolCallSettings.tools.includes(preset)) {
              this.activeContactor.options.toolCallSettings.tools.push(preset);
              client.setLocalStorage();
            }
            openaiCmdElement = {
              type: "tool_cmd",
              data: { name: preset }
            };
          } else if (type === "skill") {
            openaiCmdElement = {
              type: "skill_cmd",
              data: { name: preset }
            };
          }
          msg = remainingText;
          isCommand = true;
        }
      } else {
        msg = this.getSafeText(this.textareaRef.innerText);
        if (this.activeContactor.platform === "onebot") {
          this.availableCommands.forEach(cmd => {
            const slashLabel = `/${cmd.label}`;
            const slashValue = `/${cmd.value}`;
            if (msg.startsWith(slashLabel)) {
              msg = msg.replace(slashLabel, cmd.preset);
              isCommand = true;
            } else if (msg.startsWith(slashValue)) {
              msg = msg.replace(slashValue, cmd.preset);
              isCommand = true;
            }
          });
        }
      }

      const wrappedMessage =
        (this.activeContactor.platform === "onebot" && !isCommand) ? this.wrapText(msg) : msg;
      this.textareaRef.innerHTML = "";
      this.adjustTextareaHeight();
      const container = this.activeContactor.getBaseUserContainer();
      
      if (openaiCmdElement) {
        container.content.push(openaiCmdElement);
      }
      
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
      if (!this.hasInput()) return;
      this.$emit("toButtom");
      
      const container = this.presend();
      
      const localImageElements = container.content.filter(
        elm => elm.type === "image" && elm.data.file.startsWith("blob:")
      );
      
      const hasLocalImages = localImageElements.length > 0;
      
      container.status = hasLocalImages ? "uploading" : "pending";
      this.activeContactor.messageChain.push(container);
      this.clearDraft();
      this.$emit("stroge");
      this.$emit("toButtom");
      
      if (hasLocalImages) {
        try {
          const uploadPromises = localImageElements.map(async (elm) => {
            const localUrl = elm.data.file;
            const fileObj = this.pendingImageFiles.get(localUrl);
            if (!fileObj) {
              throw new Error("找不到本地图片缓存文件");
            }
            
            const remoteUrl = await this.compressAndUploadImage(fileObj);
            
            // Preload the remote image to ensure browser cache is built before we swap the URL, preventing layout jumps
            await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve();
              img.onerror = () => resolve();
              img.src = remoteUrl;
            });

            this.pendingImageFiles.delete(localUrl);
            elm.data.file = remoteUrl;
          });
          
          await Promise.all(uploadPromises);
          
          const msgInChain = this.activeContactor.messageChain.find(m => m.id === container.id);
          if (msgInChain) {
            msgInChain.status = "pending";
          }
          container.status = "pending";
          this.$emit("stroge");
          
          await this.activeContactor.webSend(container);
        } catch (error) {
          console.error("图片上传失败:", error);
          this.$message.error(error.message || "图片上传失败");
          const msgInChain = this.activeContactor.messageChain.find(m => m.id === container.id);
          if (msgInChain) {
            msgInChain.status = "failed";
          }
          container.status = "failed";
          this.$emit("stroge");
        }
      } else {
        try {
          await this.activeContactor.webSend(container);
        } catch (error) {
          // Handled inside sendMessage
        }
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
      if (this.showCommandPopup && this.filteredCommands.length > 0) {
        const list = this.filteredCommands;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          this.commandIndex = (this.commandIndex + 1) % list.length;
          this.scrollActiveCommandIntoView();
          return;
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          this.commandIndex = (this.commandIndex - 1 + list.length) % list.length;
          this.scrollActiveCommandIntoView();
          return;
        } else if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const cmd = list[this.commandIndex];
          if (cmd) {
            this.confirmCommand(cmd);
          }
          return;
        } else if (event.key === "Escape") {
          event.preventDefault();
          this.showCommandPopup = false;
          this.popupDismissed = true;
          return;
        }
      }

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
    checkSlashCommand(event) {
      if (this.activeContactor?.platform !== 'onebot' && this.activeContactor?.platform !== 'openai') {
        this.showCommandPopup = false;
        return;
      }
      
      const badge = this.textareaRef.querySelector(".command-badge");
      const clone = this.textareaRef.cloneNode(true);
      const cloneBadge = clone.querySelector(".command-badge");
      if (cloneBadge) {
        cloneBadge.remove();
      }
      const textWithoutBadge = clone.innerText || clone.textContent || "";
      
      const occurrences = [];
      let match;
      const regex = /(?:^|\s)[\/#](?!\/)/g;
      while ((match = regex.exec(textWithoutBadge)) !== null) {
        const isTriggerAtStart = match[0] === '/' || match[0] === '#';
        const slashIdx = match.index + (isTriggerAtStart ? 0 : 1);
        occurrences.push(slashIdx);
      }
      
      if (badge && occurrences.length > 0) {
        this.$message({
          message: "指令不可重复，已自动清除先前的指令",
          type: "warning"
        });
        
        badge.remove();
        
        const text = this.textareaRef.innerText || this.textareaRef.textContent || "";
        const newOccurrences = [];
        let newMatch;
        const newRegex = /(?:^|\s)[\/#](?!\/)/g;
        while ((newMatch = newRegex.exec(text)) !== null) {
          const isTriggerAtStart = newMatch[0] === '/' || newMatch[0] === '#';
          const slashIdx = newMatch.index + (isTriggerAtStart ? 0 : 1);
          newOccurrences.push(slashIdx);
        }
        
        if (newOccurrences.length === 1) {
          this.showCommandPopup = true;
          this.commandSearchQuery = text.substring(newOccurrences[0] + 1).trim();
          this.commandIndex = 0;
          this.popupDismissed = false;
        } else {
          this.showCommandPopup = false;
          this.commandSearchQuery = "";
        }
        
        this.adjustTextareaHeight();
        return;
      }
      
      if (occurrences.length > 1) {
        this.$message({
          message: "指令不可重复，已自动清除先前的指令",
          type: "warning"
        });
        
        let endOfCmd = textWithoutBadge.indexOf(' ', occurrences[0]);
        if (endOfCmd === -1 || endOfCmd > occurrences[1]) {
          endOfCmd = occurrences[0] + 1;
        } else {
          endOfCmd = endOfCmd + 1;
        }
        
        const newText = textWithoutBadge.substring(0, occurrences[0]) + textWithoutBadge.substring(endOfCmd);
        this.updateEditorText(newText);
        
        const newOccurrences = [];
        let newMatch;
        const newRegex = /(?:^|\s)[\/#](?!\/)/g;
        while ((newMatch = newRegex.exec(newText)) !== null) {
          const isTriggerAtStart = newMatch[0] === '/' || newMatch[0] === '#';
          const slashIdx = newMatch.index + (isTriggerAtStart ? 0 : 1);
          newOccurrences.push(slashIdx);
        }
        
        if (newOccurrences.length === 1) {
          this.showCommandPopup = true;
          this.commandSearchQuery = newText.substring(newOccurrences[0] + 1).trim();
          this.commandIndex = 0;
          this.popupDismissed = false;
        } else {
          this.showCommandPopup = false;
          this.commandSearchQuery = "";
        }
        return;
      }
      
      if (occurrences.length === 1) {
        const queryStart = occurrences[0] + 1;
        this.commandSearchQuery = textWithoutBadge.substring(queryStart).trim();
        if (!this.popupDismissed) {
          this.showCommandPopup = true;
        }
      } else {
        this.showCommandPopup = false;
        this.commandSearchQuery = "";
        this.popupDismissed = false;
      }
    },
    confirmCommand(cmd) {
      const text = this.textareaRef.innerText || this.textareaRef.textContent || "";
      const regex = /(?:^|\s)[\/#](?!\/)/g;
      let match;
      let lastSlashIdx = -1;
      let triggerChar = "/";
      while ((match = regex.exec(text)) !== null) {
        const isTriggerAtStart = match[0] === '/' || match[0] === '#';
        lastSlashIdx = match.index + (isTriggerAtStart ? 0 : 1);
        triggerChar = text.charAt(lastSlashIdx);
      }
      
      if (lastSlashIdx !== -1) {
        const badgeEl = document.createElement("span");
        badgeEl.className = "command-badge";
        badgeEl.setAttribute("contenteditable", "false");
        badgeEl.setAttribute("data-preset", cmd.preset);
        badgeEl.setAttribute("data-type", cmd.type || "command");
        
        const labelText = triggerChar + cmd.label;
        if (cmd.type === "tool") {
          badgeEl.innerHTML = `<i class="mio-icon mio-icon-tool" style="margin-right: 4px; vertical-align: middle;"></i><span>${labelText}</span>`;
        } else if (cmd.type === "skill") {
          badgeEl.innerHTML = `<i class="mio-icon mio-icon-skill" style="margin-right: 4px; vertical-align: middle;"></i><span>${labelText}</span>`;
        } else {
          badgeEl.innerText = labelText;
        }

        // Try to dynamically retrieve Vue's scope attribute from the container
        const scopeAttr = Array.from(this.textareaRef.attributes)
          .map(attr => attr.name)
          .find(name => name.startsWith("data-v-"));
        if (scopeAttr) {
          badgeEl.setAttribute(scopeAttr, "");
        } else if (this.$options._scopeId) {
          badgeEl.setAttribute(this.$options._scopeId, "");
        }

        const spaceNode = document.createTextNode("\u00A0");
        
        this.replaceTextRangeWithElements(
          this.textareaRef,
          lastSlashIdx,
          lastSlashIdx + 1 + this.commandSearchQuery.length,
          badgeEl,
          spaceNode
        );

        // Set cursor position after the space node
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStartAfter(spaceNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      
      this.showCommandPopup = false;
      this.commandSearchQuery = "";
      this.commandIndex = 0;
      this.popupDismissed = false;
      
      this.$nextTick(() => {
        this.adjustTextareaHeight();
      });
    },
    replaceTextRangeWithElements(container, startIdx, endIdx, badgeEl, spaceNode) {
      let currentIdx = 0;
      const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      let textNode;
      while ((textNode = walk.nextNode())) {
        const nodeLen = textNode.nodeValue.length;
        if (currentIdx + nodeLen > startIdx) {
          const offsetInNode = startIdx - currentIdx;
          const lengthToRemove = endIdx - startIdx;
          
          const parent = textNode.parentNode;
          const textVal = textNode.nodeValue;
          
          const beforeText = textVal.substring(0, offsetInNode);
          const afterText = textVal.substring(offsetInNode + lengthToRemove);
          
          if (beforeText) {
            parent.insertBefore(document.createTextNode(beforeText), textNode);
          }
          parent.insertBefore(badgeEl, textNode);
          parent.insertBefore(spaceNode, textNode);
          if (afterText) {
            parent.insertBefore(document.createTextNode(afterText), textNode);
          }
          
          parent.removeChild(textNode);
          return true;
        }
        currentIdx += nodeLen;
      }
      return false;
    },
    updateEditorText(newText) {
      const imgElements = Array.from(this.textareaRef.querySelectorAll("img"));
      this.textareaRef.innerText = newText;
      imgElements.forEach(img => {
        this.textareaRef.appendChild(img);
      });
      this.setCursorToEnd(this.textareaRef);
    },
    scrollActiveCommandIntoView() {
      this.$nextTick(() => {
        const activeItem = this.$el.querySelector('.command-item.active');
        if (activeItem) {
          activeItem.scrollIntoView({ block: 'nearest' });
        }
      });
    },
  },
};
</script>

<style lang="sass" scoped>
$mobile: 768px
$icon-hover: #09f

i:hover
  color: $icon-hover

.input-bar
  position: relative
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
      position: relative
      z-index: 10
      background-color: #ffffff

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
      position: relative
      z-index: 10
      background-color: #ffffff

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

.popup-fade-enter-active, .popup-fade-leave-active
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)

.popup-fade-enter-from, .popup-fade-leave-to
  opacity: 0
  @media (max-width: 768px)
    transform: translateY(100%)
    opacity: 1

.desktop-command-popup
  position: absolute
  bottom: calc(100% + 4px)
  left: 1rem
  width: 320px
  max-height: 250px
  background-color: #ffffff
  border: 1px solid #ebeef5
  border-radius: 8px
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12)
  z-index: 2000
  display: flex
  flex-direction: column
  overflow: hidden

  .command-item
    padding: 0.25rem 0.75rem

.mobile-command-popup
  position: absolute
  bottom: 100%
  left: 0
  width: 100vw
  height: 12rem
  background-color: #ffffff
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08)
  z-index: 5
  display: flex
  flex-direction: column
  border-top-left-radius: 12px
  border-top-right-radius: 12px
  overflow: hidden
  margin-left: 0rem

.popup-header
  display: flex
  align-items: center
  justify-content: center
  padding: 0.5rem 1rem
  border-bottom: 1px solid #ebeef5
  background-color: #fafafa
  flex-shrink: 0

  .popup-title
    font-size: 0.85rem
    font-weight: bold
    color: #333333

.command-list-wrapper
  flex: 1
  overflow-y: auto
  -webkit-overflow-scrolling: touch
  padding: 0.15rem 0

.command-item
  display: flex
  align-items: center
  justify-content: space-between
  padding: 0.4rem 0.75rem
  border-bottom: 1px solid #f9f9f9
  cursor: pointer
  transition: all 0.15s ease
  gap: 0.5rem

  &:last-child
    border-bottom: none

  &.active
    background-color: rgba(0, 153, 255, 0.08)

  .command-label
    font-size: 0.8rem
    font-weight: 600
    color: #303133
    display: inline-flex
    align-items: center
    max-width: 60%
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    flex-shrink: 0

    .mio-icon
      font-size: 0.8rem !important
      line-height: 1 !important
      margin-right: 6px
      color: #909399
      flex-shrink: 0
      vertical-align: middle

  .command-preset
    font-size: 0.75rem
    color: #909399
    max-width: 35%
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    text-align: right
    flex-shrink: 0

.command-badge
  display: inline-flex
  align-items: center
  background-color: rgba(0, 153, 255, 0.12)
  color: rgb(0, 153, 255)
  border: 1px solid rgba(0, 153, 255, 0.24)
  border-radius: 4px
  padding: 0 6px
  margin: 0 2px
  font-size: 0.8em
  font-weight: 500
  height: 1.25rem
  line-height: 1.25rem
  user-select: none
  vertical-align: middle
</style>

<style lang="sass">
.command-badge
  display: inline-flex !important
  align-items: center !important
  background-color: rgba(0, 153, 255, 0.12) !important
  color: rgb(0, 153, 255) !important
  border: 1px solid rgba(0, 153, 255, 0.24) !important
  border-radius: 4px !important
  padding: 0 6px !important
  margin: 0 2px !important
  font-size: 0.8em !important
  font-weight: 500 !important
  height: 1.25rem !important
  line-height: 1.25rem !important
  user-select: none !important
  vertical-align: middle !important
</style>
