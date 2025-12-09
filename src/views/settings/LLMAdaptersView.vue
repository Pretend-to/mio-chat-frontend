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
      <div class="adapters-grid">
        <LoadingSkeleton v-for="i in 6" :key="i" type="adapter-card" is-card />
      </div>
    </div>

    <transition name="fade" mode="out-in">
      <div v-if="!loading" class="content-container">
        <!-- 页面头部 -->
        <div class="page-header">
      <h1>LLM 适配器管理</h1>
      <div class="header-actions">
        <el-button
          v-if="configStore.selectedAdapters.length > 0"
          type="success"
          :icon="Check"
          @click="handleBatchEnable"
        >
          批量启用 ({{ configStore.selectedAdapters.length }})
        </el-button>
        <el-button
          v-if="configStore.selectedAdapters.length > 0"
          type="warning"
          :icon="Close"
          @click="handleBatchDisable"
        >
          批量禁用
        </el-button>
        <el-button
          v-if="configStore.selectedAdapters.length > 0"
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
            添加适配器 <el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="openai">
                <el-icon><Connection /></el-icon>
                OpenAI
              </el-dropdown-item>
              <el-dropdown-item command="gemini">
                <el-icon><Connection /></el-icon>
                Gemini
              </el-dropdown-item>
              <el-dropdown-item command="vertex">
                <el-icon><Connection /></el-icon>
                Vertex AI
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 适配器列表 -->
    <div class="adapters-container">
      <!-- OpenAI -->
      <div class="adapter-section">
        <div class="section-header">
          <div class="section-title">
            <h2>OpenAI</h2>
            <el-tag>{{ configStore.adapters.openai.length }} 个实例</el-tag>
          </div>
          <el-button
            text
            type="primary"
            :icon="Plus"
            @click="handleAddAdapter('openai')"
          >
            添加实例
          </el-button>
        </div>
        
        <div v-if="configStore.adapters.openai.length === 0" class="empty-state">
          <el-empty description="暂无 OpenAI 实例">
            <el-button type="primary" @click="handleAddAdapter('openai')">
              添加 OpenAI 实例
            </el-button>
          </el-empty>
        </div>
        
        <div v-else class="adapters-grid">
          <adapter-card
            v-for="(adapter, index) in configStore.adapters.openai"
            :key="`openai-${index}`"
            :adapter="adapter"
            type="openai"
            :index="index"
            :models="getAdapterModels(adapter, 'openai', index)"
            :selectable="true"
            :is-selected="configStore.isAdapterSelected('openai', index)"
            @edit="handleEdit"
            @delete="handleDelete"
            @refresh="handleRefresh"
            @toggle="handleToggle"
            @select="handleSelect"
          />
        </div>
      </div>

      <!-- Gemini -->
      <div class="adapter-section">
        <div class="section-header">
          <div class="section-title">
            <h2>Gemini</h2>
            <el-tag>{{ configStore.adapters.gemini.length }} 个实例</el-tag>
          </div>
          <el-button
            text
            type="primary"
            :icon="Plus"
            @click="handleAddAdapter('gemini')"
          >
            添加实例
          </el-button>
        </div>
        
        <div v-if="configStore.adapters.gemini.length === 0" class="empty-state">
          <el-empty description="暂无 Gemini 实例">
            <el-button type="primary" @click="handleAddAdapter('gemini')">
              添加 Gemini 实例
            </el-button>
          </el-empty>
        </div>
        
        <div v-else class="adapters-grid">
          <adapter-card
            v-for="(adapter, index) in configStore.adapters.gemini"
            :key="`gemini-${index}`"
            :adapter="adapter"
            type="gemini"
            :index="index"
            :models="getAdapterModels(adapter, 'gemini', index)"
            :selectable="true"
            :is-selected="configStore.isAdapterSelected('gemini', index)"
            @edit="handleEdit"
            @delete="handleDelete"
            @refresh="handleRefresh"
            @toggle="handleToggle"
            @select="handleSelect"
          />
        </div>
      </div>

      <!-- Vertex AI -->
      <div class="adapter-section">
        <div class="section-header">
          <div class="section-title">
            <h2>Vertex AI</h2>
            <el-tag>{{ configStore.adapters.vertex.length }} 个实例</el-tag>
          </div>
          <el-button
            text
            type="primary"
            :icon="Plus"
            @click="handleAddAdapter('vertex')"
          >
            添加实例
          </el-button>
        </div>
        
        <div v-if="configStore.adapters.vertex.length === 0" class="empty-state">
          <el-empty description="暂无 Vertex AI 实例">
            <el-button type="primary" @click="handleAddAdapter('vertex')">
              添加 Vertex AI 实例
            </el-button>
          </el-empty>
        </div>
        
        <div v-else class="adapters-grid">
          <adapter-card
            v-for="(adapter, index) in configStore.adapters.vertex"
            :key="`vertex-${index}`"
            :adapter="adapter"
            type="vertex"
            :index="index"
            :models="getAdapterModels(adapter, 'vertex', index)"
            :selectable="true"
            :is-selected="configStore.isAdapterSelected('vertex', index)"
            @edit="handleEdit"
            @delete="handleDelete"
            @refresh="handleRefresh"
            @toggle="handleToggle"
            @select="handleSelect"
          />
        </div>
      </div>
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
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  Refresh,
  Delete,
  Check,
  Close,
  Connection,
  ArrowDown
} from '@element-plus/icons-vue';
import { useConfigStore } from '@/stores/configStore.js';
import AdapterCard from '@/components/settings/AdapterCard.vue';
import AdapterEditor from '@/components/settings/AdapterEditor.vue';
import LoadingSkeleton from '@/components/settings/LoadingSkeleton.vue';

