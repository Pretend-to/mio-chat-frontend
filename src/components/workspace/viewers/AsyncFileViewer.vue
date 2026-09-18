<template>
  <div class="async-file-viewer-container" :class="[themeClass]">
    <Transition name="viewer-crossfade" mode="out-in">
      <!-- 阶段 1 & 2：骨架屏与过渡加载动画 -->
      <div
        v-if="isLoading || hasLoadError"
        key="loading-or-error"
        class="viewer-placeholder-layer"
      >
        <!-- 发生错误状态 -->
        <div v-if="hasLoadError" class="viewer-error-card">
          <div class="error-icon-box">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 class="error-title">文件预览加载失败</h3>
          <p class="error-desc">{{ errorMessage || "文档格式暂不支持直接解析或内容加载超时" }}</p>
          <div class="error-meta" v-if="displayFileName">
            <span class="file-name-tag">{{ displayFileName }}</span>
          </div>
          <div class="error-actions">
            <button class="retry-btn" @click="handleRetry">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
              <span>重新加载</span>
            </button>
            <button
              v-if="downloadableUrl"
              class="download-btn"
              @click="handleDownload"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>下载源文件</span>
            </button>
          </div>
        </div>

        <!-- 骨架屏与过渡加载状态 -->
        <div v-else class="viewer-skeleton-wrapper">
          <!-- 仿真模拟工具栏 -->
          <div class="skeleton-toolbar">
            <div class="tool-group left">
              <div class="skeleton-pill short pulse-anim"></div>
              <div class="skeleton-pill medium pulse-anim"></div>
            </div>
            <div class="tool-group center">
              <div class="skeleton-badge pulse-anim"></div>
            </div>
            <div class="tool-group right">
              <div class="skeleton-btn pulse-anim"></div>
              <div class="skeleton-btn pulse-anim"></div>
            </div>
          </div>

          <!-- 文档主体骨架仿真视口 -->
          <div class="skeleton-viewport">
            <div class="skeleton-doc-sheet" :style="{ borderColor: docTypeInfo.accentColor }">
              <!-- 顶部装饰色条 -->
              <div
                class="doc-sheet-banner"
                :style="{ background: docTypeInfo.accentColor }"
              ></div>

              <!-- 文档中心动态气泡与状态 -->
              <div class="sheet-center-card">
                <div
                  class="brand-icon-bubble"
                  :style="{
                    background: docTypeInfo.bgColor,
                    color: docTypeInfo.accentColor,
                    boxShadow: `0 8px 24px ${docTypeInfo.shadowColor}`
                  }"
                >
                  <component :is="docTypeInfo.iconComponent" />
                </div>

                <div class="doc-title-row">
                  <span class="doc-file-name" :title="displayFileName">{{ displayFileName }}</span>
                  <span
                    class="doc-tag"
                    :style="{ color: docTypeInfo.accentColor, backgroundColor: docTypeInfo.bgColor }"
                  >
                    {{ docTypeInfo.tagText }}
                  </span>
                </div>

                <!-- 进度条扫描 -->
                <div class="status-scan-bar">
                  <div
                    class="scan-progress-indicator"
                    :style="{ background: docTypeInfo.accentColor }"
                  ></div>
                </div>

                <!-- 动态状态提示文字 -->
                <div class="loading-status-text">
                  <span class="loading-spinner"></span>
                  <span class="status-label">{{ loadingStatusText }}</span>
                </div>
              </div>

              <!-- 仿真排版条纹 (Shimmer 线条) -->
              <div class="skeleton-lines-group">
                <div class="skeleton-line shimmer w-90"></div>
                <div class="skeleton-line shimmer w-75"></div>
                <div class="skeleton-line shimmer w-85"></div>
                <div class="skeleton-line shimmer w-60"></div>
                <div class="skeleton-line shimmer w-95" style="margin-top: 14px;"></div>
                <div class="skeleton-line shimmer w-80"></div>
                <div class="skeleton-line shimmer w-70"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 阶段 3：已完成初始化，挂载并渲染真实 OpenFileViewer -->
      <div
        v-else
        key="viewer-ready"
        class="viewer-active-wrapper"
      >
        <component
          :is="activeViewerComponent"
          :file="resolvedFileSource"
          :file-name="displayFileName"
          :width="width"
          :height="height"
          :fit="fit"
          :toolbar="toolbar"
          :theme="computedTheme"
          :plugins="activePlugins"
          @load="onViewerLoaded"
          @error="onViewerError"
          @unsupported="onViewerUnsupported"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, shallowRef, watch, onMounted, h } from "vue";

