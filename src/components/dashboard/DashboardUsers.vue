<template>
  <div class="usage-view">
    <div class="view-switch" role="tablist" aria-label="用量分析视图">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="switch-button"
        :class="{ active: activeView === tab.value }"
        type="button"
        @click="activeView = tab.value"
      >
        <i :class="tab.icon"></i>
        {{ tab.label }}
      </button>
    </div>

    <template v-if="activeView === 'sessions'">
      <div class="summary-grid">
        <article
          v-for="item in sourceCards"
          :key="item.type"
          class="summary-card"
        >
          <div class="summary-heading">
            <span class="source-icon" :class="item.type"
              ><i :class="item.icon"></i
            ></span>
            <span>{{ item.label }}</span>
          </div>
          <strong>{{ formatNumber(item.calls) }}</strong>
          <span>{{ formatTokens(item.tokens) }} Token</span>
        </article>
      </div>

      <section class="saas-card">
        <header class="card-header source-header">
          <div>
            <h3>来源与会话</h3>
            <p>按真实 Session 标题归集，并区分 Web 用户与外部 Channel 用户</p>
          </div>
          <div class="source-filters">
            <button
              v-for="filter in sourceFilters"
              :key="filter.value"
              type="button"
              :class="{ active: sourceFilter === filter.value }"
              @click="sourceFilter = filter.value"
            >
              {{ filter.label }}
            </button>
          </div>
        </header>
        <div class="table-responsive-wrapper">
          <el-table
            :data="filteredSessions"
            class="saas-table"
            style="width: 100%"
          >
            <el-table-column label="会话" min-width="260">
              <template #default="scope">
                <div class="session-cell">
                  <span class="session-title">{{
                    scope.row.sessionTitle
                  }}</span>
                  <span class="session-id">{{
                    scope.row.sessionId || "历史记录未关联 Session"
                  }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源" min-width="150">
              <template #default="scope">
                <span class="source-pill" :class="scope.row.sourceType">
                  <i :class="sourceIcon(scope.row.sourceType)"></i
                  >{{ sourceName(scope.row) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="用户标识" min-width="210">
              <template #default="scope"
                ><span class="mono ellipsis" :title="scope.row.userId">{{
                  scope.row.userId
                }}</span></template
              >
            </el-table-column>
            <el-table-column label="调用" width="110" align="right">
              <template #default="scope">{{
                formatNumber(scope.row.calls)
              }}</template>
            </el-table-column>
            <el-table-column label="Token" width="130" align="right">
              <template #default="scope"
                ><strong>{{ formatTokens(scope.row.tokens) }}</strong></template
              >
            </el-table-column>
          </el-table>
          <div v-if="filteredSessions.length === 0" class="empty-state">
            当前时间范围内没有对应来源的会话审计数据
          </div>
        </div>
      </section>

      <section class="saas-card">
        <header class="card-header">
          <div>
            <h3>用户用量</h3>
            <p>Web 用户按账号区分，Channel 用户保留平台侧发送者 ID</p>
          </div>
        </header>
        <div class="table-responsive-wrapper">
          <el-table
            :data="filteredUsers"
            class="saas-table"
            style="width: 100%"
          >
            <el-table-column label="用户" min-width="280">
              <template #default="scope">
                <div class="user-cell">
                  <span class="avatar" :class="scope.row.sourceType"
                    ><i :class="sourceIcon(scope.row.sourceType)"></i
                  ></span>
                  <div>
                    <span class="mono">{{ scope.row.userId }}</span
                    ><small>{{ sourceName(scope.row) }}</small>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="调用次数" width="150" align="right"
              ><template #default="scope">{{
                formatNumber(scope.row.calls)
              }}</template></el-table-column
            >
            <el-table-column label="Token" width="160" align="right"
              ><template #default="scope"
                ><strong>{{ formatTokens(scope.row.tokens) }}</strong></template
              ></el-table-column
            >
            <el-table-column label="单次平均" width="150" align="right"
              ><template #default="scope">{{
                formatTokens(
                  Math.round(scope.row.tokens / Math.max(scope.row.calls, 1)),
                )
              }}</template></el-table-column
            >
          </el-table>
        </div>
      </section>
    </template>

    <template v-else>
      <div class="model-summary-grid">
        <article class="metric-card">
          <span>总 Token</span
          ><strong>{{ formatTokens(store.stats.totalTokens) }}</strong
          ><small
            >{{ formatTokens(store.stats.promptTokens) }} 输入 /
            {{ formatTokens(store.stats.compTokens) }} 输出</small
          >
        </article>
        <article class="metric-card">
          <span>API 调用</span><strong>{{ formatNumber(totalCalls) }}</strong
          ><small>{{ modelRows.length }} 个模型</small>
        </article>
        <article class="metric-card">
          <span>缓存命中率</span><strong>{{ cacheHitRate }}%</strong
          ><small>{{ formatTokens(totalCachedTokens) }} 缓存读取 Token</small>
        </article>
      </div>

      <section class="saas-card model-usage-card">
        <header class="card-header">
          <div>
            <h3>模型用量</h3>
            <p>输入、输出与缓存读取 Token 的横向对照</p>
          </div>
          <el-select
            v-model="store.selectedProvider"
            size="small"
            style="width: 160px"
          >
            <el-option label="全部适配器" value="All" />
            <el-option
              v-for="provider in store.providers"
              :key="provider"
              :label="provider"
              :value="provider"
            />
          </el-select>
        </header>
        <div class="legend">
          <span><i class="legend-dot input"></i>输入</span
          ><span><i class="legend-dot output"></i>输出</span
          ><span><i class="legend-dot cache"></i>缓存读取</span>
        </div>
        <div class="model-bars">
          <div
            v-for="row in filteredModelRows"
            :key="`${row.adapterInstanceId || row.adapterName}/${row.model}`"
            class="model-row"
          >
            <div class="model-label">
              <span :title="row.model">{{ row.model }}</span
              ><small>{{ row.adapterName }}</small>
            </div>
            <div
              class="bar-track"
              :title="`${formatNumber(row.totalTokens)} Token`"
            >
              <span
                class="bar input"
                :style="segmentStyle(row.uncachedInputTokens)"
              ></span>
              <span
                class="bar output"
                :style="segmentStyle(row.candidatesTokens)"
              ></span>
              <span
                class="bar cache"
                :style="segmentStyle(row.cacheHitTokens)"
              ></span>
            </div>
            <strong>{{ formatTokens(row.totalTokens) }}</strong>
          </div>
          <div v-if="filteredModelRows.length === 0" class="empty-state">
            当前时间范围内暂无模型用量
          </div>
        </div>
      </section>

      <section class="saas-card">
        <header class="card-header">
          <div>
            <h3>模型明细</h3>
            <p>缓存命中率仅以输入 Token 为可缓存基数</p>
          </div>
        </header>
        <div class="table-responsive-wrapper">
          <el-table
            :data="filteredModelRows"
            class="saas-table"
            style="width: 100%"
          >
            <el-table-column
              prop="model"
              label="模型"
              min-width="190"
            /><el-table-column
              prop="adapterName"
              label="适配器实例"
              min-width="150"
            />
            <el-table-column label="调用" width="100" align="right"
              ><template #default="scope">{{
                formatNumber(scope.row.callCount)
              }}</template></el-table-column
            >
            <el-table-column label="输入" width="120" align="right"
              ><template #default="scope">{{
                formatTokens(scope.row.promptTokens)
              }}</template></el-table-column
            >
            <el-table-column label="输出" width="120" align="right"
              ><template #default="scope">{{
                formatTokens(scope.row.candidatesTokens)
              }}</template></el-table-column
            >
            <el-table-column label="缓存读取" width="130" align="right"
              ><template #default="scope">{{
                formatTokens(scope.row.cacheHitTokens)
              }}</template></el-table-column
            >
            <el-table-column label="命中率" width="120" align="right"
              ><template #default="scope"
                ><span class="rate"
                  >{{ scope.row.cacheHitRate }}%</span
                ></template
              ></el-table-column
            >
          </el-table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useDashboardStore } from "@/stores/dashboardStore";

