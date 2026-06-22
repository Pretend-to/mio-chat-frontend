<template>
  <div id="settings-view" :class="{ 'mobile-layout': isMobile }">
    <!-- 移动端顶部导航栏 -->
    <div v-if="isMobile && isInSubPage()" class="mobile-header sub-page">
      <div class="mobile-header-content sub-page">
        <button
          class="back-button"
          @click="handleBackToHome"
          :title="getBackButtonTitle()"
        >
          <!-- 在设置子页面显示返回箭头 -->
          <svg
            v-if="isInSubPage()"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M19 12H5M12 19l-7-7 7-7"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <!-- 在设置首页显示关闭图标 -->
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <h1 class="mobile-title">{{ getMobileTitle() }}</h1>
        <button
          v-if="showMobileMenu"
          class="menu-button"
          @click="toggleMobileMenu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 12h18M3 6h18M3 18h18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- 移动端菜单抽屉 -->
    <div
      v-if="isMobile"
      class="mobile-menu-overlay"
      :class="{ show: mobileMenuVisible }"
      @click="closeMobileMenu"
    >
      <div
        class="mobile-menu-drawer"
        :class="{ show: mobileMenuVisible }"
        @click.stop
      >
        <div class="mobile-menu-header">
          <h2>设置菜单</h2>
          <button class="close-button" @click="closeMobileMenu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <div class="mobile-menu-content">
          <div
            v-for="item in menuItems"
            :key="item.index"
            class="mobile-menu-item"
            :class="{ active: activeMenu === item.index }"
            @click="handleMobileMenuSelect(item.index)"
          >
            <component :is="item.icon" class="menu-icon" />
            <span>{{ item.label }}</span>
          </div>

          <!-- 快捷操作 -->
          <div class="mobile-quick-actions">
            <div class="quick-action-item" @click="handleReset">
              <span>重置全部</span>
            </div>
            <div class="quick-action-item" @click="handleResetCache">
              <span>清理缓存</span>
            </div>
            <div
              class="quick-action-item"
              @click="
                router.push('/dashboard');
                closeMobileMenu();
              "
            >
              <span>审计大盘</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 桌面端布局 -->
    <div class="admin-panel-container" :class="{ mobile: isMobile }">
      <!-- 移动端设置主菜单列表 (在移动端且正是设置首页时渲染) -->
      <div
        v-if="isMobile && route.path === '/settings'"
        class="mobile-settings-list"
      >
        <!-- 头部 branding -->
        <div class="mobile-settings-hero">
          <h2 class="mobile-settings-title">系统设置</h2>
          <div class="mobile-settings-status" :class="systemStatus">
            <span class="status-dot"></span>
            <span>系统状态: {{ systemStatusText }}</span>
          </div>
        </div>

        <!-- 菜单分组 -->
        <div v-if="!forbidden" class="mobile-settings-group">
          <div class="group-title">系统配置 (管理员权限)</div>
          <div class="group-content">
            <!-- 概览 -->
            <div class="menu-item" @click="handleMobileMenuSelect('overview')">
              <div class="menu-item-left">
                <el-icon class="menu-icon"><Menu /></el-icon>
                <span>配置概览</span>
              </div>
              <div class="menu-item-right">
                <el-icon class="arrow-icon"><ArrowRight /></el-icon>
              </div>
            </div>
            <!-- 其他菜单项 -->
            <div
              v-for="item in menuItems.slice(1)"
              :key="item.index"
              class="menu-item"
              @click="handleMobileMenuSelect(item.index)"
            >
              <div class="menu-item-left">
                <el-icon class="menu-icon"
                  ><component :is="item.icon"
                /></el-icon>
                <span>{{ item.label }}</span>
              </div>
              <div class="menu-item-right">
                <el-icon class="arrow-icon"><ArrowRight /></el-icon>
              </div>
            </div>
            <!-- 审计大盘 -->
            <div class="menu-item" @click="router.push('/dashboard')">
              <div class="menu-item-left">
                <el-icon class="menu-icon"><DataAnalysis /></el-icon>
                <span>数据审计大盘</span>
              </div>
              <div class="menu-item-right">
                <el-icon class="arrow-icon"><ArrowRight /></el-icon>
              </div>
            </div>
          </div>
        </div>

        <div class="mobile-settings-group">
          <div class="group-title">系统维护</div>
          <div class="group-content">
            <div class="menu-item" @click="handleResetCache">
              <div class="menu-item-left">
                <el-icon class="menu-icon warning"><Delete /></el-icon>
                <span>清理缓存</span>
              </div>
              <div class="menu-item-right">
                <el-icon class="arrow-icon"><ArrowRight /></el-icon>
              </div>
            </div>
            <div class="menu-item" @click="handleReset">
              <div class="menu-item-left">
                <el-icon class="menu-icon danger"><RefreshLeft /></el-icon>
                <span>重置全部</span>
              </div>
              <div class="menu-item-right">
                <el-icon class="arrow-icon"><ArrowRight /></el-icon>
              </div>
            </div>
          </div>
        </div>

        <div class="mobile-settings-group">
          <div class="group-title">账号与系统</div>
          <div class="group-content">
            <div class="menu-item" @click="handleSwitchAccount">
              <div class="menu-item-left">
                <el-icon class="menu-icon primary"><SwitchButton /></el-icon>
                <span>{{ forbidden ? "管理员验证" : "切换账号" }}</span>
              </div>
              <div class="menu-item-right">
                <el-icon class="arrow-icon"><ArrowRight /></el-icon>
              </div>
            </div>
            <div class="menu-item" @click="handleReturnHome">
              <div class="menu-item-left">
                <el-icon class="menu-icon regular"><HomeFilled /></el-icon>
                <span>返回聊天首页</span>
              </div>
              <div class="menu-item-right">
                <el-icon class="arrow-icon"><ArrowRight /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 桌面端与移动端子页面内容区 -->
      <template v-else>
        <!-- 侧边导航 - 仅桌面端显示 -->
        <aside v-if="!isMobile" class="admin-panel-sidebar">
          <el-menu
            :default-active="activeMenu"
            class="admin-panel-menu"
            @select="handleMenuSelect"
          >
            <el-menu-item
              v-for="item in menuItems"
              :key="item.index"
              :index="item.index"
            >
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
            </el-menu-item>
          </el-menu>

          <!-- 快捷操作 -->
          <div class="quick-actions">
            <el-button
              type="info"
              plain
              @click="handleReset"
              style="width: 100%"
            >
              重置全部
            </el-button>
            <el-button
              type="info"
              plain
              @click="handleResetCache"
              style="width: 100%"
            >
              清理缓存
            </el-button>
            <el-button
              type="primary"
              plain
              @click="router.push('/dashboard')"
              style="width: 100%"
            >
              审计大盘
            </el-button>
          </div>
        </aside>

        <!-- 内容区域 -->
        <main class="admin-panel-content" :class="{ mobile: isMobile }">
          <!-- 通用页面头部占位 -->
          <div class="content-header-spacer"></div>

          <template v-if="forbidden">
            <div class="forbidden-container" :class="{ mobile: isMobile }">
              <el-result
                icon="error"
                title="禁止访问"
                sub-title="当前访问码无权限或已失效，您无法访问配置管理页面。"
              >
                <template #extra>
                  <el-button type="primary" @click="handleSwitchAccount"
                    >切换账号</el-button
                  >
                  <el-button @click="handleReturnHome">返回首页</el-button>
                </template>
              </el-result>
            </div>
          </template>
          <template v-else>
            <ErrorBoundary
              fallback-title="页面加载失败"
              fallback-message="配置页面加载时发生错误，请刷新页面重试"
            >
              <router-view v-slot="{ Component }">
                <transition name="page-fade" mode="out-in">
                  <component :is="Component" />
                </transition>
              </router-view>
            </ErrorBoundary>
          </template>
        </main>
      </template>
    </div>
  </div>
