<template>
  <div
    class="message-container"
    :class="{ 'opening-message': isOpening }"
    :data-id="item.id"
  >
    <div v-if="showTimeInfo && showTimeInfo.show" class="message-time">
      {{ showTimeInfo.time }}
    </div>
    <div
      class="message-flex-wrapper"
      :class="{
        'is-multi-select': isMultiSelect && item.role !== 'mio_system',
        'is-selected': isMultiSelect && isSelected,
      }"
      @click="$emit('click-message', item)"
    >
      <transition name="checkbox-fade">
        <div
          v-if="isMultiSelect && item.role !== 'mio_system'"
          class="multi-select-box"
        >
          <div
            class="round-checkbox"
            :class="{ checked: isSelected }"
            @click.stop="$emit('toggle-checkbox', item.id)"
          >
            <svg
              v-if="isSelected"
              viewBox="0 0 12 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polyline
                points="1,5 4.5,8.5 11,1"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
      </transition>

      <div
        :id="item.role"
        class="message-body"
        :style="{ pointerEvents: isMultiSelect ? 'none' : 'auto' }"
      >
        <div v-if="item.role !== 'mio_system'" class="avatar">
          <img
            v-if="item.role === 'other'"
            :src="activeContactor.avatar"
            :alt="activeContactor.name"
            :crossorigin="isExternal(activeContactor.avatar) ? 'anonymous' : undefined"
            @click="$emit('to-profile')"
          />
          <img
            v-else
            :src="client.avatar"
            :alt="client.name"
            :crossorigin="isExternal(client.avatar) ? 'anonymous' : undefined"
          />
        </div>
        <div v-if="item.role !== 'mio_system'" class="msg">
          <div class="wholename">
            <div
              v-if="
                item.role === 'other' ? activeContactor.title : client.title
              "
              class="title"
            >
              {{ item.role === "other" ? activeContactor.title : client.title }}
            </div>
            <div class="name">
              {{ item.role === "other" ? activeContactor.name : client.name }}
              <span
                v-if="item.triggerType === 'task'"
                class="task-name-tag"
              >计划</span>
            </div>
          </div>
          <div
            class="message-bubble-wrapper"
            :class="{ 'is-user': item.role === 'user' }"
          >
            <div
              v-if="
                item.role === 'user' &&
                ['pending', 'failed', 'uploading'].includes(item.status)
              "
              class="message-status-indicator"
            >
              <el-icon
                v-if="item.status === 'pending' || item.status === 'uploading'"
                class="loading-spinner"
                ><Loading
              /></el-icon>

              <el-dropdown
                v-else-if="item.status === 'failed'"
                trigger="click"
                @command="handleCommand"
              >
                <span class="error-icon-trigger">
                  <el-icon class="error-icon"><Warning /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="retry"
                      >重新发送</el-dropdown-item
                    >
                    <el-dropdown-item command="delete" style="color: var(--mio-color-danger)"
                      >删除消息</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <div
              :class="['content', item.status, { 'is-pinned': item.isPinned }]"
              @mouseup="$emit('mouseup-content', $event)"
              @contextmenu="$emit('contextmenu-content', $event, index)"
              @touchstart="$emit('touchstart-content', $event, index)"
              @dblclick="$emit('contextmenu-content', $event, index)"
            >
              <div
                v-if="item.isPinned"
                class="pinned-badge"
                title="已钉住此消息"
              >
                <el-icon><CollectionTag /></el-icon>
              </div>

              <!-- 引用预览块 -->
              <template v-for="(element, elmIndex) of item.content" :key="'reply-' + elmIndex">
                <div
                  v-if="element.type === 'reply'"
                  class="reply-bubble-preview"
                  @click.stop="jumpToMessage(element.data.id)"
                >
                  <div class="reply-preview-header">
                    <span class="reply-sender-info">
                      {{ getRepliedMsgInfo(element.data.id).senderName }} &nbsp;{{ getRepliedMsgInfo(element.data.id).timeText }}
                    </span>
                    <span class="reply-jump-arrow">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="arrow-icon">
                        <line x1="12" y1="19" x2="12" y2="5"></line>
                        <polyline points="5 12 12 5 19 12"></polyline>
                      </svg>
                    </span>
                  </div>
                  <div class="reply-preview-body">
                    {{ getRepliedMsgInfo(element.data.id).bodyText }}
                  </div>
                </div>
              </template>

              <MessageContent
                :content="item.content"
                :contactor="activeContactor"
                :isStreaming="
                  item.role === 'other' &&
                  ['pending', 'retrying'].includes(item.status)
                "
                :messageIndex="index"
                :mioPlugins="mioPlugins"
                :katexPluginList="katexPluginList"
                :mdOptions="mdOptions"
              />
            </div>
          </div>
        </div>
        <div v-else class="system-message">
          <div class="system-message-content">
            {{ item.content[0].data.text }}
          </div>
          <div class="system-message-button">
            <i
              class="iconfont close"
              @click="$emit('delete-system', index)"
            ></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { client } from "@/lib/runtime.js";
