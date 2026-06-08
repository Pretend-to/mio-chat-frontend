<template>
  <div class="input-bar">
    <!-- 双向长连接就地交互选择面板 -->
    <transition name="slide-up">
      <div v-if="hasActiveInteraction" class="interaction-bar">
        <div class="interaction-info">
          <i class="mio-icon mio-icon-tool animate-bounce"></i>
          <span class="interaction-prompt">
            {{ activeInteraction.prompt || "请进行选择/授权：" }}
          </span>
        </div>

        <!-- A. 选项多项扁平单选 -->
        <div
          v-if="activeInteraction.actionType === 'SHOW_SELECT_OVERLAY'"
          class="interaction-options"
        >
          <button
            v-for="opt in activeInteraction.options"
            :key="opt.value"
            class="interaction-btn"
            @click="submitResponse({ selectResult: opt.value })"
          >
            {{ opt.label || opt.value }}
          </button>
        </div>

        <!-- B. 危险指令二次审批授权 -->
        <div
          v-else-if="activeInteraction.actionType === 'REQUEST_APPROVAL'"
          class="interaction-options"
        >
          <!-- Command Code Block -->
          <div
            v-if="activeInteraction.meta?.command"
            class="command-preview-box"
          >
            <code>{{ activeInteraction.meta.command }}</code>
          </div>

          <button
            class="interaction-btn approve-btn"
            @click="submitResponse({ approved: true })"
          >
            授权执行
          </button>

          <template
            v-if="
              activeInteraction.meta?.command &&
              !isHighRiskCommand(activeInteraction.meta.command)
            "
          >
            <button
              class="interaction-btn approve-once-btn"
              @click="handleApproveAndRememberSpecific"
            >
              记住此具体命令免确认
            </button>

            <button
              class="interaction-btn approve-once-btn"
              @click="handleApproveAndRememberPrefix"
            >
              记住命令前缀 [{{
                getCommandPrefix(activeInteraction.meta.command)
              }}] 免确认
            </button>
          </template>

          <div class="reject-reason-container">
            <button
              class="interaction-btn reject-btn"
              @click="
                submitResponse({ approved: false, reason: rejectReasonText })
              "
            >
              拒绝
            </button>
            <input
              v-model="rejectReasonText"
              class="reason-input-inline"
              placeholder="拒绝理由（可选）"
              @keyup.enter="
                submitResponse({ approved: false, reason: rejectReasonText })
              "
            />
          </div>
        </div>
      </div>
    </transition>

    <!-- Command Popup List -->
    <transition name="popup-fade">
      <div
        v-if="showCommandPopup && filteredCommands.length > 0"
        :class="[
          isMobileDevice ? 'mobile-command-popup' : 'desktop-command-popup',
        ]"
        :style="isMobileDevice ? {} : commandPopupStyle"
      >
        <div class="popup-header" v-if="isMobileDevice">
          <span class="popup-title">选择快捷指令</span>
        </div>
        <div class="command-list-wrapper">
          <div
            v-for="(cmd, idx) in filteredCommands"
            :key="idx"
            class="command-item"
            :class="{
              active: idx === commandIndex,
              'command-item-plugin': cmd.type === 'plugin',
            }"
            @click="confirmCommand(cmd)"
            @mouseenter="commandIndex = idx"
          >
            <span class="command-label">
              <span v-if="cmd.type === 'plugin'" class="cmd-plugin-icon">
                <i class="mio-icon mio-icon-tool"></i>
                <sup class="plugin-plus">+</sup>
              </span>
              <i
                v-else-if="cmd.type === 'tool'"
                class="mio-icon mio-icon-tool"
              ></i>
              <i
                v-else-if="cmd.type === 'skill'"
                class="mio-icon mio-icon-skill"
              ></i>
              {{ activeContactor.platform === "onebot" ? "/" : ""
              }}{{ cmd.label }}
            </span>
            <span v-if="cmd.type === 'plugin'" class="command-preset-plugin"
              >启用全组</span
            >
            <span v-else-if="cmd.hash" class="command-preset">{{
              cmd.hash
            }}</span>
            <span
              v-else-if="activeContactor.platform === 'onebot'"
              class="command-preset"
              >{{ cmd.preset }}</span
            >
          </div>
        </div>
      </div>
    </transition>

    <div class="options">
      <div class="bu-emoji">
        <emoji-picker
          v-show="showemoji"
          ref="emojiPicker"
          @emoji-click="getemoji"
        ></emoji-picker>
        <p class="ho-emoji">表情</p>
        <i class="iconfont smile" @click.prevent="ctrlEmojiPanel"></i>
      </div>
      <div class="bu-emoji">
        <p class="ho-emoji">
          {{ activeContactor.platform == "openai" ? "模型选择" : "工具选择" }}
        </p>
        <el-tree-select
          id="wraper-selector"
          v-model="selectedOption"
          :data="extraOptions"
          accordion
          placement="top-start"
          @node-click="currentChange"
        />
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
        <el-popconfirm
          class="box-item"
          title="此操作不可撤销"
          confirm-button-text="确定"
          cancel-button-text="取消"
          placement="top"
          @confirm="$emit('cleanScreen')"
        >
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
        <div
          ref="textarea"
          class="input-area"
          contenteditable="true"
          @keydown="handleKeyDown"
          @click="updateCursorPosition"
        ></div>
      </div>
      <button id="sendButton" @click.prevent="send" :disabled="isUploading">
        发送{{ getWraperName() ? ` | ${getWraperName()}` : "" }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed } from "vue";
