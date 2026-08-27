<template>
  <div class="overview-container">
    <!-- Stats Cards Grid -->
    <div class="stats-grid">
      <el-skeleton :loading="store.loadingOverview && !store.stats.connections && !store.stats.totalTokens" animated :rows="2">
        <template #template>
          <div class="stat-card">
            <el-skeleton-item variant="text" style="width: 50%" />
            <el-skeleton-item variant="h3" style="width: 80%; margin-top: 8px;" />
          </div>
        </template>
        <template #default>
          <div class="stat-card connections">
            <div class="stat-info">
              <span class="stat-title">在线 WebSocket 连接</span>
              <span class="stat-value text-green">{{
                store.stats.connections
              }}</span>
            </div>
            <div class="stat-icon bg-green">
              <i class="fa-solid fa-plug"></i>
            </div>
          </div>
        </template>
      </el-skeleton>

      <el-skeleton :loading="store.loadingOverview && !store.stats.users && !store.stats.totalTokens" animated :rows="2">
        <template #template>
          <div class="stat-card">
            <el-skeleton-item variant="text" style="width: 50%" />
            <el-skeleton-item variant="h3" style="width: 80%; margin-top: 8px;" />
          </div>
        </template>
        <template #default>
          <div class="stat-card active-users">
            <div class="stat-info">
              <span class="stat-title">活跃用户数</span>
              <span class="stat-value text-blue">{{ store.stats.users }}</span>
            </div>
            <div class="stat-icon bg-blue">
              <i class="fa-solid fa-user-check"></i>
            </div>
          </div>
        </template>
      </el-skeleton>

      <el-skeleton :loading="store.loadingOverview && !store.stats.pending && !store.stats.totalTokens" animated :rows="2">
        <template #template>
          <div class="stat-card">
            <el-skeleton-item variant="text" style="width: 50%" />
            <el-skeleton-item variant="h3" style="width: 80%; margin-top: 8px;" />
          </div>
        </template>
        <template #default>
          <div class="stat-card pending-reqs">
            <div class="stat-info">
              <span class="stat-title">执行中流式请求</span>
              <span class="stat-value text-amber">{{ store.stats.pending }}</span>
            </div>
            <div class="stat-icon bg-amber">
              <i class="fa-solid fa-spinner fa-spin-slow"></i>
            </div>
          </div>
        </template>
      </el-skeleton>

      <el-skeleton :loading="store.loadingOverview && !store.stats.totalTokens" animated :rows="2">
        <template #template>
          <div class="stat-card">
            <el-skeleton-item variant="text" style="width: 50%" />
            <el-skeleton-item variant="h3" style="width: 80%; margin-top: 8px;" />
          </div>
        </template>
        <template #default>
          <div class="stat-card token-metrics">
            <div class="stat-info">
              <span class="stat-title">聚合 Token 消耗</span>
              <span class="stat-value text-indigo">{{
                formatTokens(store.stats.totalTokens)
              }}</span>
              <span class="stat-sub">
                入: {{ formatTokens(store.stats.promptTokens) }} | 出:
                {{ formatTokens(store.stats.compTokens) }}
              </span>
            </div>
            <div class="stat-icon bg-indigo">
              <i class="fa-solid fa-chart-simple"></i>
            </div>
          </div>
        </template>
      </el-skeleton>
    </div>

    <!-- Charts Row -->
    <div class="charts-row">
      <div class="chart-card-col col-6">
        <div class="saas-card">
          <div class="card-header">
            <span class="card-title">大模型性能 SLA</span>
            <el-select
              v-model="store.slaMetric"
              size="small"
              class="saas-select"
              style="width: 150px"
            >
              <el-option label="首字延迟 (TTFT)" value="ttft"></el-option>
              <el-option label="生成速率 (TPS)" value="tps"></el-option>
            </el-select>
          </div>
          <div class="card-body">
            <el-skeleton v-if="store.loadingOverview && !store.historicalData" animated :rows="6" />
            <div id="sla-chart" class="chart-container" :style="{ display: store.loadingOverview && !store.historicalData ? 'none' : 'block' }"></div>
          </div>
        </div>
      </div>

      <div class="chart-card-col col-6">
        <div class="saas-card">
          <div class="card-header">
            <span class="card-title">请求吞吐与 Token 时序走势</span>
          </div>
          <div class="card-body">
            <el-skeleton v-if="store.loadingOverview && !store.historicalData" animated :rows="6" />
            <div id="trend-chart" class="chart-container" :style="{ display: store.loadingOverview && !store.historicalData ? 'none' : 'block' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cache Hit Rate Table -->
    <div class="saas-card mt-lg">
      <div class="card-header">
        <span class="card-title">模型服务提供商及缓存命中审计</span>
      </div>
      <div class="card-body p-none">
        <el-skeleton v-if="store.loadingOverview && store.providerStats.length === 0" animated :rows="5" style="padding: 20px;" />
        <div v-show="!store.loadingOverview || store.providerStats.length > 0" class="table-responsive-wrapper">
          <el-table
            :data="store.providerStats"
            style="width: 100%"
            class="saas-table"
          >
            <el-table-column
              prop="name"
              label="Provider / 实例"
            ></el-table-column>
            <el-table-column label="缓存命中率" min-width="120">
              <template #default="scope">
                <div class="progress-wrapper">
                  <span class="progress-num"
                    >{{ scope.row.cacheHitRate }}%</span
                  >
                  <el-progress
                    :percentage="scope.row.cacheHitRate"
                    :stroke-width="6"
                    :color="scope.row.cacheHitRate > 50 ? '#10b981' : '#3b82f6'"
                    :show-text="false"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="hitTokens" label="命中 Token 数">
              <template #default="scope">{{
                formatNumber(scope.row.hitTokens)
              }}</template>
            </el-table-column>
            <el-table-column prop="missTokens" label="未命中 Token 数">
              <template #default="scope">{{
                formatNumber(scope.row.missTokens)
              }}</template>
            </el-table-column>
            <el-table-column prop="calls" label="总调用次数">
              <template #default="scope">{{
                scope.row.calls
              }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, nextTick } from "vue";
