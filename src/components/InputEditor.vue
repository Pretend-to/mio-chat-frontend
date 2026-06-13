<template>
  <div class="input-bar" ref="inputBarRef">
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
        <svg
          class="lucide lucide-smile input-icon-btn"
          @click.prevent="ctrlEmojiPanel"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" x2="9.01" y1="9" y2="9" />
          <line x1="15" x2="15.01" y1="9" y2="9" />
        </svg>
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
        <svg
          class="lucide lucide-bot input-icon-btn"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      </div>
      <div class="bu-emoji">
        <p class="ho-emoji">重置人格</p>
        <svg
          class="lucide lucide-rotate-ccw input-icon-btn"
          @click="$emit('cleanHistory')"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </div>
      <div class="bu-emoji">
        <p class="ho-emoji">上传</p>
        <svg
          class="lucide lucide-upload input-icon-btn"
          @click="uploadFile"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      </div>
      <div class="bu-emoji">
        <p class="ho-emoji">清除记录</p>
        <el-popconfirm
          class="box-item"
          title="此操作不可撤销"
          confirm-button-text="确定"
          cancel-button-text="取消"
          placement="top"
          @confirm="cleanScreen"
        >
          <template #reference>
            <svg
              class="lucide lucide-trash-2 input-icon-btn"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          </template>
        </el-popconfirm>
      </div>
      <div class="bu-emoji">
        <p class="ho-emoji">更多</p>
        <svg
          class="lucide lucide-ellipsis input-icon-btn"
          @click="unsupportedTip"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
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
          @input="handleInput"
          @paste="handlePaste"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
        ></div>
      </div>
      <button id="sendButton" @click.prevent="send" :disabled="isUploading">
        发送{{ getWraperName() ? ` | ${getWraperName()}` : "" }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from "vue";
import { client } from "@/lib/runtime.js";
import { debounce } from "../utils/tools.js";
import { useConfigStore } from "@/stores/configStore.js";
import { skillAPI } from "@/lib/configApi.js";
import { ElMessage } from "element-plus";
import "emoji-picker-element";

// Import our composables
import { useInputCursorAndTextarea } from "@/composables/useInputCursorAndTextarea.js";
import { useInputDraft } from "@/composables/useInputDraft.js";
import { useInputLLMOptions } from "@/composables/useInputLLMOptions.js";
import { useInputCommandPopup } from "@/composables/useInputCommandPopup.js";
import { useInputFileUpload } from "@/composables/useInputFileUpload.js";
import { useInputInteractions } from "@/composables/useInputInteractions.js";
import { useInputSend } from "@/composables/useInputSend.js";

const props = defineProps({
  activeContactor: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["toButtom", "cleanHistory", "cleanScreen", "setModel", "stroge"]);

const activeContactor = computed(() => props.activeContactor);
const textarea = ref(null);
const inputBarRef = ref(null);
const isMobileDevice = ref(window.innerWidth < 768);
const availableSkills = ref([]);
const host = ref(window.location.origin);

// 1. Cursor and Textarea Logic
const {
  cursorPosition,
  adjustTextareaHeight,
  updateCursorPosition,
  getCaretCoordinates,
  textToHtml,
  setCursorToEnd,
  insertHtmlAtCursor,
  getPureTextOfTextNodes,
  replaceTextRangeWithElements,
  updateEditorText,
  getSafeText,
} = useInputCursorAndTextarea({ textareaRef: textarea });

// 2. LLM Options & Presets Logic
const {
  selectedOption,
  openaiModels,
  onebotPresets,
  extraOptions,
  initLLMExtraOptions,
  getOpenaiModelArray,
  getOnebotPreset,
  wrapText,
  loadSelected,
  getWraperName,
} = useInputLLMOptions({ activeContactor });
loadSelected();

// 3. Draft Logic
const {
  loadDraft,
  saveDraft,
  saveDraftTo,
  clearDraft,
} = useInputDraft({ textareaRef: textarea, activeContactor, adjustTextareaHeight });

// 4. File Upload & Emoji Logic
const {
  pendingImageFiles,
  showemoji,
  ctrlEmojiPanel,
  getemoji,
  handlePaste,
  handleDroppedFile,
  handleLocalImageInsert,
  compressAndUploadImage,
  uploadFile,
  handleFileUpload,
  uploadDocumentFile,
} = useInputFileUpload({
  textareaRef: textarea,
  activeContactor,
  insertHtmlAtCursor,
  textToHtml,
  adjustTextareaHeight,
  ElMessage,
  emit,
});

const scopeId = computed(() => {
  if (!textarea.value) return "";
  const scopeAttr = Array.from(textarea.value.attributes)
    .map((attr) => attr.name)
    .find((name) => name.startsWith("data-v-"));
  return scopeAttr || "";
});

// 5. Slash Command & Autocomplete Popup Logic
const {
  showCommandPopup,
  commandSearchQuery,
  commandIndex,
  popupDismissed,
  commandPopupStyle,
  availableCommands,
  filteredCommands,
  updateCommandPopupPosition,
  confirmCommand,
  scrollActiveCommandIntoView,
  checkSlashCommand,
  handleKeyDown: baseHandleKeyDown,
} = useInputCommandPopup({
  textareaRef: textarea,
  activeContactor,
  isMobileDevice,
  getCaretCoordinates,
  getPureTextOfTextNodes,
  replaceTextRangeWithElements,
  adjustTextareaHeight,
  updateEditorText,
  availableSkills,
  onebotPresets,
  scopeId,
  ElMessage,
});

// 6. Interaction & Approvals Logic
const {
  activeInteraction,
  hasActiveInteraction,
  submitResponse,
  rejectReasonText,
  isHighRiskCommand,
  getCommandPrefix,
  handleApproveAndRememberSpecific,
  handleApproveAndRememberPrefix,
} = useInputInteractions({ activeContactor });

// 7. Message Format and Sending Logic
const {
  hasInput,
  isUploading,
  presend,
  send,
} = useInputSend({
  textareaRef: textarea,
  activeContactor,
  pendingImageFiles,
  compressAndUploadImage,
  clearDraft,
  adjustTextareaHeight,
  getSafeText,
  availableCommands,
  wrapText,
  ElMessage,
  emit,
});

const handleKeyDown = (event) => {
  const isHandled = baseHandleKeyDown(event, inputBarRef.value || textarea.value?.closest(".input-bar"), send);
  if (isHandled) return;

  setTimeout(() => {
    updateCursorPosition();
  }, 0);
};

const debouncedAdjustHeight = debounce(adjustTextareaHeight, 100);

const handleInput = (e) => {
  debouncedAdjustHeight();
  checkSlashCommand(e);
};

const handleDragOver = () => {
  if (textarea.value) {
    textarea.value.style.backgroundColor = "var(--mio-bg-hover)";
  }
};

const handleDragLeave = () => {
  if (textarea.value) {
    textarea.value.style.backgroundColor = "";
  }
};

const handleDrop = (e) => {
  if (textarea.value) {
    textarea.value.style.backgroundColor = "";
  }
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    handleDroppedFile(files[0]);
  }
};

const unsupportedTip = () => {
  ElMessage.info("暂未支持");
};

const insertReplyBadge = (message) => {
  if (!textarea.value) return;

  const existingBadge = textarea.value.querySelector(".reply-badge");
  if (existingBadge) {
    existingBadge.remove();
  }

  const badgeEl = document.createElement("span");
  badgeEl.className = "reply-badge";
  badgeEl.setAttribute("contenteditable", "false");
  badgeEl.setAttribute("data-reply-id", String(message.id));

  if (scopeId.value) {
    badgeEl.setAttribute(scopeId.value, "");
  }

  const senderName = message.role === "user" ? (client.name || "我") : (activeContactor.value?.name || "对方");
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

  textarea.value.insertBefore(badgeEl, textarea.value.firstChild || null);

  const spaceNode = document.createTextNode("\u00A0");
  textarea.value.insertBefore(spaceNode, badgeEl.nextSibling || null);

  textarea.value.focus();
  const range = document.createRange();
  const sel = window.getSelection();
  range.setStartAfter(spaceNode);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);

  adjustTextareaHeight();
};