</template>

<script setup>
import ErrorBoundary from "@/components/settings/ErrorBoundary.vue";
import { client } from "@/lib/runtime.js";
import { useConfigStore } from "@/stores/configStore.js";
import { useLogStore } from "@/stores/logStore.js";
import { useStatusBarColor } from "@/composables/useStatusBarColor";
import {
  ChatDotRound,
  ChromeFilled,
  Connection,
  DataAnalysis,
  Document,
  Grid,
  Menu,
  Monitor,
  Box,
  Lock,
  Delete,
  RefreshLeft,
  SwitchButton,
  HomeFilled,
  ArrowRight,
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const configStore = useConfigStore();
const logStore = useLogStore();
const forbidden = ref(false);

// 移动端相关状态
const isMobile = ref(false);
const mobileMenuVisible = ref(false);

// 计算是否显示移动端菜单按钮
const showMobileMenu = computed(() => {
  // 只在设置首页显示菜单按钮
  return route.path === "/settings";
});

// 系统状态
const systemStatus = computed(() => {
  if (configStore.needRestart) return "warning";

  // 检查是否有禁用的适配器
  const hasDisabled = Object.values(configStore.adapters || {}).some(
    (instances) => instances.some((adapter) => !adapter.enable),
  );

  return hasDisabled ? "warning" : "normal";
});

const systemStatusText = computed(() => {
  if (configStore.needRestart) return "需要重启";
  return systemStatus.value === "normal" ? "正常" : "有警告";
});

// 菜单项配置
const menuItems = [
  { index: "overview", label: "概览", icon: Menu },
  { index: "llm-adapters", label: "LLM 适配器", icon: Connection },
  { index: "automation", label: "系统任务", icon: Connection },
  { index: "server", label: "服务器配置", icon: Monitor },
  { index: "web", label: "Web 配置", icon: ChromeFilled },
  { index: "onebot", label: "OneBot 配置", icon: ChatDotRound },
  { index: "plugins", label: "插件管理", icon: Grid },
  { index: "presets", label: "预设管理", icon: Document },
  { index: "storage", label: "存储配置", icon: Box },
  { index: "webhook", label: "Webhook 配置", icon: ChatDotRound },
  { index: "logs", label: "日志管理", icon: Document },
];

// 操作：切换账号（清除 admin_code 并跳转到 /auth）
const handleSwitchAccount = () => {
  configStore.clearAdminCode();
  router.push({
    path: "/auth",
    query: { redirect: route.fullPath || route.path },
  });
};

// 操作：返回首页
const handleReturnHome = () => {
  router.push("/");
};

// 响应式检测
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

// 当前激活的菜单项
const activeMenu = computed(() => {
  const path = route.path;
  if (path.includes("llm-adapters")) return "llm-adapters";
  if (path.includes("automation")) return "automation";
  if (path.includes("server")) return "server";
  if (path.includes("webhook")) return "webhook";
  if (path.includes("web")) return "web";
  if (path.includes("onebot")) return "onebot";
  if (path.includes("plugins")) return "plugins";
  if (path.includes("presets")) return "presets";
  if (path.includes("storage")) return "storage";
  if (path.includes("logs")) return "logs";
  return "overview";
});

// 检查是否在设置子页面
const isInSubPage = () => {
  const currentPath = route.path;
  return currentPath !== "/settings" && currentPath.startsWith("/settings/");
};

// 获取返回按钮的提示文本
const getBackButtonTitle = () => {
  return isInSubPage() ? "返回设置" : "关闭设置";
};

// 获取移动端标题
const getMobileTitle = () => {
  const currentPath = route.path;

  // 如果在设置首页，显示"设置"
  if (currentPath === "/settings") {
    return "设置";
  }

  // 如果在设置子页面，显示对应的页面名称
  const currentItem = menuItems.find((item) => item.index === activeMenu.value);
  return currentItem ? currentItem.label : "设置";
};

// 移动端菜单控制
const toggleMobileMenu = () => {
  mobileMenuVisible.value = !mobileMenuVisible.value;
};

const closeMobileMenu = () => {
  mobileMenuVisible.value = false;
};

const handleMobileMenuSelect = (index) => {
  if (index === "overview") {
    router.push("/settings/overview");
  } else {
    router.push(`/settings/${index}`);
  }
  closeMobileMenu();
};

const handleBackToHome = () => {
  // 智能返回逻辑
  const currentPath = route.path;

  // 如果在设置子页面，返回设置首页
  if (currentPath !== "/settings" && currentPath.startsWith("/settings/")) {
    router.push("/settings");
  } else {
    // 如果在设置首页，返回聊天页面
    router.push("/");
  }
};

// 菜单选择处理
const handleMenuSelect = (index) => {
  if (index === "overview") {
    router.push("/settings");
  } else {
    router.push(`/settings/${index}`);
  }
};

// 重置全部
const handleReset = async () => {
  try {
    await ElMessageBox.confirm(
      "此操作将重置所有配置到默认状态，是否继续？",
      "确认重置",
      {
        confirmButtonText: "确认",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    const result = await client.reset();
    if (result) {
      ElMessage.success("重置成功");
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("重置失败：" + error.message);
    }
  }
};

// 清理缓存
const handleResetCache = async () => {
  try {
    await ElMessageBox.confirm(
      "此操作将清理所有缓存数据，是否继续？",
      "确认清理",
      {
        confirmButtonText: "确认",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    await client.resetCache();
    ElMessage.success("清理缓存成功");
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("清理缓存失败：" + error.message);
    }
  }
};

// 初始化
onMounted(async () => {
  // 检测移动端
  checkMobile();
  window.addEventListener("resize", checkMobile);

  // 初始化日志订阅
  try {
    await logStore.initialize();
    console.log("日志订阅初始化成功");
  } catch (error) {
    console.error("日志订阅初始化失败:", error);
  }

  // 如果有本地保存的访问码，直接用它去拉取配置以验证权限
  if (configStore.isAuthenticated) {
    try {
      await configStore.fetchConfig();
      // 验证通过，继续渲染
    } catch (error) {
      // 认证失败或无权限，展示禁止访问
      forbidden.value = true;
      console.warn("当前访问码无权限或已失效", error);
    }
  } else {
    // 未登录不跳转，直接展示禁止访问（保留侧边栏可用）
    forbidden.value = true;
  }

  useStatusBarColor(() =>
    isInSubPage() ? "var(--mio-bg-card)" : "var(--mio-bg-page)",
  );
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
});
</script>

<style scoped lang="scss">
// 页面过渡动画
.page-fade-enter-active,
.page-fade-leave-active {
  transition: all 0.25s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

#settings-view {
  width: calc(100% - 3.8rem);
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--mio-bg-page); // 更柔和的背景色

  &.mobile-layout {
    width: 100%;
    height: calc(100% - 4.2rem - env(safe-area-inset-bottom, 0px));
    background-color: var(--mio-bg-page);
  }
}

// 移动端顶部导航栏
.mobile-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: var(--mio-bg-card);
  border-bottom: 1px solid var(--mio-border-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.mobile-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  height: 56px;
  box-sizing: border-box;
}

.back-button,
.menu-button {
  width: 40px;
  height: 40px;
  border: none;
  background: none;
  color: var(--mio-text-regular);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--mio-bg-hover);
  }
}

.mobile-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--mio-text-primary);
  margin: 0;
  flex: 1;
  text-align: center;
  transition: color 0.2s;
}

