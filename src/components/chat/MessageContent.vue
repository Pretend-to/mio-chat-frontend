<template>
  <div
    v-for="(element, elmIndex) of content"
    :key="
      element.data?.id
        ? `${element.type}-${element.data.id}`
        : `${element.type}-${elmIndex}`
    "
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
    <div
      v-else-if="element.type === 'image'"
      class="image-slot"
      :class="{ 'is-sized': !!imageSizeOf(element) }"
      :style="imageSlotStyle(element)"
    >
      <MdRenderer
        :md="`![image](${element.data.file})`"
        :custom-plugins="mioPlugins"
        :markdown-it-plugins="katexPluginList"
        :theme="'github'"
        :key="element.data.file"
        :auto-cors="corsOption"
      />
    </div>
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
    <span v-else-if="element.type === 'context_message'" />
    <ReasonBlock
      v-else-if="element.type === 'reason'"
      :end-time="element.data.endTime"
      :start-time="element.data.startTime"
      :content="element.data.text"
      :duration="element.data.duration"
    />
    <div
      v-else-if="element.type === 'blank'"
      key="blank-message"
      class="blank-message"
      style="width: 10rem; height: 28.8px; position: relative"
    >
      <span class="blank-loader"></span>
    </div>
    <div
      v-else-if="element.type === 'tool_call'"
      :key="element.data?.id || 'tool-call-' + elmIndex"
      class="tool-call-container-wrapper"
      style="align-self: flex-start; max-width: 100%"
    >
      <template v-if="getToolName(element.data) === 'toolsmanager'">
        <ActionBlock
          iconClass="mio-icon-tool"
          title="配置管理 (ToolsManager)"
          :statusText="getToolsManagerStatus(element.data)"
          :isLoading="
            element.data.action === 'running' ||
            element.data.action === 'pending' ||
            element.data.action === 'started'
          "
          :isFailed="
            element.data.status === 'failed' ||
            (element.data.result && element.data.result.success === false)
          "
          :collapsible="!!element.data.result"
          :defaultExpanded="isToolsManagerExpanded(elmIndex)"
          @toggle="toggleToolsManagerDetails(elmIndex)"
        >
          <div class="toolsmanager-detail">
            <template v-if="element.data.result && element.data.result.groups">
              <!-- List action details -->
              <div
                v-for="(toolsList, groupName) in element.data.result.groups"
                :key="groupName"
                class="toolsmanager-group"
              >
                <div class="toolsmanager-group-title">{{ groupName }}</div>
                <div class="tools-grid-mini">
                  <div
                    v-for="t in toolsList"
                    :key="t.name"
                    class="tool-state-item"
                    :class="{ disabled: !t.enabled }"
                  >
                    <span
                      class="tool-state-dot"
                      :class="{ enabled: t.enabled }"
                    ></span>
                    <span class="tool-state-name">{{ t.name }}</span>
                  </div>
                </div>
              </div>
            </template>
            <template
              v-else-if="
                element.data.result && element.data.result.toggledTools
              "
            >
              <!-- Toggle action details -->
              <div class="toggle-summary">
                {{
                  element.data.result.enabled ? "已启用" : "已禁用"
                }}以下工具：
              </div>
              <div class="tools-grid-mini">
                <div
                  v-for="tName in element.data.result.toggledTools"
                  :key="tName"
                  class="tool-state-item"
                  :class="{ disabled: !element.data.result.enabled }"
                >
                  <span
                    class="tool-state-dot"
                    :class="{ enabled: element.data.result.enabled }"
                  ></span>
                  <span class="tool-state-name">{{ tName }}</span>
                </div>
              </div>
            </template>
            <template v-else-if="element.data.result">
              <pre class="raw-result-json">{{
                JSON.stringify(element.data.result, null, 2)
              }}</pre>
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
          <template v-for="(item, idx) in outerItems(element.data)" :key="idx">
            <!-- 沉浸式无壳渲染 (immersive: true)：直接按原本的直接渲染呈现，不套任何外层卡片与多余边框 -->
            <div
              v-if="isImmersive(item)"
              class="outer-render-item outer-render-immersive"
            >
              <template v-if="item.type === 'image'">
                <div class="outer-render-image-container">
                  <MdRenderer
                    :md="`![image](${item.url})`"
                    :custom-plugins="mioPlugins"
                    :markdown-it-plugins="katexPluginList"
                    :theme="'github'"
                    :key="item.url"
                    class="extra-render-image"
                    :auto-cors="corsOption"
                  />
                </div>
              </template>
              <template
                v-else-if="item.type === 'iframe' || item.type === 'html'"
              >
                <ShadowHtml
                  v-if="item.html"
                  :html="item.html"
                  @update:html="handleShadowHtmlUpdate(item, $event)"
                />
                <iframe
                  v-else-if="item.url"
                  :src="item.url"
                  class="outer-inline-iframe"
                  loading="lazy"
                  sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-same-origin"
                ></iframe>
              </template>
              <template v-else-if="item.type === 'audio'">
                <div class="outer-render-audio-container">
                  <audio :src="item.url" controls class="outer-audio"></audio>
                </div>
              </template>
              <template v-else-if="item.type === 'video'">
                <div class="outer-video-box">
                  <video
                    :src="item.url"
                    controls
                    preload="metadata"
                    class="outer-video-player"
                  ></video>
                </div>
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
              <template v-else-if="item.type === 'text'">
                <div class="outer-render-text">
                  {{ item.content || item.text }}
                </div>
              </template>
              <template v-else>
                <ShadowHtml
                  v-if="item.html"
                  :html="item.html"
                  @update:html="handleShadowHtmlUpdate(item, $event)"
                />
                <div v-else>{{ item.content || item.text }}</div>
              </template>
            </div>

            <!-- 默认套壳渲染 (保留统一卡片头部与在工作区打开等操作) -->
            <div
              v-else
              class="outer-render-card"
              :class="[
                `card-type-${getOuterItemType(item)}`,
                { 'is-file-card': isFileCardItem(item) },
              ]"
            >
              <!-- 统一卡片头部 Header -->
              <div class="outer-card-header">
                <div class="outer-card-meta">
                  <span
                    class="outer-card-badge"
                    :class="`badge-${getOuterItemType(item)}`"
                  >
                    {{ getOuterItemBadge(item) }}
                  </span>
                  <span
                    class="outer-card-title"
                    :title="getOuterItemTitle(item, element.data)"
                  >
                    {{ getOuterItemTitle(item, element.data) }}
                  </span>
                </div>
                <div class="outer-card-actions">
                  <!-- 在工作区打开按钮 (仅非文件卡片展示，文件卡片已有内部专属交互，避免重复) -->
                  <button
                    v-if="canOpenInWorkspace(item) && !isFileCardItem(item)"
                    class="outer-card-btn primary-btn"
                    title="在工作区侧边栏打开"
                    @click.stop="openInWorkspace(item, element.data)"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M15 3v18" />
                    </svg>
                    <span>在工作区打开</span>
                  </button>
                  <!-- 在新标签页打开 (若有 URL) -->
                  <a
                    v-if="getOuterItemUrl(item)"
                    :href="getOuterItemUrl(item)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="outer-card-btn icon-btn"
                    title="在新标签页中打开"
                    @click.stop
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                      />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                  <!-- 复制按钮 -->
                  <button
                    v-if="
                      getOuterItemUrl(item) ||
                      item.content ||
                      item.text ||
                      item.html
                    "
                    class="outer-card-btn icon-btn"
                    title="复制链接或内容"
                    @click.stop="copyOuterItem(item)"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path
                        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 统一卡片主体 Body -->
              <div class="outer-card-body">
                <!-- Office 文档卡片 -->
                <template v-if="getOuterItemType(item) === 'office'">
                  <div
                    class="outer-file-box"
                    title="点击在工作区打开预览"
                    @click.stop="openInWorkspace(item, element.data)"
                  >
                    <div
                      class="file-icon-box"
                      :style="{
                        color: getFileIconInfo(item, element.data).color,
                        background: getFileIconInfo(item, element.data).bg,
                      }"
                    >
                      <svg
                        v-if="
                          getFileIconInfo(item, element.data).type === 'excel'
                        "
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
                        />
                        <polyline points="14 2 14 8 20 8" />
                        <path d="M8 13h8M8 17h8M12 10v10" />
                      </svg>
                      <svg
                        v-else-if="
                          getFileIconInfo(item, element.data).type === 'word'
                        "
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
                        />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <line x1="10" y1="9" x2="8" y2="9" />
                      </svg>
                      <svg
                        v-else
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
                        />
                        <polyline points="14 2 14 8 20 8" />
                        <circle cx="12" cy="14" r="3" />
                      </svg>
                    </div>
                    <div class="file-details">
                      <div
                        class="file-name"
                        :title="getOuterItemTitle(item, element.data)"
                      >
                        {{ getOuterItemTitle(item, element.data) }}
                      </div>
                      <div class="file-subtext">
                        {{ getOuterItemSubtext(item, element.data) }}
                      </div>
                    </div>
                    <button
                      class="file-preview-btn"
                      title="在工作区打开预览"
                      @click.stop="openInWorkspace(item, element.data)"
                    >
                      <span>预览</span>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </template>

                <!-- PDF 文档卡片 -->
                <template v-else-if="getOuterItemType(item) === 'pdf'">
                  <div
                    class="outer-file-box"
                    title="点击在工作区打开预览"
                    @click.stop="openInWorkspace(item, element.data)"
                  >
                    <div
                      class="file-icon-box"
                      :style="{
                        color: getFileIconInfo(item, element.data).color,
                        background: getFileIconInfo(item, element.data).bg,
                      }"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                        />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <div class="file-details">
                      <div
                        class="file-name"
                        :title="getOuterItemTitle(item, element.data)"
                      >
                        {{ getOuterItemTitle(item, element.data) }}
                      </div>
                      <div class="file-subtext">
                        {{ getOuterItemSubtext(item, element.data) }}
                      </div>
                    </div>
                    <button
                      class="file-preview-btn"
                      title="在工作区打开预览"
                      @click.stop="openInWorkspace(item, element.data)"
                    >
                      <span>预览</span>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </template>

                <!-- Markdown 产物卡片 -->
                <template v-else-if="getOuterItemType(item) === 'markdown'">
                  <div v-if="getMarkdownText(item)" class="outer-markdown-box">
                    <MdRenderer
                      :md="getMarkdownText(item)"
                      :custom-plugins="mioPlugins"
                      :markdown-it-plugins="katexPluginList"
                      theme="github"
                      theme-mode="auto"
                    />
                  </div>
                  <div
                    v-else
                    class="outer-file-box"
                    title="点击在工作区打开预览"
                    @click.stop="openInWorkspace(item, element.data)"
                  >
                    <div
                      class="file-icon-box"
                      :style="{
                        color: getFileIconInfo(item, element.data).color,
                        background: getFileIconInfo(item, element.data).bg,
                      }"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
                        />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <div class="file-details">
                      <div
                        class="file-name"
                        :title="getOuterItemTitle(item, element.data)"
                      >
                        {{ getOuterItemTitle(item, element.data) }}
                      </div>
                      <div class="file-subtext">
                        {{ getOuterItemSubtext(item, element.data) }}
                      </div>
                    </div>
                    <button
                      class="file-preview-btn"
                      title="在工作区打开预览"
                      @click.stop="openInWorkspace(item, element.data)"
                    >
                      <span>预览</span>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </template>

                <!-- 音频卡片 -->
                <template v-else-if="getOuterItemType(item) === 'audio'">
                  <div class="outer-audio-box">
                    <audio
                      :src="item.url"
                      controls
                      class="outer-audio-player"
                    ></audio>
                  </div>
                </template>

                <!-- 视频卡片 -->
                <template v-else-if="getOuterItemType(item) === 'video'">
                  <div class="outer-video-box">
                    <video
                      :src="item.url"
                      controls
                      preload="metadata"
                      class="outer-video-player"
                    ></video>
                  </div>
                </template>

                <!-- 图片卡片 -->
                <template v-else-if="getOuterItemType(item) === 'image'">
                  <div class="outer-image-box">
                    <img
                      :src="item.url"
                      :alt="getOuterItemTitle(item, element.data)"
                      class="outer-img"
                      loading="lazy"
                    />
                  </div>
                </template>

                <!-- 提示 Alert 卡片 -->
                <template v-else-if="getOuterItemType(item) === 'alert'">
                  <el-alert
                    :title="item.title"
                    :type="item.alertType || 'info'"
                    :description="item.description"
                    show-icon
                    :closable="false"
                    class="outer-alert"
                  />
                </template>

                <!-- 纯文本 卡片 -->
                <template v-else-if="getOuterItemType(item) === 'text'">
                  <div class="outer-text-box">
                    {{ item.content || item.text }}
                  </div>
                </template>

                <!-- 链接 卡片 -->
                <template v-else-if="getOuterItemType(item) === 'link'">
                  <div class="outer-link-box">
                    <a
                      :href="item.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="outer-link-btn"
                    >
                      <span class="link-label">{{
                        item.text || getOuterItemTitle(item, element.data)
                      }}</span>
                      <span class="link-url-hint">{{ item.url }}</span>
                    </a>
                  </div>
                </template>

                <!-- HTML / iframe / ShadowHtml 界面卡片 -->
                <template v-else>
                  <div class="outer-html-box">
                    <ShadowHtml
                      v-if="item.html"
                      :html="item.html"
                      @update:html="handleShadowHtmlUpdate(item, $event)"
                    />
                    <iframe
                      v-else-if="item.url"
                      :src="item.url"
                      class="outer-inline-iframe"
                      loading="lazy"
                      sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-same-origin"
                    ></iframe>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
    <ActionBlock
      v-else-if="element.type === 'crystallize_event'"
      iconClass="mio-icon-memory"
      title="整理记忆"
      :statusText="
        element.data.status === 'running'
          ? '整理中'
          : element.data.status === 'failed'
            ? '失败'
            : '完成'
      "
      :isLoading="element.data.status === 'running'"
      :collapsible="!!element.data.summary"
      :defaultExpanded="isCrystallizeExpanded(elmIndex)"
      @toggle="toggleCrystallizeDetails(elmIndex)"
    >
      <div class="detail-section">
        <div class="section-label">整理后上下文压缩 (XML)</div>
        <pre class="xml-box">{{ element.data.summary }}</pre>
      </div>
    </ActionBlock>
  </div>
