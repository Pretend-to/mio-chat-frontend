<template>
  <div class="workspace-render-tab">
    <!-- Header Toolbar -->
    <div class="render-header">
      <div class="render-meta">
        <span class="type-badge" :class="isWebEmbed ? 'badge-web' : `badge-${renderType}`">
          {{ typeLabel }}
        </span>
        <span class="render-title" :title="tabTitle">{{ tabTitle }}</span>
        <span v-if="toolTitle" class="tool-badge" :title="`来自工具: ${toolTitle}`">
          {{ toolTitle }}
        </span>
      </div>

      <div class="render-actions">
        <!-- 内联 HTML 或 Markdown：源码 / 预览切换 -->
        <button
          v-if="hasHtmlSource || isMarkdownView"
          class="action-btn"
          :class="{ 'is-active': showSourceCode }"
          :title="showSourceCode ? '切换到界面预览' : '查看源码'"
          @click="showSourceCode = !showSourceCode"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>{{ showSourceCode ? '预览' : '源码' }}</span>
        </button>

        <!-- 在新标签页中打开 -->
        <button
          v-if="hasHtmlSource || isWebEmbed || isOfficeView || isPdfView || isMarkdownView"
          class="action-btn"
          :title="hasHtmlSource ? '在新标签页中打开独立预览' : '在新标签页中打开'"
          @click="openInNewTab"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>

        <!-- 媒体 / 文件 / Office / PDF / Markdown：下载 -->
        <template v-if="showMediaActions || isOfficeView || isPdfView || (isMarkdownView && rawUrl)">
          <button class="action-btn" title="下载文件" @click="handleDownload(mediaUrl || rawUrl, tabTitle)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </template>

        <!-- Copy button -->
        <button class="action-btn" title="复制内容" @click="handleCopy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Main Viewport Area -->
    <div
      class="render-viewport"
      :class="{
        'is-source-mode': showSourceCode,
        'is-embed-mode': isEmbedMode,
      }"
    >
      <!-- 内联 HTML：Shadow DOM 同文档渲染（可切源码） -->
      <template v-if="isHtmlView">
        <div v-if="showSourceCode" class="source-view">
          <pre class="code-box"><code>{{ htmlContent }}</code></pre>
        </div>
        <div v-else class="html-view-container">
          <div class="html-card-wrapper">
            <ShadowHtml
              :html="htmlContent"
              @update:html="onHtmlUpdated"
            />
          </div>
        </div>
      </template>

      <!-- Office 产物：Word / Excel / PPT 使用微软 Office Online 直链内嵌渲染 -->
      <template v-else-if="isOfficeView">
        <div v-if="isLocalhost" class="office-hint-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Office 预览由微软公网服务提供；当前处于本地开发环境 (localhost)，若预览失败可点击右上角【下载文件】。</span>
        </div>
        <iframe
          class="render-iframe"
          :src="officeViewerUrl"
          :title="tabTitle"
          loading="lazy"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          allow="clipboard-write; fullscreen; autoplay"
          @load="onIframeLoad"
        ></iframe>
        <div v-if="iframeBlocked" class="embed-fallback">
          <div class="fallback-card">
            <div class="fallback-title">无法加载 Office 在线预览</div>
            <div class="fallback-url">{{ rawUrl }}</div>
            <button class="fallback-btn" @click="handleDownload(rawUrl, tabTitle)">
              直接下载文件
            </button>
          </div>
        </div>
        <div v-else-if="!iframeLoaded" class="embed-loading">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span style="margin-left: 8px; font-size: 13px;">正在通过微软 Office 服务加载文档...</span>
        </div>
      </template>

      <!-- PDF 产物：浏览器原生直接 iframe 渲染 -->
      <template v-else-if="isPdfView">
        <iframe
          class="render-iframe"
          :src="webUrl || rawUrl"
          :title="tabTitle"
          loading="lazy"
          @load="onIframeLoad"
        ></iframe>
        <div v-if="!iframeLoaded" class="embed-loading">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span style="margin-left: 8px; font-size: 13px;">正在加载 PDF 文档...</span>
        </div>
      </template>

      <!-- Markdown 产物：使用现有 md 预览器 (mio-previewer) -->
      <template v-else-if="isMarkdownView">
        <div v-if="showSourceCode" class="source-view">
          <pre class="code-box"><code>{{ markdownContent }}</code></pre>
        </div>
        <div v-else class="markdown-view-container">
          <div v-if="markdownLoading" class="embed-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span style="margin-left: 8px; font-size: 13px;">正在拉取 Markdown 内容...</span>
          </div>
          <MdRenderer
            v-else
            :md="markdownContent"
            :customPlugins="customPlugins"
            :markdownItPlugins="markdownItPlugins"
            theme="github"
            themeMode="auto"
          />
        </div>
      </template>

      <!-- 网页产物（publish 等）：有效 URL 直接 iframe 内嵌 -->
      <template v-else-if="isWebEmbed">
        <iframe
          class="render-iframe"
          :src="webUrl"
          :title="tabTitle"
          loading="lazy"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          allow="clipboard-write; fullscreen; autoplay"
          @load="onIframeLoad"
        ></iframe>
        <!-- 目标站点可能通过 X-Frame-Options / CSP frame-ancestors 拒绝内嵌，
             此时 load 事件不会触发，给出外开兜底而不是白屏 -->
        <div v-if="iframeBlocked" class="embed-fallback">
          <div class="fallback-card">
            <div class="fallback-title">该网页不允许被内嵌</div>
            <div class="fallback-url">{{ webUrl }}</div>
            <button class="fallback-btn" @click="openExternal(webUrl)">
              在新标签页打开
            </button>
          </div>
        </div>
        <div v-else-if="!iframeLoaded" class="embed-loading">
          <el-icon class="is-loading"><Loading /></el-icon>
        </div>
      </template>

      <!-- 既无内联 HTML 又无有效 URL 的 html 类型：给出空态而非静默空白 -->
      <template v-else-if="renderType === 'html' || renderType === 'iframe'">
        <div class="generic-view-container">
          <el-empty description="没有可渲染的内容" :image-size="80" />
        </div>
      </template>

      <!-- Image View -->
      <template v-else-if="renderType === 'image'">
        <div class="image-view-container">
          <div class="image-box">
            <img :src="mediaUrl" :alt="tabTitle" class="render-image" />
          </div>
        </div>
      </template>

      <!-- Audio / Voice View -->
      <template v-else-if="renderType === 'audio' || renderType === 'voice'">
        <div class="audio-view-container">
          <div class="audio-card">
            <div class="audio-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div class="audio-details">
              <div class="audio-title">{{ tabTitle }}</div>
              <audio :src="mediaUrl" controls autoplay class="audio-player"></audio>
            </div>
          </div>
        </div>
      </template>

      <!-- Video View -->
      <template v-else-if="renderType === 'video'">
        <div class="video-view-container">
          <video :src="mediaUrl" controls class="render-video"></video>
        </div>
      </template>

      <!-- Alert View -->
      <template v-else-if="renderType === 'alert'">
        <div class="alert-view-container">
          <el-alert
            :title="renderItem.title || '提示'"
            :type="renderItem.alertType || 'info'"
            :description="renderItem.description"
            show-icon
            :closable="false"
            class="full-alert"
          />
        </div>
      </template>

      <!-- File / Link / Card fallback -->
      <template v-else>
        <div class="generic-view-container">
          <div class="generic-card">
            <div class="card-icon">📁</div>
            <div class="card-body">
              <div class="card-title">{{ tabTitle }}</div>
              <div v-if="renderItem.description" class="card-desc">
                {{ renderItem.description }}
              </div>
              <div v-if="mediaUrl || rawUrl" class="card-url">
                <a :href="mediaUrl || rawUrl" target="_blank" rel="noopener noreferrer">
                  {{ mediaUrl || rawUrl }}
                </a>
              </div>
              <div v-if="mediaUrl || rawUrl" class="card-action-bar">
                <button
                  class="generic-download-btn"
                  @click="handleDownload(mediaUrl || rawUrl, tabTitle)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>下载文件</span>
                </button>
                <button
                  class="generic-secondary-btn"
                  @click="handleCopy"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  <span>复制链接</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import { Loading } from "@element-plus/icons-vue";