import MessageContent from "@/components/chat/MessageContent.vue";
import { ElMessage } from "element-plus";

import { Loading, Warning, CollectionTag } from "@element-plus/icons-vue";

const corsOption = computed(() => {
  const domains = [];
  const storage = client.config?.baseConfig?.storage_config;
  if (storage && storage.type === 's3') {
    if (storage.baseUrl) {
      try {
        domains.push(new URL(storage.baseUrl).hostname);
      } catch (e) {
        domains.push(storage.baseUrl);
      }
    }
    if (storage.endpoint) {
      try {
        domains.push(new URL(storage.endpoint).hostname);
      } catch (e) {
        domains.push(storage.endpoint);
      }
    }
  }
  return domains.length > 0 ? domains : false;
});

const isExternal = (url) => {
  if (!url) return false;
  const isOuter = (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) && !url.includes(window.location.host);
  if (!isOuter) return false;

  const option = corsOption.value;
  if (Array.isArray(option)) {
    return option.some(domain => url.includes(domain));
  }
  return option === true;
};

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  activeContactor: {
    type: Object,
    required: true,
  },
  isMultiSelect: {
    type: Boolean,
    default: false,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
  isOpening: {
    type: Boolean,
    default: false,
  },
  showTimeInfo: {
    type: Object,
    default: () => ({ show: false, time: "" }),
  },
  mioPlugins: {
    type: Array,
    required: true,
  },
  katexPluginList: {
    type: Array,
    required: true,
  },
  mdOptions: {
    type: Object,
    required: true,
  },
  updateTrigger: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits([
  "click-message",
  "toggle-checkbox",
  "to-profile",
  "mouseup-content",
  "contextmenu-content",
  "touchstart-content",
  "delete-system",
  "retry-message",
  "delete-message",
]);

const handleCommand = (command) => {
  if (command === "retry") {
    emit("retry-message", props.item);
  } else if (command === "delete") {
    emit("delete-message", props.item);
  }
};

const getReplyText = (id) => {
  let content = "";
  const message = props.activeContactor.messageChain.find(
    (item) => item.id === id || String(item.id) === String(id),
  );
  if (message) {
    message.content.forEach((element) => {
      if (element.type === "text") {
        content += element.data.text;
      } else if (element.type === "image") {
        content += "[图片]";
      }
    });
    return content.trim().slice(0, 20);
  } else {
    return "[消息已删除] ";
  }
};

const getRepliedMsgInfo = (id) => {
  const repliedMsg = props.activeContactor.messageChain.find(
    (item) => item.id === id || String(item.id) === String(id),
  );
  if (!repliedMsg) {
    return {
      senderName: "未知",
      timeText: "",
      bodyText: "[消息已删除]",
      exists: false,
    };
  }

  const senderName = repliedMsg.role === "user" ? client.name : props.activeContactor.name;

  let timeText = "";
  if (repliedMsg.time) {
    const d = new Date(repliedMsg.time);
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    timeText = `${hrs}:${mins}`;
  }

  let bodyText = "";
  if (Array.isArray(repliedMsg.content)) {
    repliedMsg.content.forEach((element) => {
      if (element.type === "text") {
        bodyText += element.data.text;
      } else if (element.type === "image") {
        bodyText += "[图片] ";
      } else if (element.type === "file") {
        bodyText += "[文件] ";
      }
    });
  } else if (typeof repliedMsg.content === "string") {
    bodyText = repliedMsg.content;
  }

  return {
    senderName,
    timeText,
    bodyText: bodyText.trim(),
    exists: true,
  };
};

const jumpToMessage = (id) => {
  client.emit("scroll_to_message", id);
};


</script>

<style lang="sass" scoped>
$mobile: 768px

.message-flex-wrapper
    display: flex
    align-items: flex-start
    width: 100%
    position: relative
    transition: background-color 0.15s

    .message-body
        flex: 1
        min-width: 0
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)
        transform: translateX(0)

    &.is-multi-select
        cursor: pointer

        & > #other.message-body
            transform: translateX(1.75rem)

        &:hover
            background-color: var(--mio-bg-hover)

    &.is-selected
        background-color: var(--mio-bg-active)

        &:hover
            background-color: var(--mio-bg-active)

    .checkbox-fade-enter-active, .checkbox-fade-leave-active
        transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)

    .checkbox-fade-enter-from, .checkbox-fade-leave-to
        opacity: 0 !important

    .multi-select-box
        position: absolute
        left: 0.5rem
        top: 50%
        transform: translateY(-50%)
        width: 1rem
        height: 1rem
        display: flex
        align-items: center
        justify-content: center
        flex-shrink: 0

        .round-checkbox
            width: 1rem
            height: 1rem
            border-radius: 50%
            border: 2px solid var(--mio-border-color)
            background-color: var(--mio-bg-card)
            display: flex
            align-items: center
            justify-content: center
            cursor: pointer
            transition: border-color 0.15s, background-color 0.15s
            flex-shrink: 0

            svg
                width: 0.7rem
                height: 0.7rem
                display: block

            &.checked
                border-color: var(--mio-color-primary)
                background-color: var(--mio-color-primary)

            &:hover:not(.checked)
                border-color: var(--mio-color-primary)