</template>

<script setup>
import {
  computed,
  ref,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
} from "vue";
import { ElMessage } from "element-plus";
import { client } from "@/lib/runtime.js";
import { setupIframeAutoResize } from "@/utils/iframeAutoResize.js";
import ShadowHtml from "@/components/ShadowHtml.vue";
import ToolCallBar from "@/components/ToolCallBar.vue";
import ReasonBlock from "@/components/ReasonBlock.vue";
import ActionBlock from "@/components/ActionBlock.vue";
import FileBlock from "@/components/FileBlock.vue";
import MdRenderer from "mio-previewer";
import { useWorkspaceStore } from "@/stores/workspaceStore.js";

// Resolve circular dependency by dynamically importing ForwardMsg
const ForwardMsg = defineAsyncComponent(
  () => import("@/components/ForwardMsg.vue"),
);

// 图片“先量后插”：按已知的自然尺寸预留终态高度，消除图片解码完成时的跳动。
// 尺寸由 lib/imageSize.js 量出后 patch 回元素（data.width / data.height）；
// 还没量到时先用稳定占位比例占位，量到后修正一次。
const IMAGE_MAX_WIDTH = 540;
const IMAGE_MAX_HEIGHT = 520;

const imageSizeOf = (element) => {
  const width = Number(element?.data?.width) || 0;
  const height = Number(element?.data?.height) || 0;
  return width > 0 && height > 0 ? { height, width } : null;
};

