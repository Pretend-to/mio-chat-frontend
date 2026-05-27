<template>
  <div class="users-view-container">
    <!-- Provider and Model Distribution Row -->
    <div class="row-flex">
      <div class="left-col-4">
        <div class="saas-card list-card">
          <div class="card-header border-b">
            <span class="card-title">服务提供商 (Provider)</span>
          </div>
          <div class="provider-list-scroll">
            <div
              class="provider-item"
              :class="{ active: store.selectedProvider === 'All' }"
              @click="selectProvider('All')"
            >
              <span class="provider-name">全部提供商 (All)</span>
              <span class="provider-tokens">
                <i class="fa-solid fa-coins"></i>
                {{ formatTokens(store.totalAllTokens) }}
              </span>
            </div>

            <div
              v-for="p in store.groupedProviders"
              :key="p.name"
              class="provider-item"
              :class="{ active: store.selectedProvider === p.name }"
              @click="selectProvider(p.name)"
            >
              <span class="provider-name">{{ p.name }}</span>
              <span class="provider-tokens">
                <i class="fa-solid fa-coins"></i>
                {{ formatTokens(p.totalTokens) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="right-col-8">
        <div class="saas-card chart-card">
          <div class="card-header">
            <span class="card-title"
              >模型 Token 消耗分布 ({{
                store.selectedProvider === "All"
                  ? "全部"
                  : store.selectedProvider
              }})</span
            >
          </div>
          <div class="card-body-chart">
            <div
              id="provider-models-chart"
              class="chart-container-models"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Model Details Table Card -->
    <div class="saas-card mt-lg">
      <div class="card-header">
        <span class="card-title"
          >具体模型 Token 消耗明细 ({{
            store.selectedProvider === "All" ? "全部" : store.selectedProvider
          }})</span
        >
      </div>
      <div class="card-body p-none">
        <div class="table-responsive-wrapper">
          <el-table
            :data="filteredModelsTable"
            style="width: 100%"
            class="saas-table"
          >
            <el-table-column prop="model" label="模型名称" min-width="180">
              <template #default="scope">
                <span class="model-name-badge">{{ scope.row.model }}</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="provider"
              label="提供商"
              width="120"
              align="center"
            >
              <template #default="scope">
                <el-tag
                  size="small"
                  :type="getProviderTagType(scope.row.provider)"
                >
                  {{ scope.row.provider }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="callCount"
              label="调用次数"
              width="120"
              align="right"
            >
              <template #default="scope">{{
                formatNumber(scope.row.callCount)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="promptTokens"
              label="输入 (Prompt)"
              min-width="140"
              align="right"
            >
              <template #default="scope">{{
                formatNumber(scope.row.promptTokens)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="candidatesTokens"
              label="输出 (Candidates)"
              min-width="160"
              align="right"
            >
              <template #default="scope">{{
                formatNumber(scope.row.candidatesTokens)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="cacheHitTokens"
              label="缓存命中"
              min-width="120"
              align="right"
            >
              <template #default="scope">
                <span v-if="scope.row.cacheHitTokens > 0" class="text-green">{{
                  formatNumber(scope.row.cacheHitTokens)
                }}</span>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="totalTokens"
              label="总消耗 (Tokens)"
              width="150"
              align="right"
            >
              <template #default="scope">
                <span class="token-value-text">{{
                  formatNumber(scope.row.totalTokens)
                }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>

    <!-- Rankings Row -->
    <div class="rankings-row mt-lg">
      <div class="ranking-col">
        <div class="saas-card">
          <div class="card-header">
            <span class="card-title">活跃用户排行 (Top 10)</span>
          </div>
          <div class="card-body p-none">
            <div class="table-responsive-wrapper">
              <el-table
                :data="store.userRankings"
                size="default"
                class="saas-table"
              >
                <el-table-column label="排名" width="80" align="center">
                  <template #default="scope">
                    <span
                      class="rank-badge"
                      :class="'rank-' + (scope.$index + 1)"
                    >
                      {{ scope.$index + 1 }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="userId"
                  label="用户 ID"
                ></el-table-column>
                <el-table-column
                  prop="calls"
                  label="调用次数"
                  width="120"
                  align="right"
                ></el-table-column>
                <el-table-column prop="tokens" label="消耗 Token" align="right">
                  <template #default="scope">
                    <span class="token-value-text">{{
                      formatNumber(scope.row.tokens)
                    }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, nextTick, computed } from "vue";
import { useDashboardStore } from "@/stores/dashboardStore";
import * as echarts from "echarts";

const store = useDashboardStore();

const filteredModelsTable = computed(() => {
  if (!store.rawModelDistribution) return [];
  const filtered =
    store.selectedProvider === "All"
      ? store.rawModelDistribution
      : store.rawModelDistribution.filter(
          (m) => (m.provider || "openai") === store.selectedProvider,
        );

  const grouped = filtered.reduce((acc, curr) => {
    const key = `${curr.provider || "openai"}/${curr.model}`;
    if (!acc[key]) {
      acc[key] = {
        model: curr.model,
        provider: curr.provider || "openai",
        callCount: 0,
        totalTokens: 0,
        promptTokens: 0,
        candidatesTokens: 0,
        cacheHitTokens: 0,
        cacheMissTokens: 0,
      };
    }
    acc[key].callCount += curr.callCount || 0;
    acc[key].totalTokens += curr.totalTokens || 0;
    acc[key].promptTokens += curr.promptTokens || 0;
    acc[key].candidatesTokens += curr.candidatesTokens || 0;
    acc[key].cacheHitTokens += curr.cacheHitTokens || 0;
    acc[key].cacheMissTokens += curr.cacheMissTokens || 0;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.totalTokens - a.totalTokens);
});

function getProviderTagType(prov) {
  const p = (prov || "").toLowerCase();
  if (p.includes("openai") || p.includes("deepseek")) return "success";
  if (p.includes("gemini") || p.includes("google")) return "warning";
  if (p.includes("anthropic") || p.includes("claude")) return "danger";
  return "info";
}

let modelsChart = null;

function formatTokens(t) {
  if (!t && t !== 0) return "0";
  return t >= 1000 ? (t / 1000).toFixed(1) + "k" : t.toString();
}

function formatNumber(num) {
  if (!num && num !== 0) return "0";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const lightChartTheme = {
  backgroundColor: "transparent",
  textStyle: { color: "#64748b", fontFamily: "Plus Jakarta Sans, sans-serif" },
  grid: {
    left: "3%",
    right: "4%",
    bottom: "3%",
    containLabel: true,
    borderColor: "#f1f5f9",
  },
  tooltip: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    textStyle: {
      color: "#0f172a",
      fontFamily: "Plus Jakarta Sans, sans-serif",
    },
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
  },
};

function initChart() {
  const el = document.getElementById("provider-models-chart");
  if (el && !modelsChart) {
    modelsChart = echarts.init(el);
  }
  renderChart();
}

function renderChart() {
  if (!modelsChart || !store.rawModelDistribution) return;

  // Filter models
  const filtered =
    store.selectedProvider === "All"
      ? store.rawModelDistribution
      : store.rawModelDistribution.filter(
          (m) => (m.provider || "openai") === store.selectedProvider,
        );

  // Group duplicate models
  const modelMap = filtered.reduce((acc, curr) => {
    const key = curr.model || "unknown";
    acc[key] = (acc[key] || 0) + (curr.totalTokens || 0);
    return acc;
  }, {});

  const chartData = Object.entries(modelMap)
    .map(([name, value]) => ({
      name,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  modelsChart.setOption(
    {
      ...lightChartTheme,
      tooltip: {
        ...lightChartTheme.tooltip,
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      color: ["#3b82f6", "#10b981", "#6366f1", "#f59e0b", "#ec4899", "#94a3b8"],
      series: [
        {
          type: "pie",
          radius: ["45%", "70%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: "#ffffff",
            borderWidth: 2,
          },
          label: {
            show: true,
            color: "#475569",
            formatter: "{b}\n{d}%",
            fontFamily: "Plus Jakarta Sans, sans-serif",
          },
          emphasis: { label: { show: true, fontSize: 13, fontWeight: "bold" } },
          data:
            chartData.length > 0 ? chartData : [{ name: "无数据", value: 0 }],
        },
      ],
    },
    true,
  );
}

function selectProvider(name) {
  store.selectedProvider = name;
  nextTick(renderChart);
}

watch(
  () => store.historicalData,
  () => {
    nextTick(renderChart);
  },
  { deep: true },
);

function handleResize() {
  modelsChart?.resize();
}

onMounted(() => {
  nextTick(() => {
    initChart();
    window.addEventListener("resize", handleResize);
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  modelsChart?.dispose();
  modelsChart = null;
});
</script>

<style scoped>
.users-view-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.row-flex {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.left-col-4 {
  width: calc(33.333% - 14px);
  min-width: 250px;
}

.right-col-8 {
  width: calc(66.666% - 6px);
  flex-grow: 1;
}

@media (max-width: 768px) {
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
  height: 380px;
}

.chart-card {
  height: 380px;
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

.provider-list-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.provider-item {
  padding: 10px 14px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 8px;
  transition: all 0.2s ease;
  margin-bottom: 6px;
  border: 1px solid transparent;
  position: relative;
}

.provider-item:hover {
  background: #f8fafc;
}

.provider-item.active {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.provider-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 25%;
  height: 50%;
  width: 3px;
  background: #3b82f6;
  border-radius: 0 4px 4px 0;
}

.provider-name {
  font-weight: 600;
  font-size: 13px;
  color: #334155;
}

.provider-tokens {
  font-size: 12px;
  color: #2563eb;
  font-weight: 600;
  font-family: "JetBrains Mono", monospace;
}

.card-body-chart {
  padding: 16px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-container-models {
  width: 100%;
  height: 300px;
}

/* Rankings section */
.rankings-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.ranking-col {
  width: calc(50% - 10px);
  min-width: 300px;
  flex-grow: 1;
}

.mt-lg {
  margin-top: 10px;
}

.p-none {
  padding: 0;
}

.token-value-text {
  font-family: "JetBrains Mono", monospace;
  font-weight: 600;
  color: #0f172a;
}

/* Rank Badges */
.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  background: #f1f5f9;
}

.rank-1 {
  background: #fef9c3;
  color: #a16207;
}

.rank-2 {
  background: #f1f5f9;
  color: #475569;
}

.rank-3 {
  background: #ffedd5;
  color: #c2410c;
}

:deep(.saas-table) {
  --el-table-bg-color: #ffffff !important;
  --el-table-tr-bg-color: #ffffff !important;
  --el-table-header-bg-color: #f8fafc !important;
  --el-table-border-color: #f1f5f9 !important;
  --el-table-text-color: #334155 !important;
  --el-table-header-text-color: #475569 !important;
  border: none !important;
}

:deep(.saas-table td.el-table__cell),
:deep(.saas-table th.el-table__cell) {
  padding: 12px 20px !important;
}

.model-name-badge {
  font-family: "JetBrains Mono", monospace;
  font-weight: 500;
  color: #1e293b;
  background: #f8fafc;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.text-green {
  color: #10b981 !important;
  font-weight: 600;
}

.text-muted {
  color: #94a3b8;
}

.table-responsive-wrapper {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 900px) {
  .left-col-4,
  .right-col-8 {
    width: 100%;
  }

  .list-card,
  .chart-card {
    height: auto;
    min-height: 300px;
  }

  .chart-container-models {
    height: 250px;
  }
}
</style>
