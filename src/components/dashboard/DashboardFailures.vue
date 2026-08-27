<template>
  <div class="failures-view-container">
    <!-- Top Overview Row: Stats & Horizontal Distribution Chart -->
    <div class="top-overview-row">
      <!-- Left: Failure Quick Stats Card -->
      <div class="saas-card stat-summary-card">
        <div class="card-header">
          <span class="card-title">故障与异常概况</span>
        </div>
        <div class="card-body failure-metrics-body">
          <div class="metric-item-block">
            <span class="metric-label">故障调用总数</span>
            <div class="metric-value-row">
              <span class="metric-number text-danger">{{ store.failures.length }}</span>
              <span class="metric-unit">次</span>
            </div>
          </div>
          <div class="metric-divider"></div>
          <div class="metric-item-block">
            <span class="metric-label">主要异常类型</span>
            <div class="metric-value-row">
              <span class="metric-highlight">{{ primaryErrorType }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Compact Error Distribution Ring Chart with Legend -->
      <div class="saas-card chart-card">
        <div class="card-header">
          <span class="card-title">异常类型分布</span>
        </div>
        <div class="card-body chart-card-body">
          <el-skeleton v-if="store.loadingFailures && store.failures.length === 0" animated :rows="3" />
          <div
            id="error-chart"
            class="chart-container"
            :style="{ display: store.loadingFailures && store.failures.length === 0 ? 'none' : 'block' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Bottom: Full-Width Diagnostics Console Table Card -->
    <div class="saas-card table-card mt-md">
      <div class="card-header table-header-bar">
        <div class="header-left">
          <span class="card-title">异常诊断控制台</span>
          <span class="record-count-badge">{{ store.failures.length }} 条记录</span>
        </div>
      </div>
      <div class="card-body p-none table-card-body">
        <el-skeleton v-if="store.loadingFailures && store.failures.length === 0" animated :rows="8" style="padding: 20px;" />
        <div v-show="!store.loadingFailures || store.failures.length > 0" class="table-responsive-wrapper">
          <el-table
            :data="store.failures"
            size="default"
            class="saas-table"
            style="width: 100%"
          >
            <el-table-column label="发生时间" width="160">
              <template #default="scope">
                <span class="time-text">{{ formatTime(scope.row.createdAt) }}</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="requestId"
              label="请求 ID"
              width="170"
              show-overflow-tooltip
            >
              <template #default="scope">
                <span class="mono-text">{{ scope.row.requestId }}</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="model"
              label="模型"
              width="180"
              show-overflow-tooltip
            >
              <template #default="scope">
                <el-tag size="small" type="danger" effect="plain" class="model-tag">
                  {{ scope.row.model }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="errorMessage"
              label="错误信息"
              min-width="320"
              show-overflow-tooltip
            >
              <template #default="scope">
                <span class="error-msg-text">{{ scope.row.errorMessage || "未知异常" }}</span>
              </template>
            </el-table-column>
            <el-table-column
              label="诊断"
              width="120"
              align="center"
              fixed="right"
              class-name="col-diagnosis"
            >
              <template #default="scope">
                <el-button
                  size="small"
                  type="danger"
                  plain
                  class="trace-btn"
                  @click="showTrace(scope.row)"
                >
                  Trace
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useDashboardStore } from "@/stores/dashboardStore";
import * as echarts from "echarts";

const store = useDashboardStore();

let errorChart = null;
let themeObserver = null;
let resizeObserver = null;

function formatTime(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  return `${m}-${d} ${h}:${min}:${s}`;
}

function showTrace(row) {
  store.activeTrace = row;
  store.showTraceModal = true;
}

const categorizedErrors = computed(() => {
  const list = store.failures || [];
  const errMap = list.reduce((acc, curr) => {
    const msg = curr.errorMessage || "Unknown Error";
    let cat = "Other Failures";
    if (msg.includes("429") || msg.toLowerCase().includes("rate limit"))
      cat = "Rate Limit (429)";
    else if (msg.includes("504") || msg.toLowerCase().includes("timeout"))
      cat = "Network Timeout (504)";
    else if (msg.includes("401") || msg.toLowerCase().includes("auth"))
      cat = "Auth Failure (401)";
    else if (msg.includes("400") || msg.includes("未找到指定的适配器"))
      cat = "Config/Adapter Error (400)";
    else if (msg.toLowerCase().includes("aborted"))
      cat = "Client Aborted";

    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(errMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
});

const primaryErrorType = computed(() => {
  if (categorizedErrors.value.length === 0) return "无故障运行";
  return categorizedErrors.value[0].name;
});

function getChartTheme() {
  const isDark =
    typeof document !== "undefined" &&
    (document.documentElement.getAttribute("data-theme") === "dark" ||
      document.documentElement.classList.contains("dark"));
  return {
    isDark,
    backgroundColor: "transparent",
    textStyle: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontFamily: "Plus Jakarta Sans, sans-serif",
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
      boxShadow: isDark
        ? "0 4px 12px rgba(0, 0, 0, 0.4)"
        : "0 4px 12px rgba(0, 0, 0, 0.05)",
    },
  };
}

function initChart() {
  const el = document.getElementById("error-chart");
  if (el && el.clientWidth > 0 && el.clientHeight > 0) {
    if (!errorChart || errorChart.isDisposed()) {
      errorChart = echarts.init(el);
    }
  }
}

function renderChart() {
  initChart();
  if (!errorChart) return;

  const theme = getChartTheme();
  const chartData = categorizedErrors.value;

  errorChart.setOption(
    {
      backgroundColor: theme.backgroundColor,
      textStyle: theme.textStyle,
      tooltip: { ...theme.tooltip, trigger: "item", formatter: "{b}: {c} 次 ({d}%)" },
      legend: {
        orient: "vertical",
        right: "10%",
        top: "center",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: theme.isDark ? "#cbd5e1" : "#475569",
          fontSize: 12,
          fontFamily: "Plus Jakarta Sans, sans-serif",
        },
      },
      color: ["#f43f5e", "#f59e0b", "#a855f7", "#3b82f6", "#64748b"],
      series: [
        {
          type: "pie",
          radius: ["48%", "82%"],
          center: ["32%", "50%"],
          avoidLabelOverlap: false,
          data:
            chartData.length > 0
              ? chartData
              : [{ name: "无故障运行", value: 0 }],
          itemStyle: {
            borderRadius: 6,
            borderColor: theme.isDark ? "#1e293b" : "#ffffff",
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: "bold" },
          },
        },
      ],
    },
    true,
  );
}

watch(
  () => store.failures,
  () => {
    nextTick(() => {
      initChart();
      renderChart();
    });
  },
  { deep: true },
);

watch(
  () => store.loadingFailures,
  (loading) => {
    if (!loading) {
      nextTick(() => {
        initChart();
        renderChart();
        handleResize();
      });
    }
  },
);

function handleResize() {
  const el = document.getElementById("error-chart");
  if (el && el.clientWidth > 0 && el.clientHeight > 0) {
    if (!errorChart || errorChart.isDisposed()) {
      initChart();
      renderChart();
    } else {
      errorChart.resize();
    }
  }
}

onMounted(() => {
  nextTick(() => {
    initChart();
    renderChart();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
    }

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      const el = document.getElementById("error-chart");
      if (el) resizeObserver.observe(el);
    }

    if (typeof document !== "undefined") {
      themeObserver = new MutationObserver(() => {
        renderChart();
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
  errorChart?.dispose();
  errorChart = null;
});
</script>

<style scoped>
.failures-view-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.top-overview-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.stat-summary-card {
  width: 320px;
  min-width: 260px;
  height: 230px;
}

.chart-card {
  flex: 1;
  min-width: 380px;
  height: 230px;
}

.failure-metrics-body {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  flex: 1;
}

.metric-item-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-label {
  font-size: 13px;
  color: var(--mio-text-secondary, #94a3b8);
}

.metric-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-number {
  font-size: 34px;
  font-weight: 700;
  font-family: "JetBrains Mono", monospace;
}

.metric-unit {
  font-size: 14px;
  color: var(--mio-text-secondary, #94a3b8);
}

.metric-highlight {
  font-size: 16px;
  font-weight: 600;
  color: var(--mio-text-primary, #0f172a);
}

.metric-divider {
  width: 1px;
  height: 56px;
  background: var(--mio-border-color-light, #f1f5f9);
}

.chart-card-body {
  padding: 12px 20px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-container {
  width: 100%;
  height: 170px;
}

.table-card {
  display: flex;
  flex-direction: column;
}

.table-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.record-count-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--mio-bg-hover, #f1f5f9);
  color: var(--mio-text-secondary, #64748b);
  font-weight: 600;
}

.saas-card {
  background: var(--mio-bg-card, #ffffff);
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--mio-border-color-light, #f1f5f9);
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--mio-text-primary, #0f172a);
}

.p-none {
  padding: 0;
}

.table-card-body {
  padding: 0;
}

.time-text {
  font-size: 12px;
  color: var(--mio-text-secondary, #64748b);
}

.mono-text {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  color: var(--mio-text-regular, #475569);
}

.model-tag {
  font-family: "JetBrains Mono", monospace;
}

.error-msg-text {
  font-size: 12px;
  color: #ef4444;
  font-family: "JetBrains Mono", monospace;
}

.trace-btn {
  font-weight: 600;
  min-width: 60px;
  letter-spacing: 0.5px;
}

.text-danger {
  color: #ef4444;
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
  padding: 12px 18px !important;
}

:deep(.saas-table th.col-diagnosis .cell),
:deep(.saas-table td.col-diagnosis .cell) {
  white-space: nowrap !important;
  overflow: visible !important;
  padding: 0 8px !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
}

.table-responsive-wrapper {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 900px) {
  .top-overview-row {
    flex-direction: column;
  }
  .stat-summary-card,
  .chart-card {
    width: 100%;
    height: auto;
    min-height: 160px;
  }
}
</style>
