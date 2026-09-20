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
        <div class="page-header" :class="{ mobile: isMobile }">
          <h1 v-if="!isMobile">LLM 适配器管理</h1>

          <!-- 桌面端操作按钮 -->
          <div v-if="!isMobile" class="header-actions">
            <el-button
              v-if="
                configStore.selectedAdapters &&
                configStore.selectedAdapters.length > 0
              "
              type="success"
              :icon="Check"
              @click="handleBatchEnable"
            >
              批量启用 ({{ configStore.selectedAdapters.length }})
            </el-button>
            <el-button
              v-if="
                configStore.selectedAdapters &&
                configStore.selectedAdapters.length > 0
              "
              type="warning"
              :icon="Close"
              @click="handleBatchDisable"
            >
              批量禁用
            </el-button>
            <el-button
              v-if="
                configStore.selectedAdapters &&
                configStore.selectedAdapters.length > 0
              "
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
            <el-button
              type="primary"
              :icon="Plus"
              @click="handleAdd"
            >
              添加服务商
            </el-button>
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
            <el-button
              type="primary"
              :icon="Plus"
              size="small"
              @click="handleAdd"
            >
              添加
            </el-button>
          </div>
        </div>

        <!-- 移动端批量操作栏 -->
        <div
          v-if="
            isMobile &&
            configStore.selectedAdapters &&
            configStore.selectedAdapters.length > 0
          "
          class="mobile-batch-actions"
        >
          <div class="batch-info">
            已选择 {{ configStore.selectedAdapters.length }} 项
          </div>
          <div class="batch-buttons">
            <el-button type="success" size="small" @click="handleBatchEnable"
              >启用</el-button
            >
            <el-button type="warning" size="small" @click="handleBatchDisable"
              >禁用</el-button
            >
            <el-button type="danger" size="small" @click="handleBatchDelete"
              >删除</el-button
            >
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
            <span class="stat-value"
              >{{ configStore.totalModelsCount }} 个</span
            >
          </div>
        </div>

        <!-- 适配器卡片网格列表 -->
        <div class="adapters-list">
          <div v-if="allAdapters.length === 0" class="empty-state">
            <el-empty description="暂无服务商实例">
              <el-button
                type="primary"
                :icon="Plus"
                @click="handleAdd"
              >
                添加服务商
              </el-button>
            </el-empty>
          </div>

          <div v-else class="adapter-cards-grid">
            <adapter-card
              v-for="item in allAdapters"
              :key="item.instanceId"
              :adapter="item.adapter"
              :type="item.type"
              :instance-id="item.instanceId"
              :models="item.models"
              :models-meta="configStore.modelsMeta"
              :provider-name="item.providerName"
              selectable
              :is-selected="
                configStore.isAdapterSelected(item.type, item.instanceId)
              "
              @edit="handleCardEdit"
              @delete="handleCardDelete"
              @refresh="handleCardRefresh"
              @toggle="handleCardToggle"
              @select="handleCardSelect"
            />
          </div>
        </div>
      </div>
    </transition>

    <!-- 统一服务商编辑器对话框 (添加与编辑完全复用) -->
    <adapter-editor
      :visible="editorVisible"
      :mode="editorMode"
      :type="editorType"
      :adapter="editorAdapter"
      :instance-id="editorInstanceId"
      @close="handleEditorClose"
      @submit="handleEditorSubmit"
    />
  </div>
</template>

<script setup>
import AdapterCard from "@/components/settings/AdapterCard.vue";
import AdapterEditor from "@/components/settings/AdapterEditor.vue";
import { useConfigStore } from "@/stores/configStore.js";
import {
  Check,
  Close,
  Delete,
  Plus,
  Refresh,
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, onUnmounted, ref } from "vue";

const configStore = useConfigStore();

const loading = ref(true);
const refreshing = ref(false);
const editorVisible = ref(false);
const editorMode = ref("add");
const editorType = ref("openai");
const editorAdapter = ref(null);

// 移动端检测
const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};
const editorInstanceId = ref("");

function getAdapterProviderName(adapter, instances, index, type) {
  if (adapter.name) return adapter.name;
  const enabledCount = instances
    .slice(0, index + 1)
    .filter((instance) => instance?.enable).length;
  return `${type}-${enabledCount}`;
}

// 获取所有适配器类型
const adapterTypes = computed(() => {
  return configStore?.adapterTypes?.types || [];
});