defineExpose({
  insertReplyBadge,
});

const currentChange = (data, event) => {
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
    ElMessage({
      message: "已切换到 " + selectedValues[2] + " 模型",
      type: "success",
    });
    const seletedProvider = selectedValues[0];
    if (seletedProvider !== activeContactor.value.options?.provider) {
      ElMessage({
        message: "已切换到 " + seletedProvider + " 协议",
        type: "success",
      });
    }
    emit("setModel", selectedValues);
  } else if (event.level === 2) {
    if (activeContactor.value.platform === "onebot") {
      if (getOnebotPreset() && !getOnebotPreset().includes("xxx")) {
        send();
      }
    }
  }
};

const cleanScreen = () => {
  emit("cleanScreen");
};

const clickOutsideHandler = ref(null);
const resizeHandler = ref(null);

onMounted(() => {
  textarea.value = textarea.value || document.querySelector("div[contenteditable]");
  loadDraft();

  resizeHandler.value = () => {
    isMobileDevice.value = window.innerWidth < 768;
  };
  window.addEventListener("resize", resizeHandler.value);

  const configStore = useConfigStore();
  if (!configStore.config) {
    configStore.fetchConfig().catch((err) => {
      console.error("Failed to load config in InputEditor:", err);
    });
  }

  clickOutsideHandler.value = (e) => {
    if (showCommandPopup.value) {
      const isClickInside = textarea.value?.closest(".input-bar")?.contains(e.target);
      if (!isClickInside) {
        showCommandPopup.value = false;
      }
    }
  };
  document.addEventListener("click", clickOutsideHandler.value);

  if (activeContactor.value?.platform === "openai") {
    fetchSkills();
  }
});

