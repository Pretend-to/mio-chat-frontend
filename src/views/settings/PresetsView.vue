<template>
  <div class="presets-view">
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
          <div class="skeleton-cell" v-for="j in 5" :key="j"></div>
        </div>
      </div>
    </div>

    <transition name="fade" mode="out-in">
      <div v-if="!loading" class="content-container">
        <!-- 页面头部 -->
        <div class="page-header">
          <h1>预设管理</h1>
          <div class="header-actions">
            <el-button
              v-if="selectedPresets && selectedPresets.length > 0"
              type="danger"
              :icon="Delete"
              @click="handleBatchDelete"
            >
              批量删除 ({{ selectedPresets?.length || 0 }})
            </el-button>
            <el-button
              type="primary"
              :icon="Refresh"
              :loading="refreshing"
              @click="handleRefresh"
            >
              刷新
            </el-button>
            <el-button
              type="primary"
              :icon="Plus"
              @click="handleCreate"
            >
              创建预设
            </el-button>
            <el-button
              type="success"
              :icon="Upload"
              @click="handleImport"
            >
              导入预设
            </el-button>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">总计：</span>
            <span class="stat-value">{{ totalCount }} 个预设</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">常用：</span>
            <span class="stat-value">{{ presetsStore.countByCategory.common }} 个</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">推荐：</span>
            <span class="stat-value">{{ presetsStore.countByCategory.recommended }} 个</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">隐藏：</span>
            <span class="stat-value">{{ presetsStore.countByCategory.hidden }} 个</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">内置：</span>
            <span class="stat-value">{{ presetsStore.countBySource['built-in'] }} 个</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">自定义：</span>
            <span class="stat-value">{{ presetsStore.countBySource.custom }} 个</span>
          </div>
        </div>

        <!-- 搜索和筛选栏 -->
        <div class="search-filter-bar">
          <div class="search-section">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索预设名称、开场白或内容..."
              :prefix-icon="Search"
              clearable
              @input="handleSearch"
              style="width: 300px"
            />
          </div>
          <div class="filter-section">
            <el-select
              v-model="categoryFilter"
              placeholder="分类筛选"
              clearable
              style="width: 120px"
              @change="handleFilterChange"
            >
              <el-option label="常用" value="common" />
              <el-option label="推荐" value="recommended" />
              <el-option label="隐藏" value="hidden" />
            </el-select>
            <el-select
              v-model="sourceFilter"
              placeholder="来源筛选"
              clearable
              style="width: 120px"
              @change="handleFilterChange"
            >
              <el-option label="内置" value="built-in" />
              <el-option label="自定义" value="custom" />
            </el-select>
          </div>
        </div>

        <!-- 预设列表 -->
        <div class="presets-list">
          <div v-if="(!displayedPresets || displayedPresets.length === 0) && !loading" class="empty-state">
            <el-empty description="暂无预设">
              <el-button type="primary" :icon="Plus" @click="handleCreate">
                创建预设
              </el-button>
            </el-empty>
          </div>

          <!-- 瀑布流卡片 -->
          <div v-else class="presets-waterfall" ref="waterfallRef">
            <preset-card
              v-for="preset in displayedPresets"
              :key="getPresetId(preset)"
              :preset="preset"
              :selected="isPresetSelected(preset)"
              @select="(selected) => handlePresetSelect(getPresetId(preset), selected)"
              @edit="handleEdit"
              @delete="handleDelete"
              @export="handleExport"
            />
          </div>

          <!-- 无限滚动触发器 -->
          <div v-if="shouldShowTrigger" ref="loadTrigger" class="load-trigger">
            <div v-if="loadingMore" class="loading-more">
              <el-skeleton :rows="2" animated />
            </div>
            <div v-else-if="loadError" class="load-error">
              <el-result icon="warning" title="加载失败" sub-title="网络错误，请重试">
                <template #extra>
                  <el-button type="primary" @click="retryLoad">重试</el-button>
                </template>
              </el-result>
            </div>
            <div v-else class="load-placeholder">
              <!-- 占位元素，用于触发 Intersection Observer -->
            </div>
          </div>

          <!-- 没有更多数据时的提示 -->
          <div v-if="!hasMore && displayedPresets.length > 0" class="no-more">
            <el-divider>
              <span class="no-more-text">已加载全部预设</span>
            </el-divider>
          </div>

          <!-- 初始加载中 -->
          <div v-if="loading" class="loading-more">
            <el-skeleton :rows="3" animated />
          </div>
        </div>
      </div>
    </transition>

    <!-- 编辑器对话框 -->
    <preset-editor
      :visible="editorVisible"
      :mode="editorMode"
      :preset="editorPreset"
      @close="handleEditorClose"
      @submit="handleEditorSubmit"
    />

    <!-- 导入文件选择 -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup>