// 获取所有适配器实例的扁平化列表
const allAdapters = computed(() => {
  const adapters = [];
  Object.entries(configStore.adapters).forEach(([type, instances]) => {
    instances.forEach((adapter, index) => {
      const providerName = getAdapterProviderName(adapter, instances, index, type);
      const models = configStore.models[providerName] || [];
      const modelCount = models.reduce((count, group) => {
        return count + (group.models ? group.models.length : 0);
      }, 0);

      adapters.push({
        type,
        index,
        instanceId: adapter.id || "",
        adapter,
        providerName,
        models,
        modelCount,
        registrySummary: computeRegistrySummary(providerName),
      });
    });
  });
  return adapters;
});

// 基于 Registry 元数据计算适配器模型规格摘要（前端零硬编码）
function computeRegistrySummary(providerName) {
  const meta = configStore.modelsMeta[providerName];
  if (!meta) return null;

  const entries = Object.values(meta);
  if (!entries.length) return null;

  const ctxs = entries
    .map((m) => m.maxInput)
    .filter((v) => typeof v === "number" && v > 0);
  const visionCount = entries.filter((m) => m.vision).length;

  const sourceCount = {};
  entries.forEach((m) => {
    sourceCount[m.matchSource] = (sourceCount[m.matchSource] || 0) + 1;
  });

  const sourceLabel = {
    "litellm-exact": "LiteLLM 精确",
    "litellm-prefix": "LiteLLM 前缀",
    "builtin-rule": "内置规则",
    fallback: "兜底",
  };
  const sourceText = Object.entries(sourceCount)
    .map(([key, count]) => `${sourceLabel[key] || key} ${count}`)
    .join("，");

  return {
    visionCount,
    ctxRange: ctxs.length
      ? `${formatCtx(Math.min(...ctxs))} ~ ${formatCtx(Math.max(...ctxs))}`
      : "-",
    sourceText,
  };
}

