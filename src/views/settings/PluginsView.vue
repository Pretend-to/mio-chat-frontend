<template>
  <div class="plugins-view">
    <!-- 加载骨架屏 -->
    <div v-if="loading" class="loading-container">
      <div class="skeleton-header">
        <div class="skeleton-title"></div>
        <div class="skeleton-actions">
          <div class="skeleton-button" v-for="i in 2" :key="i"></div>
        </div>
      </div>
      <div class="plugins-grid">
        <LoadingSkeleton v-for="i in 6" :key="i" type="adapter-card" is-card />
      </div>
    </div>

    <transition name="fade" mode="out-in">
      <div v-if="!loading" class="content-container">
        <!-- 页面头部 -->
        <div class="page-header">
          <h1>插件管理</h1>
          <div class="header-actions">
            <el-button
              type="primary"
              :icon="Refresh"
              :loading="refreshing"
              @click="handleRefreshPlugins"
            >
              刷新插件
            </el-button>
            <el-button
              type="success"
              :icon="RefreshRight"
              @click="handleReloadAll"
            >
              重载全部
            </el-button>
          </div>
        </div>

        <!-- 统计卡片 -->
        <div class="stats-row">
          <el-card class="stat-card">
            <div class="stat-icon" style="background-color: #409eff20;">
              <el-icon :size="24" color="#409eff"><Grid /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ plugins.length }}</div>
              <div class="stat-label">插件总数</div>
            </div>
          </el-card>

          <el-card class="stat-card">
            <div class="stat-icon" style="background-color: #67c23a20;">
              <el-icon :size="24" color="#67c23a"><CircleCheck /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ enabledCount }}</div>
              <div class="stat-label">已启用</div>
            </div>
          </el-card>

          <el-card class="stat-card">
            <div class="stat-icon" style="background-color: #e6a23c20;">
              <el-icon :size="24" color="#e6a23c"><Tools /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ totalToolsCount }}</div>
              <div class="stat-label">工具总数</div>
            </div>
          </el-card>

          <el-card class="stat-card">
            <div class="stat-icon" style="background-color: #90939920;">
              <el-icon :size="24" color="#909399"><Box /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ customPluginsCount }}</div>
              <div class="stat-label">自定义插件</div>
            </div>
          </el-card>
        </div>

        <!-- 插件列表 -->
        <div class="plugins-list">
          <el-card
            v-for="plugin in plugins"
            :key="plugin.name"
            class="plugin-card"
            :class="{ disabled: !plugin.enabled }"
          >
            <div class="plugin-header">
              <div class="plugin-info">
                <div class="plugin-title-row">
                  <h3 class="plugin-name">
                    <el-tag
                      v-if="plugin.type === 'custom'"
                      type="warning"
                      size="small"
                      style="margin-right: 8px;"
                    >
                      自定义
                    </el-tag>
                    {{ plugin.displayName }}
                  </h3>
                  <el-switch
                    v-model="plugin.enabled"
                    @change="handleTogglePlugin(plugin)"
                    :loading="plugin.toggling"
                  />
                </div>
                <p class="plugin-description">{{ plugin.description || '暂无描述' }}</p>
                <div class="plugin-meta">
                  <el-tag size="small" type="info">v{{ plugin.version }}</el-tag>
                  <span class="meta-item">
                    <el-icon><User /></el-icon>
                    {{ plugin.author }}
                  </span>
                  <span class="meta-item">
                    <el-icon><Tools /></el-icon>
                    {{ plugin.toolCount }} 个工具
                  </span>
                  <el-tag
                    v-if="plugin.hasConfig"
                    size="small"
                    type="success"
                  >
                    <el-icon><Setting /></el-icon>
                    可配置
                  </el-tag>
                </div>
              </div>
            </div>

            <div class="plugin-actions">
              <el-button
                size="small"
                :icon="View"
                @click="handleViewPlugin(plugin)"
              >
                查看详情
              </el-button>
              <el-button
                v-if="plugin.hasConfig"
                size="small"
                :icon="Setting"
                @click="handleConfigPlugin(plugin)"
              >
                配置
              </el-button>
              <el-button
                size="small"
                type="primary"
                :icon="Refresh"
                :loading="plugin.reloading"
                @click="handleReloadPlugin(plugin)"
              >
                重载
              </el-button>
            </div>
          </el-card>
        </div>
      </div>
    </transition>

    <!-- 插件详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`${currentPlugin?.displayName} - 详情`"
      width="800px"
      destroy-on-close
    >
      <div v-if="currentPlugin" class="plugin-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="插件名称">
            {{ currentPlugin.displayName }}
          </el-descriptions-item>
          <el-descriptions-item label="版本">
            {{ currentPlugin.version }}
          </el-descriptions-item>
          <el-descriptions-item label="作者">
            {{ currentPlugin.author }}
          </el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag :type="currentPlugin.type === 'standard' ? 'success' : 'warning'">
              {{ currentPlugin.type === 'standard' ? '标准插件' : '自定义插件' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentPlugin.enabled ? 'success' : 'info'">
              {{ currentPlugin.enabled ? '已启用' : '已禁用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="工具数量">
            {{ currentPlugin.toolCount }}
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ currentPlugin.description || '暂无描述' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 工具列表 -->
        <div v-if="pluginTools.length > 0" class="tools-section">
          <h4>提供的工具</h4>
          <el-collapse v-model="activeCollapseNames">
            <el-collapse-item
              v-for="group in pluginTools"
              :key="group.group"
              :name="group.group"
              :title="`${group.group} (${group.tools.length})`"
            >
              <div
                v-for="tool in group.tools"
                :key="tool.name"
                class="tool-item"
              >
                <div class="tool-header">
                  <h5>{{ tool.name }}</h5>
                  <el-button
                    size="small"
                    type="primary"
                    :icon="Cpu"
                    @click="handleDebugTool(tool)"
                  >
                    调试
                  </el-button>
                </div>
                <p class="tool-description">{{ tool.description }}</p>
                <el-tag size="small" type="info">
                  参数: {{ Object.keys(tool.parameters?.properties || {}).length }}
                </el-tag>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </el-dialog>

    <!-- 配置对话框 -->
    <el-dialog
      v-model="configDialogVisible"
      :title="`${currentPlugin?.displayName} - 配置`"
      width="700px"
      destroy-on-close
    >
      <div class="config-editor">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px;"
        >
          <template #title>
            配置将自动保存并触发热更新
          </template>
        </el-alert>
        
        <el-input
          v-model="configJsonStr"
          type="textarea"
          :rows="15"
          placeholder="JSON 配置"
          class="config-textarea"
        />
      </div>
      
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="savingConfig"
          @click="handleSaveConfig"
        >
          保存配置
        </el-button>
      </template>
    </el-dialog>

    <!-- 工具调试对话框 -->
    <el-dialog
      v-model="debugDialogVisible"
      :title="`调试工具: ${currentTool?.name}`"
      width="800px"
      destroy-on-close
      class="debug-dialog"
    >
      <div class="debug-container" style="height: 60vh; overflow-y: auto;">
        <!-- 工具信息 -->
        <el-card class="tool-info-card" shadow="never">
          <div class="tool-info">
            <div class="info-row">
              <label>工具名称</label>
              <el-tag type="primary">{{ currentTool?.name }}</el-tag>
            </div>
            <div class="info-row">
              <label>描述</label>
              <span>{{ currentTool?.description || '无描述' }}</span>
            </div>
          </div>
        </el-card>

        <!-- 参数说明 -->
        <el-card class="params-schema-card" shadow="never" v-if="currentTool?.parameters">
          <template #header>
            <div class="card-header">
              <span>参数说明</span>
              <el-button
                size="small"
                type="primary"
                text
                @click="fillExampleParams"
              >
                填充示例参数
              </el-button>
            </div>
          </template>
          
          <div class="params-schema">
            <div
              v-for="(prop, key) in currentTool?.parameters?.properties"
              :key="key"
              class="param-item"
            >
              <div class="param-header">
                <span class="param-name">
                  {{ key }}
                  <el-tag
                    v-if="currentTool?.parameters?.required?.includes(key)"
                    type="danger"
                    size="small"
                    effect="plain"
                  >
                    必需
                  </el-tag>
                  <el-tag
                    v-else
                    type="info"
                    size="small"
                    effect="plain"
                  >
                    可选
                  </el-tag>
                </span>
                <el-tag size="small" type="info">{{ prop.type }}</el-tag>
              </div>
              <div class="param-description">{{ prop.description || '无描述' }}</div>
              <div v-if="prop.enum" class="param-enum">
                可选值: {{ prop.enum.join(', ') }}
              </div>
              <div v-if="prop.items" class="param-items">
                数组项类型: {{ prop.items.type }}
              </div>
            </div>
          </div>
        </el-card>

        <!-- 参数输入 -->
        <el-card class="params-input-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>参数输入 (JSON 格式)</span>
              <el-button
                size="small"
                type="warning"
                text
                @click="debugParams = '{}'"
              >
                清空
              </el-button>
            </div>
          </template>
          
          <el-input
            v-model="debugParams"
            type="textarea"
            :rows="6"
            placeholder='请输入 JSON 格式的参数，例如: {"query": "test", "limit": 10}'
            class="params-textarea"
          />
          
          <div class="params-hint">
            <el-icon><InfoFilled /></el-icon>
            提示: 请确保输入的是有效的 JSON 格式，必需参数不能缺失
          </div>
        </el-card>

        <!-- 执行结果 -->
        <div v-if="debugResult" class="result-container">
          <el-card class="result-card" shadow="never">
            <template #header>
              <div class="card-header">
                <span>执行结果</span>
              </div>
            </template>
            
            <div class="debug-result-wrapper" :class="debugResult.success ? 'status-success' : 'status-error'">
              <div class="result-header">
                <div class="status-indicator">
                  <el-icon :size="18" class="icon">
                    <CircleCheckFilled v-if="debugResult.success" />
                    <CircleCloseFilled v-else />
                  </el-icon>
                  <span class="status-text">{{ debugResult.success ? '执行成功' : '执行失败' }}</span>
                </div>
                <div v-if="debugResult.success" class="execution-meta">
                  <span class="meta-item">耗时: {{ debugResult.executionTime }}</span>
                </div>
              </div>

              <div class="result-body">
                <template v-if="debugResult.success">
                  <div class="plugin-info-bar">
                    <span class="info-item">
                      <span class="label">插件:</span>
                      <span class="value">{{ debugResult.pluginName }}</span>
                    </span>
                    <span class="divider">|</span>
                    <span class="info-item">
                      <span class="label">工具:</span>
                      <span class="value">{{ debugResult.toolName }}</span>
                    </span>
                  </div>
                  
                  <div class="json-viewer-container">
                    <div class="viewer-label">返回结果</div>
                    <div class="json-content">
                      <pre>{{ JSON.stringify(debugResult.result, null, 2) }}</pre>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="error-content">
                    <div class="error-message-box">
                      <el-icon class="error-icon"><InfoFilled /></el-icon>
                      <span class="message-text">{{ debugResult.error?.message || '未知错误' }}</span>
                    </div>
                    <div v-if="debugResult.error?.stack" class="error-stack">
                      <div class="stack-label">错误堆栈</div>
                      <pre class="stack-content">{{ debugResult.error.stack }}</pre>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </el-card>
        </div>
      </div>

      <template #footer>
        <el-button @click="debugDialogVisible = false">关闭</el-button>
        <el-button
          type="primary"
          :icon="Cpu"
          :loading="debugging"
          @click="handleExecuteDebug"
        >
          执行调试
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Refresh,
  RefreshRight,
  Grid,
  CircleCheck,
  CircleCheckFilled,
  CircleCloseFilled,
  Tools,
  Box,
  User,
  Setting,
  View,
  Cpu,
  InfoFilled
} from '@element-plus/icons-vue';
import LoadingSkeleton from '@/components/settings/LoadingSkeleton.vue';
import { pluginAPI } from '@/lib/configApi.js';

const loading = ref(false);
const refreshing = ref(false);
const plugins = ref([]);
const detailDialogVisible = ref(false);
const configDialogVisible = ref(false);
const debugDialogVisible = ref(false);
const currentPlugin = ref(null);
const currentTool = ref(null);
const pluginTools = ref([]);
const configJsonStr = ref('');
const savingConfig = ref(false);
const debugParams = ref('{}');
const debugResult = ref(null);
const debugging = ref(false);
const activeCollapseNames = ref([]);

// 统计数据
const enabledCount = computed(() => plugins.value.filter(p => p.enabled).length);
const totalToolsCount = computed(() => plugins.value.reduce((sum, p) => sum + p.toolCount, 0));
const customPluginsCount = computed(() => plugins.value.filter(p => p.type === 'custom').length);

// 加载插件列表
const loadPlugins = async () => {
  loading.value = true;
  try {
    const result = await pluginAPI.listPlugins();
    if (result.code === 0) {
      plugins.value = result.data.plugins.map(p => ({
        ...p,
        reloading: false,
        toggling: false
      }));
    } else {
      ElMessage.error('加载插件列表失败：' + result.message);
    }
  } catch (error) {
    ElMessage.error('加载插件列表失败：' + error.message);
  } finally {
    loading.value = false;
  }
};

// 刷新插件
const handleRefreshPlugins = async () => {
  refreshing.value = true;
  try {
    await loadPlugins();
    ElMessage.success('刷新成功');
  } finally {
    refreshing.value = false;
  }
};

// 重载所有插件
const handleReloadAll = async () => {
  try {
    await ElMessageBox.confirm(
      '将重新加载所有插件的工具，是否继续？',
      '确认重载',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const result = await pluginAPI.reloadAllPlugins();
    if (result.code === 0) {
      ElMessage.success(`重载完成：成功 ${result.data.successCount}/${result.data.totalCount}`);
      await loadPlugins();
    } else {
      ElMessage.error('重载失败：' + result.message);
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('重载失败：' + error.message);
    }
  }
};

// 重载单个插件
const handleReloadPlugin = async (plugin) => {
  plugin.reloading = true;
  try {
    const result = await pluginAPI.reloadPlugin(plugin.name);
    if (result.code === 0) {
      ElMessage.success(`${plugin.displayName} 重载成功`);
      await loadPlugins();
    } else {
      ElMessage.error('重载失败：' + result.message);
    }
  } catch (error) {
    ElMessage.error('重载失败：' + error.message);
  } finally {
    plugin.reloading = false;
  }
};

// 切换插件启用状态
const handleTogglePlugin = async (plugin) => {
  plugin.toggling = true;
  try {
    const result = await pluginAPI.togglePlugin(plugin.name, plugin.enabled);
    if (result.code === 0) {
      ElMessage.success(`${plugin.displayName} 已${plugin.enabled ? '启用' : '禁用'}`);
    } else {
      ElMessage.error('操作失败：' + result.message);
      plugin.enabled = !plugin.enabled; // 回滚
    }
  } catch (error) {
    ElMessage.error('操作失败：' + error.message);
    plugin.enabled = !plugin.enabled; // 回滚
  } finally {
    plugin.toggling = false;
  }
};
// 查看插件详情
const handleViewPlugin = async (plugin) => {
  currentPlugin.value = plugin;
  detailDialogVisible.value = true;
  
  try {
    const result = await pluginAPI.getPluginTools(plugin.name);
    if (result.code === 0) {
      pluginTools.value = result.data.tools;
      // 默认展开所有分组
      activeCollapseNames.value = result.data.tools.map(g => g.group);
    }
  } catch (error) {
    ElMessage.error('加载工具列表失败：' + error.message);
  }
};

// 配置插件
const handleConfigPlugin = async (plugin) => {
  currentPlugin.value = plugin;
  
  try {
    const result = await pluginAPI.getPluginConfig(plugin.name);
    if (result.code === 0) {
      configJsonStr.value = JSON.stringify(result.data, null, 2);
      configDialogVisible.value = true;
    } else {
      ElMessage.error('加载配置失败：' + result.message);
    }
  } catch (error) {
    ElMessage.error('加载配置失败：' + error.message);
  }
};

// 保存配置
const handleSaveConfig = async () => {
  try {
    const config = JSON.parse(configJsonStr.value);
    savingConfig.value = true;
    
    const result = await pluginAPI.updatePluginConfig(currentPlugin.value.name, config);
    if (result.code === 0) {
      ElMessage.success('配置保存成功');
      configDialogVisible.value = false;
      
      // 提示用户可能需要重载插件
      ElMessageBox.confirm(
        '配置已更新，是否立即重载插件使配置生效？',
        '提示',
        {
          confirmButtonText: '立即重载',
          cancelButtonText: '稍后',
          type: 'info'
        }
      ).then(async () => {
        await handleReloadPlugin(currentPlugin.value);
      }).catch(() => {});
    } else {
      ElMessage.error('保存失败：' + result.message);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      ElMessage.error('JSON 格式错误');
    } else {
      ElMessage.error('保存失败：' + error.message);
    }
  } finally {
    savingConfig.value = false;
  }
};

// 调试工具
const handleDebugTool = (tool) => {
  currentTool.value = tool;
  debugParams.value = '{}';
  debugResult.value = null;
  debugDialogVisible.value = true;
};

// 填充示例参数
const fillExampleParams = () => {
  if (!currentTool.value?.parameters?.properties) {
    debugParams.value = '{}';
    return;
  }

  const example = {};
  const props = currentTool.value.parameters.properties;
  
  for (const [key, prop] of Object.entries(props)) {
    // 根据类型生成示例值
    switch (prop.type) {
      case 'string':
        if (prop.enum && prop.enum.length > 0) {
          example[key] = prop.enum[0];
        } else if (key.toLowerCase().includes('url')) {
          example[key] = 'https://example.com';
        } else if (key.toLowerCase().includes('path')) {
          example[key] = '/path/to/file';
        } else if (key.toLowerCase().includes('query') || key.toLowerCase().includes('search')) {
          example[key] = '搜索关键词';
        } else {
          example[key] = '示例文本';
        }
        break;
      case 'number':
      case 'integer':
        example[key] = prop.minimum || 0;
        break;
      case 'boolean':
        example[key] = true;
        break;
      case 'array':
        example[key] = [];
        break;
      case 'object':
        example[key] = {};
        break;
      default:
        example[key] = null;
    }
  }
  
  debugParams.value = JSON.stringify(example, null, 2);
};

// 执行调试
const handleExecuteDebug = async () => {
  try {
    const params = JSON.parse(debugParams.value);
    debugging.value = true;
    debugResult.value = null;
    
    const result = await pluginAPI.debugTool(
      currentPlugin.value.name,
      currentTool.value.name,
      params
    );
    
    if (result.code === 0) {
      debugResult.value = result.data;
    } else {
      ElMessage.error('调试失败：' + result.message);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      ElMessage.error('参数 JSON 格式错误');
    } else {
      ElMessage.error('调试失败：' + error.message);
    }
  } finally {
    debugging.value = false;
  }
};

// 初始化
onMounted(() => {
  loadPlugins();
});
</script>

<style scoped lang="scss">
.plugins-view {
  width: 100%;
  height: 100%;
}

.loading-container {
  padding: 24px;
}

.skeleton-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  .skeleton-title {
    width: 200px;
    height: 32px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s ease-in-out infinite;
    border-radius: 4px;
  }

  .skeleton-actions {
    display: flex;
    gap: 12px;

    .skeleton-button {
      width: 100px;
      height: 32px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: loading 1.5s ease-in-out infinite;
      border-radius: 4px;
    }
  }
}

.plugins-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.content-container {
  padding: 24px;
  animation: fadeIn 0.3s ease;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #303133;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;

  .stat-card {
    cursor: default;

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
    }

    .stat-content {
      flex: 1;

      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: #303133;
        line-height: 1;
        margin-bottom: 8px;
      }

      .stat-label {
        font-size: 14px;
        color: #909399;
      }
    }
  }
}

.plugins-list {
  display: grid;
  gap: 16px;

  .plugin-card {
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    &.disabled {
      opacity: 0.6;
    }

    :deep(.el-card__body) {
      padding: 20px;
    }

    .plugin-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;

      .plugin-info {
        flex: 1;

        .plugin-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;

          .plugin-name {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #303133;
            display: flex;
            align-items: center;
          }
        }

        .plugin-description {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #606266;
          line-height: 1.6;
        }

        .plugin-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;

          .meta-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 13px;
            color: #909399;
          }
        }
      }
    }

    .plugin-actions {
      display: flex;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid #ebeef5;
    }
  }
}