onUnmounted(() => {
  if (resizeHandler.value) {
    window.removeEventListener("resize", resizeHandler.value);
  }
  if (clickOutsideHandler.value) {
    document.removeEventListener("click", clickOutsideHandler.value);
  }
  saveDraft();
});

const fetchSkills = async () => {
  try {
    const res = await skillAPI.getSkills();
    if (res.success) {
      availableSkills.value = res.data || [];
    }
  } catch (err) {
    console.error("加载技能列表失败:", err);
  }
};

watch(
  () => activeContactor.value,
  (newVal, oldVal) => {
    if (oldVal) {
      saveDraftTo(oldVal);
    }
    if (textarea.value) textarea.value.innerHTML = "";
    loadSelected();
    loadDraft();
    if (newVal?.platform === "openai" && availableSkills.value.length === 0) {
      fetchSkills();
    }
  },
);

watch(
  () => commandSearchQuery.value,
  () => {
    commandIndex.value = 0;
    if (showCommandPopup.value) {
      updateCommandPopupPosition();
    }
  },
);

watch(
  () => showCommandPopup.value,
  (newVal) => {
    if (newVal) {
      updateCommandPopupPosition();
    }
  },
);
</script>

<style lang="sass" scoped>
$mobile: 768px

i:hover, .input-icon-btn:hover
  color: var(--mio-color-primary)