function formatCtx(n) {
  if (!n) return "-";
  return n >= 1000000
    ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}K`
      : `${n}`;
}

// 编辑器需要的是实例配置里的平铺模型名；旧配置可能没有 models 字段，
// 此时从当前运行时模型列表（按 providerName 分组）回填。
function flattenModelGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups
    .flatMap((group) => (Array.isArray(group?.models) ? group.models : []))
    .map((model) => (typeof model === "string" ? model : model?.id || model?.name))
    .filter(Boolean);
}

// 获取已启用的适配器数量
const enabledCount = computed(() => {
  return allAdapters.value.filter((item) => item.adapter.enable).length;
});

// 获取适配器的模型列表
const getAdapterModels = (adapter, type, index) => {
  const instances = configStore.adapters[type] || [];
  const providerName = getAdapterProviderName(adapter, instances, index, type);
  return configStore.models[providerName] || [];
};

// 将适配器类型格式化为友好显示名
const formatTypeLabel = (type) => {
  // 确保 configStore 和 adapterTypes 都存在
  if (configStore?.adapterTypes?.adapters) {
    // 优先从适配器类型信息中获取显示名称
    const adapterInfo = configStore.adapterTypes.adapters.find(
      (a) => a.type === type,
    );
    if (adapterInfo?.name) {
      return adapterInfo.name;
    }
  }

  // 动态后备方案：自动将首字母大写，且把短横线/下划线转换为空格
  return type
    ? type.charAt(0).toUpperCase() + type.slice(1).replace(/[-_]/g, " ")
    : "适配器";
};

// 获取模型数量标签的颜色
const getModelCountType = (count) => {
  if (count === 0) return "danger";
  if (count < 5) return "warning";
  return "success";
};

// 添加服务商（一跳直接打开统一编辑器）
const handleAdd = () => {
  editorMode.value = "add";
  editorType.value = "openai";
  editorAdapter.value = null;
  editorInstanceId.value = "";
  editorVisible.value = true;
};

// 添加适配器 (指定类型)
const handleAddAdapter = (type = "openai") => {
  editorMode.value = "add";
  editorType.value = type;
  editorAdapter.value = null;
  editorInstanceId.value = "";
  editorVisible.value = true;
};

// 编辑适配器
const handleEdit = (row) => {
  const { type, index, adapter } = row;
  editorMode.value = "edit";
  editorType.value = type;
  const storedModels = Array.isArray(adapter.models) ? adapter.models : [];
  const runtimeModels = flattenModelGroups(row.models);
  editorAdapter.value = {
    ...adapter,
    models: storedModels.length > 0 ? storedModels : runtimeModels,
  };
  editorInstanceId.value = requireInstanceId(row);
  editorVisible.value = true;
};

// 删除适配器
const handleDelete = async (row) => {
  const { type, index, adapter } = row;
  const adapterName = adapter.name || `${type}-${index + 1}`;

  try {
    await ElMessageBox.confirm(
      `确定要删除适配器 "${adapterName}" 吗？`,
      "删除确认",
      {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    await configStore.deleteAdapter(type, requireInstanceId(row));
    ElMessage.success("删除成功");
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("删除失败：" + error.message);
    }
  }
};

// 刷新单个适配器模型
const handleRefresh = async (row) => {
  const { type, index, instanceId } = row;
  try {
    await configStore.refreshAdapterModels(type, requireInstanceId({ instanceId }));
    ElMessage.success("模型列表刷新成功");
  } catch (error) {
    ElMessage.error("刷新失败：" + error.message);
  }
};

// 切换启用/禁用
const handleToggle = async (row) => {
  const { type, index, adapter } = row;
  const enable = adapter.enable;

  try {
    // 只更新 enable 字段
    const updatedData = { ...adapter, enable };
    await configStore.updateAdapter(type, requireInstanceId(row), updatedData);
    ElMessage.success(enable ? "已启用" : "已禁用");
  } catch (error) {
    // 如果失败，恢复原状态
    adapter.enable = !enable;
    ElMessage.error("操作失败：" + error.message);
  }
};

// ===== 移动端卡片事件适配 =====
// 根据 type/index 找到适配器行数据
const findAdapterRow = (type, instanceId) => {
  return allAdapters.value.find(
    (item) => item.type === type && item.instanceId === instanceId,
  );
};

const requireInstanceId = (row) => {
  const instanceId = row?.instanceId || row?.adapter?.id;
  if (!instanceId) {
    throw new Error("适配器数据缺少稳定实例 ID，请刷新页面后重试");
  }
  return instanceId;
};
// 编辑（卡片）
const handleCardEdit = ({ type, instanceId }) => {
  const row = findAdapterRow(type, instanceId);
  if (row) handleEdit(row);
};
// 删除（卡片，确认弹窗由卡片内部处理）
const handleCardDelete = async ({ type, instanceId }) => {
  try {
    const row = findAdapterRow(type, instanceId);
    await configStore.deleteAdapter(type, requireInstanceId(row));
    ElMessage.success("删除成功");
  } catch (error) {
    ElMessage.error("删除失败：" + error.message);
  }
};
// 刷新（卡片）
const handleCardRefresh = async ({ type, instanceId }) => {
  try {
    const row = findAdapterRow(type, instanceId);
    await configStore.refreshAdapterModels(type, requireInstanceId(row));
    ElMessage.success("模型列表刷新成功");
  } catch (error) {
    ElMessage.error("刷新失败：" + error.message);
  }
};
// 切换启用/禁用（卡片）
const handleCardToggle = async ({ type, instanceId, enable }) => {
  const row = findAdapterRow(type, instanceId);
  if (!row) return;
  const original = row.adapter.enable;
  try {
    await configStore.updateAdapter(type, requireInstanceId(row), { ...row.adapter, enable });
    ElMessage.success(enable ? "已启用" : "已禁用");
  } catch (error) {
    row.adapter.enable = original;
    ElMessage.error("操作失败：" + error.message);
  }
};
// 选择/取消选择（卡片，与批量操作栏联动）
const handleCardSelect = ({ type, instanceId, selected }) => {
  if (selected !== configStore.isAdapterSelected(type, instanceId)) {
    configStore.toggleAdapterSelection(type, instanceId);
  }
};
// 处理表格选择变化
const handleSelectionChange = (selection) => {
  // 清空当前选择
  configStore.clearAdapterSelection();

  // 添加新选择
  selection.forEach((item) => {
    configStore.toggleAdapterSelection(item.type, item.instanceId);
  });
};

// 刷新全部模型
const handleRefreshAll = async () => {
  refreshing.value = true;
  try {
    await configStore.refreshAllModels();
    ElMessage.success("所有模型列表刷新成功");
  } catch (error) {
    ElMessage.error("刷新失败：" + error.message);
  } finally {
    refreshing.value = false;
  }
};

// 批量启用
const handleBatchEnable = async () => {
  if (
    !configStore.selectedAdapters ||
    configStore.selectedAdapters.length === 0
  ) {
    ElMessage.warning("请先选择要操作的适配器");
    return;
  }

  try {
    const results = await configStore.batchToggleAdapters(
      configStore.selectedAdapters,
      true,
    );

    const successCount = results.filter((r) => r.success).length;
    ElMessage.success(`成功启用 ${successCount} 个适配器`);
    configStore.clearAdapterSelection();
  } catch (error) {
    ElMessage.error("批量启用失败：" + error.message);
  }
};

// 批量禁用
const handleBatchDisable = async () => {
  if (
    !configStore.selectedAdapters ||
    configStore.selectedAdapters.length === 0
  ) {
    ElMessage.warning("请先选择要操作的适配器");
    return;
  }

  try {
    const results = await configStore.batchToggleAdapters(
      configStore.selectedAdapters,
      false,
    );

    const successCount = results.filter((r) => r.success).length;
    ElMessage.success(`成功禁用 ${successCount} 个适配器`);
    configStore.clearAdapterSelection();
  } catch (error) {
    ElMessage.error("批量禁用失败：" + error.message);
  }
};

// 批量删除
const handleBatchDelete = async () => {
  if (
    !configStore.selectedAdapters ||
    configStore.selectedAdapters.length === 0
  ) {
    ElMessage.warning("请先选择要删除的适配器");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${configStore.selectedAdapters.length} 个适配器吗？`,
      "批量删除",
      {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    const results = await configStore.batchDeleteAdapters(
      configStore.selectedAdapters,
    );

    const successCount = results.filter((r) => r.success).length;
    ElMessage.success(`成功删除 ${successCount} 个适配器`);
    configStore.clearAdapterSelection();
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("批量删除失败：" + error.message);
    }
  }
};