.plugin-detail {
  max-height: 70vh;
  overflow-y: auto;
  overflow-x: hidden;

  // 自定义滚动条样式
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;

    &:hover {
      background: #a8a8a8;
    }
  }

  .tools-section {
    margin-top: 24px;

    h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }

    .tool-item {
      padding: 12px;
      border-bottom: 1px solid #ebeef5;

      &:last-child {
        border-bottom: none;
      }

      .tool-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        h5 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #303133;
        }
      }

      .tool-description {
        margin: 0 0 8px 0;
        font-size: 13px;
        color: #606266;
      }
    }
  }
}

.config-editor {
  .config-textarea {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
  }
}

.debug-dialog {
  :deep(.el-dialog__body) {
    padding: 0 !important;
  }

  :deep(.el-alert__content) {
    flex-grow: 1;
  }
}

.debug-container {
  padding: 20px;
}

.result-container {
  margin-top: 16px;
}

  .tool-info-card,
  .params-schema-card,
  .params-input-card {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .result-card {
    margin-top: 16px;
    margin-bottom: 0;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    color: #303133;
  }

  .tool-info {
    .info-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      label {
        min-width: 80px;
        font-weight: 600;
        color: #606266;
      }

      span {
        color: #303133;
      }
    }
  }

  .params-schema {
    .param-item {
      padding: 12px;
      background: #f5f7fa;
      border-radius: 4px;
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      .param-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .param-name {
          font-weight: 600;
          color: #303133;
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }

      .param-description {
        font-size: 13px;
        color: #606266;
        margin-bottom: 4px;
      }

      .param-enum,
      .param-items {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;
      }
    }
  }

  .params-textarea {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
  }
  .debug-result-wrapper {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid;
    transition: all 0.3s ease;

    &.status-success {
      border-color: #e1f3d8;
      background-color: #f0f9eb;

      .result-header {
        background-color: #e1f3d8;
        color: #67c23a;
      }
    }

    &.status-error {
      border-color: #fde2e2;
      background-color: #fef0f0;

      .result-header {
        background-color: #fde2e2;
        color: #f56c6c;
      }
    }

    .result-header {
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      font-weight: 600;

      .status-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .icon {
          display: flex;
          align-items: center;
        }
      }

      .execution-meta {
        font-size: 12px;
        opacity: 0.9;
      }
    }

    .result-body {
      padding: 16px;
    }

    .plugin-info-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #606266;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);

      .info-item {
        display: flex;
        gap: 6px;

        .label {
          color: #909399;
        }
        
        .value {
          font-weight: 500;
          color: #303133;
        }
      }

      .divider {
        color: #dcdfe6;
      }
    }

    .json-viewer-container {
      .viewer-label {
        font-size: 12px;
        color: #909399;
        margin-bottom: 8px;
      }

      .json-content {
        background-color: #ffffff;
        border-radius: 4px;
        border: 1px solid #dcdfe6;
        padding: 12px;
        
        pre {
          margin: 0;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 12px;
          color: #303133;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 300px;
          overflow-y: auto;

          &::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }

          &::-webkit-scrollbar-thumb {
            background: #c0c4cc;
            border-radius: 3px;
          }
        }
      }
    }

    .error-content {
      .error-message-box {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        color: #f56c6c;
        font-weight: 600;
        margin-bottom: 16px;
        font-size: 14px;
        
        .error-icon {
          margin-top: 2px;
        }
      }

      .error-stack {
        .stack-label {
          font-size: 12px;
          color: #909399;
          margin-bottom: 8px;
        }

        .stack-content {
          margin: 0;
          padding: 12px;
          background-color: #fff;
          border: 1px solid #fde2e2;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 11px;
          color: #f56c6c;
          overflow-x: auto;
          white-space: pre;
        }
      }
    }
  }

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