import { client, config } from "@/lib/runtime.js";
import { debounce } from "../utils/tools.js";
import { useConfigStore } from "@/stores/configStore.js";
import { skillAPI } from "@/lib/configApi.js";
import { useInteraction } from "@/composables/useInteraction.js";

export default {
  setup(props) {
    const { activeInteraction, hasActiveInteraction, submitResponse } =
      useInteraction(computed(() => props.activeContactor?.id));
    const rejectReasonText = ref("");

    const isHighRiskCommand = (command) => {
      if (!command) return true;
      const trimmed = command.trim();

      // 1. Strip all quoted strings to avoid parsing operators or keywords inside quotes
      const stripQuotesRegex =
        /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/g;
      const commandWithoutQuotes = trimmed.replace(stripQuotesRegex, " ");

      // 2. Split by shell command separators: &&, ||, |, ;
      const subCommands = commandWithoutQuotes.split(/&&|\|\||\||;/);

      const highRiskExecutables = [
        "rm",
        "rmdir",
        "node",
        "python",
        "python3",
        "pip",
        "pip3",
        "npm",
        "yarn",
        "pnpm",
        "sh",
        "bash",
        "zsh",
        "sudo",
        "curl",
        "wget",
        "docker",
        "mv",
        "chmod",
        "chown",
        "unlink",
      ];

      for (let subCmd of subCommands) {
        subCmd = subCmd.trim();
        if (!subCmd) continue;

        // Extract first word, filtering out environment variables (e.g. PORT=3000)
        const words = subCmd
          .split(/\s+/)
          .filter((w) => !w.includes("=") && w.length > 0);
        if (words.length === 0) continue;

        // Strip parenthesis, brackets and redirection characters around the executable name
        const executable = words[0]
          .replace(/^[^a-zA-Z0-9_\-/]+|[^a-zA-Z0-9_\-/]+$/g, "")
          .toLowerCase();

        const isRisk = highRiskExecutables.some((exec) => {
          return executable === exec || executable.endsWith("/" + exec);
        });

        if (isRisk) {
          return true;
        }
      }

      return false;
    };

    const getCommandPrefix = (command) => {
      if (!command) return "";
      const trimmed = command.trim();
      const words = trimmed
        .split(/\s+/)
        .filter((w) => !w.includes("=") && w.length > 0);
      if (words.length === 0) return "";
      return words[0]
        .replace(/^[^a-zA-Z0-9_\-/]+|[^a-zA-Z0-9_\-/]+$/g, "")
        .toLowerCase();
    };

    const checkAutoApproval = (interaction) => {
      if (!interaction || interaction.actionType !== "REQUEST_APPROVAL") return;
      const command = interaction.meta?.command;
      if (!command) return;

      if (isHighRiskCommand(command)) return;

      try {
        // 1. 优先校验具体命令是否被记住免密
        const listStr =
          localStorage.getItem("mio_auto_approved_commands") || "[]";
        const list = JSON.parse(listStr);
        if (Array.isArray(list) && list.includes(command)) {
          console.log(`[Auto Approval] 自动批准具体命令: ${command}`);
          submitResponse({ approved: true });
          return;
        }

        // 2. 校验命令前缀是否被记住免密
        const prefixListStr =
          localStorage.getItem("mio_auto_approved_command_prefixes") || "[]";
        const prefixList = JSON.parse(prefixListStr);
        const prefix = getCommandPrefix(command);
        if (
          prefix &&
          Array.isArray(prefixList) &&
          prefixList.includes(prefix)
        ) {
          console.log(
            `[Auto Approval] 根据前缀 "${prefix}" 自动批准命令: ${command}`,
          );
          submitResponse({ approved: true });
        }
      } catch (err) {
        console.error("Failed to process auto-approval check:", err);
      }
    };

    const handleApproveAndRememberSpecific = () => {
      const interaction = activeInteraction.value;
      if (!interaction) return;
      const command = interaction.meta?.command;
      if (command && !isHighRiskCommand(command)) {
        try {
          const listStr =
            localStorage.getItem("mio_auto_approved_commands") || "[]";
          const list = JSON.parse(listStr);
          if (Array.isArray(list) && !list.includes(command)) {
            list.push(command);
            localStorage.setItem(
              "mio_auto_approved_commands",
              JSON.stringify(list),
            );
          }
        } catch (err) {
          console.error("Failed to save auto-approved command:", err);
        }
      }
      submitResponse({ approved: true });
    };

    const handleApproveAndRememberPrefix = () => {
      const interaction = activeInteraction.value;
      if (!interaction) return;
      const command = interaction.meta?.command;
      const prefix = getCommandPrefix(command);
      if (prefix && !isHighRiskCommand(command)) {
        try {
          const prefixListStr =
            localStorage.getItem("mio_auto_approved_command_prefixes") || "[]";
          const prefixList = JSON.parse(prefixListStr);
          if (Array.isArray(prefixList) && !prefixList.includes(prefix)) {
            prefixList.push(prefix);
            localStorage.setItem(
              "mio_auto_approved_command_prefixes",
              JSON.stringify(prefixList),
            );
          }
        } catch (err) {
          console.error("Failed to save auto-approved command prefix:", err);
        }
      }
      submitResponse({ approved: true });
    };

    watch(
      () => activeInteraction.value,
      (newVal) => {
        rejectReasonText.value = "";
        if (newVal) {
          checkAutoApproval(newVal);
        }
      },
      { immediate: true },
    );

    return {
      activeInteraction,
      hasActiveInteraction,
      submitResponse,
      rejectReasonText,
      isHighRiskCommand,
      getCommandPrefix,
      handleApproveAndRememberSpecific,
      handleApproveAndRememberPrefix,
    };
  },
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
      commandPopupStyle: {
        left: "1rem",
        bottom: "calc(100% + 4px)",
      },
    };
  },
  computed: {
    isUploading() {
      return this.activeContactor.messageChain.some((m) => m.status === 'uploading');
    },
    extraOptions() {
      if (this.activeContactor.platform == "openai") {
        return this.openaiModels;
      } else {
        return this.onebotPresets;
      }
    },
    availableCommands() {
      const list = [];
      if (this.activeContactor?.platform === "onebot") {
        const options = this.onebotPresets || [];
        options.forEach((cat) => {
          if (cat.children && Array.isArray(cat.children)) {
            cat.children.forEach((child) => {
              if (child.preset) {
                list.push({
                  type: "command",
                  label: child.label || child.value,
                  value: child.value,
                  preset: child.preset,
                });
              }
            });
          }
        });
        if (list.length === 0) {
          list.push(
            { type: "command", label: "画画", value: "draw", preset: "#画图" },
            { type: "command", label: "帮助", value: "help", preset: "#帮助" },
          );
        }
      } else if (this.activeContactor?.platform === "openai") {
        if (typeof config.llmTools === "object" && config.llmTools !== null) {
          Object.keys(config.llmTools).forEach((pluginName) => {
            const pluginTools = config.llmTools[pluginName];
            if (pluginTools && typeof pluginTools === "object") {
              const toolNames = Object.keys(pluginTools);
              if (toolNames.length > 0) {
                list.push({
                  type: "plugin",
                  label: pluginName,
                  value: pluginName,
                  preset: pluginName,
                  toolNames: toolNames,
                });
              }
              Object.keys(pluginTools).forEach((toolName) => {
                const tool = pluginTools[toolName];

                let displayName = tool.name;
                let hash = "";
                if (tool.name.includes("_mid_")) {
                  const parts = tool.name.split("_mid_");
                  displayName = parts[0];
                  hash = parts[1];
                }

                list.push({
                  type: "tool",
                  label: displayName,
                  hash: hash,
                  value: tool.name,
                  preset: tool.name,
                  description: tool.description,
                });
              });
            }
          });
        }
        const skills = this.availableSkills || [];
        skills.forEach((skill) => {
          let displayName = skill.name;
          let hash = "";
          if (skill.name.includes("_mid_")) {
            const parts = skill.name.split("_mid_");
            displayName = parts[0];
            hash = parts[1];
          }
          list.push({
            type: "skill",
            label: displayName,
            hash: hash,
            value: skill.name,
            preset: skill.name,
            description: skill.description,
          });
        });
      }
      return list;
    },
    filteredCommands() {
      if (!this.commandSearchQuery) return this.availableCommands;
      const query = this.commandSearchQuery.toLowerCase();
      return this.availableCommands.filter(
        (c) =>
          c.label.toLowerCase().includes(query) ||
          c.value.toLowerCase().includes(query) ||
          c.preset.toLowerCase().includes(query),
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
      if (newVal?.platform === "openai" && this.availableSkills.length === 0) {
        this.fetchSkills();
      }
    },
    commandSearchQuery() {
      this.commandIndex = 0;
      if (this.showCommandPopup) {
        this.updateCommandPopupPosition();
      }
    },
    showCommandPopup(newVal) {
      if (newVal) {
        this.updateCommandPopupPosition();
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
    insertReplyBadge(message) {
      if (!this.textareaRef) return;

      const existingBadge = this.textareaRef.querySelector(".reply-badge");
      if (existingBadge) {
        existingBadge.remove();
      }

      const badgeEl = document.createElement("span");
      badgeEl.className = "reply-badge";
      badgeEl.setAttribute("contenteditable", "false");
      badgeEl.setAttribute("data-reply-id", String(message.id));

      const scopeAttr = Array.from(this.textareaRef.attributes)
        .map((attr) => attr.name)
        .find((name) => name.startsWith("data-v-"));
      if (scopeAttr) {
        badgeEl.setAttribute(scopeAttr, "");
      } else if (this.$options._scopeId) {
        badgeEl.setAttribute(this.$options._scopeId, "");
      }

      const senderName = message.role === "user" ? (client.name || "我") : (this.activeContactor.name || "对方");
      let summary = "";
      if (Array.isArray(message.content)) {
        message.content.forEach((elm) => {
          if (elm.type === "text") {
            summary += elm.data.text;
          } else if (elm.type === "image") {
            summary += "[图片]";
          } else if (elm.type === "file") {
            summary += "[文件]";
          }
        });
      } else if (typeof message.content === "string") {
        summary = message.content;
      }
      summary = summary.replace(/\s+/g, " ").trim();
      if (summary.length > 20) {
        summary = summary.substring(0, 20) + "...";
      }

      badgeEl.innerHTML = `<i class="iconfont yinyong" style="margin-right: 4px; font-size: 0.85em; vertical-align: middle;"></i><span>回复 ${senderName}: ${summary}</span>`;

      this.textareaRef.insertBefore(badgeEl, this.textareaRef.firstChild || null);

      const spaceNode = document.createTextNode("\u00A0");
      this.textareaRef.insertBefore(spaceNode, badgeEl.nextSibling || null);

      this.textareaRef.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStartAfter(spaceNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);

      this.adjustTextareaHeight();
    },
    getCaretCoordinates() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;

      const range = selection.getRangeAt(0);
      let rect = range.getBoundingClientRect();

      if (!rect || (rect.width === 0 && rect.height === 0)) {
        const rects = range.getClientRects();
        if (rects && rects.length > 0) {
          rect = rects[0];
        }
      }

      if (!rect || (rect.width === 0 && rect.height === 0)) {
        const node = selection.anchorNode;
        if (node) {
          const element =
            node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
          if (element) {
            rect = element.getBoundingClientRect();
          }
        }
      }

      return rect;
    },
    updateCommandPopupPosition() {
      if (this.isMobileDevice) return;
      this.$nextTick(() => {
        const caretRect = this.getCaretCoordinates();
        const inputBar = this.$el;
        if (!caretRect || !inputBar) return;
        const inputBarRect = inputBar.getBoundingClientRect();

        let left = caretRect.left - inputBarRect.left;
        const popupWidth = 320;
        const margin = 10;
        const maxLeft = Math.max(
          margin,
          inputBarRect.width - popupWidth - margin,
        );
        left = Math.min(Math.max(margin, left), maxLeft);

        const bottom = inputBarRect.bottom - caretRect.top + 4;

        this.commandPopupStyle = {
          position: "absolute",
          left: `${left}px`,
          bottom: `${bottom}px`,
        };
      });
    },
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
      const doc = new DOMParser().parseFromString(content, "text/html");
      const hasImage = doc.querySelector("img") !== null;
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
      if (this.activeContactor.emit)
        this.activeContactor.emit("updateMessageSummary");
      client.setLocalStorage();
    },
    unsupportedTip() {
      this.$message.warning("功能暂未开放");
    },
    hasInput() {
      if (!this.textareaRef) return false;
      const clone = this.textareaRef.cloneNode(true);
      clone.querySelectorAll(".command-badge, .reply-badge").forEach((b) => b.remove());
      const hasText = clone.innerText.trim().length > 0;
      const hasImage = this.textareaRef.querySelector("img") !== null;
      const hasCommand = this.textareaRef.querySelector(".command-badge") !== null;
      return hasText || hasImage || hasCommand;
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
        imageFiles.forEach((file) => {
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
          if (fileType === "image/gif") {
            if (file.size > maxSizeByte) {
              reject(new Error(`GIF 图片不能超过 ${maxSizeMB}MB`));
              return;
            }
            const formData = new FormData();
            formData.append("image", file, file.name);
            client
              .uploadImage(formData)
              .then((upload) => {
                resolve(upload.data.url);
              })
              .catch(reject);
            return;
          }

          // Other image formats compressed via canvas
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          let mimeType, quality;
          if (fileType === "image/png") {
            mimeType = "image/png";
          } else if (fileType === "image/webp") {
            mimeType = "image/webp";
            quality = 0.7;
          } else {
            mimeType = "image/jpeg";
            quality = 0.7;
          }

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("图片压缩失败"));
                return;
              }
              if (blob.size > maxSizeByte) {
                reject(new Error(`压缩后仍超过 ${maxSizeMB}MB`));
                return;
              }
              const formData = new FormData();
              formData.append("image", blob, file.name);
              client
                .uploadImage(formData)
                .then((upload) => {
                  resolve(upload.data.url);
                })
                .catch(reject);
            },
            mimeType,
            quality,
          );
        };

        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error("图片加载失败"));
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
        const msgInChain = this.activeContactor.messageChain.find(
          (m) => m.id === container.id,
        );
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

        const msgInChain = this.activeContactor.messageChain.find(
          (m) => m.id === container.id,
        );
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
        `<span>${imageElement.outerHTML}</span>`,
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
      this.openaiModels = Object.entries(allModels).map(
        ([provider, models]) => {
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
        },
      );
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
      let openaiCmdElements = [];
      let repliedIdFromBadge = null;

      const replyBadge = this.textareaRef.querySelector(".reply-badge");
      if (replyBadge) {
        repliedIdFromBadge = replyBadge.getAttribute("data-reply-id");
      }

      const clone = this.textareaRef.cloneNode(true);
      clone.querySelectorAll(".command-badge, .reply-badge").forEach((b) => b.remove());
      const remainingText = this.getSafeText(clone.innerText).trim();

      const badges = this.textareaRef.querySelectorAll(".command-badge");
      if (badges.length > 0) {
        if (this.activeContactor.platform === "onebot") {
          const badge = badges[0];
          const preset = badge.getAttribute("data-preset");
          if (preset.includes("{xxx}")) {
            msg = preset.replace("{xxx}", remainingText);
          } else {
            msg = remainingText ? `${preset} ${remainingText}` : preset;
          }
          isCommand = true;
        } else if (this.activeContactor.platform === "openai") {
          let hasConfigChanged = false;
          badges.forEach((badge) => {
            const preset = badge.getAttribute("data-preset");
            const type = badge.getAttribute("data-type");
            const label = badge.getAttribute("data-label") || preset;

            if (type === "tool") {
              if (!this.activeContactor.options)
                this.activeContactor.options = {};
              if (!this.activeContactor.options.toolCallSettings)
                this.activeContactor.options.toolCallSettings = {};
              if (
                !Array.isArray(
                  this.activeContactor.options.toolCallSettings.tools,
                )
              )
                this.activeContactor.options.toolCallSettings.tools = [];
              if (
                !this.activeContactor.options.toolCallSettings.tools.includes(
                  preset,
                )
              ) {
                this.activeContactor.options.toolCallSettings.tools.push(
                  preset,
                );
                hasConfigChanged = true;
              }
              openaiCmdElements.push({
                type: "prompt_hint",
                data: {
                  subtype: "tool",
                  name: label,
                  prompt: `please call tool ${preset}`,
                },
              });
            } else if (type === "skill") {
              let skillToolFullNames = [];
              let terminalToolFullNames = [];
              if (
                typeof config.llmTools === "object" &&
                config.llmTools !== null
              ) {
                Object.keys(config.llmTools).forEach((pName) => {
                  const pTools = config.llmTools[pName];
                  if (pTools && typeof pTools === "object") {
                    const isTerminal = pName.toLowerCase().includes("terminal");
                    Object.keys(pTools).forEach((tName) => {
                      if (
                        tName.toLowerCase() === "skill" ||
                        tName.toLowerCase().startsWith("skill_mid_")
                      ) {
                        skillToolFullNames.push(tName);
                      }
                      if (isTerminal) {
                        terminalToolFullNames.push(tName);
                      }
                    });
                  }
                });
              }

              if (!this.activeContactor.options)
                this.activeContactor.options = {};
              if (!this.activeContactor.options.toolCallSettings)
                this.activeContactor.options.toolCallSettings = {};
              if (
                !Array.isArray(
                  this.activeContactor.options.toolCallSettings.tools,
                )
              )
                this.activeContactor.options.toolCallSettings.tools = [];

              skillToolFullNames.forEach((stName) => {
                if (
                  !this.activeContactor.options.toolCallSettings.tools.includes(
                    stName,
                  )
                ) {
                  this.activeContactor.options.toolCallSettings.tools.push(
                    stName,
                  );
                  hasConfigChanged = true;
                }
              });

              if (skillToolFullNames.length > 0) {
                terminalToolFullNames.forEach((ttName) => {
                  if (
                    !this.activeContactor.options.toolCallSettings.tools.includes(
                      ttName,
                    )
                  ) {
                    this.activeContactor.options.toolCallSettings.tools.push(
                      ttName,
                    );
                    hasConfigChanged = true;
                  }
                });
              }

              openaiCmdElements.push({
                type: "prompt_hint",
                data: {
                  subtype: "skill",
                  name: label,
                  prompt: `please call skill tool 2 load ${preset} skill`,
                },
              });
            } else if (type === "plugin") {
              const toolNamesAttr = badge.getAttribute("data-tool-names");
              const toolNames = JSON.parse(toolNamesAttr || "[]");
              if (!this.activeContactor.options)
                this.activeContactor.options = {};
              if (!this.activeContactor.options.toolCallSettings)
                this.activeContactor.options.toolCallSettings = {};
              if (
                !Array.isArray(
                  this.activeContactor.options.toolCallSettings.tools,
                )
              )
                this.activeContactor.options.toolCallSettings.tools = [];
              toolNames.forEach((tName) => {
                if (
                  !this.activeContactor.options.toolCallSettings.tools.includes(
                    tName,
                  )
                ) {
                  this.activeContactor.options.toolCallSettings.tools.push(
                    tName,
                  );
                  hasConfigChanged = true;
                }
              });
              openaiCmdElements.push({
                type: "prompt_hint",
                data: {
                  subtype: "plugin",
                  name: label,
                  prompt: "",
                },
              });
            }
          });

          if (hasConfigChanged) {
            client.setLocalStorage();
          }
          msg = remainingText;
          isCommand = true;
        }
      } else {
        msg = remainingText;
        if (this.activeContactor.platform === "onebot") {
          this.availableCommands.forEach((cmd) => {
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
        this.activeContactor.platform === "onebot" && !isCommand
          ? this.wrapText(msg)
          : msg;
      this.textareaRef.innerHTML = "";
      this.adjustTextareaHeight();
      const container = this.activeContactor.getBaseUserContainer();

      if (openaiCmdElements.length > 0) {
        openaiCmdElements.forEach((elm) => {
          container.content.push(elm);
        });
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
      if (repliedIdFromBadge) {
        const targetId = isNaN(Number(repliedIdFromBadge)) ? repliedIdFromBadge : Number(repliedIdFromBadge);
        container.content.push({
          type: "reply",
          data: { id: targetId },
        });

        const repliedMsg = this.activeContactor.messageChain.find(
          (m) => m.id === targetId || String(m.id) === String(targetId),
        );
        if (repliedMsg) {
          let plainText = "";
          if (Array.isArray(repliedMsg.content)) {
            repliedMsg.content.forEach((elm) => {
              if (elm.type === "text") {
                plainText += elm.data.text + "\n";
              } else if (elm.type === "image") {
                plainText += "[图片]\n";
              } else if (elm.type === "file") {
                plainText += "[文件]\n";
              }
            });
          } else if (typeof repliedMsg.content === "string") {
            plainText = repliedMsg.content;
          }
          if (plainText.trim()) {
            container.content.push({
              type: "prompt_hint",
              data: {
                subtype: "reply",
                prompt: `[引用消息]\n${plainText.trim()}\n`,
              },
            });
          }
        }
      }
      return container;
    },
    async send() {
      if (!this.hasInput()) return;
      this.$emit("toButtom");

      const container = this.presend();

      const localImageElements = container.content.filter(
        (elm) => elm.type === "image" && elm.data.file.startsWith("blob:"),
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

          const msgInChain = this.activeContactor.messageChain.find(
            (m) => m.id === container.id,
          );
          if (msgInChain) {
            msgInChain.status = "pending";
          }
          container.status = "pending";
          this.$emit("stroge");

          await this.activeContactor.webSend(container);
        } catch (error) {
          console.error("图片上传失败:", error);
          this.$message.error(error.message || "图片上传失败");
          const msgInChain = this.activeContactor.messageChain.find(
            (m) => m.id === container.id,
          );
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
          if (
            this.getOnebotPreset() &&
            !this.getOnebotPreset().includes("xxx")
          ) {
            this.send();
          }
        }
      }
    },
    handleKeyDown(event) {
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      if (this.showCommandPopup && this.filteredCommands.length > 0) {
        const list = this.filteredCommands;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          this.commandIndex = (this.commandIndex + 1) % list.length;
          this.scrollActiveCommandIntoView();
          return;
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          this.commandIndex =
            (this.commandIndex - 1 + list.length) % list.length;
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
      if (
        this.activeContactor?.platform !== "onebot" &&
        this.activeContactor?.platform !== "openai"
      ) {
        this.showCommandPopup = false;
        return;
      }

      const isOneBot = this.activeContactor.platform === "onebot";
      const badge = this.textareaRef.querySelector(".command-badge");

      const clone = this.textareaRef.cloneNode(true);
      clone.querySelectorAll(".command-badge").forEach((b) => b.remove());
      const textWithoutBadge = clone.innerText || clone.textContent || "";

      const occurrences = [];
      let match;
      const regex = /(?:^|\s)[/#](?!\/)/g;
      while ((match = regex.exec(textWithoutBadge)) !== null) {
        const isTriggerAtStart = match[0] === "/" || match[0] === "#";
        const slashIdx = match.index + (isTriggerAtStart ? 0 : 1);
        occurrences.push(slashIdx);
      }

      if (isOneBot) {
        if (badge && occurrences.length > 0) {
          this.$message({
            message: "指令不可重复，已自动清除先前的指令",
            type: "warning",
          });

          badge.remove();

          const text =
            this.textareaRef.innerText || this.textareaRef.textContent || "";
          const newOccurrences = [];
          let newMatch;
          const newRegex = /(?:^|\s)[/#](?!\/)/g;
          while ((newMatch = newRegex.exec(text)) !== null) {
            const isTriggerAtStart = newMatch[0] === "/" || newMatch[0] === "#";
            const slashIdx = newMatch.index + (isTriggerAtStart ? 0 : 1);
            newOccurrences.push(slashIdx);
          }

          if (newOccurrences.length === 1) {
            this.showCommandPopup = true;
            this.commandSearchQuery = text
              .substring(newOccurrences[0] + 1)
              .trim();
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
            type: "warning",
          });

          let endOfCmd = textWithoutBadge.indexOf(" ", occurrences[0]);
          if (endOfCmd === -1 || endOfCmd > occurrences[1]) {
            endOfCmd = occurrences[0] + 1;
          } else {
            endOfCmd = endOfCmd + 1;
          }

          const newText =
            textWithoutBadge.substring(0, occurrences[0]) +
            textWithoutBadge.substring(endOfCmd);
          this.updateEditorText(newText);

          const newOccurrences = [];
          let newMatch;
          const newRegex = /(?:^|\s)[/#](?!\/)/g;
          while ((newMatch = newRegex.exec(newText)) !== null) {
            const isTriggerAtStart = newMatch[0] === "/" || newMatch[0] === "#";
            const slashIdx = newMatch.index + (isTriggerAtStart ? 0 : 1);
            newOccurrences.push(slashIdx);
          }

          if (newOccurrences.length === 1) {
            this.showCommandPopup = true;
            this.commandSearchQuery = newText
              .substring(newOccurrences[0] + 1)
              .trim();
            this.commandIndex = 0;
            this.popupDismissed = false;
          } else {
            this.showCommandPopup = false;
            this.commandSearchQuery = "";
          }
          return;
        }
      }

      if (occurrences.length > 0) {
        const lastSlashIdx = occurrences[occurrences.length - 1];
        const queryStart = lastSlashIdx + 1;
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
    getPureTextOfTextNodes(container) {
      let text = "";
      const walk = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
      let textNode;
      while ((textNode = walk.nextNode())) {
        let isInsideBadge = false;
        let p = textNode.parentNode;
        while (p && p !== container) {
          if (p.classList && p.classList.contains("command-badge")) {
            isInsideBadge = true;
            break;
          }
          p = p.parentNode;
        }
        if (!isInsideBadge) {
          text += textNode.nodeValue;
        }
      }
      return text;
    },
    confirmCommand(cmd) {
      const text = this.getPureTextOfTextNodes(this.textareaRef);
      const regex = /(?:^|\s)[/#](?!\/)/g;
      let match;
      let lastSlashIdx = -1;
      let triggerChar = "/";
      while ((match = regex.exec(text)) !== null) {
        const isTriggerAtStart = match[0] === "/" || match[0] === "#";
        lastSlashIdx = match.index + (isTriggerAtStart ? 0 : 1);
        triggerChar = text.charAt(lastSlashIdx);
      }

      if (lastSlashIdx !== -1) {
        const badgeEl = document.createElement("span");
        badgeEl.className = "command-badge";
        badgeEl.setAttribute("contenteditable", "false");
        badgeEl.setAttribute("data-preset", cmd.preset);
        badgeEl.setAttribute("data-type", cmd.type || "command");

        badgeEl.setAttribute("data-label", cmd.label);

        const labelText = triggerChar + cmd.label;
        if (cmd.type === "tool") {
          badgeEl.innerHTML = `<i class="mio-icon mio-icon-tool" style="margin-right: 4px; vertical-align: middle;"></i><span>${labelText}</span>`;
        } else if (cmd.type === "skill") {
          badgeEl.innerHTML = `<i class="mio-icon mio-icon-skill" style="margin-right: 4px; vertical-align: middle;"></i><span>${labelText}</span>`;
        } else if (cmd.type === "plugin") {
          badgeEl.setAttribute(
            "data-tool-names",
            JSON.stringify(cmd.toolNames),
          );
          badgeEl.innerHTML = `<span class="cmd-plugin-icon" style="margin-right: 4px; vertical-align: middle;"><i class="mio-icon mio-icon-tool"></i><sup class="plugin-plus">+</sup></span><span>${labelText}</span>`;
        } else {
          badgeEl.innerText = labelText;
        }

        // Try to dynamically retrieve Vue's scope attribute from the container
        const scopeAttr = Array.from(this.textareaRef.attributes)
          .map((attr) => attr.name)
          .find((name) => name.startsWith("data-v-"));
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
          spaceNode,
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
    replaceTextRangeWithElements(
      container,
      startIdx,
      endIdx,
      badgeEl,
      spaceNode,
    ) {
      let currentIdx = 0;
      const walk = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
      let textNode;
      while ((textNode = walk.nextNode())) {
        let isInsideBadge = false;
        let p = textNode.parentNode;
        while (p && p !== container) {
          if (p.classList && p.classList.contains("command-badge")) {
            isInsideBadge = true;
            break;
          }
          p = p.parentNode;
        }
        if (isInsideBadge) {
          continue;
        }

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
      imgElements.forEach((img) => {
        this.textareaRef.appendChild(img);
      });
      this.setCursorToEnd(this.textareaRef);
    },
    scrollActiveCommandIntoView() {
      this.$nextTick(() => {
        const activeItem = this.$el.querySelector(".command-item.active");
        if (activeItem) {
          activeItem.scrollIntoView({ block: "nearest" });
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
        &:disabled
          background-color: #ccc
          cursor: not-allowed
          opacity: 0.8

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
      width: 12px !important
      height: 12px !important
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

.cmd-plugin-icon
  position: relative
  display: inline-flex
  align-items: center
  margin-right: 6px

  .mio-icon
    width: 12px !important
    height: 12px !important
    margin-right: 0 !important
    color: #909399
    flex-shrink: 0
    vertical-align: middle

  .plugin-plus
    position: absolute
    top: -4px
    right: -4px
    font-size: 8px
    font-weight: bold
    color: #409eff
    line-height: 1

.command-item-plugin
  background-color: #fafafa
  border-bottom: 1px dashed #ebeef5

  .command-preset-plugin
    font-size: 0.7rem
    color: #409eff
    font-weight: 500

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

  .mio-icon
    width: 11px !important
    height: 11px !important
    margin-right: 4px
    background-color: currentColor
    vertical-align: middle

.reply-preview-container
  width: 100%
  display: flex
  justify-content: space-between
  align-items: center
  background-color: rgba(0, 0, 0, 0.03)
  border-bottom: 1px solid rgba(0, 0, 0, 0.06)
  padding: 6px 10px
  box-sizing: border-box
  border-radius: 4px 4px 0 0

  @media screen and (max-width: $mobile)
    flex-basis: 100%
    padding: 6px 8px
    background-color: rgba(0, 0, 0, 0.05)
    margin: 0

  .reply-preview-content
    display: flex
    align-items: center
    overflow: hidden
    white-space: nowrap
    text-overflow: ellipsis
    flex-grow: 1
    margin-right: 8px
    text-align: left

    .reply-preview-label
      font-size: 0.8rem
      color: #999
      margin-right: 4px
      flex-shrink: 0

    .reply-preview-text
      font-size: 0.85rem
      color: #555
      overflow: hidden
      white-space: nowrap
      text-overflow: ellipsis
      width: 100%

      strong
        color: #333
        font-weight: 600

  .reply-preview-close
    width: 18px
    height: 18px
    border-radius: 50%
    background-color: rgba(0, 0, 0, 0.15)
    color: #fff
    border: none
    display: flex
    align-items: center
    justify-content: center
    cursor: pointer
    flex-shrink: 0
    padding: 0
    transition: background-color 0.2s ease
    &:hover
      background-color: rgba(0, 0, 0, 0.3)

    .close-icon
      width: 10px
      height: 10px
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

  .mio-icon
    width: 11px !important
    height: 11px !important
    margin-right: 4px !important
    background-color: currentColor !important
    vertical-align: middle !important

  .cmd-plugin-icon
    position: relative !important
    display: inline-flex !important
    align-items: center !important
    margin-right: 4px !important

    .mio-icon
      width: 11px !important
      height: 11px !important
      margin-right: 0 !important
      background-color: currentColor !important
      vertical-align: middle !important

    .plugin-plus
      position: absolute !important
      top: -4px !important
      right: -4px !important
      font-size: 8px !important
      font-weight: bold !important
      color: rgb(0, 153, 255) !important
      line-height: 1 !important

.reply-badge
  display: inline-flex !important
  align-items: center !important
  background-color: rgba(120, 120, 120, 0.15) !important
  color: inherit !important
  border: 1px solid rgba(120, 120, 120, 0.25) !important
  border-radius: 4px !important
  padding: 0 6px !important
  margin: 0 2px !important
  font-size: 0.8em !important
  font-weight: 500 !important
  height: 1.25rem !important
  line-height: 1.25rem !important
  user-select: none !important
  vertical-align: middle !important
  max-width: 220px !important
  white-space: nowrap !important
  overflow: hidden !important
  text-overflow: ellipsis !important

  i.iconfont
    font-size: 0.85em !important
    margin-right: 4px !important
    vertical-align: middle !important

  span
    overflow: hidden !important
    text-overflow: ellipsis !important
    white-space: nowrap !important

.interaction-bar
  position: absolute
  bottom: 100%
  left: 12px
  right: 12px
  background: rgba(255, 255, 255, 0.98)
  backdrop-filter: blur(10px)
  border: 1px solid rgba(0, 0, 0, 0.08)
  border-bottom: none
  border-radius: 8px 8px 0 0
  padding: 8px 12px
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04)
  display: flex
  flex-direction: column
  gap: 8px
  z-index: 99
  margin-bottom: 0px
  transform-origin: bottom

  .interaction-info
    display: flex
    align-items: center
    gap: 6px

    .interaction-prompt
      font-size: 12px
      color: #666
      font-weight: 500

  .interaction-options
    display: flex
    flex-wrap: wrap
    gap: 6px

    .command-preview-box
      width: 100%
      box-sizing: border-box
      background: #1e293b
      color: #38bdf8
      font-family: Menlo, Monaco, Consolas, "Courier New", monospace
      font-size: 11px
      padding: 6px 10px
      border-radius: 6px
      max-height: 80px
      overflow-y: auto
      word-break: break-all
      margin: 2px 0 6px 0
      border: 1px solid #334155
      text-align: left

    .interaction-btn
      padding: 4px 10px
      font-size: 11px
      font-weight: 500
      border-radius: 4px
      border: 1px solid rgba(0, 0, 0, 0.08)
      background: #fafafa
      cursor: pointer
      transition: all 0.15s ease
      color: #555

      &:hover
        background: #efefef
        color: #111
        border-color: rgba(0,0,0,0.15)

      &.approve-btn
        background: #e6f7ff
        border-color: #91d5ff
        color: #1890ff
        &:hover
          background: #1890ff
          color: #fff

      &.approve-once-btn
        background: #f6ffed
        border-color: #b7eb8f
        color: #52c41a
        &:hover
          background: #52c41a
          color: #fff

      &.reject-btn
        background: #fff1f0
        border-color: #ffa39e
        color: #f5222d
        &:hover
          background: #f5222d
          color: #fff

  .reject-reason-container
    display: flex
    align-items: center
    gap: 6px
    flex: 1

    .reason-input-inline
      border: none
      border-bottom: 1px solid rgba(0, 0, 0, 0.15)
      border-radius: 0
      padding: 2px 4px
      font-size: 11px
      flex: 1
      outline: none
      background: transparent
      transition: border-color 0.2s

      &::placeholder
        color: #bbb

      &:focus
        border-bottom-color: #ffa39e

.slide-up-enter-active, .slide-up-leave-active
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)

.slide-up-enter-from, .slide-up-leave-to
  transform: translateY(10px) scaleY(0.9)
  opacity: 0

@media (max-width: 768px)
  .slide-up-enter-from, .slide-up-leave-to
    transform: translateY(100%) !important
    opacity: 1 !important

  .interaction-bar
    position: fixed
    bottom: 0
    left: 0
    right: 0
    padding: 16px 20px
    border-radius: 12px 12px 0 0
    border: none
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15)
    overflow-y: auto
    background: #ffffff
    z-index: 2000
    display: flex
    flex-direction: column
    gap: 12px
    max-height: 80vh

    .interaction-info
      flex-shrink: 0
      margin-bottom: 4px

      .interaction-prompt
        font-size: 14px !important
        color: #333 !important
        font-weight: 600 !important

    .interaction-options
      flex-direction: column
      width: 100%
      gap: 10px !important
      flex-grow: 1

      .command-preview-box
        font-size: 12px
        max-height: 100px
        padding: 8px 12px
        margin-bottom: 8px

      .interaction-btn
        width: 100%
        box-sizing: border-box
        text-align: center
        padding: 12px 16px !important
        font-size: 13px !important
        border-radius: 8px !important
        background: transparent !important
        border: 1px solid rgba(0, 0, 0, 0.12) !important
        margin: 0 !important
        font-weight: 500

        &.approve-btn
          color: #1890ff !important
          border-color: rgba(24, 144, 255, 0.4) !important
          background: rgba(24, 144, 255, 0.02) !important
          &:active, &:hover
            background: rgba(24, 144, 255, 0.08) !important

        &.approve-once-btn
          color: #52c41a !important
          border-color: rgba(82, 196, 26, 0.4) !important
          background: rgba(82, 196, 26, 0.02) !important
          &:active, &:hover
            background: rgba(82, 196, 26, 0.08) !important

        &.reject-btn
          color: #ff4d4f !important
          border-color: rgba(255, 77, 79, 0.4) !important
          background: rgba(255, 77, 79, 0.02) !important
          &:active, &:hover
            background: rgba(255, 77, 79, 0.08) !important

      .reject-reason-container
        width: 100%
        flex-direction: column
        align-items: stretch !important
        gap: 8px !important
        margin-top: 4px

        .reject-btn
          width: 100%

        .reason-input-inline
          width: 100%
          box-sizing: border-box
          padding: 12px 14px !important
          font-size: 13px !important
          border: 1px solid rgba(0, 0, 0, 0.15) !important
          border-radius: 8px !important
          background: rgba(0, 0, 0, 0.02) !important
          margin-top: 2px
          outline: none
          &:focus
            border-color: #ff4d4f !important
            background: #fff !important
</style>