const store = useDashboardStore();
const activeView = ref("sessions");
const sourceFilter = ref("all");
const tabs = [
  {
    value: "sessions",
    label: "来源与会话",
    icon: "fa-solid fa-users-viewfinder",
  },
  { value: "models", label: "模型用量", icon: "fa-solid fa-chart-simple" },
];
const sourceFilters = [
  { value: "all", label: "全部" },
  { value: "web", label: "Web" },
  { value: "channel", label: "Channel" },
  { value: "system", label: "系统" },
];
const sourceMeta = {
  web: { label: "Web", icon: "fa-solid fa-window-maximize" },
  channel: { label: "Channel", icon: "fa-solid fa-comments" },
  system: { label: "系统任务", icon: "fa-solid fa-gears" },
  unknown: { label: "历史未识别", icon: "fa-solid fa-circle-question" },
};

const sourceCards = computed(() => {
  const totals = new Map();
  for (const row of store.sourceDistribution) {
    const type = row.sourceType || "unknown";
    const current = totals.get(type) || { calls: 0, tokens: 0 };
    current.calls += row.callCount || 0;
    current.tokens += row.totalTokens || 0;
    totals.set(type, current);
  }
  return ["web", "channel", "system", "unknown"].map((type) => ({
    type,
    ...sourceMeta[type],
    ...(totals.get(type) || { calls: 0, tokens: 0 }),
  }));
});
const filteredSessions = computed(() =>
  store.sessionRankings
    .filter(
      (row) =>
        sourceFilter.value === "all" || row.sourceType === sourceFilter.value,
    )
    .sort((a, b) => b.tokens - a.tokens),
);
const filteredUsers = computed(() =>
  store.userRankings
    .filter(
      (row) =>
        sourceFilter.value === "all" || row.sourceType === sourceFilter.value,
    )
    .sort((a, b) => b.tokens - a.tokens),
);
const modelRows = computed(() =>
  (store.rawModelDistribution || [])
    .map((row) => {
      const inputTokens = row.promptTokens || 0;
      return {
        ...row,
        adapterName: row.adapterName || row.provider || "历史未识别实例",
        uncachedInputTokens: Math.max(
          0,
          (row.promptTokens || 0) - (row.cacheHitTokens || 0),
        ),
        cacheHitRate:
          inputTokens > 0
            ? Math.min(
                100,
                Math.round(((row.cacheHitTokens || 0) / inputTokens) * 100),
              )
            : 0,
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens),
);
const filteredModelRows = computed(() =>
  store.selectedProvider === "All"
    ? modelRows.value
    : modelRows.value.filter(
        (row) => row.adapterName === store.selectedProvider,
      ),
);
const totalCalls = computed(() =>
  modelRows.value.reduce((sum, row) => sum + (row.callCount || 0), 0),
);
const totalCachedTokens = computed(() =>
  modelRows.value.reduce((sum, row) => sum + (row.cacheHitTokens || 0), 0),
);
const totalCacheableTokens = computed(() =>
  modelRows.value.reduce((sum, row) => sum + (row.promptTokens || 0), 0),
);
const cacheHitRate = computed(() =>
  totalCacheableTokens.value > 0
    ? Math.min(
        100,
        Math.round(
          (totalCachedTokens.value / totalCacheableTokens.value) * 100,
        ),
      )
    : 0,
);

function sourceIcon(type) {
  return (sourceMeta[type] || sourceMeta.unknown).icon;
}
function sourceName(row) {
  return row.sourceType === "channel"
    ? row.channelName || row.channelType || "Channel"
    : (sourceMeta[row.sourceType] || sourceMeta.unknown).label;
}
function segmentStyle(value) {
  const maxTotal = filteredModelRows.value[0]?.totalTokens || 1;
  return { width: `${Math.max(0, ((value || 0) / maxTotal) * 100)}%` };
}
function formatTokens(value) {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return number.toLocaleString("zh-CN");
}
function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}
</script>

<style scoped>
.usage-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.view-switch {
  align-self: flex-start;
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  border-radius: 10px;
  background: var(--mio-bg-hover, #f1f5f9);
}
.switch-button,
.source-filters button {
  border: 0;
  background: transparent;
  color: var(--mio-text-secondary, #64748b);
  cursor: pointer;
  font: inherit;
}
.switch-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
}
.switch-button.active {
  color: var(--mio-color-primary, #2563eb);
  background: var(--mio-bg-card, #fff);
  box-shadow: 0 1px 3px rgb(15 23 42 / 8%);
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.summary-card,
.metric-card,
.saas-card {
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  background: var(--mio-bg-card, #fff);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgb(15 23 42 / 4%);
}
.summary-card {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.summary-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--mio-text-secondary, #64748b);
  font-size: 13px;
}
.source-icon,
.avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
}
.source-icon.web,
.avatar.web {
  color: #2563eb;
  background: #eff6ff;
}
.source-icon.channel,
.avatar.channel {
  color: #059669;
  background: #ecfdf5;
}
.source-icon.system,
.avatar.system {
  color: #7c3aed;
  background: #f5f3ff;
}
.source-icon.unknown,
.avatar.unknown {
  color: #64748b;
  background: #f1f5f9;
}
.summary-card strong,
.metric-card strong {
  color: var(--mio-text-primary, #0f172a);
  font-size: 26px;
  line-height: 1.1;
}
.summary-card > span,
.metric-card small {
  color: var(--mio-text-secondary, #94a3b8);
  font-size: 12px;
}
.saas-card {
  overflow: hidden;
}
.card-header {
  min-height: 66px;
  padding: 15px 20px;
  border-bottom: 1px solid var(--mio-border-color-light, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.card-header h3 {
  margin: 0;
  color: var(--mio-text-primary, #0f172a);
  font-size: 15px;
}
.card-header p {
  margin: 5px 0 0;
  color: var(--mio-text-secondary, #94a3b8);
  font-size: 12px;
}
.source-filters {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 8px;
  background: var(--mio-bg-hover, #f1f5f9);
}
.source-filters button {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
}
.source-filters button.active {
  color: var(--mio-color-primary, #2563eb);
  background: var(--mio-bg-card, #fff);
  font-weight: 600;
}
.session-cell,
.user-cell > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.session-title {
  color: var(--mio-text-primary, #0f172a);
  font-weight: 600;
}
.session-id,
.user-cell small {
  margin-top: 3px;
  color: var(--mio-text-secondary, #94a3b8);
  font-size: 11px;
}
.source-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: #475569;
  background: #f1f5f9;
}
.source-pill.web {
  color: #1d4ed8;
  background: #eff6ff;
}
.source-pill.channel {
  color: #047857;
  background: #ecfdf5;
}
.source-pill.system {
  color: #6d28d9;
  background: #f5f3ff;
}
.mono {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px;
}
.ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.avatar {
  flex: none;
}
.empty-state {
  padding: 34px;
  text-align: center;
  color: var(--mio-text-secondary, #94a3b8);
  font-size: 13px;
}
.model-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.metric-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.metric-card > span {
  color: var(--mio-text-secondary, #64748b);
  font-size: 13px;
}
.legend {
  display: flex;
  gap: 18px;
  padding: 14px 20px 0;
  color: var(--mio-text-secondary, #64748b);
  font-size: 12px;
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.legend-dot.input,
.bar.input {
  background: #5b6ac4;
}
.legend-dot.output,
.bar.output {
  background: #28a99a;
}
.legend-dot.cache,
.bar.cache {
  background: #f3ae4c;
}
.model-bars {
  padding: 16px 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.model-row {
  display: grid;
  grid-template-columns: minmax(150px, 220px) 1fr 80px;
  align-items: center;
  gap: 16px;
}
.model-label {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.model-label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--mio-text-primary, #0f172a);
  font-size: 13px;
  font-weight: 600;
}
.model-label small {
  margin-top: 3px;
  color: var(--mio-text-secondary, #94a3b8);
}
.bar-track {
  height: 18px;
  display: flex;
  overflow: hidden;
  border-radius: 6px;
  background: var(--mio-bg-hover, #f1f5f9);
}
.bar {
  height: 100%;
  min-width: 0;
}
.model-row > strong {
  color: var(--mio-text-regular, #475569);
  text-align: right;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px;
}
.rate {
  color: #059669;
  font-weight: 700;
}
.table-responsive-wrapper {
  overflow-x: auto;
}
@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .model-summary-grid {
    grid-template-columns: 1fr;
  }
  .source-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .model-row {
    grid-template-columns: minmax(110px, 150px) 1fr 60px;
    gap: 9px;
  }
}
@media (max-width: 560px) {
  .view-switch {
    align-self: stretch;
  }
  .switch-button {
    flex: 1;
    justify-content: center;
  }
  .source-filters {
    width: 100%;
    overflow-x: auto;
  }
  .model-row {
    grid-template-columns: 110px 1fr;
  }
  .model-row > strong {
    display: none;
  }
}
</style>