const props = defineProps({
  file: {
    type: [String, Object, File, Blob, ArrayBuffer],
    required: true,
  },
  fileName: {
    type: String,
    default: "",
  },
  fileType: {
    type: String,
    default: "",
  },
  width: {
    type: [String, Number],
    default: "100%",
  },
  height: {
    type: [String, Number],
    default: "100%",
  },
  fit: {
    type: String,
    default: "contain",
  },
  toolbar: {
    type: [Boolean, Object],
    default: true,
  },
  theme: {
    type: String,
    default: "auto",
  },
});

const emit = defineEmits(["load", "error", "unsupported"]);

// 状态控制
const isLoading = ref(true);
const loadingPhase = ref("engine"); // "engine" | "parsing" | "ready"
const hasLoadError = ref(false);
const errorMessage = ref("");

// 异步组件与插件缓存
const activeViewerComponent = shallowRef(null);
const activePlugins = shallowRef([]);

// 引擎单例引用缓存，避免同一个页面重复动态加载脚本
let cachedModules = null;

// 从文件名或 URL 提取扩展名
const detectedExt = computed(() => {
  const target = props.fileName || (typeof props.file === "string" ? props.file : "");
  if (!target) return "";
  const clean = target.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
});

// 展示文件名
const displayFileName = computed(() => {
  if (props.fileName) return props.fileName;
  if (typeof props.file === "string") {
    const clean = props.file.split("?")[0].split("#")[0];
    return clean.split("/").pop() || "文档";
  }
  if (props.file instanceof File) {
    return props.file.name;
  }
  return "未命名文件";
});

// 下载 URL
const downloadableUrl = computed(() => {
  if (typeof props.file === "string" && props.file.startsWith("http")) {
    return props.file;
  }
  return "";
});

// 动态状态提示文本
const loadingStatusText = computed(() => {
  if (loadingPhase.value === "engine") {
    return "正在按需加载文档引擎 (首次启动中)...";
  }
  if (loadingPhase.value === "parsing") {
    return `正在解析 ${displayFileName.value}...`;
  }
  return "正在加载并渲染文档...";
});

// 解析出来的文件源
const resolvedFileSource = computed(() => {
  return props.file;
});

// 计算主题
const computedTheme = computed(() => {
  if (props.theme && props.theme !== "auto") return props.theme;
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
  return "light";
});

const themeClass = computed(() => {
  return computedTheme.value === "dark" ? "theme-dark" : "theme-light";
});

