<template>
  <div class="dashboard-root">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="logo-area">
        <i class="fa-solid fa-chart-line logo-icon"></i>
        <span>MioChat 审计大盘</span>
      </div>
      <div class="menu-list">
        <div
          class="menu-item"
          :class="{ active: store.activeTab === 'overview' }"
          @click="switchTab('overview')"
        >
          <i class="fa-solid fa-gauge-high"></i> 实时与性能分析
        </div>
        <div
          class="menu-item"
          :class="{ active: store.activeTab === 'users' }"
          @click="switchTab('users')"
        >
          <i class="fa-solid fa-users-viewfinder"></i> 用户与会话画像
        </div>
        <div
          class="menu-item"
          :class="{ active: store.activeTab === 'toolcalls' }"
          @click="switchTab('toolcalls')"
        >
          <i class="fa-solid fa-network-wired"></i> Tool Call 级联链
        </div>
        <div
          class="menu-item"
          :class="{ active: store.activeTab === 'failures' }"
          @click="switchTab('failures')"
        >
          <i class="fa-solid fa-shield-halved"></i> 异常与故障归因
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="system-time">
          <i class="fa-regular fa-clock"></i> {{ store.currentTime }}
        </div>
        <div class="server-status">
          <span class="status-dot"></span>
          <span>后端服务已连接</span>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="main-content">
      <div class="header-bar">
        <div class="page-title">
          <h2>{{ tabTitle }}</h2>
          <p class="subtitle">实时监控与审计分析平台</p>
        </div>
        <div class="header-actions">
          <el-radio-group
            v-model="store.timeRange"
            size="default"
            class="saas-radio"
            @change="store.refreshData"
          >
            <el-radio-button label="24h">24小时</el-radio-button>
            <el-radio-button label="7d">近7天</el-radio-button>
            <el-radio-button label="30d">近30天</el-radio-button>
          </el-radio-group>

          <el-button
            type="primary"
            class="cost-btn"
            @click="store.showCostModal = true"
          >
            <i class="fa-solid fa-calculator btn-icon"></i> 成本核算
          </el-button>
        </div>
      </div>

      <!-- Tab Contents -->
      <div class="view-body">
        <div
          v-show="store.activeTab === 'overview'"
          class="tab-pane-content fade-in"
        >
          <DashboardOverview />
        </div>

        <div
          v-show="store.activeTab === 'users'"
          class="tab-pane-content fade-in"
        >
          <DashboardUsers />
        </div>

        <div
          v-show="store.activeTab === 'toolcalls'"
          class="tab-pane-content fade-in"
        >
          <DashboardTrace />
        </div>

        <div
          v-show="store.activeTab === 'failures'"
          class="tab-pane-content fade-in"
        >
          <DashboardFailures />
        </div>
      </div>
    </div>

    <!-- Modals -->
    <CostCalculatorDialog />
    <TraceModal />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed, nextTick } from "vue";
import { useDashboardStore } from "@/stores/dashboardStore";

// Import Subcomponents
import DashboardOverview from "@/components/dashboard/DashboardOverview.vue";
import DashboardUsers from "@/components/dashboard/DashboardUsers.vue";
import DashboardTrace from "@/components/dashboard/DashboardTrace.vue";
import DashboardFailures from "@/components/dashboard/DashboardFailures.vue";
import CostCalculatorDialog from "@/components/dashboard/CostCalculatorDialog.vue";
import TraceModal from "@/components/dashboard/TraceModal.vue";

const store = useDashboardStore();

const tabTitle = computed(() => {
  switch (store.activeTab) {
    case "overview":
      return "实时性能与 SLA 审计";
    case "users":
      return "会话画像与调用分布";
    case "toolcalls":
      return "Tool Call 调用链审计 (Trace)";
    case "failures":
      return "异常分析与故障归因";
    default:
      return "审计大盘";
  }
});

let realtimeTimer = null;
let timeClockTimer = null;

function switchTab(tab) {
  store.activeTab = tab;
  nextTick(() => {
    store.refreshData();
    // Trigger a window resize event to force ECharts to redraw and size properly
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 80);
  });
}

onMounted(() => {
  // Inject FontAwesome styles to head dynamically
  if (!document.getElementById("font-awesome-cdn")) {
    const faLink = document.createElement("link");
    faLink.rel = "stylesheet";
    faLink.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    faLink.id = "font-awesome-cdn";
    document.head.appendChild(faLink);
  }

  // Inject Google Fonts dynamically
  if (!document.getElementById("premium-fonts-cdn")) {
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href =
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap";
    fontLink.id = "premium-fonts-cdn";
    document.head.appendChild(fontLink);
  }

  // Clock
  timeClockTimer = setInterval(() => {
    const d = new Date();
    store.currentTime = `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  }, 1000);

  // Real-time connections/users metrics pooling (every 5 seconds)
  store.fetchRealtimeStats();
  realtimeTimer = setInterval(store.fetchRealtimeStats, 5000);

  // Initial dashboard load
  store.refreshData();
});

onUnmounted(() => {
  clearInterval(realtimeTimer);
  clearInterval(timeClockTimer);

  // Clean up injected stylesheets
  document.getElementById("font-awesome-cdn")?.remove();
  document.getElementById("premium-fonts-cdn")?.remove();
});
</script>

<style scoped>
/* Main Dashboard Layout */
.dashboard-root {
  display: flex;
  width: 100vw;
  height: 100vh;
  background-color: #f8fafc;
  color: #0f172a;
  font-family:
    "Plus Jakarta Sans",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    sans-serif;
  overflow: hidden;
}

/* Sidebar Styling */
.sidebar {
  width: 250px;
  background-color: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 10;
}

.logo-area {
  padding: 24px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  border-bottom: 1px solid #f1f5f9;
}

.logo-icon {
  color: #2563eb;
  font-size: 18px;
}

.menu-list {
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.menu-item {
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  transition: all 0.2s ease;
}

.menu-item:hover {
  background-color: #f8fafc;
  color: #0f172a;
}

.menu-item.active {
  background-color: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

.menu-item i {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid #f1f5f9;
  font-size: 12px;
  color: #64748b;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.system-time {
  display: flex;
  align-items: center;
  gap: 8px;
}

.server-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 8px #10b981;
}

/* Main Content Area */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.header-bar {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 18px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.page-title h2 {
  margin: 0 0 2px 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cost-btn {
  font-weight: 600;
  background-color: #2563eb;
  border-color: #2563eb;
}

.cost-btn:hover {
  background-color: #1d4ed8;
  border-color: #1d4ed8;
}

.btn-icon {
  margin-right: 6px;
}

.view-body {
  flex: 1;
  overflow-y: auto;
  padding: 30px;
}

.tab-pane-content {
  width: 100%;
}

/* Animations */
.fade-in {
  animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Custom element style overrides */
:deep(.saas-radio .el-radio-button__inner) {
  border-radius: 6px !important;
  border: 1px solid #d1d5db !important;
  margin: 0 2px;
  box-shadow: none !important;
}

:deep(
  .saas-radio .el-radio-button__orig-radio:checked + .el-radio-button__inner
) {
  background-color: #2563eb !important;
  border-color: #2563eb !important;
  color: #ffffff !important;
}
</style>
