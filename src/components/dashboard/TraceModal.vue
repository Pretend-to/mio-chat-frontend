<template>
  <el-dialog
    v-model="store.showTraceModal"
    title="异常堆栈诊断追踪"
    width="min(1040px, calc(100vw - 32px))"
    align-center
    class="saas-dialog"
    destroy-on-close
  >
    <div
      v-if="store.activeTrace"
      v-loading="store.loadingFailureTrace"
      class="trace-modal-body"
    >
      <div class="trace-info-grid">
        <div class="info-row">
          <span class="info-label">Request ID</span>
          <span class="info-value mono-text select-all">{{
            store.activeTrace.requestId
          }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">服务实例</span>
          <span class="info-value">{{
            store.activeTrace.provider || "unknown"
          }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">发生时间</span>
          <span class="info-value">{{
            formatTime(store.activeTrace.createdAt)
          }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">异常模型</span>
          <span class="info-value">
            <el-tag size="small" type="danger" effect="plain">{{
              store.activeTrace.model
            }}</el-tag>
          </span>
        </div>
      </div>

      <div class="error-summary-box">
        <span class="box-title">错误摘要</span>
        <p class="error-message">
          {{ store.activeTrace.errorMessage || "No error message." }}
        </p>
      </div>

      <section class="request-diagnostics">
        <div class="stack-header request-header">
          <span
            >失败请求体<span v-if="diagnostics?.round">
              · 第 {{ diagnostics.round }} 轮</span
            ></span
          >
          <el-button v-if="selectedBody" size="small" @click="copyRequest"
            >复制 JSON</el-button
          >
        </div>
        <template v-if="sections.length">
          <el-tabs v-model="selectedSection">
            <el-tab-pane
              v-for="section in sections"
              :key="section.key"
              :name="section.key"
              :label="section.label"
            />
          </el-tabs>
          <p class="request-hint">
            认证凭据和内联二进制内容已脱敏；消息正文与工具定义保留。
          </p>
          <details v-if="tools.length" class="request-section">
            <summary>工具定义 · {{ tools.length }} 个</summary>
            <div class="tool-list">
              <details
                v-for="tool in tools"
                :key="tool.path"
                class="tool-schema"
              >
                <summary>
                  {{ tool.name }}
                  <span class="request-hint">{{ tool.path }}</span>
                </summary>
                <pre
                  class="stack-content"
                ><code>{{ formatDiagnosticJson(tool.schema) }}</code></pre>
              </details>
            </div>
          </details>
          <details class="request-section" open>
            <summary>完整请求 JSON</summary>
            <pre
              class="stack-content request-content"
            ><code>{{ formatDiagnosticJson(selectedBody) }}</code></pre>
          </details>
        </template>
        <p v-else class="request-hint">
          此记录未保存请求体（历史记录无法补采）。
        </p>
      </section>

      <div class="stack-trace-container">
        <div class="stack-header">
          <span>异常追踪调用栈</span>
        </div>
        <pre
          class="stack-content"
        ><code>{{ store.activeTrace.errorStack || 'No stack trace captured.' }}</code></pre>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  parseRequestDiagnostics,
  requestBodySections,
  requestTools,
  formatDiagnosticJson,
} from "@/lib/requestDiagnostics.js";
import { useDashboardStore } from "@/stores/dashboardStore";

const store = useDashboardStore();
const diagnostics = computed(() =>
  parseRequestDiagnostics(store.activeTrace?.requestBody),
);
const sections = computed(() =>
  requestBodySections(store.activeTrace?.requestBody),
);
const selectedSection = ref("");
watch(
  sections,
  (value) => {
    selectedSection.value = value[0]?.key || "";
  },
  { immediate: true },
);
const selectedBody = computed(
  () =>
    sections.value.find((section) => section.key === selectedSection.value)
      ?.body,
);
const tools = computed(() => requestTools(selectedBody.value));
async function copyRequest() {
  try {
    await navigator.clipboard.writeText(
      formatDiagnosticJson(selectedBody.value),
    );
    ElMessage.success("请求体已复制");
  } catch {
    ElMessage.error("复制失败，可在请求体区域选中复制");
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
}
</script>

<style scoped>
.trace-modal-body {
  max-height: calc(100dvh - 180px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trace-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: var(--mio-bg-hover, #f8fafc);
  padding: 16px;
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  border-radius: 10px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  color: var(--mio-text-secondary, #94a3b8);
  text-transform: uppercase;
  font-weight: 600;
}

.info-value {
  font-size: 13px;
  color: var(--mio-text-primary, #334155);
  font-weight: 500;
}

.mono-text {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  color: var(--mio-color-primary, #2563eb);
}

.select-all {
  user-select: all;
}

.error-summary-box {
  background: var(--mio-bg-danger-light, #fff5f5);
  border: 1px solid rgba(245, 108, 108, 0.3);
  border-radius: 10px;
  padding: 16px;
}

.box-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--mio-color-danger, #b91c1c);
  display: block;
  margin-bottom: 6px;
}

.error-message {
  margin: 0;
  font-size: 13px;
  color: var(--mio-color-danger, #991b1b);
  line-height: 1.5;
  font-weight: 500;
}

.stack-trace-container {
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
}

.stack-header {
  background: var(--mio-bg-hover, #f8fafc);
  padding: 10px 16px;
  font-size: 12px;
  color: var(--mio-text-secondary, #475569);
  font-weight: 600;
  border-bottom: 1px solid var(--mio-border-color-light, #e2e8f0);
}

.stack-content {
  margin: 0;
  padding: 16px;
  background: var(--mio-bg-page, #fafafa);
  font-family: "JetBrains Mono", monospace;
  font-size: 11.5px;
  color: var(--mio-text-regular, #334155);
  max-height: 240px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

:deep(.el-dialog) {
  border-radius: 12px !important;
  background-color: var(--mio-bg-card, #ffffff) !important;
}

:deep(.el-dialog__header) {
  margin-right: 0px !important;
  padding-bottom: 12px !important;
  border-bottom: 1px solid var(--mio-border-color-lighter, #f1f5f9) !important;
  background-color: var(--mio-bg-card, #ffffff) !important;
}

:deep(.el-dialog__title) {
  font-size: 16px !important;
  font-weight: 600 !important;
  color: var(--mio-text-primary, #0f172a) !important;
}

:deep(.el-dialog__body) {
  padding: 24px 20px !important;
  max-height: calc(100dvh - 160px);
  overflow-y: auto;
  background-color: var(--mio-bg-card, #ffffff) !important;
}
</style>

<style scoped>
.request-diagnostics {
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
}
.request-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.request-diagnostics :deep(.el-tabs__header) {
  padding: 0 16px;
  margin-bottom: 0;
}
.request-hint {
  color: var(--mio-text-secondary, #64748b);
  font-size: 12px;
  overflow-wrap: anywhere;
}
p.request-hint {
  padding: 0 16px;
}
.request-section > summary,
.tool-schema > summary {
  cursor: pointer;
  padding: 10px 16px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.tool-list {
  max-height: 320px;
  overflow-y: auto;
}
.tool-schema {
  margin: 0 12px 8px;
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  border-radius: 6px;
}
.request-content {
  max-height: 420px;
  white-space: pre;
  overflow: auto;
}
</style>