// 移动端菜单抽屉
.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;

  &.show {
    opacity: 1;
    visibility: visible;
  }
}

.mobile-menu-drawer {
  position: absolute;
  top: 0;
  right: 0;
  width: 280px;
  height: 100%;
  background-color: var(--mio-bg-card);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;

  &.show {
    transform: translateX(0);
  }
}

.mobile-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--mio-border-color-light);

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--mio-text-primary);
  }
}

.close-button {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: var(--mio-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--mio-bg-hover);
  }
}

.mobile-menu-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.mobile-menu-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: var(--mio-text-regular);

  &:hover {
    background-color: var(--mio-bg-hover);
  }

  &.active {
    background-color: var(--mio-bg-active);
    color: var(--mio-color-primary);
    font-weight: 500;
  }

  .menu-icon {
    width: 20px;
    height: 20px;
    margin-right: 12px;
  }

  span {
    font-size: 16px;
  }
}

.mobile-quick-actions {
  border-top: 1px solid var(--mio-border-color-light);
  padding: 8px 0;
  margin-top: 8px;
}

.quick-action-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: var(--mio-text-secondary);
  font-size: 14px;

  &:hover {
    background-color: var(--mio-bg-hover);
  }
}

.restart-banner {
  margin: 0;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--mio-border-color-light);

  &.mobile {
    margin: 0;
    border-radius: 0;
  }

  :deep(.el-alert__content) {
    width: 100%;
  }
}

