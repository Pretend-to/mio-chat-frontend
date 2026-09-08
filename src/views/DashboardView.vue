<template>
  <div class="dashboard-root">
    <!-- Mobile Sidebar Backdrop Overlay -->
    <div
      v-if="isSidebarOpen"
      class="sidebar-overlay"
      @click="isSidebarOpen = false"
    ></div>

    <!-- Sidebar Drawer -->
    <div class="sidebar" :class="{ 'drawer-open': isSidebarOpen }">
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
          <i class="fa-solid fa-network-wired"></i> 会话与调用 Trace
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
        <div
          class="back-to-app"
          @click="router.push('/settings')"
          title="返回设置概览"
        >
          <i class="fa-solid fa-arrow-left-long"></i>
          <span>返回设置概览</span>
        </div>
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
        <div class="title-area">
          <button
            class="burger-btn"
            @click="isSidebarOpen = !isSidebarOpen"
            aria-label="Toggle Navigation Menu"
          >
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="page-title">
            <h2>{{ tabTitle }}</h2>
            <p class="subtitle">实时监控与审计分析平台</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="desktop-time-range-group">
            <span class="time-range-label">时间范围:</span>
            <el-select
              v-model="store.timeRange"
              size="default"
              class="saas-time-select"
              @change="store.refreshData"
              aria-label="时间范围"
            >
              <el-option label="24小时" value="24h" />
              <el-option label="近7天" value="7d" />
              <el-option label="近30天" value="30d" />
              <el-option label="近90天" value="90d" />
              <el-option label="近1年" value="365d" />
            </el-select>
          </div>
        </div>
      </div>

      <!-- Mobile Subpage Navigation Bar -->
      <div class="mobile-subpage-nav">
        <div class="mobile-nav-scroll">
          <button
            class="mobile-nav-pill"
            :class="{ active: store.activeTab === 'overview' }"
            @click="switchTab('overview')"
          >
            <i class="fa-solid fa-gauge-high"></i>
            <span>实时性能</span>
          </button>
          <button
            class="mobile-nav-pill"
            :class="{ active: store.activeTab === 'users' }"
            @click="switchTab('users')"
          >
            <i class="fa-solid fa-users-viewfinder"></i>
            <span>会话画像</span>
          </button>
          <button
            class="mobile-nav-pill"
            :class="{ active: store.activeTab === 'toolcalls' }"
            @click="switchTab('toolcalls')"
          >
            <i class="fa-solid fa-network-wired"></i>
            <span>调用 Trace</span>
          </button>
          <button
            class="mobile-nav-pill"
            :class="{ active: store.activeTab === 'failures' }"
            @click="switchTab('failures')"
          >
            <i class="fa-solid fa-shield-halved"></i>
            <span>异常归因</span>
          </button>
        </div>
      </div>

      <!-- Tab Contents -->
      <div
        class="view-body"
        :class="{ 'flex-layout': store.activeTab === 'toolcalls' }"
      >
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
          class="tab-pane-content fade-in toolcalls-pane"
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
    <TraceModal />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed, nextTick, ref } from "vue";
import { useRouter } from "vue-router";
import { useDashboardStore } from "@/stores/dashboardStore";

// Import Subcomponents
import DashboardOverview from "@/components/dashboard/DashboardOverview.vue";
import DashboardUsers from "@/components/dashboard/DashboardUsers.vue";
import DashboardTrace from "@/components/dashboard/DashboardTrace.vue";
import DashboardFailures from "@/components/dashboard/DashboardFailures.vue";
import TraceModal from "@/components/dashboard/TraceModal.vue";

const store = useDashboardStore();
const router = useRouter();
const isSidebarOpen = ref(false);
const isMobile = ref(false);

const checkMobile = () => {
  if (typeof window !== "undefined") {
    isMobile.value = window.innerWidth <= 1024;
  }
};

