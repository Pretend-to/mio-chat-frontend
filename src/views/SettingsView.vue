<template>
  <div id="settings-view" :class="{ 'mobile-layout': isMobile }">
    <!-- 移动端顶部导航栏 -->
    <div v-if="isMobile" class="mobile-header" :class="{ 'sub-page': isInSubPage(), 'main-page': !isInSubPage() }">
      <div class="mobile-header-content" :class="{ 'sub-page': isInSubPage() }">
        <button class="back-button" @click="handleBackToHome" :title="getBackButtonTitle()">
          <!-- 在设置子页面显示返回箭头 -->
          <svg v-if="isInSubPage()" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <!-- 在设置首页显示关闭图标 -->
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <h1 class="mobile-title">{{ getMobileTitle() }}</h1>
        <button v-if="showMobileMenu" class="menu-button" @click="toggleMobileMenu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 重启服务提示横幅 -->
    <el-alert
      v-if="configStore.needRestart"
      type="warning"
      :closable="false"
      show-icon
      class="restart-banner"
      :class="{ 'mobile': isMobile }"
    >
      <template #title>
        <div class="restart-banner-content">
          <span>{{ isMobile ? '需要重启服务' : '配置已更改，需要重启服务才能生效' }}</span>
          <el-button
            type="warning"
            :size="isMobile ? 'small' : 'small'"
            @click="handleRestartService"
          >
            重启服务
          </el-button>
        </div>
      </template>
    </el-alert>

    <!-- 移动端菜单抽屉 -->
    <div v-if="isMobile" class="mobile-menu-overlay" :class="{ 'show': mobileMenuVisible }" @click="closeMobileMenu">
      <div class="mobile-menu-drawer" :class="{ 'show': mobileMenuVisible }" @click.stop>
        <div class="mobile-menu-header">
          <h2>设置菜单</h2>
          <button class="close-button" @click="closeMobileMenu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="mobile-menu-content">
          <div
            v-for="item in menuItems"
            :key="item.index"
            class="mobile-menu-item"
            :class="{ 'active': activeMenu === item.index }"
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
          </div>
        </div>
      </div>
    </div>

    <!-- 桌面端布局 -->
    <div class="settings-container" :class="{ 'mobile': isMobile }">
      <!-- 侧边导航 - 仅桌面端显示 -->
      <aside v-if="!isMobile" class="settings-sidebar">
        <el-menu
          :default-active="activeMenu"
          class="settings-menu"
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
          <el-button type="info" plain @click="handleReset" style="width: 100%">
            重置全部
          </el-button>
          <el-button type="info" plain @click="handleResetCache" style="width: 100%">
            清理缓存
          </el-button>
        </div>
      </aside>

      <!-- 内容区域 -->
      <main class="settings-content" :class="{ 'mobile': isMobile }">
        <!-- 通用页面头部占位 -->
        <div class="content-header-spacer"></div>
        
        <template v-if="forbidden">
          <div class="forbidden-container" :class="{ 'mobile': isMobile }">
            <el-result
              icon="error"
              title="禁止访问"
              sub-title="当前访问码无权限或已失效，您无法访问配置管理页面。"
            >
              <template #extra>
                <el-button type="primary" @click="handleSwitchAccount">切换账号</el-button>
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
    </div>
  </div>
</template>

