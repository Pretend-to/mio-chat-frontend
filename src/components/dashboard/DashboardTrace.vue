<template>
  <div class="trace-view-container">
    <div class="row-flex">
      <!-- Left Column: Turns List -->
      <div class="left-col-4">
        <div class="saas-card list-card">
          <div class="card-header border-b">
            <span class="card-title">最近活跃对话流</span>
          </div>
          <div class="turns-list-scroll">
            <div v-if="store.toolCallTurns.length === 0" class="empty-state">
              暂无对话记录
            </div>

            <div
              v-for="turn in store.toolCallTurns"
              :key="turn.requestId"
              @click="store.selectTurn(turn)"
              class="turn-item"
              :class="{
                active: store.activeTurn?.requestId === turn.requestId,
              }"
            >
              <div class="turn-header">
                <span class="turn-id" :title="turn.requestId">
                  {{ getTurnTitle(turn) }}
                </span>
                <el-tag
                  size="small"
                  :type="turn.stepsCount > 1 ? 'danger' : 'info'"
                  class="turn-tag"
                  effect="plain"
                >
                  {{ turn.stepsCount > 1 ? "递归多步" : "单步" }}
                </el-tag>
              </div>
              <div class="turn-meta">
                <span><i class="fa-solid fa-user"></i> {{ turn.user }}</span>
                <span
                  ><i class="fa-solid fa-cube"></i> {{ turn.presetName }}</span
                >
              </div>
              <div class="turn-footer">
                <span
                  ><i class="fa-regular fa-clock"></i>
                  {{ formatTime(turn.createdAt) }}</span
                >
                <span class="turn-tokens">
                  <i class="fa-solid fa-coins"></i>
                  {{ formatNumber(turn.totalTokens) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Timeline Cascading Trace -->
      <div class="right-col-8">
        <div class="saas-card timeline-card">
          <div class="card-header border-b">
            <span class="card-title">调用级联链路分析 (Trace)</span>
            <span class="total-tokens-badge" v-if="store.activeTurn">
              累计:
              <strong>{{ formatNumber(store.activeTurn.totalTokens) }}</strong>
              Tokens
            </span>
          </div>

          <div v-if="!store.activeTurn" class="trace-empty-container">
            <i class="fa-solid fa-diagram-next empty-icon"></i>
            <p class="empty-text">请在左侧选择一个对话查看级联链路</p>
          </div>

          <div v-else class="trace-timeline-scroll">
            <div class="timeline-container">
              <div
                v-for="(step, index) in store.activeTurn.steps"
                :key="index"
                class="timeline-node"
              >
                <!-- Timeline indicator column -->
                <div class="node-indicator">
                  <div class="node-dot" :class="step.type">
                    <i
                      :class="
                        step.type === 'tool'
                          ? 'fa-solid fa-wrench'
                          : 'fa-solid fa-brain'
                      "
                    ></i>
                  </div>
                  <div
                    class="node-line"
                    v-if="index < store.activeTurn.steps.length - 1"
                  ></div>
                </div>

                <!-- Timeline card content -->
                <div class="node-content-card">
                  <div class="step-card-header">
                    <span class="step-time">{{
                      formatTime(step.timestamp)
                    }}</span>
                    <span class="step-badge" :class="step.type">
                      {{ step.type === "tool" ? "Tool Call" : "LLM Inference" }}
                    </span>
                    <span class="step-model-tag" v-if="step.model">
                      {{ step.provider }} / {{ step.model }}
                    </span>
                    <el-tag
                      v-if="step.cacheHitTokens > 0"
                      size="small"
                      type="success"
                      effect="light"
                      class="cache-badge"
                    >
                      <i class="fa-solid fa-bolt"></i> 缓存命中: {{ formatNumber(step.cacheHitTokens) }} Tokens ({{ Math.round((step.cacheHitTokens / (step.cacheHitTokens + step.cacheMissTokens)) * 100) }}%)
                    </el-tag>
                  </div>

                  <div class="step-details">
                    <h4 class="step-title">
                      {{
                        step.type === "tool"
                          ? `执行工具: ${step.toolName}`
                          : "对话大模型推理"
                      }}
                    </h4>

                    <!-- LLM fields -->
                    <div v-if="step.type === 'llm'" class="llm-fields">
                      <div class="metric-row">
                        <span class="metric-item"
                          >输入 Token:
                          <strong>{{ step.promptTokens }}</strong></span
                        >
                        <span class="metric-item"
                          >输出 Token:
                          <strong>{{ step.candidatesTokens }}</strong></span
                        >
                        <span class="metric-item latency" v-if="step.ttft">
                          首字延迟: <strong>{{ step.ttft }}ms</strong>
                        </span>
                        <span class="metric-item cache" v-if="step.cacheHitTokens !== undefined">
                          缓存命中:
                          <strong :style="{ color: step.cacheHitTokens > 0 ? '#10b981' : '#64748b' }">
                            {{ formatNumber(step.cacheHitTokens) }}
                          </strong>
                        </span>
                        <span class="metric-item cache-rate" v-if="step.cacheHitTokens !== undefined">
                          缓存命中率:
                          <strong :style="{ color: step.cacheHitTokens > 0 ? '#10b981' : '#64748b' }">
                            {{ step.cacheHitTokens + step.cacheMissTokens > 0 ? Math.round((step.cacheHitTokens / (step.cacheHitTokens + step.cacheMissTokens)) * 100) : 0 }}%
                          </strong>
                        </span>
                      </div>

                      <div
                        v-if="step.toolsCalled && step.toolsCalled.length"
                        class="tools-called-box"
                      >
                        <span class="box-label"
                          ><i class="fa-solid fa-code-branch"></i>
                          触发的后续工具:</span
                        >
                        <div class="tags-group">
                          <el-tag
                            v-for="t in step.toolsCalled"
                            :key="t"
                            size="small"
                            type="warning"
                            effect="dark"
                          >
                            {{ t }}
                          </el-tag>
                        </div>
                      </div>
                    </div>

                    <!-- Tool fields -->
                    <div v-if="step.type === 'tool'" class="tool-fields">
                      <div class="code-editor-box">
                        <div class="code-box-header">
                          <span>参数与返回值</span>
                        </div>
                        <pre
                          class="code-box-content"
                        ><code>参数: {{ step.arguments }}
返回值: {{ step.output }}</code></pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useDashboardStore } from "@/stores/dashboardStore";
import { useContactorsStore } from "@/stores/contactorsStore";

const store = useDashboardStore();
const contactorsStore = useContactorsStore();

function getTurnTitle(turn) {
  // 1. 优先使用后端入库的全局会话标题
  if (turn.sessionTitle) {
    return turn.sessionTitle;
  }

  // 2. 如果是系统生成标题的任务
  if (turn.presetName && (turn.presetName.toLowerCase().startsWith("system_title") || turn.presetName.toLowerCase().includes("title"))) {
    return "🏷️ 自动生成会话标题";
  }
  if (turn.requestId && turn.requestId.startsWith("system_title")) {
    return "🏷️ 自动生成会话标题";
  }

  // 3. 如果是当前用户的会话，尝试联动 LocalStorage 兜底
  if (turn.contactorId && contactorsStore.contactors[turn.contactorId]) {
    return contactorsStore.contactors[turn.contactorId].name || turn.presetName || "常规对话";
  }

  // 4. 兜底显示
  if (turn.presetName && turn.presetName !== "Direct Dialogue" && turn.presetName !== "undefined") {
    return turn.presetName;
  }
  
  return truncateRequestId(turn.requestId);
}

function truncateRequestId(id) {
  if (!id) return "";
  return id.length > 20
    ? id.substring(0, 8) + "..." + id.substring(id.length - 8)
    : id;
}

function formatNumber(num) {
  if (!num && num !== 0) return "0";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatTime(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
}
</script>

<style scoped>
.trace-view-container {
  display: flex;
  flex-direction: column;
}

.row-flex {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.left-col-4 {
  width: calc(33.333% - 14px);
  min-width: 280px;
}

.right-col-8 {
  width: calc(66.666% - 6px);
  flex-grow: 1;
}

@media (max-width: 900px) {
  .left-col-4,
  .right-col-8 {
    width: 100%;
  }
}

.saas-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.list-card {
  height: 600px;
}

.timeline-card {
  height: 600px;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.total-tokens-badge {
  font-size: 12px;
  color: #4f46e5;
  background: #eef2ff;
  padding: 4px 10px;
  border-radius: 20px;
}

.border-b {
  border-bottom: 1px solid #f1f5f9;
}

/* Turns list scroll styling */
.turns-list-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  font-size: 14px;
}

.turn-item {
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 10px;
  transition: all 0.2s ease;
  background: #ffffff;
}

.turn-item:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.turn-item.active {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.turn-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.turn-id {
  font-weight: 600;
  font-size: 13px;
  color: #1e293b;
  font-family: "JetBrains Mono", monospace;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 170px;
}

.turn-tag {
  border-radius: 4px;
}

.turn-meta {
  font-size: 12px;
  color: #64748b;
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.turn-meta i {
  color: #94a3b8;
}

.turn-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #94a3b8;
}

.turn-tokens {
  font-family: "JetBrains Mono", monospace;
  font-weight: 600;
  color: #2563eb;
  font-size: 12px;
}

/* Right timeline container styling */
.trace-empty-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
  color: #cbd5e1;
}

.empty-text {
  font-size: 14px;
}

.trace-timeline-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #f8fafc;
}

.timeline-container {
  display: flex;
  flex-direction: column;
}

.timeline-node {
  display: flex;
  gap: 20px;
}

.node-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 32px;
}

.node-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 13px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.node-dot.llm {
  background: #3b82f6;
}

.node-dot.tool {
  background: #f59e0b;
}

.node-line {
  width: 2px;
  flex-grow: 1;
  background: #e2e8f0;
  margin: 4px 0;
}

.node-content-card {
  flex-grow: 1;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 24px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.step-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.step-time {
  font-size: 12px;
  color: #94a3b8;
}

.step-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.step-badge.llm {
  background: #eff6ff;
  color: #2563eb;
}

.step-badge.tool {
  background: #fffbeb;
  color: #d97706;
}

.step-model-tag {
  font-size: 11px;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "JetBrains Mono", monospace;
}

.step-title {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.llm-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.metric-row {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #64748b;
  flex-wrap: wrap;
}

.metric-item strong {
  color: #334155;
}

.metric-item.latency strong {
  color: #d97706;
}

.tools-called-box {
  background: #fafafa;
  border: 1px dashed #e2e8f0;
  border-radius: 6px;
  padding: 10px;
  margin-top: 4px;
}

.box-label {
  font-size: 11px;
  color: #64748b;
  display: block;
  margin-bottom: 6px;
}

.tags-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tool-fields {
  margin-top: 4px;
}

.code-editor-box {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.code-box-header {
  background: #f8fafc;
  padding: 8px 12px;
  font-size: 11px;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 600;
}

.code-box-content {
  margin: 0;
  padding: 12px;
  background: #fafafa;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
