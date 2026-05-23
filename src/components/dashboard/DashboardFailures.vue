<template>
  <div class="failures-view-container">
    <div class="row-flex">
      <!-- Left Column: Error Chart -->
      <div class="left-col-4">
        <div class="saas-card chart-card">
          <div class="card-header">
            <span class="card-title">异常故障分布</span>
          </div>
          <div class="card-body">
            <div id="error-chart" class="chart-container"></div>
          </div>
        </div>
      </div>

      <!-- Right Column: Diagnostics Table -->
      <div class="right-col-8">
        <div class="saas-card table-card">
          <div class="card-header">
            <span class="card-title">异常诊断控制台</span>
          </div>
          <div class="card-body p-none">
            <el-table
              :data="store.failures"
              size="default"
              class="saas-table"
              height="340"
            >
              <el-table-column label="发生时间" width="160">
                <template #default="scope">{{
                  formatTime(scope.row.createdAt)
                }}</template>
              </el-table-column>
              <el-table-column
                prop="requestId"
                label="请求 ID"
                min-width="140"
                show-overflow-tooltip
              >
                <template #default="scope">
                  <span class="mono-text">{{ scope.row.requestId }}</span>
                </template>
              </el-table-column>
              <el-table-column
                prop="model"
                label="模型"
                width="130"
                show-overflow-tooltip
              >
                <template #default="scope">
                  <el-tag size="small" type="danger" effect="plain">{{
                    scope.row.model
                  }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column
                prop="errorMessage"
                label="错误信息"
                min-width="200"
                show-overflow-tooltip
              ></el-table-column>
              <el-table-column
                label="诊断"
                width="90"
                align="center"
                fixed="right"
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
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, nextTick } from "vue";
import { useDashboardStore } from "@/stores/dashboardStore";
import * as echarts from "echarts";

const store = useDashboardStore();

let errorChart = null;

function formatTime(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
}

function showTrace(row) {
  store.activeTrace = row;
  store.showTraceModal = true;
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
  const el = document.getElementById("error-chart");
  if (el && !errorChart) {
    errorChart = echarts.init(el);
  }
  renderChart();
}

function renderChart() {
  if (!errorChart || !store.failures) return;

  // Categorize errors
  const errMap = store.failures.reduce((acc, curr) => {
    const msg = curr.errorMessage || "Unknown Error";
    let cat = "Other Failures";
    if (msg.includes("429") || msg.toLowerCase().includes("rate limit"))
      cat = "Rate Limit (429)";
    else if (msg.includes("504") || msg.toLowerCase().includes("timeout"))
      cat = "Network Timeout (504)";
    else if (msg.includes("401") || msg.toLowerCase().includes("auth"))
      cat = "Auth Failure (401)";

    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(errMap).map(([name, value]) => ({
    name,
    value,
  }));

  errorChart.setOption(
    {
      ...lightChartTheme,
      tooltip: { ...lightChartTheme.tooltip, trigger: "item" },
      color: ["#f43f5e", "#f59e0b", "#a855f7", "#64748b"],
      series: [
        {
          type: "pie",
          radius: "60%",
          data:
            chartData.length > 0
              ? chartData
              : [{ name: "无故障运行", value: 0 }],
          itemStyle: {
            borderRadius: 6,
            borderColor: "#ffffff",
            borderWidth: 2,
          },
          label: {
            show: true,
            color: "#475569",
            fontSize: 11,
            fontFamily: "Plus Jakarta Sans, sans-serif",
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
    nextTick(renderChart);
  },
  { deep: true },
);

function handleResize() {
  errorChart?.resize();
}

onMounted(() => {
  nextTick(() => {
    initChart();
    window.addEventListener("resize", handleResize);
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  errorChart?.dispose();
  errorChart = null;
});
</script>

<style scoped>
.failures-view-container {
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

.chart-card {
  height: 400px;
}

.table-card {
  height: 400px;
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

.card-body {
  padding: 20px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-container {
  width: 100%;
  height: 300px;
}

.p-none {
  padding: 0;
}

.mono-text {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
}

.trace-btn {
  font-weight: 600;
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
</style>