import { useDashboardStore } from "@/stores/dashboardStore";
import * as echarts from "echarts";

const store = useDashboardStore();

let slaChart = null;
let trendChart = null;
let themeObserver = null;

// Helper formatters
function formatTokens(t) {
  if (!t && t !== 0) return "0";
  if (t >= 1000000) return (t / 1000000).toFixed(2) + "m";
  if (t >= 1000) return (t / 1000).toFixed(1) + "k";
  return t.toString();
}

function formatNumber(num) {
  if (!num && num !== 0) return "0";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 动态根据系统/用户主题生成 ECharts 配置
function getChartTheme() {
  const isDark = typeof document !== "undefined" && (document.documentElement.getAttribute("data-theme") === "dark" || document.documentElement.classList.contains("dark"));
  return {
    isDark,
    backgroundColor: "transparent",
    textStyle: { 
      color: isDark ? "#94a3b8" : "#64748b", 
      fontFamily: "Plus Jakarta Sans, sans-serif" 
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
      borderColor: isDark ? "#334155" : "#f1f5f9",
    },
    tooltip: {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      borderColor: isDark ? "#334155" : "#e2e8f0",
      borderWidth: 1,
      textStyle: {
        color: isDark ? "#f8fafc" : "#0f172a",
        fontFamily: "Plus Jakarta Sans, sans-serif",
      },
      borderRadius: 8,
      boxShadow: isDark ? "0 4px 12px rgba(0, 0, 0, 0.4)" : "0 4px 12px rgba(0, 0, 0, 0.05)",
    },
  };
}

function initCharts() {
  const slaEl = document.getElementById("sla-chart");
  const trendEl = document.getElementById("trend-chart");

  if (slaEl && slaEl.clientWidth > 0 && slaEl.clientHeight > 0) {
    if (!slaChart || slaChart.isDisposed()) {
      slaChart = echarts.init(slaEl);
    }
  }
  if (trendEl && trendEl.clientWidth > 0 && trendEl.clientHeight > 0) {
    if (!trendChart || trendChart.isDisposed()) {
      trendChart = echarts.init(trendEl);
    }
  }
}

function renderCharts() {
  if (!store.historicalData) return;
  initCharts();

  const theme = getChartTheme();

  // 1. SLA Chart
  if (slaChart) {
    const modelList = (store.historicalData.modelDistribution || [])
      .filter((m) => m.callCount > 0)
      .sort((a, b) => b.callCount - a.callCount);

    const modelLabels = modelList.map((m) => `[${m.provider}] ${m.model}`);
    const modelValues = modelList.map((m) => {
      return store.slaMetric === "ttft"
        ? Math.round(m.avgTtft || 0)
        : m.avgTps || 0;
    });

    const hasZoom = modelLabels.length > 7;

    slaChart.setOption(
      {
        backgroundColor: theme.backgroundColor,
        textStyle: theme.textStyle,
        grid: {
          ...theme.grid,
          bottom: hasZoom ? "24%" : "14%",
          containLabel: true,
        },
        tooltip: {
          ...theme.tooltip,
          trigger: "axis",
          axisPointer: { type: "shadow" },
        },
        xAxis: {
          type: "category",
          data: modelLabels,
          axisLine: { lineStyle: { color: theme.isDark ? "#475569" : "#cbd5e1" } },
          axisLabel: {
            interval: 0,
            rotate: 30,
            fontSize: 10,
            color: theme.isDark ? "#94a3b8" : "#64748b",
            formatter: function (value) {
              return value.length > 25 ? value.substring(0, 22) + "..." : value;
            },
          },
        },
        yAxis: {
          type: "value",
          name:
            store.slaMetric === "ttft"
              ? "平均首字延迟 (ms)"
              : "平均生成速率 (TPS)",
          splitLine: { lineStyle: { color: theme.isDark ? "#334155" : "#f1f5f9" } },
          axisLine: { lineStyle: { color: theme.isDark ? "#475569" : "#cbd5e1" } },
        },
        dataZoom: hasZoom
          ? [
              {
                type: "slider",
                show: true,
                startValue: 0,
                endValue: 6,
                height: 8,
                bottom: 5,
                borderColor: "transparent",
                backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9",
                fillerColor: theme.isDark ? "#475569" : "#cbd5e1",
                handleSize: 0,
                showDetail: false,
                moveHandleSize: 0,
              },
              {
                type: "inside",
                startValue: 0,
                endValue: 6,
                zoomOnMouseWheel: false,
                moveOnMouseMove: true,
                moveOnMouseWheel: true,
              },
            ]
          : [],
        series: [
          {
            name: store.slaMetric === "ttft" ? "平均延迟" : "生成速率",
            type: "bar",
            barWidth: "35%",
            data: modelValues,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "#3b82f6" },
                { offset: 1, color: "#2563eb" },
              ]),
              borderRadius: [4, 4, 0, 0],
            },
          },
        ],
      },
      true,
    );
  }

  // 2. Trend Chart (时序趋势走势)
  if (trendChart) {
    const rawTrends = store.historicalData.trends || [];
    const timeMap = {};
    rawTrends.forEach((t) => {
      const tb = t.timeBucket || "未知";
      if (!timeMap[tb]) {
        timeMap[tb] = { calls: 0, tokens: 0 };
      }
      timeMap[tb].calls += t.callCount || 0;
      timeMap[tb].tokens += t.tokenCount || 0;
    });

    const timeLabels = Object.keys(timeMap).map((k) => {
      return k.length > 10 ? k.substring(5, 16) : k.substring(5);
    });
    const callData = Object.values(timeMap).map((v) => v.calls);
    const tokenData = Object.values(timeMap).map((v) => v.tokens);

    trendChart.setOption(
      {
        backgroundColor: theme.backgroundColor,
        textStyle: theme.textStyle,
        tooltip: {
          ...theme.tooltip,
          trigger: "axis",
        },
        legend: {
          data: ["调用频次 (次)", "Token 消耗 (Tokens)"],
          textStyle: { color: theme.isDark ? "#cbd5e1" : "#475569" },
          top: 0,
          right: 10,
        },
        grid: {
          ...theme.grid,
          bottom: "14%",
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: timeLabels,
          axisLine: { lineStyle: { color: theme.isDark ? "#475569" : "#cbd5e1" } },
          axisLabel: {
            color: theme.isDark ? "#94a3b8" : "#64748b",
            rotate: 25,
            fontSize: 10,
          },
        },
        yAxis: [
          {
            type: "value",
            name: "调用次数",
            splitLine: { lineStyle: { color: theme.isDark ? "#334155" : "#f1f5f9" } },
            axisLine: { lineStyle: { color: theme.isDark ? "#475569" : "#cbd5e1" } },
          },
          {
            type: "value",
            name: "Tokens",
            splitLine: { show: false },
            axisLine: { lineStyle: { color: theme.isDark ? "#475569" : "#cbd5e1" } },
          },
        ],
        series: [
          {
            name: "调用频次 (次)",
            type: "bar",
            data: callData,
            itemStyle: { color: "#3b82f6", borderRadius: [3, 3, 0, 0] },
            barWidth: "30%",
          },
          {
            name: "Token 消耗 (Tokens)",
            type: "line",
            yAxisIndex: 1,
            data: tokenData,
            smooth: true,
            showSymbol: false,
            itemStyle: { color: "#10b981" },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(16, 185, 129, 0.28)" },
                { offset: 1, color: "rgba(16, 185, 129, 0.01)" },
              ]),
            },
          },
        ],
      },
      true,
    );
  }
}