<script setup>
import ErrorBoundary from '@/components/settings/ErrorBoundary.vue';
import { client } from '@/lib/runtime.js';
import { useConfigStore } from '@/stores/configStore.js';
import {
  ChatDotRound,
  ChromeFilled,
  Connection,
  Document,
  Grid,
  Menu,
  Monitor
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const configStore = useConfigStore();
const forbidden = ref(false);

// 移动端相关状态
const isMobile = ref(false);
const mobileMenuVisible = ref(false);

// 计算是否显示移动端菜单按钮
const showMobileMenu = computed(() => {
  // 只在设置首页显示菜单按钮
  return route.path === '/settings';
});

// 菜单项配置
const menuItems = [
  { index: 'overview', label: '概览', icon: Menu },
  { index: 'llm-adapters', label: 'LLM 适配器', icon: Connection },
  { index: 'server', label: '服务器配置', icon: Monitor },
  { index: 'web', label: 'Web 配置', icon: ChromeFilled },
  { index: 'onebot', label: 'OneBot 配置', icon: ChatDotRound },
  { index: 'plugins', label: '插件管理', icon: Grid },
  { index: 'presets', label: '预设管理', icon: Document }
];

// 操作：切换账号（清除 admin_code 并跳转到 /auth）
const handleSwitchAccount = () => {
  configStore.clearAdminCode();
  router.push({ path: '/auth', query: { redirect: route.fullPath || route.path } });
};

// 操作：返回首页
const handleReturnHome = () => {
  router.push('/');
};

// 响应式检测
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

// 当前激活的菜单项
const activeMenu = computed(() => {
  const path = route.path;
  if (path.includes('llm-adapters')) return 'llm-adapters';
  if (path.includes('server')) return 'server';
  if (path.includes('web')) return 'web';
  if (path.includes('onebot')) return 'onebot';
  if (path.includes('plugins')) return 'plugins';
  if (path.includes('presets')) return 'presets';
  return 'overview';
});

// 检查是否在设置子页面
const isInSubPage = () => {
  const currentPath = route.path;
  return currentPath !== '/settings' && currentPath.startsWith('/settings/');
};

// 获取返回按钮的提示文本
const getBackButtonTitle = () => {
  return isInSubPage() ? '返回设置' : '关闭设置';
};

// 获取移动端标题
const getMobileTitle = () => {
  const currentPath = route.path;
  
  // 如果在设置首页，显示"设置"
  if (currentPath === '/settings') {
    return '设置';
  }
  
  // 如果在设置子页面，显示对应的页面名称
  const currentItem = menuItems.find(item => item.index === activeMenu.value);
  return currentItem ? currentItem.label : '设置';
};

// 移动端菜单控制
const toggleMobileMenu = () => {
  mobileMenuVisible.value = !mobileMenuVisible.value;
};

const closeMobileMenu = () => {
  mobileMenuVisible.value = false;
};

const handleMobileMenuSelect = (index) => {
  handleMenuSelect(index);
  closeMobileMenu();
};

const handleBackToHome = () => {
  // 智能返回逻辑
  const currentPath = route.path;
  
  // 如果在设置子页面，返回设置首页
  if (currentPath !== '/settings' && currentPath.startsWith('/settings/')) {
    router.push('/settings');
  } else {
    // 如果在设置首页，返回聊天页面
    router.push('/');
  }
};

// 菜单选择处理
const handleMenuSelect = (index) => {
  if (index === 'overview') {
    router.push('/settings');
  } else {
    router.push(`/settings/${index}`);
  }
};

// 重启服务
const handleRestartService = async () => {
  try {
    await ElMessageBox.confirm(
      '重启服务将断开所有连接，是否继续？',
      '确认重启',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    ElMessage.info('重启服务功能需要后端支持，暂未实现');
    // TODO: 调用后端重启 API
    // await configAPI.restartService();
  } catch (error) {
    // 用户取消
  }
};

// 重置全部
const handleReset = async () => {
  try {
    await ElMessageBox.confirm(
      '此操作将重置所有配置到默认状态，是否继续？',
      '确认重置',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const result = await client.reset();
    if (result) {
      ElMessage.success('重置成功');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('重置失败：' + error.message);
    }
  }
};

// 清理缓存
const handleResetCache = async () => {
  try {
    await ElMessageBox.confirm(
      '此操作将清理所有缓存数据，是否继续？',
      '确认清理',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    await client.resetCache();
    ElMessage.success('清理缓存成功');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理缓存失败：' + error.message);
    }
  }
};

// 初始化
onMounted(async () => {
  // 检测移动端
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  // 如果有本地保存的访问码，直接用它去拉取配置以验证权限
  if (configStore.isAuthenticated) {
    try {
      await configStore.fetchConfig();
      // 验证通过，继续渲染
    } catch (error) {
      // 认证失败或无权限，展示禁止访问
      forbidden.value = true;
      console.warn('当前访问码无权限或已失效', error);
    }
  } else {
    // 未登录不跳转，直接展示禁止访问（保留侧边栏可用）
    forbidden.value = true;
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
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
  background-color: #f2f3f5; // 更柔和的背景色

  &.mobile-layout {
    width: 100%;
    height: 100vh;
    background-color: #f8f9fa;
  }
}

// 移动端顶部导航栏
.mobile-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
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
  color: #606266;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f7fa;
  }
}

.mobile-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
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
  background-color: #fff;
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
  border-bottom: 1px solid #e4e7ed;

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }
}

.close-button {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: #909399;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f7fa;
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
  color: #606266;

  &:hover {
    background-color: #f5f7fa;
  }

  &.active {
    background-color: #ecf5ff;
    color: #409eff;
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
  border-top: 1px solid #e4e7ed;
  padding: 8px 0;
  margin-top: 8px;
}

.quick-action-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #909399;
  font-size: 14px;

  &:hover {
    background-color: #f5f7fa;
  }
}

.restart-banner {
  margin: 0;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid #e4e7ed;

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

.settings-container {
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

.settings-sidebar {
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

.settings-menu {
  flex: 1;
  border: none;
  background: transparent;
  
  :deep(.el-menu-item) {
    height: 50px;
    line-height: 50px;
    margin-bottom: 4px;
    border-radius: 8px; // 菜单项圆角
    color: #606266;
    
    &:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }
    
    &.is-active {
      background-color: #fff; // 选中项白色背景
      color: #409eff;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); // 选中项轻微投影
    }

    .el-icon {
      font-size: 18px;
    }
  }
}

.quick-actions {
  padding: 12px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;

  .el-button {
    margin: 0;
    border-radius: 8px;
    height: 40px;
    justify-content: flex-start;
    padding-left: 20px;
    border: none;
    background: rgba(255, 255, 255, 0.6);
    
    &:hover {
      background: #fff;
    }
  }
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  background-color: #fff; // 内容区白色背景
  border-radius: 16px; // 内容区大圆角
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); // 柔和投影
  position: relative;
  padding: 0; // 内容区内部padding由各页面自己控制，或者在这里统一加

  &.mobile {
    border-radius: 0;
    box-shadow: none;
    background-color: #f8f9fa;
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
</style>

// 响应式样式
@media (max-width: 768px) {
  #settings-view {
    width: 100% !important;
  }

  .settings-sidebar {
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

  .settings-container {
    padding: 0 !important;
  }

  .settings-content {
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
  .settings-sidebar {
    width: 180px;
  }

  .settings-menu {
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
        color: #409eff;
      }
      
      .back-button {
        color: #409eff;
        
        &:hover {
          background-color: #ecf5ff;
        }
      }
    }
    
    // 在首页时的样式
    &.main-page {
      .back-button {
        color: #909399;
        
        &:hover {
          background-color: #f5f7fa;
        }
      }
    }
  }
  
  // 面包屑导航效果
  .mobile-header-content {
    position: relative;
    
    &::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, #409eff 50%, transparent 100%);
      opacity: 0;
      transition: opacity 0.3s;
    }
    
    &.sub-page::after {
      opacity: 1;
    }
  }
}