const imageSlotStyle = (element) => {
  const size = imageSizeOf(element);
  if (!size) {
    // 历史消息没有量过尺寸：什么都不加，走 .image-slot:not(.is-sized) 的自然流。
    // 绝不能给 width:100% —— 气泡宽度由内容决定，百分比宽度会塌成一条缝。
    return {};
  }
  // 宽度必须自带上限：aspect-ratio 只在另一边是 auto 时才能推出这边，
  // 若给确定性宽度再配 max-height，宽度不会回缩，比例被破坏 → contain 补白。
  const fittedWidth = Math.min(
    size.width,
    IMAGE_MAX_WIDTH,
    (IMAGE_MAX_HEIGHT * size.width) / size.height,
  );
  return {
    aspectRatio: `${size.width} / ${size.height}`,
    maxWidth: "100%",
    width: `${Math.round(fittedWidth)}px`,
  };
};

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
  if (storage && storage.type === "s3") {
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
  const dur =
    toolCall.duration ||
    (toolCall.endTime && toolCall.startTime
      ? toolCall.endTime - toolCall.startTime
      : 0);
  const durStr =
    dur > 0
      ? dur < 1000
        ? `(${dur}ms)`
        : `(${(dur / 1000).toFixed(1)}s)`
      : "";

  if (
    toolCall.action === "running" ||
    toolCall.action === "pending" ||
    toolCall.action === "started"
  ) {
    return "运行中";
  }
  if (
    toolCall.status === "failed" ||
    (toolCall.result && toolCall.result.success === false)
  ) {
    return durStr ? `失败 ${durStr}` : "失败";
  }
  return durStr ? durStr : "完成";
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
  expandedToolsManagerEvents.value[key] =
    !expandedToolsManagerEvents.value[key];
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
  const extra = data?.extraRender || [];
  const list = Array.isArray(extra) ? extra : extra ? [extra] : [];
  return list.filter((r) => r && r.placement === "outer");
}

