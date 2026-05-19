<template>
  <el-dialog 
    v-model="store.showTraceModal" 
    title="异常堆栈诊断追踪" 
    width="680px" 
    class="saas-dialog"
    destroy-on-close
  >
    <div v-if="store.activeTrace" class="trace-modal-body">
      <div class="trace-info-grid">
        <div class="info-row">
          <span class="info-label">Request ID</span>
          <span class="info-value mono-text select-all">{{ store.activeTrace.requestId }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">服务实例 (Provider)</span>
          <span class="info-value">{{ store.activeTrace.provider || 'unknown' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">发生时间</span>
          <span class="info-value">{{ formatTime(store.activeTrace.createdAt) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">异常模型</span>
          <span class="info-value">
            <el-tag size="small" type="danger" effect="plain">{{ store.activeTrace.model }}</el-tag>
          </span>
        </div>
      </div>
      
      <div class="error-summary-box">
        <span class="box-title">错误摘要</span>
        <p class="error-message">{{ store.activeTrace.errorMessage || 'No error message.' }}</p>
      </div>

      <div class="stack-trace-container">
        <div class="stack-header">
          <span>异常追踪调用栈 (Stack Trace)</span>
        </div>
        <pre class="stack-content"><code>{{ store.activeTrace.errorStack || 'No stack trace captured.' }}</code></pre>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { useDashboardStore } from '@/stores/dashboardStore'

const store = useDashboardStore()

function formatTime(timestamp) {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}
</script>

<style scoped>
.trace-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trace-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: #f8fafc;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 600;
}

.info-value {
  font-size: 13px;
  color: #334155;
  font-weight: 500;
}

.mono-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #2563eb;
}

.select-all {
  user-select: all;
}

.error-summary-box {
  background: #fff5f5;
  border: 1px solid #fee2e2;
  border-radius: 10px;
  padding: 16px;
}

.box-title {
  font-size: 12px;
  font-weight: 600;
  color: #b91c1c;
  display: block;
  margin-bottom: 6px;
}

.error-message {
  margin: 0;
  font-size: 13px;
  color: #991b1b;
  line-height: 1.5;
  font-weight: 500;
}

.stack-trace-container {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.stack-header {
  background: #f8fafc;
  padding: 10px 16px;
  font-size: 12px;
  color: #475569;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
}

.stack-content {
  margin: 0;
  padding: 16px;
  background: #fafafa;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  color: #334155;
  max-height: 240px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

:deep(.el-dialog) {
  border-radius: 12px !important;
}

:deep(.el-dialog__header) {
  margin-right: 0px !important;
  padding-bottom: 12px !important;
  border-bottom: 1px solid #f1f5f9 !important;
}

:deep(.el-dialog__title) {
  font-size: 16px !important;
  font-weight: 600 !important;
  color: #0f172a !important;
}

:deep(.el-dialog__body) {
  padding: 24px 20px !important;
}
</style>