.input-bar
  position: relative
  flex-shrink: 0
  display: flex
  flex-direction: column
  border: 0 solid var(--mio-border-color)
  flex-basis: 11rem
  @media (max-width: $mobile)
    flex-basis: calc(7rem + 1rem + env(safe-area-inset-bottom, 0px))
    width: 100%
    flex-direction: column-reverse
    position: fixed
    bottom: 0
    z-index: 1000
    background-color: var(--mio-bg-statusbar-friendlist)
    border-top: 1px solid var(--mio-border-color-light)
    padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px))
    i, .input-icon-btn
      color: var(--mio-text-primary)

  .options
    display: flex
    border-top: 0.0625rem solid var(--mio-border-color-light)
    padding: 0.25rem 0.5rem
    @media (max-width: $mobile)
      border: none
      justify-content: space-around
      position: relative
      z-index: 10
      background-color: transparent

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
    background-color: var(--mio-bg-card)
    border: none
    box-shadow: 0 .125rem .25rem #0003
    position: absolute
    top: 80%
    left: 50%
    transform: translate(-60%)
i, .input-icon-btn
  display: block
  padding: 0.25rem 0.5rem 0 0
  font-size: 1.25rem
  width: 2rem
  height: 1.75rem
  box-sizing: border-box
  color: var(--mio-text-regular)
  cursor: pointer
  transition: color var(--mio-transition-fast)

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
      background-color: transparent

    .input-content
      flex-wrap: wrap
      display: flex
      background-color: var(--mio-bg-page)
      border: 0
      flex-grow: 1
      width: 100%

      @media screen and (max-width: $mobile)
        margin: 0.5rem 0.5rem 0.8rem 0
        min-height: 2rem
        flex-basis: calc( 100% - 4rem )
        max-width: calc( 100% - 4rem )
        flex-grow: 0
        background-color: var(--mio-bg-card)

      .input-area
        overflow-y: auto
        max-height: 20rem
        resize: none
        font-size: 1rem
        background-color: var(--mio-bg-page)
        color: var(--mio-text-primary)
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
          background-color: var(--mio-bg-card)
          margin: 0.2rem
          caret-color: var(--mio-color-primary)

    button
        white-space: nowrap
        color: #ffffff
        border-radius: .3125rem
        border: 0
        background-color: var(--mio-color-primary)
        padding: .25rem 1rem
        margin-bottom: .8rem
        margin-right: .5rem
        cursor: pointer
        &:disabled
          background-color: var(--mio-border-color)
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
  background-color: var(--mio-bg-card)
  border: 1px solid var(--mio-border-color-light)
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
  background-color: var(--mio-bg-card)
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
  border-bottom: 1px solid var(--mio-border-color-light)
  background-color: var(--mio-bg-hover)
  flex-shrink: 0

  .popup-title
    font-size: 0.85rem
    font-weight: bold
    color: var(--mio-text-primary)

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
  border-bottom: 1px solid var(--mio-border-color-lighter)
  cursor: pointer
  transition: all 0.15s ease
  gap: 0.5rem

  &:last-child
    border-bottom: none

  &.active
    background-color: var(--mio-bg-active)

  .command-label
    font-size: 0.8rem
    font-weight: 600
    color: var(--mio-text-primary)
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
      color: var(--mio-text-secondary)
      flex-shrink: 0
      vertical-align: middle

  .command-preset
    font-size: 0.75rem
    color: var(--mio-text-secondary)
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
    color: var(--mio-text-secondary)
    flex-shrink: 0
    vertical-align: middle

  .plugin-plus
    position: absolute
    top: -4px
    right: -4px
    font-size: 8px
    font-weight: bold
    color: var(--mio-color-primary)
    line-height: 1

.command-item-plugin
  background-color: var(--mio-bg-hover)
  border-bottom: 1px dashed var(--mio-border-color-light)

  .command-preset-plugin
    font-size: 0.7rem
    color: var(--mio-color-primary)
    font-weight: 500

