<template>
  <div id="settings-view">
    <!-- 重启服务提示横幅 -->
    <el-alert
      v-if="configStore.needRestart"
      type="warning"
      :closable="false"
      show-icon
      class="restart-banner"
    >
      <template #title>
        <div class="restart-banner-content">
          <span>配置已更改，需要重启服务才能生效</span>
          <el-button
            type="warning"
            size="small"
            @click="handleRestartService"
          >
            重启服务
          </el-button>
        </div>
      </template>
    </el-alert>

    <!-- 侧边导航 + 内容区域 -->
    <div class="settings-container">
      <!-- 侧边导航 -->
      <aside class="settings-sidebar">
        <el-menu
          :default-active="activeMenu"
          class="settings-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="overview">
            <el-icon><Menu /></el-icon>
            <span>概览</span>
          </el-menu-item>
          <el-menu-item index="llm-adapters">
            <el-icon><Connection /></el-icon>
            <span>LLM 适配器</span>
          </el-menu-item>
          <el-menu-item index="server">
            <el-icon><Monitor /></el-icon>
            <span>服务器配置</span>
          </el-menu-item>
          <el-menu-item index="web">
            <el-icon><ChromeFilled /></el-icon>
            <span>Web 配置</span>
          </el-menu-item>
          <el-menu-item index="onebot">
            <el-icon><ChatDotRound /></el-icon>
            <span>OneBot 配置</span>
          </el-menu-item>
          <el-menu-item index="plugins">
            <el-icon><Grid /></el-icon>
            <span>插件管理</span>
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
      <main class="settings-content">
        <!-- 通用页面头部占位 -->
        <div class="content-header-spacer"></div>
        
        <template v-if="forbidden">
          <div class="forbidden-container">
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
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Menu,
  Connection,
  Monitor,
  ChromeFilled,
  ChatDotRound,
  Grid
} from '@element-plus/icons-vue';
import { useConfigStore } from '@/stores/configStore.js';
import { client } from '@/lib/runtime.js';
import ErrorBoundary from '@/components/settings/ErrorBoundary.vue';

const route = useRoute();
const router = useRouter();
const configStore = useConfigStore();
const forbidden = ref(false);

// 操作：切换账号（清除 admin_code 并跳转到 /auth）
const handleSwitchAccount = () => {
  configStore.clearAdminCode();
  router.push({ path: '/auth', query: { redirect: route.fullPath || route.path } });
};

// 操作：返回首页
const handleReturnHome = () => {
  router.push('/');
};

// 当前激活的菜单项
const activeMenu = computed(() => {
  const path = route.path;
  if (path.includes('llm-adapters')) return 'llm-adapters';
  if (path.includes('server')) return 'server';
  if (path.includes('web')) return 'web';
  if (path.includes('onebot')) return 'onebot';
  if (path.includes('plugins')) return 'plugins';
  return 'overview';
});

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
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f2f3f5; // 更柔和的背景色
}

.restart-banner {
  margin: 0;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid #e4e7ed;

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
}

.content-header-spacer {
  display: none; // 新布局不需要这个占位了
}
</style>