const tabTitle = computed(() => {
  switch (store.activeTab) {
    case "overview":
      return "实时性能与 SLA 审计";
    case "users":
      return "会话画像与调用分布";
    case "toolcalls":
      return "会话与调用链路 Trace";
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
  // 切到 Trace 页时清掉残留选中会话，移动端默认回到会话列表，而非直接进级联详情
  if (tab === "toolcalls") store.activeTurn = null;
  isSidebarOpen.value = false; // Close drawer on mobile upon tab selection
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

  checkMobile();
  window.addEventListener("resize", checkMobile);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
  clearInterval(realtimeTimer);
  clearInterval(timeClockTimer);

  // Clean up injected stylesheets
  document.getElementById("font-awesome-cdn")?.remove();
  document.getElementById("premium-fonts-cdn")?.remove();
});
</script>

<style scoped lang="scss">
/* Mobile Subpage Navigation */
.mobile-subpage-nav {
  display: none;
  background: var(--mio-bg-card, #ffffff);
  border-bottom: 1px solid var(--mio-border-color-light, #e2e8f0);
  padding: 8px 16px;
  flex-shrink: 0;

  .mobile-nav-scroll {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .mobile-nav-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    border: 1px solid var(--mio-border-color-light, #e2e8f0);
    background: var(--mio-bg-page, #f8fafc);
    color: var(--mio-text-regular, #64748b);
    cursor: pointer;
    transition: all 0.2s ease;

    i {
      font-size: 12px;
    }

    &:hover {
      background: var(--mio-bg-hover, #f1f5f9);
      color: var(--mio-text-primary, #0f172a);
    }

    &.active {
      background: var(--mio-bg-active, #eff6ff);
      border-color: var(--mio-color-primary, #2563eb);
      color: var(--mio-color-primary, #2563eb);
      font-weight: 600;
      box-shadow: 0 1px 4px rgba(37, 99, 235, 0.15);
    }
  }
}

.desktop-time-range-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  .time-range-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--mio-text-secondary, #64748b);
    white-space: nowrap;
  }
}

.saas-time-select {
  width: 120px !important;
  min-width: 120px !important;
  flex-shrink: 0;

  :deep(.el-select__wrapper) {
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    border: 1px solid var(--mio-border-color-light, #e2e8f0);
  }
}

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
  background-color: var(--mio-bg-card, #ffffff);
  border-right: 1px solid var(--mio-border-color-light, #e2e8f0);
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
  color: var(--mio-text-primary, #0f172a);
  border-bottom: 1px solid var(--mio-border-color-light, #f1f5f9);
}

.logo-icon {
  color: var(--mio-color-primary, #2563eb);
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
  color: var(--mio-text-regular, #475569);
  transition: all 0.2s ease;
}

.menu-item:hover {
  background-color: var(--mio-bg-hover, #f8fafc);
  color: var(--mio-text-primary, #0f172a);
}

.menu-item.active {
  background-color: var(--mio-bg-active, #eff6ff);
  color: var(--mio-color-primary, #2563eb);
  font-weight: 600;
}

.menu-item i {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--mio-border-color-light, #f1f5f9);
  font-size: 12px;
  color: var(--mio-text-secondary, #64748b);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.back-to-app {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--mio-text-regular, #475569);
  cursor: pointer;
  transition: color 0.2s ease;
  border-bottom: 1px solid var(--mio-border-color-light, #f1f5f9);
}

.back-to-app:hover {
  color: var(--mio-color-primary, #2563eb);
}

.back-to-app i {
  font-size: 13px;
  width: 16px;
  text-align: center;
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
  background-color: var(--mio-bg-page, #f8fafc);
}

.title-area {
  display: flex;
  align-items: center;
}

.burger-btn {
  display: none;
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--mio-text-regular, #475569);
  cursor: pointer;
  padding: 8px;
  margin-right: 14px;
  border-radius: 6px;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.burger-btn:hover {
  background-color: var(--mio-bg-hover, #f1f5f9);
  color: var(--mio-text-primary, #0f172a);
}

.header-bar {
  background: var(--mio-bg-card, #ffffff);
  border-bottom: 1px solid var(--mio-border-color-light, #e2e8f0);
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
  color: var(--mio-text-primary, #0f172a);
}

.subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--mio-text-secondary, #64748b);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.btn-icon {
  margin-right: 6px;
}

.view-body {
  flex: 1;
  overflow-y: auto;
  padding: 30px;
}

.view-body.flex-layout {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-pane-content {
  width: 100%;
}

.toolcalls-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
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
  border: 1px solid var(--mio-border-color-light, #d1d5db) !important;
  background: var(--mio-bg-card, #ffffff) !important;
  color: var(--mio-text-regular, #374151) !important;
  margin: 0 2px;
  box-shadow: none !important;
}

:deep(
  .saas-radio .el-radio-button__orig-radio:checked + .el-radio-button__inner
) {
  background-color: var(--mio-color-primary, #2563eb) !important;
  border-color: var(--mio-color-primary, #2563eb) !important;
  color: #ffffff !important;
}

/* Tablet & Mobile Layout Adaptations */
@media (max-width: 1024px) {
  .burger-btn {
    display: inline-flex;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    transform: translateX(-100%);
    transition:
      transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.3s ease;
    box-shadow: none;
  }

  .sidebar.drawer-open {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(15, 23, 42, 0.15);
  }

  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(8px);
    z-index: 9;
    animation: fadeInOverlay 0.2s ease-out;
  }

  .mobile-subpage-nav {
    display: block;
  }

  .header-bar {
    padding: 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-actions {
    width: auto;
  }

  .view-body {
    padding: 20px;
  }
}

@media (max-width: 768px) {
  .header-bar {
    padding: 10px 14px;
    gap: 8px;
  }

  .page-title h2 {
    font-size: 15px;
    white-space: nowrap;
  }

  .page-title .subtitle {
    display: none;
  }

  .header-actions {
    width: auto;
  }

  .desktop-time-range-group .time-range-label {
    display: none;
  }

  .saas-time-select {
    width: 96px !important;
    min-width: 96px !important;
  }

  .view-body {
    padding: 14px 10px;
  }

  .view-body.flex-layout {
    padding: 14px 10px 10px;
  }
}
@keyframes fadeInOverlay {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