import PresetCard from '@/components/settings/PresetCard.vue';
import PresetEditor from '@/components/settings/PresetEditor.vue';
import { usePresetsStore } from '@/stores/presetsStore.js';
import {
  Delete,
  Plus,
  Refresh,
  Search,
  Upload
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const presetsStore = usePresetsStore();

const loading = ref(true);
const refreshing = ref(false);
const searchKeyword = ref('');
const categoryFilter = ref('');
const sourceFilter = ref('');
const selectedPresets = ref([]);
const editorVisible = ref(false);
const editorMode = ref('create');
const editorPreset = ref(null);
const fileInput = ref(null);
const waterfallRef = ref(null);
const loadTrigger = ref(null);

// 分页相关
const currentPage = ref(1);
const pageSize = ref(50); // 与后端默认值保持一致
const hasMore = computed(() => presetsStore.pagination?.hasMore || false);

// 是否应该显示触发器（包括加载中状态）
const shouldShowTrigger = computed(() => {
  return hasMore.value || loadingMore.value;
});
const loadingMore = ref(false);
const loadError = ref(false);

// 获取预设数据
const allPresets = computed(() => presetsStore.allPresets || []);
const totalCount = computed(() => presetsStore.totalCount || 0);

// 当前显示的预设（直接使用 store 中的数据，已经过服务端筛选和分页）
const displayedPresets = computed(() => {
  return allPresets.value || [];
});

// 获取预设ID的辅助函数
const getPresetId = (preset) => {
  return preset.name; // 根据文档，预设的唯一标识符就是 name 字段
};

// 检查预设是否被选中
const isPresetSelected = (preset) => {
  const presetId = getPresetId(preset);
  return presetId && selectedPresets.value.includes(presetId);
};

// 搜索防抖
let searchTimeout = null;

// 监听筛选条件变化，重新获取数据
watch([searchKeyword], () => {
  // 搜索关键词变化时使用防抖
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    handleFilterChange();
  }, 500); // 500ms 防抖
});

// 监听其他筛选条件变化，立即获取数据
watch([categoryFilter, sourceFilter], () => {
  handleFilterChange();
});

// 监听 hasMore 变化，当没有更多数据时清理观察器
watch(hasMore, (newHasMore, oldHasMore) => {
  console.log('hasMore changed:', { newHasMore, oldHasMore });
  if (!newHasMore) {
    cleanupObserver();
  } else if (newHasMore && !oldHasMore) {
    // 如果从没有更多数据变为有更多数据，重新设置观察器
    nextTick(() => {
      setupInfiniteScroll();
    });
  }
});

// 处理筛选变化
const handleFilterChange = async () => {
  currentPage.value = 1;
  cleanupObserver(); // 清理旧的观察器
  await fetchPresetsWithFilters();
  // 等待 DOM 更新后，如果有更多数据就设置观察器
  await nextTick();
  if (hasMore.value) {
    setupInfiniteScroll();
  }
};

// 获取带筛选条件的预设
const fetchPresetsWithFilters = async () => {
  const params = {
    start: 0,
    nums: pageSize.value
  };
  
  if (searchKeyword.value) {
    params.keyword = searchKeyword.value;
  }
  
  if (categoryFilter.value) {
    params.category = categoryFilter.value;
  }
  
  if (sourceFilter.value) {
    params.source = sourceFilter.value;
  }
  
  try {
    await presetsStore.fetchPresets(params);
  } catch (error) {
    ElMessage.error('获取预设失败：' + error.message);
  }
};