// Watch data updates
watch(
  () => store.historicalData,
  () => {
    nextTick(() => {
      initCharts();
      renderCharts();
    });
  },
  { deep: true },
);

watch(
  () => store.slaMetric,
  () => {
    nextTick(() => {
      initCharts();
      renderCharts();
    });
  },
);

watch(
  () => store.loadingOverview,
  (loading) => {
    if (!loading) {
      nextTick(() => {
        initCharts();
        renderCharts();
      });
    }
  }
);

function handleResize() {
  const slaEl = document.getElementById("sla-chart");
  const trendEl = document.getElementById("trend-chart");

  if (slaEl && slaEl.clientWidth > 0 && slaEl.clientHeight > 0) {
    if (!slaChart || slaChart.isDisposed()) {
      initCharts();
      renderCharts();
    } else {
      slaChart.resize();
    }
  }

  if (trendEl && trendEl.clientWidth > 0 && trendEl.clientHeight > 0) {
    if (!trendChart || trendChart.isDisposed()) {
      initCharts();
      renderCharts();
    } else {
      trendChart.resize();
    }
  }
}

let resizeObserver = null;

onMounted(() => {
  nextTick(() => {
    initCharts();
    renderCharts();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
    }

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      const slaEl = document.getElementById("sla-chart");
      const trendEl = document.getElementById("trend-chart");
      if (slaEl) resizeObserver.observe(slaEl);
      if (trendEl) resizeObserver.observe(trendEl);
    }

    if (typeof document !== "undefined") {
      themeObserver = new MutationObserver(() => {
        renderCharts();
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });
    }
  });
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", handleResize);
  }
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
  slaChart?.dispose();
  trendChart?.dispose();
  slaChart = null;
  trendChart = null;
});
</script>