.restart-banner-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.admin-panel-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 16px; // 给整体加个内边距，制造悬浮感
  gap: 16px;

  &.mobile {
    padding: 0;
    gap: 0;
    flex-direction: column;
  }
}

.admin-panel-sidebar {
  width: 220px;
  background: transparent; // 侧边栏背景透明
  border-right: none; // 去掉分割线
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  position: relative;
  z-index: 30;
  padding-right: 8px;
}

.admin-panel-menu {
  flex: 1;
  border: none;
  background: transparent;

  :deep(.el-menu-item) {
    height: 50px;
    line-height: 50px;
    margin-bottom: 4px;
    border-radius: 8px; // 菜单项圆角
    color: var(--mio-text-regular);

    &:hover {
      background-color: var(--mio-bg-hover);
    }

    &.is-active {
      background-color: var(--mio-bg-card); // 选中项白色背景
      color: var(--mio-color-primary);
      font-weight: 600;
      box-shadow: var(--mio-shadow-light); // 选中项轻微投影
    }

    .el-icon {
      font-size: 18px;
    }
  }
}

.quick-actions {
  padding: 12px 0;
  border-top: 1px solid var(--mio-border-color-light);
  display: flex;
  flex-direction: column;
  gap: 12px;

  .el-button {
    margin: 0;
    border-radius: 8px;
    height: 40px;
    justify-content: flex-start;
    padding-left: 20px;
    border: 1px solid transparent;
    background: var(--mio-bg-blur);
    color: var(--mio-text-primary);

    &:hover {
      background: var(--mio-bg-card);
      border-color: var(--mio-border-color-light);
      box-shadow: var(--mio-shadow-light);
      color: var(--mio-text-primary);
    }
  }
}