// 加载更多
const loadMore = async () => {
  console.log('loadMore called', {
    hasMore: hasMore.value,
    loadingMore: loadingMore.value,
    pagination: presetsStore.pagination
  });
  
  if (hasMore.value && !loadingMore.value) {
    loadingMore.value = true;
    loadError.value = false;
    
    const params = {
      start: presetsStore.pagination.start + presetsStore.pagination.nums,
      nums: pageSize.value
    };
    
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value;
    }
    
    if (categoryFilter.value) {
      params.category = categoryFilter.value;
    }
    
    if (sourceFilter.value) {
      params.source = sourceFilter.value;
    }
    
    console.log('Loading more with params:', params);
    
    try {
      await presetsStore.fetchPresets(params, true); // 使用 append 模式
      console.log('Load more successful');
    } catch (error) {
      console.error('Load more failed:', error);
      loadError.value = true;
      ElMessage.error('加载更多失败：' + error.message);
    } finally {
      loadingMore.value = false;
    }
  } else {
    console.log('loadMore conditions not met', {
      hasMore: hasMore.value,
      loadingMore: loadingMore.value
    });
  }
};

// 重试加载
const retryLoad = () => {
  loadError.value = false;
  loadMore();
};

// 处理预设选择
const handlePresetSelect = (presetId, selected) => {
  if (selected) {
    if (!selectedPresets.value.includes(presetId)) {
      selectedPresets.value.push(presetId);
    }
  } else {
    const index = selectedPresets.value.indexOf(presetId);
    if (index > -1) {
      selectedPresets.value.splice(index, 1);
    }
  }
};

// 搜索处理
const handleSearch = () => {
  // 搜索变化会被 watch 监听到，自动调用 handleFilterChange
};

// 刷新预设
const handleRefresh = async () => {
  refreshing.value = true;
  try {
    await presetsStore.fetchPresets();
    ElMessage.success('预设列表刷新成功');
  } catch (error) {
    ElMessage.error('刷新失败：' + error.message);
  } finally {
    refreshing.value = false;
  }
};

// 创建预设
const handleCreate = () => {
  editorMode.value = 'create';
  editorPreset.value = null;
  editorVisible.value = true;
};

// 编辑预设
const handleEdit = (preset) => {
  editorMode.value = 'edit';
  editorPreset.value = preset;
  editorVisible.value = true;
};

// 删除预设
const handleDelete = async (preset) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除预设 "${preset.name}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const presetId = preset.name;
    if (!presetId) {
      throw new Error('预设名称不能为空');
    }
    await presetsStore.deletePreset(presetId);
    ElMessage.success('删除成功');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败：' + error.message);
    }
  }
};