import ShadowHtml from "@/components/ShadowHtml.vue";
import MdRenderer from "mio-previewer";
import {
  codeBlockPlugin,
  mermaidPlugin,
  imageViewerPlugin,
} from "mio-previewer/plugins/custom";
import { katexPlugin } from "mio-previewer/plugins/markdown-it";
import { client } from "@/lib/runtime.js";

const props = defineProps({
  tab: {
    type: Object,
    required: true,
  },
});

const showSourceCode = ref(false);

const customPlugins = [
  { plugin: codeBlockPlugin },
  { plugin: mermaidPlugin },
  { plugin: imageViewerPlugin },
];
const markdownItPlugins = [{ plugin: katexPlugin }];

const renderItem = computed(() => {
  return props.tab.payload?.renderItem || props.tab.payload || {};
});

const meta = computed(() => {
  return props.tab.payload?.meta || {};
});

const renderType = computed(() => {
  return (renderItem.value.type || "html").toLowerCase();
});

function getFileExtension(urlOrPath = "") {
  try {
    const clean = String(urlOrPath).split("?")[0].split("#")[0];
    const dotIndex = clean.lastIndexOf(".");
    if (dotIndex === -1) return "";
    return clean.slice(dotIndex + 1).toLowerCase();
  } catch {
    return "";
  }
}