function isImmersive(item) {
  if (!item) return false;
  return Boolean(
    item.immersive === true ||
      item.frameless === true ||
      item.seamless === true ||
      item.bare === true,
  );
}

function getOuterItemType(item) {
  if (!item) return "render";
  const rawUrl = item.url || item.src || item.href || "";
  const name = item.fileName || item.title || item.name || "";
  const clean = String(rawUrl || name)
    .split("?")[0]
    .split("#")[0];
  const dotIndex = clean.lastIndexOf(".");
  const ext = dotIndex !== -1 ? clean.slice(dotIndex + 1).toLowerCase() : "";

  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext))
    return "office";
  if (ext === "pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "html" || ext === "htm") return "html";

  const t = (item.type || "").toLowerCase();
  if (t === "iframe" || t === "html") return "html";
  if (t === "image") return "image";
  if (t === "audio" || t === "voice") return "audio";
  if (t === "video") return "video";
  if (t === "alert") return "alert";
  if (t === "link") return "link";
  if (t === "text") return "text";
  if (rawUrl) return "link";
  return "render";
}

function getOuterItemBadge(item) {
  const t = getOuterItemType(item);
  switch (t) {
    case "office":
      return "Office";
    case "pdf":
      return "PDF";
    case "markdown":
      return "Markdown";
    case "html":
      return "UI 卡片";
    case "image":
      return "图片";
    case "audio":
      return "音频";
    case "video":
      return "视频";
    case "alert":
      return "提示";
    case "link":
      return "链接";
    case "text":
      return "文本";
    default:
      return "产物";
  }
}