const configStore = useConfigStore();

const loading = ref(true);
const refreshing = ref(false);
const editorVisible = ref(false);
const editorMode = ref('add');
const editorType = ref('openai');
const editorAdapter = ref(null);
const editorIndex = ref(-1);

// 获取适配器的模型列表
const getAdapterModels = (adapter, type, index) => {
  const providerName = adapter.name || `${type}-${index + 1}`;
  return configStore.models[providerName] || [];
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
const handleEdit = ({ type, index, adapter }) => {
  editorMode.value = 'edit';
  editorType.value = type;
  editorAdapter.value = adapter;
  editorIndex.value = index;
  editorVisible.value = true;
};

// 删除适配器
const handleDelete = async ({ type, index }) => {
  try {
    await configStore.deleteAdapter(type, index);
    ElMessage.success('删除成功');
  } catch (error) {
    ElMessage.error('删除失败：' + error.message);
  }
};

// 刷新单个适配器模型
const handleRefresh = async ({ type, index }) => {
  try {
    await configStore.refreshAdapterModels(type, index);
    ElMessage.success('模型列表刷新成功');
  } catch (error) {
    ElMessage.error('刷新失败：' + error.message);
  }
};

// 切换启用/禁用
const handleToggle = async ({ type, index, enable }) => {
  try {
    // 只更新 enable 字段
    const updatedData = { enable };
    await configStore.updateAdapter(type, index, updatedData);
    ElMessage.success(enable ? '已启用' : '已禁用');
  } catch (error) {
    ElMessage.error('操作失败：' + error.message);
  }
};

// 选择适配器
const handleSelect = ({ type, index, selected }) => {
  configStore.toggleAdapterSelection(type, index);
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
  loading.value = true;
  try {
    if (!configStore.config) {
      await configStore.fetchConfig();
    }
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

.llm-adapters-view {
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

  .adapters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 16px;
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

.adapters-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.adapter-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 0;
    border-bottom: none;

    .section-title {
      display: flex;
      align-items: center;
      gap: 12px;

      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #303133;
      }
    }
  }

  .empty-state {
    padding: 48px 0;
    background: #f9fafc;
    border-radius: 16px;
  }

  .adapters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 24px;
  }
}
</style>