function getAbsoluteUrl(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (typeof window !== "undefined") {
    if (s.startsWith("/")) {
      return `${window.location.origin}${s}`;
    }
    return `${window.location.origin}/${s}`;
  }
  return s;
}

const tabTitle = computed(() => {
  return (
    props.tab.title ||
    renderItem.value.title ||
    renderItem.value.name ||
    renderItem.value.fileName ||
    "渲染项"
  );
});

const rawUrl = computed(() => {
  const value =
    renderItem.value.url || renderItem.value.src || renderItem.value.href || "";
  return String(value).trim();
});

/** 媒体类型用来取 src 的 URL（渲染时不再重复 trim） */
const mediaUrl = computed(() => rawUrl.value);

const detectedExt = computed(() => {
  return getFileExtension(rawUrl.value || tabTitle.value);
});

const isOfficeView = computed(() => {
  const ext = detectedExt.value;
  return (
    ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext) ||
    renderType.value === "office"
  );
});

const isPdfView = computed(() => {
  return detectedExt.value === "pdf" || renderType.value === "pdf";
});

const isMarkdownView = computed(() => {
  return (
    ["md", "markdown"].includes(detectedExt.value) ||
    renderType.value === "markdown" ||
    renderType.value === "md"
  );
});

const isLocalhost = computed(() => {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0"
  );
});