.command-badge
  display: inline-flex
  align-items: center
  background-color: var(--mio-bg-active)
  color: var(--mio-color-primary)
  border: 1px solid var(--mio-border-color-light)
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
  background-color: var(--mio-bg-hover)
  border-bottom: 1px solid var(--mio-border-color-light)
  padding: 6px 10px
  box-sizing: border-box
  border-radius: 4px 4px 0 0

  @media screen and (max-width: $mobile)
    flex-basis: 100%
    padding: 6px 8px
    background-color: var(--mio-bg-hover)
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
      color: var(--mio-text-secondary)
      margin-right: 4px
      flex-shrink: 0

    .reply-preview-text
      font-size: 0.85rem
      color: var(--mio-text-regular)
      overflow: hidden
      white-space: nowrap
      text-overflow: ellipsis
      width: 100%

      strong
        color: var(--mio-text-primary)
        font-weight: 600

  .reply-preview-close
    width: 18px
    height: 18px
    border-radius: 50%
    background-color: var(--mio-bg-hover)
    color: var(--mio-text-primary)
    border: none
    display: flex
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition: background-color 0.2s ease;
    &:hover
      background-color: var(--mio-bg-active)

    .close-icon
      width: 10px
      height: 10px
</style>

<style lang="sass">
.command-badge
  display: inline-flex !important
  align-items: center !important
  background-color: var(--mio-bg-active) !important
  color: var(--mio-color-primary) !important
  border: 1px solid var(--mio-border-color-light) !important
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
      color: var(--mio-color-primary) !important
      line-height: 1 !important

.reply-badge
  display: inline-flex !important
  align-items: center !important
  background-color: var(--mio-bg-hover) !important
  color: inherit !important
  border: 1px solid var(--mio-border-color-light) !important
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
  background: var(--mio-bg-blur)
  backdrop-filter: blur(10px)
  border: 1px solid var(--mio-border-color-light)
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
      color: var(--mio-text-regular)
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
      border: 1px solid var(--mio-border-color-light)
      background: var(--mio-bg-hover)
      cursor: pointer
      transition: all 0.15s ease
      color: var(--mio-text-regular)

      &:hover
        background: var(--mio-bg-active)
        color: var(--mio-text-primary)
        border-color: var(--mio-border-color)

      &.approve-btn
        background: #e6f7ff
        border-color: #91d5ff
        color: var(--mio-color-primary)
        &:hover
          background: var(--mio-color-primary)
          color: #fff

      &.approve-once-btn
        background: #f6ffed
        border-color: #b7eb8f
        color: var(--mio-color-success)
        &:hover
          background: var(--mio-color-success)
          color: #fff

      &.reject-btn
        background: #fff1f0
        border-color: #ffa39e
        color: var(--mio-color-danger)
        &:hover
          background: var(--mio-color-danger)
          color: #fff

  .reject-reason-container
    display: flex
    align-items: center
    gap: 6px
    flex: 1

    .reason-input-inline
      border: none
      border-bottom: 1px solid var(--mio-border-color-light)
      border-radius: 0
      padding: 2px 4px
      font-size: 11px
      flex: 1
      outline: none
      background: transparent
      transition: border-color 0.2s

      &::placeholder
        color: var(--mio-text-placeholder)

      &:focus
        border-bottom-color: var(--mio-color-danger)

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
    background: var(--mio-bg-card)
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
        color: var(--mio-text-primary) !important
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
        border: 1px solid var(--mio-border-color-light) !important
        margin: 0 !important
        font-weight: 500

        &.approve-btn
          color: var(--mio-color-primary) !important
          border-color: rgba(24, 144, 255, 0.4) !important
          background: rgba(24, 144, 255, 0.02) !important
          &:active, &:hover
            background: rgba(24, 144, 255, 0.08) !important

        &.approve-once-btn
          color: var(--mio-color-success) !important
          border-color: rgba(82, 196, 26, 0.4) !important
          background: rgba(82, 196, 26, 0.02) !important
          &:active, &:hover
            background: rgba(82, 196, 26, 0.08) !important

        &.reject-btn
          color: var(--mio-color-danger) !important
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
          border: 1px solid var(--mio-border-color-light) !important
          border-radius: 8px !important
          background: rgba(0, 0, 0, 0.02) !important
          margin-top: 2px
          outline: none
          &:focus
            border-color: var(--mio-color-danger) !important
            background: var(--mio-bg-card) !important
</style>