.message-body > .avatar
  cursor: pointer
  flex-basis: 2.65rem
  min-width: 2.65rem
  height: 2.65rem
  border-radius: 50%
  overflow: hidden
  background-color: #f2f2f2

.avatar > img
  width: 100%
  height: 100%

.inner-content
  display: flex
  flex-direction: column
  width: 100%

  & > *
    margin: 2px 0

@keyframes move
  0%
    left: -20%
  100%
    left: 120%

.blank-loader
  width: 10%
  height: 200%
  position: absolute
  background: linear-gradient(to right, var(--mio-bg-card), var(--mio-text-primary) 50%, transparent 50%, transparent)
  top: -50%
  transform: rotate(30deg)
  filter: blur(5px)
  animation: move 1s linear infinite

.message-bubble-wrapper
    display: flex
    align-items: center
    width: 100%
    &.is-user
        justify-content: flex-end
    &:not(.is-user)
        justify-content: flex-start

.message-status-indicator
    display: flex
    align-items: center
    justify-content: center
    margin: 0 8px
    flex-shrink: 0

.loading-spinner
    font-size: 16px
    color: var(--mio-text-placeholder)
    animation: rotating 2s linear infinite

.error-icon-trigger
    cursor: pointer
    display: inline-flex
    align-items: center
    justify-content: center

.error-icon
    font-size: 18px
    color: var(--mio-color-danger)
    transition: transform 0.2s ease
    &:hover
        transform: scale(1.15)

@keyframes rotating
    from
        transform: rotate(0deg)
    to
        transform: rotate(360deg)

.cmd-plugin-icon
  position: relative !important
  display: inline-flex !important
  align-items: center !important

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

.detail-section
  margin-bottom: 8px
  &:last-child
    margin-bottom: 0

.section-label
  font-size: 10px
  color: var(--mio-text-secondary)
  text-transform: uppercase
  font-weight: bold
  margin-bottom: 4px

