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
                    <el-dropdown-item command="delete" style="color: #f56c6c"
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

              <div
                v-for="(element, elmIndex) of item.content"
                :key="elmIndex"
                class="inner-content"
              >
                <MdRenderer
                  v-if="element.type === 'text'"
                  :md="element.data.text"
                  :theme="'github'"
                  :isStreaming="
                    item.role === 'other' &&
                    ['pending', 'retrying'].includes(item.status) &&
                    item.content.length - 1 === elmIndex
                  "
                  :custom-plugins="mioPlugins"
                  :markdown-it-plugins="katexPluginList"
                  :markdown-it-options="mdOptions"
                  :auto-cors="corsOption"
                />
                <MdRenderer
                  v-if="element.type === 'image'"
                  :md="`![image](${element.data.file})`"
                  :custom-plugins="mioPlugins"
                  :markdown-it-plugins="katexPluginList"
                  :theme="'github'"
                  :key="element.data.file"
                  :auto-cors="corsOption"
                />
                <span v-else-if="element.type === 'reply'" />
                <ForwardMsg
                  v-else-if="element.type === 'nodes'"
                  :contactor="activeContactor"
                  :messages="element.data.messages"
                />
                <FileBlock
                  v-else-if="element.type === 'file'"
                  :file-url="element.data.file"
                />
                <span v-else-if="element.type === 'at'" />
                <span v-else-if="element.type === 'prompt_hint'" />
                <ReasonBlock
                  v-else-if="element.type === 'reason'"
                  :end-time="element.data.endTime"
                  :start-time="element.data.startTime"
                  :content="element.data.text"
                  :duration="element.data.duration"
                />
                <div
                  v-else-if="element.type === 'blank'"
                  class="blank-message"
                  style="width: 10rem; height: 28.8px; position: relative"
                >
                  <span class="blank-loader"></span>
                </div>
                <div v-else-if="element.type === 'tool_call'" class="tool-call-container-wrapper" style="width: 100%">
                  <template v-if="getToolName(element.data) === 'toolsmanager'">
                    <ActionBlock
                      iconClass="mio-icon-tool"
                      title="配置管理 (ToolsManager)"
                      :statusText="getToolsManagerStatus(element.data)"
                      :isLoading="element.data.action === 'running' || element.data.action === 'pending' || element.data.action === 'started'"
                      :isFailed="element.data.status === 'failed' || (element.data.result && element.data.result.success === false)"
                      :collapsible="!!element.data.result"
                      :defaultExpanded="isToolsManagerExpanded(elmIndex)"
                      @toggle="toggleToolsManagerDetails(elmIndex)"
                    >
                      <div class="toolsmanager-detail">
                        <template v-if="element.data.result && element.data.result.groups">
                          <!-- List action details -->
                          <div v-for="(toolsList, groupName) in element.data.result.groups" :key="groupName" class="toolsmanager-group">
                            <div class="toolsmanager-group-title">{{ groupName }}</div>
                            <div class="tools-grid-mini">
                              <div v-for="t in toolsList" :key="t.name" class="tool-state-item" :class="{ disabled: !t.enabled }">
                                <span class="tool-state-dot" :class="{ enabled: t.enabled }"></span>
                                <span class="tool-state-name">{{ t.name }}</span>
                              </div>
                            </div>
                          </div>
                        </template>
                        <template v-else-if="element.data.result && element.data.result.toggledTools">
                          <!-- Toggle action details -->
                          <div class="toggle-summary">
                            {{ element.data.result.enabled ? '已启用' : '已禁用' }}以下工具：
                          </div>
                          <div class="tools-grid-mini">
                            <div v-for="tName in element.data.result.toggledTools" :key="tName" class="tool-state-item" :class="{ disabled: !element.data.result.enabled }">
                              <span class="tool-state-dot" :class="{ enabled: element.data.result.enabled }"></span>
                              <span class="tool-state-name">{{ tName }}</span>
                            </div>
                          </div>
                        </template>
                        <template v-else-if="element.data.result">
                          <pre class="raw-result-json">{{ JSON.stringify(element.data.result, null, 2) }}</pre>
                        </template>
                      </div>
                    </ActionBlock>
                  </template>
                  <template v-else>
                    <ToolCallBar
                      :tool-call="element.data"
                      :mio-plugins="mioPlugins"
                      :katex-plugin-list="katexPluginList"
                    />
                    <div
                      v-if="element.data.outerRender && element.data.outerRender.length"
                      class="message-level-outer-render"
                    >
                      <div
                        v-for="(item, idx) in element.data.outerRender"
                        :key="idx"
                        class="outer-render-item"
                      >
                        <template v-if="item.type === 'audio'">
                          <div class="outer-render-audio-container">
                            <audio :src="item.url" controls class="outer-audio"></audio>
                          </div>
                        </template>
                        <template v-else-if="item.type === 'image'">
                          <MdRenderer
                            :md="`![image](${item.url})`"
                            :custom-plugins="mioPlugins"
                            :markdown-it-plugins="katexPluginList"
                            :theme="'github'"
                            :key="item.url"
                            class="extra-render-image"
                            :auto-cors="corsOption"
                          />
                        </template>
                        <template v-else-if="item.type === 'text'">
                          <div class="outer-render-text">{{ item.content }}</div>
                        </template>
                        <template v-else-if="item.type === 'alert'">
                          <el-alert
                            :title="item.title"
                            :type="item.alertType || 'info'"
                            :description="item.description"
                            show-icon
                            :closable="false"
                            class="outer-render-alert"
                          />
                        </template>
                        <template v-else-if="item.type === 'link'">
                          <div class="outer-render-link-container">
                            <el-link
                              :href="item.url"
                              target="_blank"
                              type="primary"
                              class="outer-render-link"
                            >
                              {{ item.text || "查看链接" }}
                            </el-link>
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>
                <ActionBlock
                  v-else-if="element.type === 'crystallize_event'"
                  iconClass="mio-icon-memory"
                  title="整理记忆"
                  :statusText="
                    element.data.status === 'running' ? '整理中' : '完成'
                  "
                  :isLoading="element.data.status === 'running'"
                  :collapsible="!!element.data.summary"
                  :defaultExpanded="isCrystallizeExpanded(elmIndex)"
                  @toggle="toggleCrystallizeDetails(elmIndex)"
                >
                  <div class="detail-section">
                    <div class="section-label">整理后记忆结晶 (XML)</div>
                    <pre class="xml-box">{{ element.data.summary }}</pre>
                  </div>
                </ActionBlock>
              </div>
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
import ForwardMsg from "@/components/ForwardMsg.vue";
import FileBlock from "@/components/FileBlock.vue";
import ToolCallBar from "@/components/ToolCallBar.vue";
import ReasonBlock from "@/components/ReasonBlock.vue";
import ActionBlock from "@/components/ActionBlock.vue";
import MdRenderer from "mio-previewer";
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