function formatFileSize(bytes) {
  if (bytes === undefined || bytes === null || bytes === "" || isNaN(bytes))
    return "";
  const num = Number(bytes);
  if (num <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let s = num;
  while (s >= 1024 && i < units.length - 1) {
    s /= 1024;
    i++;
  }
  return `${s.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getOuterItemSubtext(item, toolData) {
  const rawUrl = item?.url || item?.src || item?.href || "";
  const name = item?.fileName || item?.title || item?.name || "";
  const clean = String(rawUrl || name)
    .split("?")[0]
    .split("#")[0];
  const dotIndex = clean.lastIndexOf(".");
  const ext = dotIndex !== -1 ? clean.slice(dotIndex + 1).toLowerCase() : "";

  let typeName = "文档";
  if (["doc", "docx", "dot", "rtf", "odt", "wps"].includes(ext)) {
    typeName = "Word 文档";
  } else if (["xls", "xlsx", "csv", "xlsm", "xlsb", "et"].includes(ext)) {
    typeName = "Excel 表格";
  } else if (["ppt", "pptx", "pps", "pptm", "dps"].includes(ext)) {
    typeName = "PowerPoint 演示文稿";
  } else if (ext === "pdf") {
    typeName = "PDF 文档";
  } else if (ext === "md" || ext === "markdown") {
    typeName = "Markdown 文档";
  } else if (
    ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"].includes(ext)
  ) {
    typeName = "压缩归档";
  } else if (["xmind", "drawio"].includes(ext)) {
    typeName = "图表导图";
  } else if (ext) {
    typeName = `${ext.toUpperCase()} 文件`;
  }

  // 尝试获取大小（支持多种字段结构）
  const rawSize =
    item?.size ||
    item?.fileSize ||
    item?.bytes ||
    item?.length ||
    item?.meta?.size ||
    item?.meta?.fileSize ||
    toolData?.result?.size ||
    toolData?.result?.fileSize ||
    toolData?.result?.bytes ||
    toolData?.args?.size;

  let sizeStr = "";
  if (typeof rawSize === "string" && /[KkMmGgTt]?[Bb]/.test(rawSize)) {
    sizeStr = rawSize;
  } else if (rawSize) {
    sizeStr = formatFileSize(rawSize);
  }

  return sizeStr ? `${typeName} · ${sizeStr}` : typeName;
}

function isFileCardItem(item) {
  if (!item) return false;
  const t = getOuterItemType(item);
  if (["office", "pdf", "archive", "file"].includes(t)) return true;
  if (t === "markdown" && !getMarkdownText(item)) return true;
  return false;
}

function getFileIconInfo(item, toolData) {
  const rawUrl = item?.url || item?.src || item?.href || "";
  const name = item?.fileName || item?.title || item?.name || "";
  const clean = String(rawUrl || name)
    .split("?")[0]
    .split("#")[0];
  const dotIndex = clean.lastIndexOf(".");
  const ext = dotIndex !== -1 ? clean.slice(dotIndex + 1).toLowerCase() : "";

  if (["doc", "docx", "dot", "rtf", "odt", "wps"].includes(ext)) {
    return { type: "word", color: "#2b579a", bg: "rgba(43, 87, 154, 0.12)" };
  }
  if (["xls", "xlsx", "csv", "xlsm", "xlsb", "et"].includes(ext)) {
    return { type: "excel", color: "#217346", bg: "rgba(33, 115, 70, 0.12)" };
  }
  if (["ppt", "pptx", "pps", "pptm", "dps"].includes(ext)) {
    return { type: "ppt", color: "#d24726", bg: "rgba(210, 71, 38, 0.12)" };
  }
  if (ext === "pdf") {
    return { type: "pdf", color: "#e11d48", bg: "rgba(225, 29, 72, 0.12)" };
  }
  if (["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"].includes(ext)) {
    return {
      type: "archive",
      color: "#8b5cf6",
      bg: "rgba(139, 92, 246, 0.12)",
    };
  }
  if (ext === "md" || ext === "markdown") {
    return {
      type: "markdown",
      color: "#0891b2",
      bg: "rgba(8, 145, 178, 0.12)",
    };
  }
  return { type: "file", color: "#64748b", bg: "rgba(100, 116, 139, 0.12)" };
}

function getOuterItemTitle(item, toolData) {
  if (item.title) return item.title;
  if (item.fileName) return item.fileName;
  if (item.name) return item.name;
  const toolName = toolData?.displayName || toolData?.name;
  const badge = getOuterItemBadge(item);
  return toolName ? `${toolName} · ${badge}` : `${badge}产物`;
}

function getOuterItemUrl(item) {
  return (item.url || item.src || item.href || "").trim();
}

const markdownCache = ref({});

function isValidMarkdownContent(str) {
  if (typeof str !== "string" || !str.trim()) return false;
  if (str.includes("文件分享:") && str.includes("下载链接:")) return false;
  return true;
}

function getMarkdownText(item) {
  if (isValidMarkdownContent(item.content)) return item.content;
  if (isValidMarkdownContent(item.md)) return item.md;
  if (isValidMarkdownContent(item.markdown)) return item.markdown;
  if (isValidMarkdownContent(item.text)) return item.text;

  const url = getOuterItemUrl(item);
  if (url) {
    if (markdownCache.value[url]) {
      return markdownCache.value[url];
    }
    fetchMarkdownForItem(url);
  }
  return "";
}

async function fetchMarkdownForItem(url) {
  if (!url || markdownCache.value[url]) return;
  try {
    const resp = await fetch(url);
    if (resp.ok) {
      markdownCache.value[url] = await resp.text();
    }
  } catch (err) {
    console.warn("[MessageContent] Failed to fetch markdown from url:", err);
  }
}

const copyOuterItem = async (item) => {
  const text =
    getMarkdownText(item) ||
    item.content ||
    item.text ||
    item.html ||
    getOuterItemUrl(item) ||
    "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("已复制到剪贴板");
  } catch (err) {
    ElMessage.error("复制失败");
  }
};

const workspaceStore = useWorkspaceStore();

function canOpenInWorkspace(item) {
  if (!item) return false;
  return true;
}

function openInWorkspace(item, toolData) {
  workspaceStore.openRenderTab(item, {
    toolName: toolData?.name,
    toolTitle: toolData?.displayName || toolData?.name,
    messageIndex: props.messageIndex,
  });
}

const handleShadowHtmlUpdate = (item, newHtml) => {
  if (item && newHtml && item.html !== newHtml) {
    item.html = newHtml;
    client.config?._saveStrogeConfig?.();
  }
};

// iframe 高度自适应：内容变化时自动贴合（ResizeObserver + postMessage）
const { enable: enableIframeResize, disable: disableIframeResize } =
  setupIframeAutoResize();
onMounted(enableIframeResize);
onUnmounted(disableIframeResize);
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
  gap: 10px
  width: 100%

.outer-render-immersive
  width: 100%
  display: flex
  flex-direction: column
  align-items: flex-start

  .outer-render-image-container
    width: fit-content
    max-width: 100%
    display: inline-block

    :deep(.markdown-body)
      background: transparent !important
      padding: 0 !important

      p
        margin: 0 !important

      img
        max-width: min(100%, 540px)
        max-height: 520px
        width: auto
        height: auto
        object-fit: contain
        border-radius: 8px
        box-shadow: 0 3px 14px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)
        cursor: zoom-in

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

  .outer-render-text
    padding: 8px 12px
    background-color: var(--el-fill-color-light)
    border-left: 3px solid var(--el-color-primary)
    border-radius: 0 6px 6px 0
    font-size: 13px
    color: var(--el-text-color-regular)
    white-space: pre-wrap

  .outer-inline-iframe
    width: 100%
    min-height: 320px
    border: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.08))
    border-radius: 8px
    background-color: #ffffff

.tool-call-container-wrapper
  align-self: flex-start
  width: fit-content
  max-width: 100%

.outer-render-card
  width: fit-content
  max-width: 100%
  border-radius: 8px
  border: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.08))
  background: var(--mio-bg-surface, #ffffff)
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)
  overflow: hidden
  transition: border-color 0.15s ease, box-shadow 0.15s ease

  &:hover
    border-color: var(--mio-border-color, rgba(0, 0, 0, 0.15))
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06)

  &.is-file-card
    width: 330px
    max-width: 100%

.outer-card-header
  height: 32px
  padding: 0 10px
  background: var(--mio-bg-surface-soft, rgba(0, 0, 0, 0.02))
  border-bottom: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.06))
  display: flex
  align-items: center
  justify-content: space-between
  gap: 8px

.outer-card-meta
  display: flex
  align-items: center
  gap: 6px
  overflow: hidden
  min-width: 0
  flex: 1

.outer-card-badge
  font-size: 10px
  font-weight: 700
  padding: 1px 5px
  border-radius: 4px
  white-space: nowrap
  letter-spacing: 0.02em
  flex-shrink: 0

  &.badge-office
    background: rgba(37, 99, 235, 0.14)
    color: #2563eb
  &.badge-pdf
    background: rgba(239, 68, 68, 0.14)
    color: #ef4444
  &.badge-markdown
    background: rgba(8, 145, 178, 0.14)
    color: #0891b2
  &.badge-html
    background: rgba(139, 92, 246, 0.14)
    color: #8b5cf6
  &.badge-link
    background: rgba(0, 153, 255, 0.14)
    color: #0099ff
  &.badge-image
    background: rgba(245, 158, 11, 0.14)
    color: #f59e0b
  &.badge-audio
    background: rgba(16, 185, 129, 0.14)
    color: #10b981
  &.badge-video
    background: rgba(244, 63, 94, 0.14)
    color: #f43f5e
  &.badge-alert
    background: rgba(234, 88, 12, 0.14)
    color: #ea580c
  &.badge-text
    background: rgba(100, 116, 139, 0.14)
    color: #64748b
  &.badge-render
    background: rgba(99, 102, 241, 0.14)
    color: #6366f1

.outer-card-title
  font-size: 11.5px
  font-weight: 600
  color: var(--mio-text-primary, #1e293b)
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

.outer-card-actions
  display: flex
  align-items: center
  gap: 4px
  flex-shrink: 0

.outer-card-btn
  display: inline-flex
  align-items: center
  gap: 4px
  padding: 2px 7px
  border-radius: 4px
  font-size: 11px
  cursor: pointer
  border: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.1))
  background: var(--mio-bg-surface, #ffffff)
  color: var(--mio-text-secondary, #64748b)
  transition: all 0.15s ease
  text-decoration: none

  &:hover
    color: var(--mio-color-primary, #0099ff)
    border-color: var(--mio-color-primary, #0099ff)
    background: var(--mio-bg-hover, rgba(0, 153, 255, 0.06))

  &.icon-btn
    padding: 3px 5px

  &.primary-btn
    font-weight: 500

.outer-card-body
  padding: 8px 10px
  overflow-x: auto

.outer-file-box
  display: flex
  align-items: center
  gap: 10px
  padding: 4px 6px
  border-radius: 6px
  cursor: pointer
  transition: background-color 0.15s ease
  width: 100%
  box-sizing: border-box

  &:hover
    background: var(--mio-bg-hover, rgba(0, 0, 0, 0.04))

    .file-preview-btn
      background: var(--mio-color-primary, #0099ff)
      color: #ffffff
      border-color: var(--mio-color-primary, #0099ff)

  .file-icon-box
    width: 36px
    height: 36px
    min-width: 36px
    min-height: 36px
    border-radius: 8px
    display: flex
    align-items: center
    justify-content: center
    flex-shrink: 0

  .file-details
    display: flex
    flex-direction: column
    min-width: 0
    flex: 1

    .file-name
      font-size: 13px
      font-weight: 600
      color: var(--mio-text-primary, #1e293b)
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis

    .file-subtext
      font-size: 11px
      color: var(--mio-text-secondary, #64748b)
      margin-top: 2px
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis

  .file-preview-btn
    display: inline-flex
    align-items: center
    gap: 3px
    padding: 3px 8px
    border-radius: 4px
    border: 1px solid var(--mio-border-color-light, rgba(0, 153, 255, 0.25))
    background: var(--mio-bg-primary-light, rgba(0, 153, 255, 0.08))
    color: var(--mio-color-primary, #0099ff)
    font-size: 11px
    font-weight: 500
    cursor: pointer
    flex-shrink: 0
    transition: all 0.15s ease

.outer-audio-box
  width: 100%
  display: flex
  align-items: center

  .outer-audio-player
    width: 100%
    height: 32px
    border-radius: 16px

.outer-video-box
  width: 100%
  display: flex
  justify-content: center
  background: rgba(0, 0, 0, 0.05)
  border-radius: 6px
  overflow: hidden

  .outer-video-player
    width: 100%
    max-height: 320px
    border-radius: 6px
    outline: none

.image-slot
  position: relative
  display: flex
  justify-content: center
  overflow: hidden
  /* 沿用图片原本的上下间距，避免挤紧相邻文字 */
  margin: 0.5rem 0
  border-radius: 8px
  background: linear-gradient(100deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.04))

  :deep(p)
    margin: 0 !important
    padding: 0 !important

  :deep(img)
    position: absolute
    inset: 0
    width: 100%
    height: 100%
    object-fit: contain
    border-radius: 8px
    box-shadow: 0 3px 14px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)
    cursor: zoom-in

  /* 存量消息没有 width/height：退回自然流，让框贴着图。
     不再用 4:3 占位框 —— 3:2 的图被 contain 进 4:3 里，下方会留一条生硬空白。
     align-self 必须 flex-start：flex 默认 stretch 会把框拉成整行宽，而插件给
     img 的 inline max-width:100% 会跟着变宽，图片就撑满了。上限与
     IMAGE_MAX_WIDTH / IMAGE_MAX_HEIGHT 保持一致。 */
  &:not(.is-sized)
    align-self: flex-start
    max-width: 540px
    background: none

    :deep(img)
      position: static
      inset: auto
      width: auto
      height: auto
      max-width: 100%
      max-height: 520px

.outer-image-box
  display: flex
  justify-content: center
  width: fit-content
  max-width: 100%

  .outer-img
    max-width: min(100%, 540px)
    max-height: 520px
    width: auto
    height: auto
    border-radius: 6px
    object-fit: contain

.outer-text-box
  font-size: 13px
  line-height: 1.5
  color: var(--mio-text-primary, #334155)
  white-space: pre-wrap
  word-break: break-word

.outer-link-box
  width: 100%

  .outer-link-btn
    display: flex
    flex-direction: column
    gap: 2px
    padding: 6px 10px
    border-radius: 6px
    background: var(--mio-bg-surface-soft, rgba(0, 0, 0, 0.02))
    border: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.08))
    text-decoration: none
    transition: all 0.15s ease

    &:hover
      border-color: var(--mio-color-primary, #0099ff)

    .link-label
      font-size: 12.5px
      font-weight: 600
      color: var(--mio-color-primary, #0099ff)

    .link-url-hint
      font-size: 11px
      color: var(--mio-text-secondary, #94a3b8)
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis

.outer-html-box
  width: 100%
  min-height: 60px

  .outer-inline-iframe
    width: 100%
    height: 320px
    min-height: 240px
    border: none
    border-radius: 6px
    background: #ffffff

.outer-markdown-box
  width: 100%
  max-height: 420px
  overflow-y: auto
  overflow-x: auto
  font-size: 13px
  padding-right: 4px

  &::-webkit-scrollbar
    width: 6px
    height: 6px

  &::-webkit-scrollbar-track
    background: transparent

  &::-webkit-scrollbar-thumb
    background: var(--mio-border-color-light, rgba(0, 0, 0, 0.15))
    border-radius: 3px

    &:hover
      background: var(--mio-border-color, rgba(0, 0, 0, 0.25))

  :deep(.markdown-body)
    font-size: 13px
    line-height: 1.6

    > *:first-child
      margin-top: 0

    > *:last-child
      margin-bottom: 0

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
