<template>
  <div class="overview-view">
    <!-- 加载骨架屏 -->
    <div v-if="loading" class="loading-container">
      <div class="stats-grid">
        <LoadingSkeleton v-for="i in 4" :key="i" type="stat-card" is-card />
      </div>
      <el-card class="section-card">
        <LoadingSkeleton type="list" :count="4" />
      </el-card>
    </div>

    <transition name="fade" mode="out-in">
      <div v-if="!loading" class="content-container">
        <!-- 顶部操作栏 -->
        <div class="overview-header">
          <div class="header-title">
            <h2>概览</h2>
            <span class="subtitle">系统运行状态与快捷入口</span>
          </div>
          <div class="header-actions">
            <el-tooltip content="刷新模型列表" placement="bottom">
              <el-button circle :icon="Refresh" @click="handleRefreshModels" :loading="refreshing" />
            </el-tooltip>
            <el-upload
              :before-upload="handleImportConfig"
              :show-file-list="false"
              accept=".json"
              style="display: inline-block; margin: 0 8px;"
            >
              <el-tooltip content="导入配置" placement="bottom">
                <el-button circle :icon="Upload" />
              </el-tooltip>
            </el-upload>
            <el-tooltip content="导出配置" placement="bottom">
              <el-button circle :icon="Download" @click="handleExportConfig" />
            </el-tooltip>
            <el-tooltip content="配置对比" placement="bottom">
              <el-button circle :icon="DocumentCopy" @click="showCompare = true" />
            </el-tooltip>
          </div>
        </div>

        <!-- 统计信息卡片 -->
        <div class="stats-grid">
          <el-card class="stat-card">
            <div class="stat-icon" style="background-color: #409eff20;">
              <el-icon :size="32" color="#409eff"><Connection /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ configStore.totalAdapters }}</div>
              <div class="stat-label">适配器总数</div>
            </div>
          </el-card>

          <el-card class="stat-card">
            <div class="stat-icon" style="background-color: #67c23a20;">
              <el-icon :size="32" color="#67c23a"><CircleCheck /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ configStore.enabledAdaptersCount }}</div>
              <div class="stat-label">已启用</div>
            </div>
          </el-card>

          <el-card class="stat-card">
            <div class="stat-icon" style="background-color: #e6a23c20;">
              <el-icon :size="32" color="#e6a23c"><Grid /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ configStore.totalModelsCount }}</div>
              <div class="stat-label">可用模型</div>
            </div>
          </el-card>

          <el-card class="stat-card">
            <div class="stat-icon" :style="{
              backgroundColor: systemStatus === 'normal' ? '#67c23a20' : '#f5672020'
            }">
              <el-icon
                :size="32"
                :color="systemStatus === 'normal' ? '#67c23a' : '#f56720'"
              >
                <component :is="systemStatus === 'normal' ? SuccessFilled : WarningFilled" />
              </el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ systemStatusText }}</div>
              <div class="stat-label">系统状态</div>
            </div>
          </el-card>
        </div>

        <!-- 快速操作 -->
        <div class="section-container">
          <div class="section-header">
            <h3>快速操作</h3>
          </div>
          <div class="quick-actions-grid">
            <div class="action-item" @click="navigateTo('llm-adapters')">
              <div class="action-icon" style="background: #ecf5ff; color: #409eff;">
                <el-icon><Connection /></el-icon>
              </div>
              <div class="action-info">
                <div class="action-title">LLM 适配器</div>
                <div class="action-desc">管理模型与接口</div>
              </div>
              <el-icon class="action-arrow"><ArrowRight /></el-icon>
            </div>
            
            <div class="action-item" @click="navigateTo('server')">
              <div class="action-icon" style="background: #f0f9eb; color: #67c23a;">
                <el-icon><Monitor /></el-icon>
              </div>
              <div class="action-info">
                <div class="action-title">服务器配置</div>
                <div class="action-desc">端口与网络设置</div>
              </div>
              <el-icon class="action-arrow"><ArrowRight /></el-icon>
            </div>

            <div class="action-item" @click="navigateTo('web')">
              <div class="action-icon" style="background: #fdf6ec; color: #e6a23c;">
                <el-icon><ChromeFilled /></el-icon>
              </div>
              <div class="action-info">
                <div class="action-title">Web 配置</div>
                <div class="action-desc">界面与显示选项</div>
              </div>
              <el-icon class="action-arrow"><ArrowRight /></el-icon>
            </div>

            <div class="action-item" @click="navigateTo('onebot')">
              <div class="action-icon" style="background: #f4f4f5; color: #909399;">
                <el-icon><ChatDotRound /></el-icon>
              </div>
              <div class="action-info">
                <div class="action-title">OneBot 配置</div>
                <div class="action-desc">QQ 机器人连接</div>
              </div>
              <el-icon class="action-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </div>

    <!-- 待处理事项 -->
    <el-card class="section-card" v-if="pendingItems.length > 0">
      <template #header>
        <div class="card-header">
          <el-icon><Warning /></el-icon>
          <span>待处理事项 ({{ pendingItems.length }})</span>
        </div>
      </template>
      <div class="pending-items-list">
        <div
          v-for="(item, index) in pendingItems"
          :key="index"
          class="pending-item"
        >
          <el-alert
            :type="item.type"
            :title="item.title"
            :closable="false"
          />
          <el-button
            v-if="item.action"
            type="primary"
            link
            @click="item.action.handler"
          >
            {{ item.action.text }}
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 适配器概览 -->
    <el-card class="section-card">
      <template #header>
        <div class="card-header">
          <el-icon><Connection /></el-icon>
          <span>适配器概览</span>
        </div>
      </template>
      <div class="adapters-overview">
        <div
          v-for="(instances, type) in configStore.adapters"
          :key="type"
          class="adapter-type-section"
        >
          <div class="adapter-type-header">
            <h3>{{ adapterTypeName(type) }}</h3>
            <el-tag>{{ instances.length }} 个实例</el-tag>
          </div>
          <div v-if="instances.length === 0" class="empty-state">
            暂无实例
          </div>
          <div v-else class="adapter-list">
            <div
              v-for="(adapter, index) in instances"
              :key="index"
              class="adapter-item"
            >
              <el-tag :type="adapter.enable ? 'success' : 'info'" size="small">
                {{ adapter.enable ? '已启用' : '已禁用' }}
              </el-tag>
              <span class="adapter-name">{{ adapter.name || `${type}-${index + 1}` }}</span>
              <span class="adapter-model">{{ adapter.default_model }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>
      </div>
    </transition>

    <!-- 配置对比对话框 -->
    <ConfigCompare v-model="showCompare" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import LoadingSkeleton from '@/components/settings/LoadingSkeleton.vue';
import {
  Connection,
  CircleCheck,
  Grid,
  SuccessFilled,
  WarningFilled,
  Refresh,
  Download,
  Upload,
  DocumentCopy,
  Pointer,
  Monitor,
  ChromeFilled,
  ChatDotRound,
  Warning,
  ArrowRight
} from '@element-plus/icons-vue';
import { useConfigStore } from '@/stores/configStore.js';
import ConfigCompare from '@/components/settings/ConfigCompare.vue';

const router = useRouter();
const configStore = useConfigStore();

const loading = ref(true);
const refreshing = ref(false);
const showCompare = ref(false);

// 系统状态
const systemStatus = computed(() => {
  if (configStore.needRestart) return 'warning';
  
  // 检查是否有禁用的适配器
  const hasDisabled = Object.values(configStore.adapters).some(instances =>
    instances.some(adapter => !adapter.enable)
  );
  
  return hasDisabled ? 'warning' : 'normal';
});

const systemStatusText = computed(() => {
  if (configStore.needRestart) return '需要重启';
  return systemStatus.value === 'normal' ? '正常' : '有警告';
});

// 待处理事项
const pendingItems = computed(() => {
  const items = [];
  
  // 1. 需要重启服务
  if (configStore.needRestart) {
    items.push({
      type: 'warning',
      title: '配置已更改，需要重启服务才能生效',
      action: {
        text: '去重启',
        handler: () => router.push('/settings')
      }
    });
  }
  
  // 2. 检查是否有模型列表为空的适配器
  Object.entries(configStore.adapters).forEach(([type, instances]) => {
    instances.forEach((adapter, index) => {
      if (adapter.enable) {
        const providerName = adapter.name || `${type}-${index + 1}`;
        const models = configStore.models[providerName];
        
        if (!models || models.length === 0) {
          items.push({
            type: 'error',
            title: `${providerName} 实例模型列表为空，请检查 API Key 或网络连接`,
            action: {
              text: '去检查',
              handler: () => router.push('/settings/llm-adapters')
            }
          });
        }
      }
    });
  });
  
  // 3. 检查是否有禁用的适配器
  const disabledCount = Object.values(configStore.adapters)
    .flat()
    .filter(adapter => !adapter.enable).length;
  
  if (disabledCount > 0) {
    items.push({
      type: 'info',
      title: `有 ${disabledCount} 个适配器处于禁用状态`,
      action: {
        text: '查看详情',
        handler: () => router.push('/settings/llm-adapters')
      }
    });
  }
  
  // 4. （已由 AuthView 负责）不再在管理页面重复提示管理员访问码
  
  // 5. 检查 OneBot 配置
  if (configStore.config?.onebot?.enable) {
    const onebotConfig = configStore.config.onebot;
    if (!onebotConfig.reverse_ws_url || !onebotConfig.bot_qq) {
      items.push({
        type: 'warning',
        title: 'OneBot 已启用但配置不完整',
        action: {
          text: '去完善',
          handler: () => router.push('/settings/onebot')
        }
      });
    }
  }
  
  return items;
});

// 适配器类型名称（已知类型使用友好名，其他类型首字母大写）
const adapterTypeName = (type) => {
  const names = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    vertex: 'Vertex AI'
  };
  if (names[type]) return names[type];
  if (!type) return '';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

// 刷新模型列表
const handleRefreshModels = async () => {
  refreshing.value = true;
  try {
    await configStore.refreshAllModels();
    ElMessage.success('模型列表刷新成功');
  } catch (error) {
    ElMessage.error('刷新失败：' + error.message);
  } finally {
    refreshing.value = false;
  }
};

// 导出配置
const handleExportConfig = async () => {
  try {
    const filename = `mio-chat-config-${new Date().toISOString().split('T')[0]}.json`;
    await configStore.exportConfig(filename);
    ElMessage.success('配置导出成功');
  } catch (error) {
    ElMessage.error('导出失败：' + error.message);
  }
};

// 导入配置
const handleImportConfig = async (file) => {
  try {
    await ElMessageBox.confirm(
      '导入配置将覆盖当前所有配置，是否继续？',
      '确认导入',
      {
        confirmButtonText: '导入',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const configData = await configStore.importConfig(file);
    
    // 验证配置
    const validateResult = await configStore.validateConfig(configData);
    if (!validateResult.valid) {
      ElMessageBox.alert(
        `配置验证失败：\n${validateResult.errors.join('\n')}`,
        '导入失败',
        { type: 'error' }
      );
      return false;
    }

    // 更新配置
    await configStore.updateConfig(configData);
    ElMessage.success('配置导入成功，请重启服务使配置生效');
    
    // 重新加载配置
    await configStore.fetchConfig();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('导入失败：' + error.message);
    }
  }
  
  return false; // 阻止自动上传
};

// 导航到指定页面
const navigateTo = (path) => {
  router.push(`/settings/${path}`);
};

// 加载配置
onMounted(async () => {
  loading.value = true;
  try {
    if (!configStore.config) {
      await configStore.fetchConfig();
    }
    // 模拟最小加载时间，提升用户体验
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (error) {
    ElMessage.error('加载配置失败：' + error.message);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped lang="scss">
// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.overview-view {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.loading-container {
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .section-card {
    margin-bottom: 24px;
  }
}

.content-container {
  width: 100%;
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  .header-title {
    h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #303133;
    }
    
    .subtitle {
      font-size: 14px;
      color: #909399;
      margin-top: 4px;
      display: block;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .el-button {
      border: none;
      background: transparent;
      font-size: 18px;
      color: #606266;
      width: 40px;
      height: 40px;
      
      &:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #409eff;
      }
    }
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  border: none;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
  }

  :deep(.el-card__body) {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .stat-content {
    flex: 1;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 600;
    color: #303133;
    line-height: 1.2;
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 14px;
    color: #909399;
  }
}

.section-container {
  margin-bottom: 32px;

  .section-header {
    margin-bottom: 16px;
    
    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;

  .action-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid transparent;

    &:hover {
      background: #fff;
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.05);
      border-color: var(--el-color-primary-light-8);

      .action-arrow {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .action-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    .action-info {
      flex: 1;
      
      .action-title {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
        margin-bottom: 4px;
      }

      .action-desc {
        font-size: 12px;
        color: #909399;
      }
    }

    .action-arrow {
      font-size: 16px;
      color: #c0c4cc;
      opacity: 0;
      transform: translateX(-10px);
      transition: all 0.3s ease;
    }
  }
}

.pending-items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .pending-item {
    display: flex;
    align-items: center;
    gap: 12px;

    .el-alert {
      flex: 1;
    }

    .el-button {
      flex-shrink: 0;
    }
  }
}

.adapters-overview {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.adapter-type-section {
  display: flex;
  flex-direction: column;
  
  &:last-child {
    padding-bottom: 24px;
  }
  
  .adapter-type-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e4e7ed;
    flex-shrink: 0;
    min-height: 32px; // 确保统一高度

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      line-height: 1.5;
    }
  }

  .empty-state {
    text-align: center;
    padding: 32px;
    color: #909399;
    font-size: 14px;
  }

  .adapter-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .adapter-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background-color: #f5f7fa;
    border-radius: 6px;
    transition: background-color 0.2s;

    &:hover {
      background-color: #ecf5ff;
    }

    .adapter-name {
      font-weight: 500;
      color: #303133;
    }

    .adapter-model {
      margin-left: auto;
      color: #909399;
      font-size: 13px;
    }
  }
}
</style>