.admin-panel-content {
  flex: 1;
  overflow-y: auto;
  background-color: var(--mio-bg-card); // 内容区背景
  border-radius: 16px; // 内容区大圆角
  box-shadow: var(--mio-shadow-light); // 柔和投影
  position: relative;
  padding: 0; // 内容区内部padding由各页面自己控制，或者在这里统一加

  &.mobile {
    border-radius: 0;
    box-shadow: none;
    background-color: var(--mio-bg-page);
  }
}

.forbidden-container {
  padding: 40px;
  max-width: 980px;
  margin: 0 auto;
  position: relative;
  z-index: 10;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  &.mobile {
    padding: 20px;
    max-width: 100%;
  }
}

.content-header-spacer {
  display: none; // 新布局不需要这个占位了
}

// 响应式样式
@media (max-width: 768px) {
  #settings-view {
    width: 100% !important;
  }
  .admin-panel-sidebar {
    display: none !important;
  }
  .restart-banner-content {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
    span {
      font-size: 14px;
    }
  }
  .mobile-header {
    display: block !important;
  }
  .admin-panel-container {
    padding: 0 !important;
  }
  .admin-panel-content {
    border-radius: 0 !important;
    box-shadow: none !important;
  }
}

// 确保桌面端不显示移动端组件
@media (min-width: 769px) {
  .mobile-header,
  .mobile-menu-overlay {
    display: none !important;
  }
}