// 编辑器关闭
const handleEditorClose = () => {
  editorVisible.value = false;
};

// 编辑器提交
const handleEditorSubmit = async ({ type, instanceId, data, mode }) => {
  try {
    if (mode === "add") {
      await configStore.addAdapter(type, data);
      ElMessage.success("添加成功");
    } else {
      if (!instanceId) {
        throw new Error("更新适配器失败：缺少稳定实例 ID，请刷新页面后重试");
      }
      await configStore.updateAdapter(type, instanceId, data);
      ElMessage.success("更新成功");
    }
  } catch (error) {
    ElMessage.error(
      mode === "add" ? "添加失败：" : "更新失败：" + error.message,
    );
    throw error; // 重新抛出错误，让编辑器保持打开
  }
};

// 初始化
onMounted(async () => {
  // 检测移动端
  checkMobile();
  window.addEventListener("resize", checkMobile);

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
    await new Promise((resolve) => setTimeout(resolve, 300));
  } catch (error) {
    ElMessage.error("加载配置失败：" + error.message);
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
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
      background: var(--mio-skeleton-bg);
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
        background: var(--mio-skeleton-bg);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s ease-in-out infinite;
      }
    }
  }

  .skeleton-table {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--mio-border-color-light);

    .skeleton-row {
      display: flex;
      height: 60px;
      border-bottom: 1px solid var(--mio-border-color-light);

      &:last-child {
        border-bottom: none;
      }

      .skeleton-cell {
        flex: 1;
        margin: 12px;
        border-radius: 4px;
        background: var(--mio-skeleton-bg);
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
    color: var(--mio-text-primary);
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
  background: rgba(64, 158, 255, 0.15);
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid rgba(64, 158, 255, 0.3);

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
  background: var(--mio-bg-hover);
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
      color: var(--mio-text-regular);
    }

    .stat-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--mio-text-primary);
    }
  }
}

.adapters-list {
  background: var(--mio-bg-card);
  border-radius: 8px;
  overflow-y: auto;
  max-height: calc(100vh - 260px);

  .empty-state {
    padding: 48px 0;
    background: var(--mio-bg-hover);
  }

  .adapter-name {
    display: flex;
    align-items: center;
    gap: 8px;

    .name {
      font-weight: 500;
      color: var(--mio-text-primary);
    }
  }

  .model-name {
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 13px;
    color: var(--mio-text-regular);
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
      background-color: var(--mio-bg-page);
      color: var(--mio-text-regular);
      font-weight: 600;
    }
  }

  .el-table__row {
    &:hover {
      background-color: var(--mio-bg-hover);
    }
  }

  .el-table__cell {
    padding: 12px 0;
  }
}
// 适配器列表行内公共样式（桌面/移动通用）
.registry-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}
.registry-empty {
  color: var(--mio-text-secondary);
  font-size: 12px;
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
    max-height: none;
    overflow: visible;
    background: transparent;
    border-radius: 0;
    // 移动端卡片列表
    .mobile-cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
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
// 适配器选择器对话框移动端适配
@media (max-width: 768px) {
  .adapter-selector-dialog {
    :deep(.el-dialog) {
      width: 94vw !important;
      margin-top: 6vh;
      border-radius: 12px;
    }
    :deep(.el-dialog__header) {
      padding: 14px 16px 8px;
    }
    :deep(.el-dialog__body) {
      padding: 12px 16px 16px;
    }
  }
  .selector-scrollbar {
    max-height: 60vh;
  }
  .grid-container {
    grid-template-columns: 1fr;
  }
  .selector-card {
    padding: 14px;
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

// 响应式卡片网格布局
.adapter-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
  align-items: stretch;
  margin-top: 8px;
}

@media (max-width: 768px) {
  .adapter-cards-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}
</style>
