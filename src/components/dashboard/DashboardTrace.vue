<template>
  <div class="trace-view-container">
    <div class="row-flex">
      <!-- Left Column: Turns List -->
      <div class="left-col-4" v-if="!isMobile || !store.activeTurn">
        <div class="saas-card list-card">
          <div class="card-header border-b">
            <span class="card-title">最近活跃会话流</span>
          </div>

          <!-- 组合过滤检索栏 -->
          <div class="filter-bar border-b">
            <div class="filter-row">
              <el-select
                v-model="selectedUserFilter"
                placeholder="👤 点选活跃用户..."
                clearable
                filterable
                class="saas-filter-select"
                style="width: 100%"
                @change="handleFilterChange"
              >
                <el-option label="全部活跃用户" value="" />
                <el-option
                  v-for="user in activeUsersList"
                  :key="user"
                  :label="user"
                  :value="user"
                />
              </el-select>
            </div>
            <div class="filter-row mt-sm">
              <el-input
                v-model="searchKeyword"
                placeholder="🔍 匹配会话主题/IP/ID..."
                clearable
                class="saas-filter-input"
                @input="debounceSearch"
              >
                <template #prefix>
                  <i class="fa-solid fa-magnifying-glass"></i>
                </template>
              </el-input>
            </div>
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
                <span>
                  <i class="fa-solid fa-user"></i>
                  <a
                    href="#"
                    class="user-profile-link"
                    :class="{ 'disabled-link': !isRealUser(turn.user) }"
                    @click.stop="openUserDetail(turn.user)"
                  >
                    {{ turn.user }}
                  </a>
                </span>
                <span>
                  <i class="fa-solid fa-cube"></i> {{ turn.presetName }}
                </span>
              </div>
              <div class="turn-footer">
                <span>
                  <i class="fa-regular fa-clock"></i>
                  {{ formatTime(turn.createdAt) }}
                </span>
                <span class="turn-ip-meta">
                  <i class="fa-solid fa-earth-asia"></i> {{ turn.userIp || '未知' }}
                </span>
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
      <div class="right-col-8" v-if="!isMobile || store.activeTurn">
        <div class="saas-card timeline-card">
          <div class="card-header border-b">
            <div class="header-title-wrapper">
              <button
                v-if="isMobile"
                class="back-btn"
                @click="store.activeTurn = null"
                aria-label="返回"
              >
                <i class="fa-solid fa-chevron-left"></i> 返回
              </button>
              <span class="card-title">{{ isMobile ? '级联链路' : '调用级联链路分析 (Trace)' }}</span>
            </div>
            <span class="total-tokens-badge" v-if="store.activeTurn">
              {{ isMobile ? '' : '累计: ' }}<strong>{{ formatNumber(store.activeTurn.totalTokens) }}</strong> Tokens
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
                      {{ step.type === "tool" ? "Tool" : "Inference" }}
                    </span>
                    <span class="step-model-tag" v-if="step.model">
                      {{ step.model }}
                    </span>
                    <el-tag
                      v-if="step.cacheHitTokens > 0"
                      size="small"
                      type="success"
                      effect="light"
                      class="cache-badge"
                    >
                      <i class="fa-solid fa-bolt"></i>
                      <span class="desktop-only-inline"> 命中:</span>
                      <span> {{ Math.round((step.cacheHitTokens / (step.cacheHitTokens + step.cacheMissTokens)) * 100) }}%</span>
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
                        <span
                          class="metric-item cache"
                          v-if="step.cacheHitTokens !== undefined"
                        >
                          缓存命中:
                          <strong
                            :style="{
                              color:
                                step.cacheHitTokens > 0 ? '#10b981' : '#64748b',
                            }"
                          >
                            {{ formatNumber(step.cacheHitTokens) }}
                          </strong>
                        </span>
                        <span
                          class="metric-item cache-rate"
                          v-if="step.cacheHitTokens !== undefined"
                        >
                          缓存命中率:
                          <strong
                            :style="{
                              color:
                                step.cacheHitTokens > 0 ? '#10b981' : '#64748b',
                            }"
                          >
                            {{
                              step.cacheHitTokens + step.cacheMissTokens > 0
                                ? Math.round(
                                    (step.cacheHitTokens /
                                      (step.cacheHitTokens +
                                        step.cacheMissTokens)) *
                                      100,
                                  )
                                : 0
                            }}%
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

  <!-- User Detail Modal -->
  <el-dialog
    v-model="showUserModal"
    title="👤 用户审计画像与详情"
    width="500px"
    align-center
    class="saas-dialog"
    :before-close="closeUserModal"
  >
    <div v-if="loadingUser" class="loading-box">
      <i class="fa-solid fa-spinner fa-spin"></i> 正在加载用户审计画像...
    </div>
    <div v-else-if="userDetail" class="user-detail-profile">
      <div class="profile-header">
        <div class="avatar-circle">
          <i class="fa-solid fa-user-tie"></i>
        </div>
        <div class="user-meta-info">
          <h3 class="profile-user-id">{{ userDetail.userId }}</h3>
          <span class="profile-ip-badge">
            <i class="fa-solid fa-earth-asia"></i> 最近活跃 IP: {{ userDetail.lastIp }}
          </span>
        </div>
      </div>

      <div class="profile-metrics">
        <div class="metric-card-mini">
          <span class="mini-label">总计调用</span>
          <span class="mini-value">{{ formatNumber(userDetail.totalCalls) }} 次</span>
        </div>
        <div class="metric-card-mini">
          <span class="mini-label">累计消耗 Tokens</span>
          <span class="mini-value">{{ formatNumber(userDetail.totalTokens) }}</span>
        </div>
      </div>

      <div class="metric-breakdown-row">
        <div class="breakdown-item">
          <span>输入 Token:</span>
          <strong>{{ formatNumber(userDetail.promptTokens) }}</strong>
        </div>
        <div class="breakdown-item">
          <span>输出 Token:</span>
          <strong>{{ formatNumber(userDetail.candidatesTokens) }}</strong>
        </div>
      </div>

      <div class="fav-models-section" v-if="userDetail.favModels && userDetail.favModels.length > 0">
        <h4 class="section-title-mini"><i class="fa-solid fa-heart-pulse"></i> 渠道与模型偏好 Top 5</h4>
        <div class="fav-model-list">
          <div v-for="m in userDetail.favModels" :key="m.model" class="fav-model-item">
            <span class="fav-model-name">{{ m.model }}</span>
            <span class="fav-model-calls">{{ m.calls }} 次调用</span>
          </div>
        </div>
      </div>

      <div class="profile-footer">
        <span class="last-active-time">
          <i class="fa-regular fa-clock"></i> 最近活动: {{ formatFullTime(userDetail.lastActive) }}
        </span>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useContactorsStore } from "@/stores/contactorsStore";

