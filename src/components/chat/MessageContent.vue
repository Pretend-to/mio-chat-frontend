<template>
  <div
    v-for="(element, elmIndex) of content"
    :key="elmIndex"
    class="inner-content"
  >
    <MdRenderer
      v-if="element.type === 'text'"
      :md="element.data.text"
      :theme="'github'"
      :isStreaming="isStreaming && content.length - 1 === elmIndex"
      :custom-plugins="mioPlugins"
      :markdown-it-plugins="katexPluginList"
      :markdown-it-options="mdOptions"
      :auto-cors="corsOption"
    />
    <MdRenderer
      v-else-if="element.type === 'image'"
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
      :contactor="contactor"
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
          v-if="outerItems(element.data).length"
          class="message-level-outer-render"
        >
          <div
            v-for="(item, idx) in outerItems(element.data)"
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
</template>

<script setup>
import { computed, ref, defineAsyncComponent } from "vue";
import { client } from "@/lib/runtime.js";
import ToolCallBar from "@/components/ToolCallBar.vue";
import ReasonBlock from "@/components/ReasonBlock.vue";
import ActionBlock from "@/components/ActionBlock.vue";
import FileBlock from "@/components/FileBlock.vue";
import MdRenderer from "mio-previewer";

// Resolve circular dependency by dynamically importing ForwardMsg
const ForwardMsg = defineAsyncComponent(() => import("@/components/ForwardMsg.vue"));

const props = defineProps({
  content: {
    type: Array,
    required: true,
  },
  contactor: {
    type: Object,
    required: true,
  },
  isStreaming: {
    type: Boolean,
    default: false,
  },
  messageIndex: {
    type: Number,
    required: true,
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
});

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
  const key = `${props.messageIndex}-${elmIndex}`;
  if (expandedToolsManagerEvents.value[key] === undefined) {
    return false;
  }
  return expandedToolsManagerEvents.value[key] === true;
};

const toggleToolsManagerDetails = (elmIndex) => {
  const key = `${props.messageIndex}-${elmIndex}`;
  expandedToolsManagerEvents.value[key] = !expandedToolsManagerEvents.value[key];
};

const expandedCrystallizeEvents = ref({});

const isCrystallizeExpanded = (elmIndex) => {
  const key = `${props.messageIndex}-${elmIndex}`;
  if (expandedCrystallizeEvents.value[key] === undefined) {
    const element = props.content[elmIndex];
    if (element && element.data?.status === "running" && element.data.summary) {
      return true;
    }
    return false;
  }
  return expandedCrystallizeEvents.value[key] === true;
};

const toggleCrystallizeDetails = (elmIndex) => {
  const key = `${props.messageIndex}-${elmIndex}`;
  expandedCrystallizeEvents.value[key] = !expandedCrystallizeEvents.value[key];
};

function outerItems(data) {
  const extra = data.extraRender || [];
  return extra.filter(r => r.placement === 'outer');
}
</script>

<style lang="sass" scoped>
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
</style>