// 平板适配
@media (min-width: 769px) and (max-width: 1024px) {
  .admin-panel-sidebar {
    width: 180px;
  }
  .admin-panel-menu {
    :deep(.el-menu-item) {
      span {
        font-size: 14px;
      }
    }
  }
}

// 移动端导航状态样式
@media (max-width: 768px) {
  .mobile-header {
    // 在子页面时的样式
    &.sub-page {
      .mobile-title {
        color: var(--mio-color-primary);
      }
      .back-button {
        color: var(--mio-color-primary);
        &:hover {
          background-color: var(--mio-bg-active);
        }
      }
    }
    // 在首页时的样式
    &.main-page {
      .back-button {
        color: var(--mio-text-secondary);
        &:hover {
          background-color: var(--mio-bg-hover);
        }
      }
    }
  }
  // 面包屑导航效果
  .mobile-header-content {
    position: relative;
    &::after {
      content: "";
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--mio-color-primary) 50%,
        transparent 100%
      );
      opacity: 0;
      transition: opacity 0.3s;
    }
    &.sub-page::after {
      opacity: 1;
    }
  }

  // 移动端设置首页菜单列表样式
  .mobile-settings-list {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 16px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background-color: var(--mio-bg-page);
  }

  .mobile-settings-hero {
    padding: 12px 4px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mobile-settings-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--mio-text-primary);
    margin: 0;
  }

  .mobile-settings-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    align-self: flex-start;
    padding: 4px 8px;
    border-radius: 6px;
    background-color: var(--mio-bg-hover);
    color: var(--mio-text-regular);

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--mio-color-primary);
    }

    &.warning {
      color: var(--mio-color-warning);
      .status-dot {
        background-color: var(--mio-color-warning);
      }
    }

    &.normal {
      color: var(--mio-color-success);
      .status-dot {
        background-color: var(--mio-color-success);
      }
    }
  }

  .mobile-settings-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--mio-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-left: 4px;
  }

  .group-content {
    background-color: var(--mio-bg-card);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--mio-border-color-light);
    box-shadow: var(--mio-shadow-light);
  }

  .menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    cursor: pointer;
    background-color: var(--mio-bg-card);
    transition: background-color 0.2s;
    border-bottom: 1px solid var(--mio-border-color-light);

    &:last-child {
      border-bottom: none;
    }

    &:active {
      background-color: var(--mio-bg-hover);
    }
  }

  .menu-item-left {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    color: var(--mio-text-primary);
    font-weight: 500;

    .menu-icon {
      font-size: 18px;
      color: var(--mio-text-regular);
      display: flex;
      align-items: center;

      &.primary {
        color: var(--mio-color-primary);
      }
      &.success {
        color: var(--mio-color-success);
      }
      &.warning {
        color: var(--mio-color-warning);
      }
      &.danger {
        color: var(--mio-color-danger);
      }
      &.regular {
        color: var(--mio-text-regular);
      }
    }
  }

  .menu-item-right {
    display: flex;
    align-items: center;
    gap: 4px;

    .lock-icon {
      font-size: 14px;
      color: var(--mio-text-secondary);
      opacity: 0.6;
      display: flex;
      align-items: center;
    }

    .arrow-icon {
      font-size: 14px;
      color: var(--mio-text-secondary);
      display: flex;
      align-items: center;
    }
  }
}
</style>