const store = useDashboardStore();
const contactorsStore = useContactorsStore();

const isMobile = ref(false);

const selectedUserFilter = ref("");
const searchKeyword = ref("");

// 智能活跃用户去重计算列表
const activeUsersList = computed(() => {
  const list = new Set();
  if (store.userRankings && store.userRankings.length > 0) {
    store.userRankings.forEach(item => {
      if (item.userId && item.userId !== 'Direct Chat / API') {
        list.add(item.userId);
      }
    });
  }
  if (store.toolCallTurns && store.toolCallTurns.length > 0) {
    store.toolCallTurns.forEach(turn => {
      if (turn.user && turn.user !== 'Direct Chat / API') {
        list.add(turn.user);
      }
    });
  }
  return Array.from(list);
});

let searchTimer = null;

function handleFilterChange() {
  triggerSearch();
}

function debounceSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    triggerSearch();
  }, 400);
}

function triggerSearch() {
  const query = selectedUserFilter.value ? selectedUserFilter.value : searchKeyword.value;
  store.fetchTurns(query);
}

// 用户详情 Dialog 状态
const showUserModal = ref(false);
const loadingUser = ref(false);
const userDetail = ref(null);

function isRealUser(userId) {
  if (!userId) return false;
  const virtualUsers = [
    'Direct Chat / API',
    '标题生成 (Title)',
    '会话压缩 (Compress)',
    '定时任务 (Task)',
    '视觉分析 (Vision)',
    '系统内部任务 (System)'
  ];
  return !virtualUsers.some(vu => userId.includes(vu));
}

async function openUserDetail(userId) {
  if (!isRealUser(userId)) return;
  showUserModal.value = true;
  loadingUser.value = true;
  userDetail.value = null;
  try {
    const data = await store.fetchUserDetail(userId);
    if (data) {
      userDetail.value = data;
    }
  } catch (err) {
    console.error(err);
  } finally {
    loadingUser.value = false;
  }
}

function closeUserModal() {
  showUserModal.value = false;
  userDetail.value = null;
}

function formatFullTime(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
}

function checkIfMobile() {
  isMobile.value = window.innerWidth < 900;
}

onMounted(() => {
  checkIfMobile();
  window.addEventListener("resize", checkIfMobile);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkIfMobile);
});