const expandedCrystallizeEvents = ref({});

const isCrystallizeExpanded = (elmIndex) => {
  const key = `${props.index}-${elmIndex}`;
  if (expandedCrystallizeEvents.value[key] === undefined) {
    // 正在整理中且有数据时，默认自动展开，让用户能够直接看到酷炫的流式打字机效果
    const element = props.item.content[elmIndex];
    if (element && element.data?.status === "running" && element.data.summary) {
      return true;
    }
    return false;
  }
  return expandedCrystallizeEvents.value[key] === true;
};

const toggleCrystallizeDetails = (elmIndex) => {
  const key = `${props.index}-${elmIndex}`;
  expandedCrystallizeEvents.value[key] = !expandedCrystallizeEvents.value[key];
};

const getToolName = (toolCall) => {
  return (toolCall.name || "").split("_mid_")[0];
};

const getToolsManagerStatus = (toolCall) => {
  if (toolCall.action === 'running' || toolCall.action === 'pending' || toolCall.action === 'started') {
    return '运行中';
  }
  if (toolCall.status === 'failed' || (toolCall.result && toolCall.result.success === false)) {
    return '失败';
  }
  return '完成';
};

const expandedToolsManagerEvents = ref({});

const isToolsManagerExpanded = (elmIndex) => {
  const key = `${props.index}-${elmIndex}`;
  if (expandedToolsManagerEvents.value[key] === undefined) {
    return false;
  }
  return expandedToolsManagerEvents.value[key] === true;
};

const toggleToolsManagerDetails = (elmIndex) => {
  const key = `${props.index}-${elmIndex}`;
  expandedToolsManagerEvents.value[key] = !expandedToolsManagerEvents.value[key];
};
</script>

<style lang="sass" scoped>
$mobile: 768px
$icon-hover: #09f



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
            background-color: rgba(0, 0, 0, 0.04)

    &.is-selected
        background-color: rgba(0, 0, 0, 0.06)

        &:hover
            background-color: rgba(0, 0, 0, 0.08)

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
            border: 2px solid #ccc
            background-color: #fff
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
                border-color: rgb(0, 153, 255)
                background-color: rgb(0, 153, 255)

            &:hover:not(.checked)
                border-color: rgb(0, 153, 255)

.message-body > .avatar
  cursor: pointer
  flex-basis: 2.65rem
  min-width: 2.65rem
  height: 2.65rem

.avatar > img
  width: 100%
  height: 100%
  border-radius: 50%

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
  background: linear-gradient(to right, rgb(255, 255, 255), rgb(0, 0, 0) 50%, transparent 50%, transparent)
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
    color: #a8abb2
    animation: rotating 2s linear infinite

.error-icon-trigger
    cursor: pointer
    display: inline-flex
    align-items: center
    justify-content: center

.error-icon
    font-size: 18px
    color: #f56c6c
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
    color: rgb(0, 153, 255) !important
    line-height: 1 !important

.detail-section
  margin-bottom: 8px
  &:last-child
    margin-bottom: 0

.section-label
  font-size: 10px
  color: #aaa
  text-transform: uppercase
  font-weight: bold
  margin-bottom: 4px

.xml-box
  font-family: "Fira Code", monospace
  font-size: 11px
  background: transparent
  color: #666
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
  background-color: rgba(0, 0, 0, 0.2)
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
    color: rgba(0, 0, 0, 0.85)
    .reply-sender-info
      color: rgba(0, 0, 0, 0.55)
    .reply-jump-arrow
      color: rgba(0, 0, 0, 0.65)

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
  background-color: #909399

  &.enabled
    background-color: #67c23a

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