.xml-box
  font-family: "Fira Code", monospace
  font-size: 11px
  background: transparent
  color: var(--mio-text-regular)
  white-space: pre-wrap
  word-break: break-all
  margin: 0
  padding: 0

.message-level-outer-render
  margin-top: 8px
  display: flex
  flex-direction: column
  gap: 8px
  width: 100%

  .outer-render-item
    width: 100%
    display: flex
    flex-direction: column

  .outer-render-audio-container
    margin: 6px 0
    display: flex
    align-items: center
    width: 100%

  .outer-audio
    width: 100%
    max-width: 320px
    height: 30px
    border-radius: 15px
    outline: none
    background-color: var(--el-fill-color-blank)
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04)

  .extra-render-image
    width: 100%

  .outer-render-link-container
    display: inline-flex
    align-items: center
    gap: 6px
    padding: 8px 12px
    background-color: var(--el-fill-color-light)
    border-radius: 6px
    border: 1px solid var(--el-border-color-lighter)
    align-self: flex-start

  .outer-render-alert
    width: 100%
    border-radius: 6px

  .outer-render-text
    padding: 8px 12px
    background-color: var(--el-fill-color-light)
    border-left: 3px solid var(--el-color-primary)
    border-radius: 0 6px 6px 0
    font-size: 13px
    color: var(--el-text-color-regular)
    white-space: pre-wrap

.reply-bubble-preview
  background-color: var(--mio-bg-hover)
  border-radius: 6px
  padding: 6px 10px
  margin-bottom: 6px
  font-size: 0.75rem
  cursor: pointer
  display: flex
  flex-direction: column
  gap: 4px
  width: 100%
  box-sizing: border-box
  transition: opacity 0.2s ease
  text-align: left

  &:hover
    opacity: 0.85

  .reply-preview-header
    display: flex
    justify-content: space-between
    align-items: center
    font-weight: 500

    .reply-sender-info
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis

    .reply-jump-arrow
      display: inline-flex
      align-items: center
      justify-content: center
      cursor: pointer
      border-top: 1.5px solid currentColor

      .arrow-icon
        width: 12px
        height: 12px

  .reply-preview-body
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    width: 100%

#user
  .reply-bubble-preview
    color: rgba(255, 255, 255, 0.95)
    .reply-sender-info
      color: rgba(255, 255, 255, 0.75)
    .reply-jump-arrow
      color: rgba(255, 255, 255, 0.85)

#other
  .reply-bubble-preview
    color: var(--mio-text-primary)
    .reply-sender-info
      color: var(--mio-text-secondary)
    .reply-jump-arrow
      color: var(--mio-text-secondary)

.toolsmanager-detail
  display: flex
  flex-direction: column
  gap: 12px
  width: 100%
  font-size: 13px
  color: var(--el-text-color-regular)
  margin-top: 4px

.toolsmanager-group
  display: flex
  flex-direction: column
  gap: 6px

.toolsmanager-group-title
  font-weight: 600
  font-size: 12px
  color: var(--el-text-color-secondary)
  border-bottom: 1px solid var(--el-border-color-lighter)
  padding-bottom: 4px
  margin-bottom: 4px

.tools-grid-mini
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))
  gap: 6px

.tool-state-item
  display: flex
  align-items: center
  gap: 6px
  padding: 4px 8px
  border-radius: 4px
  background-color: var(--el-fill-color-light)
  border: 1px solid var(--el-border-color-lighter)
  font-size: 12px

  &.disabled
    opacity: 0.6
    background-color: var(--el-fill-color-lighter)

.tool-state-dot
  width: 6px
  height: 6px
  border-radius: 50%
  background-color: var(--mio-text-secondary)

  &.enabled
    background-color: var(--mio-color-success)

.tool-state-name
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  color: var(--el-text-color-primary)

.toggle-summary
  font-weight: 500
  font-size: 12px
  color: var(--el-text-color-regular)

.raw-result-json
  font-family: monospace
  font-size: 11px
  background-color: var(--el-fill-color-light)
  padding: 8px
  border-radius: 4px
  margin: 0
  overflow-x: auto
</style>