// 批量删除
const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedPresets.value.length} 个预设吗？`,
      '批量删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const results = await presetsStore.batchDeletePresets(selectedPresets.value);
    const successCount = results.filter(r => r.success).length;
    ElMessage.success(`成功删除 ${successCount} 个预设`);
    selectedPresets.value = [];
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败：' + error.message);
    }
  }
};

// 导出预设
const handleExport = async (preset) => {
  try {
    const presetId = preset.name;
    if (!presetId) {
      throw new Error('预设名称不能为空');
    }
    await presetsStore.exportPreset(presetId);
    ElMessage.success('导出成功');
  } catch (error) {
    ElMessage.error('导出失败：' + error.message);
  }
};

// 导入预设
const handleImport = () => {
  fileInput.value?.click();
};

// 处理文件选择
const handleFileSelect = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    await presetsStore.importPreset(file);
    ElMessage.success('导入成功');
    // 清空文件选择
    event.target.value = '';
  } catch (error) {
    ElMessage.error('导入失败：' + error.message);
  }
};

// 编辑器关闭
const handleEditorClose = () => {
  editorVisible.value = false;
};

// 编辑器提交
const handleEditorSubmit = async ({ data, mode }) => {
  try {
    if (mode === 'create') {
      await presetsStore.createPreset(data);
      ElMessage.success('创建成功');
      // 创建成功后关闭编辑器
      editorVisible.value = false;
    } else {
      // 使用预设的名称作为标识符
      const presetId = editorPreset.value.name;
      if (!presetId) {
        ElMessage.error('预设名称不能为空');
        return; // 不关闭编辑器
      }
      await presetsStore.updatePreset(presetId, data);
      ElMessage.success('更新成功');
      // 更新成功后关闭编辑器
      editorVisible.value = false;
    }
  } catch (error) {
    ElMessage.error(mode === 'create' ? '创建失败：' : '更新失败：' + error.message);
    // 不重新抛出错误，只显示toast，编辑器保持打开
  }
};

// Intersection Observer 实例
let observer = null;

// 设置无限滚动观察器
const setupInfiniteScroll = () => {
  console.log('setupInfiniteScroll called', {
    loadTrigger: loadTrigger.value,
    hasMore: hasMore.value,
    loadingMore: loadingMore.value
  });
  
  if (!loadTrigger.value) {
    console.log('loadTrigger element not found');
    return;
  }

  // 创建 Intersection Observer
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      console.log('Observer triggered', {
        isIntersecting: entry.isIntersecting,
        hasMore: hasMore.value,
        loadingMore: loadingMore.value
      });
      
      // 当触发器元素进入视口时，加载更多数据
      if (entry.isIntersecting && hasMore.value && !loadingMore.value) {
        console.log('Loading more data...');
        loadMore();
      }
    },
    {
      // 提前 100px 触发加载
      rootMargin: '100px',
      threshold: 0.1
    }
  );

  observer.observe(loadTrigger.value);
  console.log('Observer set up successfully');
};

// 清理观察器
const cleanupObserver = () => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
};

// 初始化
onMounted(async () => {
  loading.value = true;
  try {
    // 初始加载
    await fetchPresetsWithFilters();
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (error) {
    ElMessage.error('加载预设失败：' + error.message);
  } finally {
    loading.value = false;
    // 在加载完成后设置无限滚动观察器
    await nextTick(); // 确保 DOM 已更新
    setupInfiniteScroll();
  }
});

// 清理
onUnmounted(() => {
  cleanupObserver();
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



.presets-view {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
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
      height: 120px;
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

.stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  margin-bottom: 24px;
  border: 1px solid #e9ecef;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.7);
    transition: all 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.9);
      transform: translateY(-1px);
    }

    .stat-label {
      font-size: 13px;
      color: #606266;
      font-weight: 500;
    }

    .stat-value {
      font-size: 13px;
      font-weight: 700;
      color: #303133;
    }
  }

  @media (max-width: 768px) {
    gap: 12px;
    
    .stat-item {
      flex: 1;
      min-width: calc(50% - 6px);
      justify-content: center;
    }
  }
}

.search-filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 16px;

  .search-section {
    flex: 1;
  }

  .filter-section {
    display: flex;
    gap: 12px;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;

    .filter-section {
      justify-content: flex-start;
    }
  }
}

.presets-list {
  .empty-state {
    padding: 48px 0;
    background: #f9fafc;
    border-radius: 8px;
  }
}

.presets-waterfall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }

  @media (min-width: 1200px) {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
}

.load-trigger {
  margin: 24px 0;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;

  .load-placeholder {
    width: 100%;
    height: 20px;
    background: rgba(64, 158, 255, 0.1); // 临时显示，用于调试
    border: 1px dashed #409eff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #409eff;
    
    &::after {
      content: '滚动触发器';
    }
  }
}

.loading-more {
  margin: 24px 0;
  
  :deep(.el-skeleton) {
    .el-skeleton__item {
      background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s ease-in-out infinite;
    }
  }
}

.load-error {
  margin: 24px 0;
  
  :deep(.el-result) {
    padding: 20px;
    
    .el-result__icon {
      margin-bottom: 12px;
    }
    
    .el-result__title {
      margin-bottom: 8px;
      font-size: 16px;
    }
    
    .el-result__subtitle {
      margin-bottom: 16px;
      font-size: 14px;
    }
  }
}

.no-more {
  margin: 32px 0;
  
  .no-more-text {
    color: #909399;
    font-size: 14px;
    padding: 0 16px;
    background: #f5f7fa;
  }
  
  :deep(.el-divider__text) {
    background: #f5f7fa;
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
</style>