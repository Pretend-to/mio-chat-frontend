<template>
  <div class="llm-adapters-view">
    <!-- 加载骨架屏 -->
    <div v-if="loading" class="loading-container">
      <div class="skeleton-header">
        <div class="skeleton-title"></div>
        <div class="skeleton-actions">
          <div class="skeleton-button" v-for="i in 3" :key="i"></div>
        </div>
      </div>
      <div class="skeleton-table">
        <div class="skeleton-row" v-for="i in 6" :key="i">
          <div class="skeleton-cell" v-for="j in 6" :key="j"></div>
        </div>
      </div>
    </div>

    <transition name="fade" mode="out-in">
      <div v-if="!loading" class="content-container">
        <!-- 页面头部 -->
        <div class="page-header" :class="{ 'mobile': isMobile }">
          <h1 v-if="!isMobile">LLM 适配器管理</h1>
          
          <!-- 桌面端操作按钮 -->
          <div v-if="!isMobile" class="header-actions">
            <el-button
              v-if="configStore.selectedAdapters && configStore.selectedAdapters.length > 0"
              type="success"
              :icon="Check"
              @click="handleBatchEnable"
            >
              批量启用 ({{ configStore.selectedAdapters.length }})
            </el-button>
            <el-button
              v-if="configStore.selectedAdapters && configStore.selectedAdapters.length > 0"
              type="warning"
              :icon="Close"
              @click="handleBatchDisable"
            >
              批量禁用
            </el-button>
            <el-button
              v-if="configStore.selectedAdapters && configStore.selectedAdapters.length > 0"
              type="danger"
              :icon="Delete"
              @click="handleBatchDelete"
            >
              批量删除
            </el-button>
            <el-button
              type="primary"
              :icon="Refresh"
              :loading="refreshing"
              @click="handleRefreshAll"
            >
              刷新全部模型
            </el-button>
            <el-dropdown @command="handleAddAdapter" trigger="click">
              <el-button type="primary" :icon="Plus">
                添加适配器 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="type in adapterTypes"
                    :key="type"
                    :command="type"
                  >
                    <el-icon><Connection /></el-icon>
                    {{ formatTypeLabel(type) }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <!-- 移动端操作按钮 -->
          <div v-if="isMobile" class="mobile-actions">
            <el-button
              type="primary"
              :icon="Refresh"
              :loading="refreshing"
              @click="handleRefreshAll"
              size="small"
            >
              刷新
            </el-button>
            <el-dropdown @command="handleAddAdapter" trigger="click">
              <el-button type="primary" :icon="Plus" size="small">
                添加
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="type in adapterTypes"
                    :key="type"
                    :command="type"
                  >
                    <el-icon><Connection /></el-icon>
                    {{ formatTypeLabel(type) }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- 移动端批量操作栏 -->
        <div v-if="isMobile && configStore.selectedAdapters && configStore.selectedAdapters.length > 0" class="mobile-batch-actions">
          <div class="batch-info">
            已选择 {{ configStore.selectedAdapters.length }} 项
          </div>
          <div class="batch-buttons">
            <el-button type="success" size="small" @click="handleBatchEnable">启用</el-button>
            <el-button type="warning" size="small" @click="handleBatchDisable">禁用</el-button>
            <el-button type="danger" size="small" @click="handleBatchDelete">删除</el-button>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">总计：</span>
            <span class="stat-value">{{ allAdapters.length }} 个实例</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">已启用：</span>
            <span class="stat-value">{{ enabledCount }} 个</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总模型数：</span>
            <span class="stat-value">{{ configStore.totalModelsCount }} 个</span>
          </div>
        </div>

        <!-- 适配器列表 -->
        <div class="adapters-list">
          <div v-if="allAdapters.length === 0" class="empty-state">
            <el-empty description="暂无适配器实例">
              <el-dropdown @command="handleAddAdapter" trigger="click">
                <el-button type="primary" :icon="Plus">
                  添加适配器
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="type in adapterTypes"
                      :key="type"
                      :command="type"
                    >
                      <el-icon><Connection /></el-icon>
                      {{ formatTypeLabel(type) }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-empty>
          </div>

          <el-table
            v-else
            :data="allAdapters"
            style="width: 100%"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="55" />
            
            <el-table-column label="类型" width="120">
              <template #default="{ row }">
                <el-tag :type="getTypeTagType(row.type)" effect="light">
                  {{ formatTypeLabel(row.type) }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="名称" min-width="150">
              <template #default="{ row }">
                <div class="adapter-name">
                  <span class="name">{{ row.adapter.name || `${row.type}-${row.index + 1}` }}</span>
                  <el-tag v-if="!row.adapter.enable" type="info" size="small" effect="plain">
                    已禁用
                  </el-tag>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="默认模型" min-width="200">
              <template #default="{ row }">
                <span class="model-name">{{ row.adapter.default_model || '-' }}</span>
              </template>
            </el-table-column>

            <el-table-column label="可用模型" width="120" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="getModelCountType(row.modelCount)" effect="plain" round>
                  {{ row.modelCount }} 个
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-switch
                  v-model="row.adapter.enable"
                  @change="handleToggle(row)"
                />
              </template>
            </el-table-column>

            <el-table-column label="操作" width="200" align="center">
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-button
                    size="small"
                    type="primary"
                    text
                    @click="handleEdit(row)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    size="small"
                    type="success"
                    text
                    @click="handleRefresh(row)"
                  >
                    刷新
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    text
                    @click="handleDelete(row)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </transition>

    <!-- 编辑器对话框 -->
    <adapter-editor
      :visible="editorVisible"
      :mode="editorMode"
      :type="editorType"
      :adapter="editorAdapter"
      :index="editorIndex"
      @close="handleEditorClose"
      @submit="handleEditorSubmit"
    />
  </div>
</template>

<script setup>
import AdapterEditor from '@/components/settings/AdapterEditor.vue';
import { useConfigStore } from '@/stores/configStore.js';
import {
  ArrowDown,
  Check,
  Close,
  Connection,
  Delete,
  Plus,
  Refresh
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const configStore = useConfigStore();

const loading = ref(true);
const refreshing = ref(false);
const editorVisible = ref(false);
const editorMode = ref('add');
const editorType = ref('openai');
const editorAdapter = ref(null);

// 移动端检测
const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};
const editorIndex = ref(-1);

// 获取所有适配器类型
const adapterTypes = computed(() => {
  return configStore?.adapterTypes?.types || [];
});

// 获取所有适配器实例的扁平化列表
const allAdapters = computed(() => {
  const adapters = [];
  Object.entries(configStore.adapters).forEach(([type, instances]) => {
    instances.forEach((adapter, index) => {
      const providerName = adapter.name || `${type}-${index + 1}`;
      const models = configStore.models[providerName] || [];
      const modelCount = models.reduce((count, group) => {
        return count + (group.models ? group.models.length : 0);
      }, 0);
      
      adapters.push({
        type,
        index,
        adapter,
        providerName,
        models,
        modelCount
      });
    });
  });
  return adapters;
});

// 获取已启用的适配器数量
const enabledCount = computed(() => {
  return allAdapters.value.filter(item => item.adapter.enable).length;
});

// 获取适配器的模型列表
const getAdapterModels = (adapter, type, index) => {
  const providerName = adapter.name || `${type}-${index + 1}`;
  return configStore.models[providerName] || [];
};

// 将适配器类型格式化为友好显示名
const formatTypeLabel = (type) => {
  // 确保 configStore 和 adapterTypes 都存在
  if (configStore?.adapterTypes?.adapters) {
    // 优先从适配器类型信息中获取显示名称
    const adapterInfo = configStore.adapterTypes.adapters.find(a => a.type === type);
    if (adapterInfo?.name) {
      return adapterInfo.name;
    }
  }
  
  // 后备方案：使用硬编码映射
  const map = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    vertex: 'Vertex AI',
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic'
  };
  if (map[type]) return map[type];
  return type.charAt(0).toUpperCase() + type.slice(1);
};

// 获取类型标签的颜色
const getTypeTagType = (type) => {
  const map = {
    openai: 'success',
    gemini: 'warning',
    vertex: 'info'
  };
  return map[type] || 'primary';
};

// 获取模型数量标签的颜色
const getModelCountType = (count) => {
  if (count === 0) return 'danger';
  if (count < 5) return 'warning';
  return 'success';
};

// 添加适配器
const handleAddAdapter = (type) => {
  editorMode.value = 'add';
  editorType.value = type;
  editorAdapter.value = null;
  editorIndex.value = -1;
  editorVisible.value = true;
};

// 编辑适配器
const handleEdit = (row) => {
  const { type, index, adapter } = row;
  editorMode.value = 'edit';
  editorType.value = type;
  editorAdapter.value = adapter;
  editorIndex.value = index;
  editorVisible.value = true;
};

// 删除适配器
const handleDelete = async (row) => {
  const { type, index, adapter } = row;
  const adapterName = adapter.name || `${type}-${index + 1}`;
  
  try {
    await ElMessageBox.confirm(
      `确定要删除适配器 "${adapterName}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    await configStore.deleteAdapter(type, index);
    ElMessage.success('删除成功');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败：' + error.message);
    }
  }
};

// 刷新单个适配器模型
const handleRefresh = async (row) => {
  const { type, index } = row;
  try {
    await configStore.refreshAdapterModels(type, index);
    ElMessage.success('模型列表刷新成功');
  } catch (error) {
    ElMessage.error('刷新失败：' + error.message);
  }
};

// 切换启用/禁用
const handleToggle = async (row) => {
  const { type, index, adapter } = row;
  const enable = adapter.enable;
  
  try {
    // 只更新 enable 字段
    const updatedData = { ...adapter, enable };
    await configStore.updateAdapter(type, index, updatedData);
    ElMessage.success(enable ? '已启用' : '已禁用');
  } catch (error) {
    // 如果失败，恢复原状态
    adapter.enable = !enable;
    ElMessage.error('操作失败：' + error.message);
  }
};

// 处理表格选择变化
const handleSelectionChange = (selection) => {
  // 清空当前选择
  configStore.clearAdapterSelection();
  
  // 添加新选择
  selection.forEach(item => {
    configStore.toggleAdapterSelection(item.type, item.index);
  });
};

// 刷新全部模型
const handleRefreshAll = async () => {
  refreshing.value = true;
  try {
    await configStore.refreshAllModels();
    ElMessage.success('所有模型列表刷新成功');
  } catch (error) {
    ElMessage.error('刷新失败：' + error.message);
  } finally {
    refreshing.value = false;
  }
};

// 批量启用
const handleBatchEnable = async () => {
  if (!configStore.selectedAdapters || configStore.selectedAdapters.length === 0) {
    ElMessage.warning('请先选择要操作的适配器');
    return;
  }
  
  try {
    const results = await configStore.batchToggleAdapters(
      configStore.selectedAdapters,
      true
    );
    
    const successCount = results.filter(r => r.success).length;
    ElMessage.success(`成功启用 ${successCount} 个适配器`);
    configStore.clearAdapterSelection();
  } catch (error) {
    ElMessage.error('批量启用失败：' + error.message);
  }
};

// 批量禁用
const handleBatchDisable = async () => {
  if (!configStore.selectedAdapters || configStore.selectedAdapters.length === 0) {
    ElMessage.warning('请先选择要操作的适配器');
    return;
  }
  
  try {
    const results = await configStore.batchToggleAdapters(
      configStore.selectedAdapters,
      false
    );
    
    const successCount = results.filter(r => r.success).length;
    ElMessage.success(`成功禁用 ${successCount} 个适配器`);
    configStore.clearAdapterSelection();
  } catch (error) {
    ElMessage.error('批量禁用失败：' + error.message);
  }
};

// 批量删除
const handleBatchDelete = async () => {
  if (!configStore.selectedAdapters || configStore.selectedAdapters.length === 0) {
    ElMessage.warning('请先选择要删除的适配器');
    return;
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${configStore.selectedAdapters.length} 个适配器吗？`,
      '批量删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const results = await configStore.batchDeleteAdapters(
      configStore.selectedAdapters
    );
    
    const successCount = results.filter(r => r.success).length;
    ElMessage.success(`成功删除 ${successCount} 个适配器`);
    configStore.clearAdapterSelection();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败：' + error.message);
    }
  }
};

// 编辑器关闭
const handleEditorClose = () => {
  editorVisible.value = false;
};

// 编辑器提交
const handleEditorSubmit = async ({ type, index, data, mode }) => {
  try {
    if (mode === 'add') {
      await configStore.addAdapter(type, data);
      ElMessage.success('添加成功');
    } else {
      await configStore.updateAdapter(type, index, data);
      ElMessage.success('更新成功');
    }
  } catch (error) {
    ElMessage.error(mode === 'add' ? '添加失败：' : '更新失败：' + error.message);
    throw error; // 重新抛出错误，让编辑器保持打开
  }
};

// 初始化
onMounted(async () => {
  // 检测移动端
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  loading.value = true;
  try {
    // 并行加载适配器类型信息和配置
    const promises = [];
    
    if (!configStore.adapterTypes.types.length) {
      promises.push(configStore.fetchAdapterTypes());
    }
    
    if (!configStore.config) {
      promises.push(configStore.fetchConfig());
    }
    
    await Promise.all(promises);
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (error) {
    ElMessage.error('加载配置失败：' + error.message);
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
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

.llm-adapters-view {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 16px;
    max-width: 100%;
  }
}

.loading-container {
  .skeleton-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    .skeleton-title {
      width: 200px;
      height: 32px;
      border-radius: 4px;
      background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s ease-in-out infinite;
    }

    .skeleton-actions {
      display: flex;
      gap: 12px;

      .skeleton-button {
        width: 120px;
        height: 32px;
        border-radius: 4px;
        background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s ease-in-out infinite;
      }
    }
  }

  .skeleton-table {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #ebeef5;

    .skeleton-row {
      display: flex;
      height: 60px;
      border-bottom: 1px solid #ebeef5;

      &:last-child {
        border-bottom: none;
      }

      .skeleton-cell {
        flex: 1;
        margin: 12px;
        border-radius: 4px;
        background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s ease-in-out infinite;

        &:first-child {
          flex: 0 0 60px;
        }

        &:nth-child(2) {
          flex: 0 0 100px;
        }

        &:nth-child(3) {
          flex: 2;
        }

        &:nth-child(4) {
          flex: 2;
        }

        &:nth-child(5) {
          flex: 0 0 100px;
        }

        &:last-child {
          flex: 0 0 180px;
        }
      }
    }
  }
}

@keyframes skeleton-loading {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.content-container {
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  &.mobile {
    margin-bottom: 16px;
    justify-content: flex-end;
  }

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

  .mobile-actions {
    display: flex;
    gap: 8px;
  }
}

// 移动端批量操作栏
.mobile-batch-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #ecf5ff;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid #b3d8ff;

  .batch-info {
    font-size: 14px;
    color: #409eff;
    font-weight: 500;
  }

  .batch-buttons {
    display: flex;
    gap: 8px;
  }
}

.stats-bar {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 4px;

    .stat-label {
      font-size: 14px;
      color: #606266;
    }

    .stat-value {
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }
  }
}

.adapters-list {
  background: white;
  border-radius: 8px;
  overflow: hidden;

  .empty-state {
    padding: 48px 0;
    background: #f9fafc;
  }

  .adapter-name {
    display: flex;
    align-items: center;
    gap: 8px;

    .name {
      font-weight: 500;
      color: #303133;
    }
  }

  .model-name {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
    color: #606266;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
}

// Element Plus 表格样式覆盖
:deep(.el-table) {
  .el-table__header {
    th {
      background-color: #fafafa;
      color: #606266;
      font-weight: 600;
    }
  }

  .el-table__row {
    &:hover {
      background-color: #f5f7fa;
    }
  }

  .el-table__cell {
    padding: 12px 0;
  }
}
// 移动端响应式样式
@media (max-width: 768px) {
  .page-header {
    .header-actions {
      display: none !important;
    }
  }

  .stats-bar {
    .stat-item {
      .stat-label {
        font-size: 13px;
      }
      .stat-value {
        font-size: 14px;
      }
    }
  }

  .adapters-list {
    .adapter-card {
      margin-bottom: 12px;
      
      .card-header {
        padding: 12px 16px;
        
        .adapter-title {
          font-size: 16px;
        }
        
        .adapter-actions {
          gap: 8px;
          
          .el-button {
            padding: 6px 12px;
            font-size: 13px;
          }
        }
      }
      
      .card-content {
        padding: 12px 16px;
        
        .adapter-info {
          .info-item {
            margin-bottom: 8px;
            
            .info-label {
              font-size: 13px;
            }
            
            .info-value {
              font-size: 14px;
            }
          }
        }
      }
    }
  }

  .empty-state {
    padding: 40px 20px;
    
    .el-empty {
      :deep(.el-empty__description) {
        font-size: 14px;
      }
    }
  }
}

// 平板适配
@media (min-width: 769px) and (max-width: 1024px) {
  .llm-adapters-view {
    padding: 20px;
  }
  
  .page-header {
    .header-actions {
      gap: 8px;
      
      .el-button {
        padding: 8px 12px;
        font-size: 13px;
      }
    }
  }
}
</style>