function getTurnTitle(turn) {
  // 1. 优先使用后端入库的全局会话标题
  if (turn.sessionTitle) {
    return turn.sessionTitle;
  }

  // 2. 如果是系统生成标题的任务
  if (
    turn.presetName &&
    (turn.presetName.toLowerCase().startsWith("system_title") ||
      turn.presetName.toLowerCase().includes("title"))
  ) {
    return "🏷️ 自动生成会话标题";
  }
  if (turn.requestId && turn.requestId.startsWith("system_title")) {
    return "🏷️ 自动生成会话标题";
  }

  // 3. 如果是当前用户的会话，尝试联动 LocalStorage 兜底
  if (turn.contactorId && contactorsStore.contactors[turn.contactorId]) {
    return (
      contactorsStore.contactors[turn.contactorId].name ||
      turn.presetName ||
      "常规对话"
    );
  }

  // 4. 兜底显示
  if (
    turn.presetName &&
    turn.presetName !== "Direct Dialogue" &&
    turn.presetName !== "undefined"
  ) {
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
  height: 100%;
  min-height: 0;
}

.row-flex {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.left-col-4 {
  width: calc(33.333% - 14px);
  min-width: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.right-col-8 {
  width: calc(66.666% - 6px);
  flex-grow: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

@media (max-width: 900px) {
  .left-col-4,
  .right-col-8 {
    width: 100%;
    height: 100%;
  }

  .node-indicator {
    display: none;
  }

  .trace-timeline-scroll {
    padding: 12px;
  }

  .node-content-card {
    margin-bottom: 16px;
    padding: 12px;
  }

  .card-header {
    padding: 12px 16px !important;
  }

  .step-card-header {
    gap: 6px;
  }

  .step-model-tag {
    font-size: 10px;
    padding: 1px 4px;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .step-badge {
    font-size: 9px;
    padding: 1px 4px;
  }

  .cache-badge {
    font-size: 9px;
    padding: 1px 4px;
  }

  .desktop-only-inline {
    display: none;
  }

  .code-box-content {
    max-height: 120px !important;
    font-size: 11px !important;
    padding: 8px !important;
  }
}

.desktop-only-inline {
  display: inline;
}

@media (max-width: 600px) {
  .metric-row {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 6px 10px !important;
    font-size: 11px !important;
  }
}

.header-title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.saas-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.list-card {
  /* Flex height is handled by parent saas-card */
}

.timeline-card {
  /* Flex height is handled by parent saas-card */
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
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
  max-height: 200px;
  overflow-y: auto;
}

/* Custom Added Styles for Filtering and Dialog details */
.filter-bar {
  padding: 12px 14px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-row {
  width: 100%;
}

.mt-sm {
  margin-top: 4px;
}

:deep(.saas-filter-select .el-select__wrapper) {
  background-color: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: none !important;
  border-radius: 8px !important;
  height: 36px !important;
  transition: all 0.2s ease;
}

:deep(.saas-filter-select .el-select__wrapper.is-focused) {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 1px #3b82f6 !important;
}

:deep(.saas-filter-input .el-input__wrapper) {
  background-color: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: none !important;
  border-radius: 8px !important;
  height: 36px !important;
  transition: all 0.2s ease;
}

:deep(.saas-filter-input .el-input__wrapper.is-focus) {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 1px #3b82f6 !important;
}

.user-profile-link {
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s ease;
}

.user-profile-link:hover {
  text-decoration: underline;
  color: #1d4ed8;
}

.disabled-link {
  color: #64748b !important;
  pointer-events: none;
  text-decoration: none !important;
}

.turn-ip-meta {
  display: flex;
  align-items: center;
  gap: 4px;
}

.turn-ip-meta i {
  color: #cbd5e1;
}

/* User Audit Profile dialog styling */
.user-detail-profile {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 10px 0;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 16px;
}

.avatar-circle {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: inset 0 2px 4px rgba(37, 99, 235, 0.05);
}

.user-meta-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-user-id {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.profile-ip-badge {
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
}

.profile-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.metric-card-mini {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.mini-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mini-value {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  font-family: "Plus Jakarta Sans", sans-serif;
}

.metric-breakdown-row {
  display: flex;
  justify-content: space-around;
  background: #f8fafc;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
}

.breakdown-item {
  display: flex;
  gap: 8px;
  color: #64748b;
}

.breakdown-item strong {
  color: #334155;
  font-family: "JetBrains Mono", monospace;
}

.fav-models-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title-mini {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 6px;
}

.fav-model-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fav-model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  font-size: 12px;
  transition: all 0.2s ease;
}

.fav-model-item:hover {
  background: #fafafa;
  border-color: #e2e8f0;
}

.fav-model-name {
  font-family: "JetBrains Mono", monospace;
  font-weight: 600;
  color: #334155;
}

.fav-model-calls {
  color: #64748b;
  font-size: 11px;
}

.profile-footer {
  border-top: 1px solid #f1f5f9;
  padding-top: 12px;
  text-align: right;
}

.last-active-time {
  font-size: 11px;
  color: #94a3b8;
}

.loading-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 150px;
  color: #64748b;
  font-size: 14px;
}
</style>