const officeViewerUrl = computed(() => {
  const abs = getAbsoluteUrl(rawUrl.value);
  if (!abs) return "";
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(abs)}`;
});

/** 走 Shadow DOM 同文档渲染的类型 */
const HTML_TYPES = ["html", "iframe"];
const MEDIA_TYPES = ["image", "audio", "voice", "video"];

const toolTitle = computed(() => {
  return meta.value.toolTitle || meta.value.toolName || "";
});

const typeLabel = computed(() => {
  if (isOfficeView.value) {
    const ext = detectedExt.value;
    if (ext.startsWith("doc")) return "Word";
    if (ext.startsWith("xls")) return "Excel";
    if (ext.startsWith("ppt")) return "PPT";
    return "Office";
  }
  if (isPdfView.value) return "PDF";
  if (isMarkdownView.value) return "Markdown";
  if (isWebEmbed.value) return "网页";
  switch (renderType.value) {
    case "html":
    case "iframe":
      return "UI 卡片";
    case "image":
      return "图片";
    case "audio":
    case "voice":
      return "音频";
    case "video":
      return "视频";
    case "file":
    case "document":
      return "文件";
    case "alert":
      return "提示";
    case "link":
      return "链接";
    default:
      return "产物";
  }
});

/**
 * 判定是否可用于 iframe 内嵌的有效 URL。
 * 站内相对路径（/f/up/... 等）同样视为有效，生产环境由后端同源托管。
 */
function isEmbeddableUrl(value) {
  const url = String(value || "").trim();
  if (!url) return false;
  if (/^https?:\/\//i.test(url)) return true;
  return url.startsWith("/") && !url.startsWith("//");
}

/** 可内嵌 / 可外开的网页产物 URL */
const webUrl = computed(() =>
  isEmbeddableUrl(rawUrl.value) ? rawUrl.value : "",
);

const htmlContent = computed(() => {
  return renderItem.value.html || renderItem.value.content || "";
});

/**
 * html / iframe 类型的 content 字段可能是真实的 HTML 片段，也可能被误用作 URL。
 * 只有确认是标记语言时才走 Shadow DOM，否则交给 iframe 分支。
 */
const hasHtmlSource = computed(() => {
  if (!HTML_TYPES.includes(renderType.value)) return false;
  const source = String(htmlContent.value || "").trim();
  if (!source.startsWith("<")) return false;
  return /^<\s*[a-z!]/i.test(source);
});

/** 内联 HTML 视图（Shadow DOM） */
const isHtmlView = computed(() => hasHtmlSource.value);

/** 网页产物视图：有效 URL 且非媒体/文件/Office/PDF/Markdown/内联内容类型，直接用 iframe 渲染 */
const isWebEmbed = computed(() => {
  if (isHtmlView.value) return false;
  if (isOfficeView.value) return false;
  if (isPdfView.value) return false;
  if (isMarkdownView.value) return false;
  if (!webUrl.value) return false;

  // 文件类型 (file, document) 除非扩展名是明确的网页 (html/htm)，否则展示文件卡片，避免进入 iframe 触发浏览器下载
  if (
    (renderType.value === "file" || renderType.value === "document") &&
    !["html", "htm"].includes(detectedExt.value)
  ) {
    return false;
  }

  // publish 工具产物，或者显式网页/链接类型，一律用 iframe 渲染
  if (
    meta.value.toolName === "publish" ||
    meta.value.toolTitle === "publish" ||
    renderType.value === "link" ||
    renderType.value === "html" ||
    renderType.value === "iframe" ||
    renderType.value === "web" ||
    renderType.value === "page" ||
    detectedExt.value === "html" ||
    detectedExt.value === "htm"
  ) {
    return true;
  }
  // 纯媒体类型（且不以 .html/.htm 结尾）交给专属媒体播放器
  if (MEDIA_TYPES.includes(renderType.value) && !/\.html?$/i.test(webUrl.value)) {
    return false;
  }
  // 提示卡片与带纯文本内容的类型保留原有卡片
  if (renderType.value === "alert") return false;
  if (renderType.value === "text" && renderItem.value.content) return false;
  return false;
});

const isEmbedMode = computed(() => {
  return isWebEmbed.value || isOfficeView.value || isPdfView.value;
});

/** 媒体 / 文件的操作按钮（外开 + 下载），iframe 嵌入式网页改用单一外开按钮 */
const showMediaActions = computed(() => {
  return (
    Boolean(mediaUrl.value) &&
    !isWebEmbed.value &&
    !isOfficeView.value &&
    !isPdfView.value &&
    !isMarkdownView.value
  );
});

function isValidMarkdownContent(str) {
  if (typeof str !== "string" || !str.trim()) return false;
  // 排除 share 插件等历史遗留的通知提示词（避免将下载通知误作为 md 正文展示）
  if (str.includes("文件分享:") && str.includes("下载链接:")) return false;
  return true;
}

// Markdown 远程加载
const markdownFetchedContent = ref("");
const markdownLoading = ref(false);

const markdownContent = computed(() => {
  const direct =
    (isValidMarkdownContent(renderItem.value.content) && renderItem.value.content) ||
    (isValidMarkdownContent(renderItem.value.md) && renderItem.value.md) ||
    (isValidMarkdownContent(renderItem.value.markdown) && renderItem.value.markdown) ||
    (isValidMarkdownContent(renderItem.value.text) && renderItem.value.text) ||
    "";
  if (direct) return direct;
  return markdownFetchedContent.value;
});

const loadMarkdownContent = async () => {
  if (!isMarkdownView.value) return;
  const direct =
    (isValidMarkdownContent(renderItem.value.content) && renderItem.value.content) ||
    (isValidMarkdownContent(renderItem.value.md) && renderItem.value.md) ||
    (isValidMarkdownContent(renderItem.value.markdown) && renderItem.value.markdown) ||
    (isValidMarkdownContent(renderItem.value.text) && renderItem.value.text) ||
    "";
  if (direct) return;
  if (!rawUrl.value) return;

  markdownLoading.value = true;
  try {
    const resp = await fetch(rawUrl.value);
    if (resp.ok) {
      markdownFetchedContent.value = await resp.text();
    } else {
      markdownFetchedContent.value = `> 加载 Markdown 文件失败 (${resp.status} ${resp.statusText})：[${rawUrl.value}](${rawUrl.value})`;
    }
  } catch (e) {
    markdownFetchedContent.value = `> 加载 Markdown 文件失败：${e.message}\n\n[点击在新标签页打开](${rawUrl.value})`;
  } finally {
    markdownLoading.value = false;
  }
};

watch(
  () => [rawUrl.value, isMarkdownView.value],
  () => {
    loadMarkdownContent();
  },
  { immediate: true },
);

// iframe 加载状态：用于识别 X-Frame-Options / CSP 拒编导致的静默白屏
const iframeLoaded = ref(false);
const iframeBlocked = ref(false);
let iframeTimer = null;

const clearIframeTimer = () => {
  if (iframeTimer) {
    clearTimeout(iframeTimer);
    iframeTimer = null;
  }
};

watch(
  () => [webUrl.value, officeViewerUrl.value, isOfficeView.value, isPdfView.value],
  () => {
    clearIframeTimer();
    iframeLoaded.value = false;
    iframeBlocked.value = false;
    const target = isOfficeView.value
      ? officeViewerUrl.value
      : isPdfView.value
        ? webUrl.value || rawUrl.value
        : webUrl.value;
    if (!target) return;
    iframeTimer = setTimeout(() => {
      if (!iframeLoaded.value) iframeBlocked.value = true;
    }, 10000);
  },
);

const onIframeLoad = () => {
  iframeLoaded.value = true;
  iframeBlocked.value = false;
  clearIframeTimer();
};

onBeforeUnmount(clearIframeTimer);

const onHtmlUpdated = (newHtml) => {
  if (renderItem.value && newHtml && renderItem.value.html !== newHtml) {
    renderItem.value.html = newHtml;
    client.config?._saveStrogeConfig?.();
  }
};

const openInNewTab = () => {
  if (isOfficeView.value) {
    openExternal(officeViewerUrl.value || rawUrl.value);
    return;
  }
  if (isPdfView.value || isWebEmbed.value) {
    openExternal(webUrl.value || rawUrl.value);
    return;
  }
  if (isMarkdownView.value && rawUrl.value) {
    openExternal(rawUrl.value);
    return;
  }
  if (isHtmlView.value) {
    try {
      const blob = new Blob([htmlContent.value], {
        type: "text/html;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      ElMessage.error("打开新窗口失败: " + err.message);
    }
    return;
  }
  openExternal(rawUrl.value);
};

const openExternal = (url) => {
  if (url) {
    window.open(url, "_blank");
  }
};

const handleDownload = (url, name) => {
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = name || "download";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const handleCopy = async () => {
  try {
    const textToCopy = isMarkdownView.value
      ? markdownContent.value
      : isHtmlView.value
        ? htmlContent.value
        : isWebEmbed.value
          ? webUrl.value
          : rawUrl.value || JSON.stringify(renderItem.value, null, 2);
    await navigator.clipboard.writeText(textToCopy);
    ElMessage.success("已复制到剪贴板");
  } catch (err) {
    ElMessage.error("复制失败: " + err.message);
  }
};
</script>

<style lang="scss" scoped>
.workspace-render-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--mio-bg-page, #ffffff);
}

.render-header {
  height: 2.35rem;
  padding: 0 0.85rem;
  background: var(--mio-bg-surface, #ffffff);
  border-bottom: 1px solid var(--mio-border-color-light, #e4e7ed);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;

  .render-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
    min-width: 0;

    .type-badge {
      font-size: 0.6875rem;
      padding: 0.12rem 0.4rem;
      border-radius: 0.25rem;
      font-weight: 500;
      white-space: nowrap;

      &.badge-html,
      &.badge-iframe {
        background: rgba(0, 153, 255, 0.14);
        color: var(--mio-color-primary, #0099ff);
      }
      &.badge-web {
        background: rgba(14, 165, 233, 0.16);
        color: #0ea5e9;
      }
      &.badge-image {
        background: rgba(16, 185, 129, 0.16);
        color: #10b981;
      }
      &.badge-audio,
      &.badge-voice {
        background: rgba(245, 158, 11, 0.16);
        color: #f59e0b;
      }
      &.badge-video {
        background: rgba(239, 68, 68, 0.16);
        color: #ef4444;
      }
      &.badge-file,
      &.badge-document {
        background: rgba(59, 130, 246, 0.16);
        color: #3b82f6;
      }
      &.badge-office {
        background: rgba(37, 99, 235, 0.16);
        color: #2563eb;
      }
      &.badge-pdf {
        background: rgba(239, 68, 68, 0.16);
        color: #ef4444;
      }
      &.badge-markdown {
        background: rgba(8, 145, 178, 0.16);
        color: #0891b2;
      }
    }

    .render-title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--mio-text-primary, #303133);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tool-badge {
      font-size: 0.6875rem;
      color: var(--mio-text-secondary, #909399);
      background: var(--mio-bg-hover, rgba(0, 0, 0, 0.05));
      padding: 0.08rem 0.35rem;
      border-radius: 0.2rem;
      white-space: nowrap;
    }
  }

  .render-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      border-radius: 0.35rem;
      border: 1px solid var(--mio-border-color-light, #e4e7ed);
      background: transparent;
      color: var(--mio-text-secondary, #909399);
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: var(--mio-bg-hover, rgba(0, 0, 0, 0.05));
        color: var(--mio-text-primary, #303133);
        border-color: var(--mio-color-primary, #0099ff);
      }

      &.is-active {
        background: var(--mio-bg-primary-light, rgba(0, 153, 255, 0.12));
        color: var(--mio-color-primary, #0099ff);
        border-color: var(--mio-color-primary, #0099ff);
      }
    }
  }
}

.render-viewport {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 1rem;
  display: flex;
  flex-direction: column;

  &.is-source-mode {
    padding: 0;
  }

  /* 网页产物：iframe 独占视口，去掉内边距与滚动，避免双重滚动条 */
  &.is-embed-mode {
    padding: 0;
    overflow: hidden;
    position: relative;
  }
}

.render-iframe {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 320px;
  border: none;
  background-color: #fff;
  display: block;
}

.office-hint-banner {
  padding: 6px 14px;
  background: var(--mio-bg-surface-soft, rgba(0, 0, 0, 0.03));
  border-bottom: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.08));
  font-size: 0.75rem;
  color: var(--mio-text-secondary, #64748b);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.markdown-view-container {
  width: 100%;
  padding: 1.5rem;
  box-sizing: border-box;
  background: var(--mio-bg-page, #ffffff);
  min-height: 100%;
}

.embed-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mio-text-secondary, #909399);
  pointer-events: none;
}

.embed-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--mio-bg-page, #ffffff);

  .fallback-card {
    max-width: 420px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    align-items: center;

    .fallback-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--mio-text-primary, #303133);
    }

    .fallback-url {
      font-size: 0.75rem;
      color: var(--mio-text-secondary, #909399);
      word-break: break-all;
    }

    .fallback-btn {
      margin-top: 0.25rem;
      padding: 0.3rem 0.9rem;
      border-radius: 0.35rem;
      border: 1px solid var(--mio-color-primary, #0099ff);
      background: var(--mio-bg-primary-light, rgba(0, 153, 255, 0.12));
      color: var(--mio-color-primary, #0099ff);
      font-size: 0.8125rem;
      cursor: pointer;

      &:hover {
        background: var(--mio-bg-primary-light, rgba(0, 153, 255, 0.22));
      }
    }
  }
}

.source-view {
  height: 100%;
  overflow: auto;
  background: #18181c;

  .code-box {
    margin: 0;
    padding: 1rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8125rem;
    line-height: 1.6;
    color: #e2e8f0;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.html-view-container {
  width: 100%;
  display: flex;
  flex-direction: column;

  .html-card-wrapper {
    width: 100%;
    min-height: 200px;
    background: transparent;
  }
}

.image-view-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;

  .image-box {
    max-width: 100%;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    background: var(--mio-bg-card, #ffffff);

    .render-image {
      max-width: 100%;
      max-height: 80vh;
      display: block;
      object-fit: contain;
    }
  }
}

.audio-view-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;

  .audio-card {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.5rem 2rem;
    border-radius: 0.75rem;
    background: var(--mio-bg-card, #ffffff);
    border: 1px solid var(--mio-border-color-light, #e4e7ed);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    max-width: 480px;
    width: 100%;

    .audio-icon {
      color: var(--mio-color-primary, #0099ff);
      flex-shrink: 0;
    }

    .audio-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;

      .audio-title {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--mio-text-primary, #303133);
      }

      .audio-player {
        width: 100%;
      }
    }
  }
}

.video-view-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;

  .render-video {
    max-width: 100%;
    max-height: 80vh;
    border-radius: 0.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
}

.alert-view-container {
  width: 100%;
  max-width: 600px;
  margin: 1rem auto;
}

.generic-view-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;

  .generic-card {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-radius: 0.75rem;
    background: var(--mio-bg-card, #ffffff);
    border: 1px solid var(--mio-border-color-light, #e4e7ed);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    max-width: 500px;
    width: 100%;

    .card-icon {
      font-size: 1.8rem;
      flex-shrink: 0;
    }

    .card-body {
      flex: 1;
      overflow: hidden;

      .card-title {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--mio-text-primary, #303133);
      }

      .card-desc {
        font-size: 0.8125rem;
        color: var(--mio-text-secondary, #909399);
        margin-top: 0.35rem;
        line-height: 1.5;
      }

      .card-url {
        margin-top: 0.5rem;
        font-size: 0.75rem;
        word-break: break-all;

        a {
          color: var(--mio-color-primary, #0099ff);
          text-decoration: underline;
        }
      }

      .card-action-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 1rem;

        .generic-download-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 6px;
          background: var(--mio-color-primary, #0099ff);
          color: #ffffff;
          font-size: 12px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            opacity: 0.9;
            transform: translateY(-1px);
          }
        }

        .generic-secondary-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          background: var(--mio-bg-surface-soft, rgba(0, 0, 0, 0.04));
          border: 1px solid var(--mio-border-color-light, #e4e7ed);
          color: var(--mio-text-secondary, #606266);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            border-color: var(--mio-color-primary, #0099ff);
            color: var(--mio-color-primary, #0099ff);
          }
        }
      }
    }
  }
}
</style>
