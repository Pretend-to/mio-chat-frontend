<template>
  <div class="overview-container">
    <!-- Stats Cards Grid -->
    <div class="stats-grid">
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

      <div class="stat-card active-users">
        <div class="stat-info">
          <span class="stat-title">活跃用户数</span>
          <span class="stat-value text-blue">{{ store.stats.users }}</span>
        </div>
        <div class="stat-icon bg-blue">
          <i class="fa-solid fa-user-check"></i>
        </div>
      </div>

      <div class="stat-card pending-reqs">
        <div class="stat-info">
          <span class="stat-title">执行中流式请求</span>
          <span class="stat-value text-amber">{{ store.stats.pending }}</span>
        </div>
        <div class="stat-icon bg-amber">
          <i class="fa-solid fa-spinner fa-spin-slow"></i>
        </div>
      </div>

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
    </div>

    <!-- Charts Row -->
    <div class="charts-row">
      <div class="chart-card-col col-8">
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
            <div id="sla-chart" class="chart-container"></div>
          </div>
        </div>
      </div>

      <div class="chart-card-col col-4">
        <div class="saas-card">
          <div class="card-header">
            <span class="card-title">模型调用占比</span>
          </div>
          <div class="card-body">
            <div id="share-chart" class="chart-container"></div>
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
        <div class="table-responsive-wrapper">
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
                formatNumber(scope.row.calls)
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
let shareChart = null;

// Helper formatters
function formatTokens(t) {
  if (!t && t !== 0) return "0";
  return t >= 1000 ? (t / 1000).toFixed(1) + "k" : t.toString();
}

function formatNumber(num) {
  if (!num && num !== 0) return "0";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ECharts Light Theme Settings
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

function initCharts() {
  const slaEl = document.getElementById("sla-chart");
  const shareEl = document.getElementById("share-chart");

  if (slaEl && !slaChart) {
    slaChart = echarts.init(slaEl);
  }
  if (shareEl && !shareChart) {
    shareChart = echarts.init(shareEl);
  }

  renderCharts();
}

function renderCharts() {
  if (!store.historicalData) return;

  // 1. SLA Chart 重构为柱状图
  if (slaChart) {
    // 过滤发生过请求的模型，并按调用次数排序
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
        ...lightChartTheme,
        grid: {
          ...lightChartTheme.grid,
          bottom: hasZoom ? "24%" : "14%", // 留出空间给 dataZoom 滚动条与倾斜的 X 轴标签
          containLabel: true,
        },
        tooltip: {
          ...lightChartTheme.tooltip,
          trigger: "axis",
          axisPointer: { type: "shadow" },
        },
        xAxis: {
          type: "category",
          data: modelLabels,
          axisLine: { lineStyle: { color: "#cbd5e1" } },
          axisLabel: {
            interval: 0,
            rotate: 30, // 标签倾斜，避免重叠
            fontSize: 10,
            color: "#64748b",
            formatter: function (value) {
              // 超长文本截断处理，保证 UI 美观
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
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLine: { lineStyle: { color: "#cbd5e1" } },
        },
        dataZoom: hasZoom
          ? [
              {
                type: "slider",
                show: true,
                startValue: 0,
                endValue: 6, // 默认每页显示 7 个模型
                height: 8,
                bottom: 5,
                borderColor: "transparent",
                backgroundColor: "#f1f5f9",
                fillerColor: "#cbd5e1",
                handleSize: 0,
                showDetail: false,
                moveHandleSize: 0,
              },
              {
                type: "inside",
                startValue: 0,
                endValue: 6,
                zoomOnMouseWheel: false, // 禁用鼠标滚轮缩放，保留平滑横向移动
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
              // 极具现代科技感的渐变蓝柱体
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "#3b82f6" },
                { offset: 1, color: "#2563eb" },
              ]),
              borderRadius: [4, 4, 0, 0], // 顶部圆角
            },
          },
        ],
      },
      true,
    );
  }

  // 2. Share Chart
  if (shareChart && store.historicalData.modelDistribution) {
    const pieData = store.historicalData.modelDistribution.map((m) => ({
      name: `${m.provider}/${m.model}`,
      value: m.totalTokens,
    }));

    shareChart.setOption(
      {
        ...lightChartTheme,
        tooltip: {
          ...lightChartTheme.tooltip,
          trigger: "item",
          formatter: "{b}: {c} ({d}%)",
        },
        color: [
          "#2563eb",
          "#10b981",
          "#6366f1",
          "#f59e0b",
          "#ec4899",
          "#94a3b8",
        ],
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
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 13, fontWeight: "bold" },
            },
            data: pieData,
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
    nextTick(renderCharts);
  },
  { deep: true },
);

watch(
  () => store.slaMetric,
  () => {
    nextTick(renderCharts);
  },
);

function handleResize() {
  slaChart?.resize();
  shareChart?.resize();
}

onMounted(() => {
  nextTick(() => {
    initCharts();
    window.addEventListener("resize", handleResize);
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  slaChart?.dispose();
  shareChart?.dispose();
  slaChart = null;
  shareChart = null;
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
  background: #ffffff;
  border: 1px solid #e2e8f0;
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
  color: #64748b;
  font-weight: 500;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  font-family: "Plus Jakarta Sans", sans-serif;
  color: #0f172a;
}

.stat-sub {
  font-size: 11px;
  color: #94a3b8;
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
  background: #f0fdf4;
  color: #10b981;
}
.text-green {
  color: #10b981;
}

.bg-blue {
  background: #eff6ff;
  color: #3b82f6;
}
.text-blue {
  color: #3b82f6;
}

.bg-amber {
  background: #fffbeb;
  color: #f59e0b;
}
.text-amber {
  color: #d97706;
}

.bg-indigo {
  background: #eef2ff;
  color: #6366f1;
}
.text-indigo {
  color: #4f46e5;
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

.col-8 {
  width: 66.666%;
}
.col-4 {
  width: 33.333%;
}

@media (max-width: 992px) {
  .col-8,
  .col-4 {
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
  color: #334155;
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