// 各种文件格式的色彩与图标配置
const docTypeInfo = computed(() => {
  const ext = detectedExt.value;
  const type = (props.fileType || "").toLowerCase();

  // Word 文档
  if (["doc", "docx", "dot", "rtf", "odt", "wps"].includes(ext) || type === "word" || type === "docx") {
    return {
      tagText: "Word 文档",
      accentColor: "#2b579a",
      bgColor: "rgba(43, 87, 154, 0.12)",
      shadowColor: "rgba(43, 87, 154, 0.2)",
      iconComponent: () =>
        h("svg", { width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, [
          h("path", { d: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" }),
          h("polyline", { points: "14 2 14 8 20 8" }),
          h("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
          h("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
          h("line", { x1: "10", y1: "9", x2: "8", y2: "9" }),
        ]),
    };
  }

  // Excel 表格
  if (["xls", "xlsx", "csv", "xlsm", "xlsb", "et"].includes(ext) || type === "excel" || type === "xlsx") {
    return {
      tagText: "Excel 表格",
      accentColor: "#217346",
      bgColor: "rgba(33, 115, 70, 0.12)",
      shadowColor: "rgba(33, 115, 70, 0.2)",
      iconComponent: () =>
        h("svg", { width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, [
          h("path", { d: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" }),
          h("polyline", { points: "14 2 14 8 20 8" }),
          h("path", { d: "M8 13h8M8 17h8M12 10v10" }),
        ]),
    };
  }

  // PPT 幻灯片
  if (["ppt", "pptx", "pps", "pptm", "dps"].includes(ext) || type === "ppt" || type === "pptx") {
    return {
      tagText: "PowerPoint",
      accentColor: "#d24726",
      bgColor: "rgba(210, 71, 38, 0.12)",
      shadowColor: "rgba(210, 71, 38, 0.2)",
      iconComponent: () =>
        h("svg", { width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, [
          h("path", { d: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" }),
          h("polyline", { points: "14 2 14 8 20 8" }),
          h("circle", { cx: "12", cy: "14", r: "3" }),
        ]),
    };
  }

  // PDF 文档
  if (ext === "pdf" || type === "pdf") {
    return {
      tagText: "PDF 文档",
      accentColor: "#e11d48",
      bgColor: "rgba(225, 29, 72, 0.12)",
      shadowColor: "rgba(225, 29, 72, 0.2)",
      iconComponent: () =>
        h("svg", { width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, [
          h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
          h("polyline", { points: "14 2 14 8 20 8" }),
          h("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
          h("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
          h("polyline", { points: "10 9 9 9 8 9" }),
        ]),
    };
  }

  // 压缩包
  if (["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"].includes(ext) || type === "archive") {
    return {
      tagText: "压缩归档",
      accentColor: "#8b5cf6",
      bgColor: "rgba(139, 92, 246, 0.12)",
      shadowColor: "rgba(139, 92, 246, 0.2)",
      iconComponent: () =>
        h("svg", { width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, [
          h("polyline", { points: "21 8 21 21 3 21 3 8" }),
          h("rect", { x: "1", y: "3", width: "22", height: "5" }),
          h("line", { x1: "10", y1: "12", x2: "14", y2: "12" }),
        ]),
    };
  }

  // 思维导图 / 白板绘图
  if (["xmind", "drawio", "dio", "excalidraw", "tldraw"].includes(ext)) {
    return {
      tagText: "图表与思维导图",
      accentColor: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.12)",
      shadowColor: "rgba(245, 158, 11, 0.2)",
      iconComponent: () =>
        h("svg", { width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, [
          h("circle", { cx: "12", cy: "12", r: "3" }),
          h("path", { d: "M3 12h6M15 12h6M12 3v6M12 15v6" }),
        ]),
    };
  }

  // 默认通用文件
  return {
    tagText: ext ? ext.toUpperCase() : "文档",
    accentColor: "#4f46e5",
    bgColor: "rgba(79, 70, 229, 0.12)",
    shadowColor: "rgba(79, 70, 229, 0.2)",
    iconComponent: () =>
      h("svg", { width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, [
        h("path", { d: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" }),
        h("polyline", { points: "13 2 13 9 20 9" }),
      ]),
  };
});

/** 核心动态加载逻辑 */
const loadEngine = async () => {
  isLoading.value = true;
  hasLoadError.value = false;
  errorMessage.value = "";
  loadingPhase.value = "engine";

  try {
    // 首次拉取或使用已缓存模块
    if (!cachedModules) {
      const [vueAdapter, coreModule, pdfWorkerModule] = await Promise.all([
        import("@open-file-viewer/vue"),
        import("@open-file-viewer/core"),
        import("pdfjs-dist/build/pdf.worker.mjs?url"),
        import("@open-file-viewer/core/style.css"),
      ]);

      cachedModules = {
        OpenFileViewer: vueAdapter.OpenFileViewer,
        core: coreModule,
        pdfWorkerSrc: pdfWorkerModule.default || pdfWorkerModule,
      };
    }

    const { OpenFileViewer, core, pdfWorkerSrc } = cachedModules;

    // 组装并配置各格式专属插件
    const plugins = [
      core.officePlugin(),
      core.pdfPlugin({
        workerSrc: pdfWorkerSrc,
        useFetchData: false,
      }),
      core.archivePlugin(),
      core.imagePlugin(),
      core.drawingPlugin(),
      core.xmindPlugin(),
      core.textPlugin(),
      core.fallbackPlugin(),
    ];

    activeViewerComponent.value = OpenFileViewer;
    activePlugins.value = plugins;

    loadingPhase.value = "parsing";

    // 留出微小的缓冲时间让 Vue 挂载容器并展现过渡动效
    setTimeout(() => {
      isLoading.value = false;
      loadingPhase.value = "ready";
    }, 180);
  } catch (err) {
    console.error("[AsyncFileViewer] 加载文件预览引擎失败:", err);
    hasLoadError.value = true;
    errorMessage.value = err?.message || "按需下载文档解析引擎失败，请检查网络连接";
    isLoading.value = false;
    emit("error", err);
  }
};

const onViewerLoaded = (payload) => {
  isLoading.value = false;
  hasLoadError.value = false;
  emit("load", payload);
};

const onViewerError = (err) => {
  console.warn("[AsyncFileViewer] 渲染中捕获错误:", err);
  emit("error", err);
};

const onViewerUnsupported = (file) => {
  emit("unsupported", file);
};

const handleRetry = () => {
  loadEngine();
};

const handleDownload = () => {
  if (!downloadableUrl.value) return;
  const a = document.createElement("a");
  a.href = downloadableUrl.value;
  a.download = displayFileName.value || "download";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

watch(
  () => [props.file, props.fileName],
  () => {
    loadEngine();
  }
);

onMounted(() => {
  loadEngine();
});
</script>

<style lang="scss" scoped>
.async-file-viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--mio-bg-page, #ffffff);
  overflow: hidden;
}

/* 占位骨架与错误层 */
.viewer-placeholder-layer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  background: var(--mio-bg-page, #ffffff);
}

/* 激活的真实渲染层 */
.viewer-active-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  :deep(.ofv-container) {
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    border-radius: 0 !important;
    background: transparent !important;
  }
}

/* 错误卡片 */
.viewer-error-card {
  margin: auto;
  padding: 2.5rem 2rem;
  max-width: 420px;
  width: 90%;
  text-align: center;
  border-radius: 12px;
  background: var(--mio-bg-surface, #ffffff);
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);

  .error-icon-box {
    width: 64px;
    height: 64px;
    margin: 0 auto 1.25rem;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--mio-text-primary, #1e293b);
    margin: 0 0 0.5rem;
  }

  .error-desc {
    font-size: 0.875rem;
    color: var(--mio-text-secondary, #64748b);
    margin: 0 0 1rem;
    line-height: 1.5;
  }

  .error-meta {
    margin-bottom: 1.5rem;

    .file-name-tag {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 6px;
      background: var(--mio-bg-hover, #f1f5f9);
      color: var(--mio-text-regular, #475569);
      font-size: 0.8125rem;
      font-family: monospace;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .error-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;

    button {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .retry-btn {
      background: var(--mio-color-primary, #4f46e5);
      color: #ffffff;
      border: none;

      &:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
    }

    .download-btn {
      background: transparent;
      border: 1px solid var(--mio-border-color, #cbd5e1);
      color: var(--mio-text-regular, #475569);

      &:hover {
        background: var(--mio-bg-hover, #f8fafc);
        color: var(--mio-text-primary, #0f172a);
      }
    }
  }
}

/* 骨架屏布局 */
.viewer-skeleton-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.skeleton-toolbar {
  height: 44px;
  padding: 0 1.25rem;
  border-bottom: 1px solid var(--mio-border-color-light, #f1f5f9);
  background: var(--mio-bg-surface, #ffffff);
  display: flex;
  align-items: center;
  justify-content: space-between;

  .tool-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .skeleton-pill {
    height: 16px;
    border-radius: 4px;
    background: var(--mio-bg-hover, #e2e8f0);

    &.short { width: 36px; }
    &.medium { width: 64px; }
  }

  .skeleton-badge {
    height: 20px;
    width: 80px;
    border-radius: 10px;
    background: var(--mio-bg-hover, #e2e8f0);
  }

  .skeleton-btn {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: var(--mio-bg-hover, #e2e8f0);
  }
}

.skeleton-viewport {
  flex: 1;
  padding: 2rem 1.5rem;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: var(--mio-bg-page, #f8fafc);
}

.skeleton-doc-sheet {
  width: 100%;
  max-width: 680px;
  min-height: 480px;
  background: var(--mio-bg-surface, #ffffff);
  border-radius: 10px;
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;

  .doc-sheet-banner {
    height: 4px;
    width: 100%;
  }

  .sheet-center-card {
    padding: 3rem 2rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .brand-icon-bubble {
    width: 68px;
    height: 68px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.25rem;
    animation: icon-float 2.4s ease-in-out infinite alternate;
  }

  .doc-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    max-width: 90%;

    .doc-file-name {
      font-size: 1.0625rem;
      font-weight: 600;
      color: var(--mio-text-primary, #0f172a);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .doc-tag {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
  }

  .status-scan-bar {
    width: 220px;
    height: 4px;
    border-radius: 2px;
    background: var(--mio-bg-hover, #e2e8f0);
    overflow: hidden;
    margin-bottom: 1rem;
    position: relative;

    .scan-progress-indicator {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 40%;
      border-radius: 2px;
      animation: scan-move 1.6s ease-in-out infinite;
    }
  }

  .loading-status-text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--mio-text-secondary, #64748b);

    .loading-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid var(--mio-border-color, #cbd5e1);
      border-top-color: var(--mio-color-primary, #4f46e5);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  }

  .skeleton-lines-group {
    padding: 1rem 2.5rem 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    .skeleton-line {
      height: 12px;
      border-radius: 4px;
      background: var(--mio-bg-hover, #f1f5f9);

      &.w-95 { width: 95%; }
      &.w-90 { width: 90%; }
      &.w-85 { width: 85%; }
      &.w-80 { width: 80%; }
      &.w-75 { width: 75%; }
      &.w-70 { width: 70%; }
      &.w-60 { width: 60%; }
    }
  }
}

/* 动效关键帧 */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes icon-float {
  0% { transform: translateY(0) scale(1); }
  100% { transform: translateY(-6px) scale(1.03); }
}

@keyframes scan-move {
  0% { left: -40%; }
  50% { left: 40%; width: 50%; }
  100% { left: 100%; width: 30%; }
}

@keyframes shimmer-sweep {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.shimmer {
  background: linear-gradient(
    90deg,
    var(--mio-bg-hover, #f1f5f9) 25%,
    var(--mio-bg-surface, #e2e8f0) 50%,
    var(--mio-bg-hover, #f1f5f9) 75%
  ) !important;
  background-size: 200% 100% !important;
  animation: shimmer-sweep 2s infinite ease-in-out;
}

.pulse-anim {
  opacity: 0.7;
  animation: pulse-op 1.5s infinite alternate ease-in-out;
}

@keyframes pulse-op {
  0% { opacity: 0.5; }
  100% { opacity: 0.85; }
}

/* 平滑过渡 crossfade */
.viewer-crossfade-enter-active,
.viewer-crossfade-leave-active {
  transition: opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1), transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.viewer-crossfade-enter-from {
  opacity: 0;
  transform: scale(0.995);
}

.viewer-crossfade-leave-to {
  opacity: 0;
  transform: scale(1.005);
}

/* 深色模式适配微调 */
.theme-dark {
  .skeleton-doc-sheet {
    background: #1e293b;
    border-color: #334155;
  }

  .skeleton-toolbar {
    background: #0f172a;
    border-bottom-color: #1e293b;
  }

  .skeleton-viewport {
    background: #090d16;
  }

  .viewer-error-card {
    background: #1e293b;
    border-color: #334155;
  }
}
</style>