<style scoped>
.overview-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Stats Grid styles */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.stat-card {
  background: var(--mio-bg-card, #ffffff);
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-title {
  font-size: 13px;
  color: var(--mio-text-secondary, #64748b);
  font-weight: 500;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  font-family: "Plus Jakarta Sans", sans-serif;
  color: var(--mio-text-primary, #0f172a);
}

.stat-sub {
  font-size: 11px;
  color: var(--mio-text-placeholder, #94a3b8);
  margin-top: 4px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

/* Accent state colors */
.bg-green {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.text-green {
  color: #10b981;
}

.bg-blue {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}
.text-blue {
  color: #3b82f6;
}

.bg-amber {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}
.text-amber {
  color: #d97706;
}

.bg-indigo {
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
}
.text-indigo {
  color: #6366f1;
}

/* Charts Layout */
.charts-row {
  display: flex;
  margin: 0 -10px;
  flex-wrap: wrap;
  gap: 20px 0;
}

.chart-card-col {
  padding: 0 10px;
  box-sizing: border-box;
}

.col-6 {
  width: 50%;
}
.col-8 {
  width: 66.666%;
}
.col-4 {
  width: 33.333%;
}

@media (max-width: 992px) {
  .col-6,
  .col-8,
  .col-4 {
    width: 100%;
  }
}

.saas-card {
  background: var(--mio-bg-card, #ffffff);
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--mio-border-color-light, #f1f5f9);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--mio-text-primary, #0f172a);
}

.card-body {
  padding: 20px;
  min-height: 280px;
  position: relative;
}

.chart-container {
  width: 100%;
  height: 280px;
}

.mt-lg {
  margin-top: 10px;
}

.p-none {
  padding: 0;
}

/* Cache hit table & progress bar styling */
.progress-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-num {
  font-size: 13px;
  font-weight: 600;
  width: 36px;
  color: var(--mio-text-primary, #334155);
}

:deep(.saas-table) {
  --el-table-bg-color: var(--mio-bg-card, #ffffff) !important;
  --el-table-tr-bg-color: var(--mio-bg-card, #ffffff) !important;
  --el-table-header-bg-color: var(--mio-bg-hover, #f8fafc) !important;
  --el-table-border-color: var(--mio-border-color-light, #f1f5f9) !important;
  --el-table-text-color: var(--mio-text-regular, #334155) !important;
  --el-table-header-text-color: var(--mio-text-primary, #475569) !important;
  border: none !important;
}

:deep(.saas-table td.el-table__cell),
:deep(.saas-table th.el-table__cell) {
  padding: 14px 20px !important;
}

.table-responsive-wrapper {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-value {
    font-size: 20px;
  }

  .card-body {
    padding: 12px;
  }
}
</style>
