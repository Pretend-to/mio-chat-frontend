<template>
  <el-card class="adapter-card" :class="{ 'is-selected': isSelected }">
    <!-- 选择框 -->
    <el-checkbox
      v-if="selectable"
      :model-value="isSelected"
      @change="handleSelect"
      class="card-checkbox"
    />

    <!-- 卡片头部 -->
    <div class="card-header">
      <div class="header-left">
        <el-tag :type="adapter.enable ? 'success' : 'info'" size="small">
          {{ adapter.enable ? '已启用' : '已禁用' }}
        </el-tag>
        <h3 class="adapter-name">{{ displayName }}</h3>
      </div>
      <el-switch
        :model-value="adapter.enable"
        @change="handleToggle"
        :loading="toggling"
      />
    </div>

    <!-- 配置信息 -->
    <div class="card-body">
      <div class="info-container">
        <div class="info-item">
          <span class="label">API Key</span>
          <span class="value">{{ maskedApiKey }}</span>
        </div>
        <div class="info-item" v-if="adapter.base_url">
          <span class="label">Base URL</span>
          <span class="value">{{ adapter.base_url }}</span>
        </div>
        <div class="info-item" v-if="adapter.region">
          <span class="label">区域</span>
          <span class="value">{{ adapter.region }}</span>
        </div>
        <div class="info-item">
          <span class="label">默认模型</span>
          <span class="value">{{ adapter.default_model || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="label">可用模型</span>
          <span class="value model-count">
            <el-tag size="small" :type="modelCountType" effect="plain" round>
              {{ modelCount }} 个
            </el-tag>
          </span>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="card-actions">
      <el-button
        size="small"
        :icon="Edit"
        @click="handleEdit"
      >
        编辑
      </el-button>
      <el-button
        size="small"
        :icon="Refresh"
        @click="handleRefresh"
        :loading="refreshing"
      >
        刷新模型
      </el-button>
      <el-button
        size="small"
        type="danger"
        :icon="Delete"
        @click="handleDelete"
      >
        删除
      </el-button>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Edit, Refresh, Delete } from '@element-plus/icons-vue';

const props = defineProps({
  adapter: {
    type: Object,
    required: true
  },
  type: {
    type: String,
    required: true,
  },
  index: {
    type: Number,
    required: true
  },
  models: {
    type: Array,
    default: () => []
  },
  selectable: {
    type: Boolean,
    default: false
  },
  isSelected: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['edit', 'delete', 'refresh', 'toggle', 'select']);

const toggling = ref(false);
const refreshing = ref(false);

// 显示名称
const displayName = computed(() => {
  return props.adapter.name || `${props.type}-${props.index + 1}`;
});

// 脱敏的 API Key
const maskedApiKey = computed(() => {
  const key = props.adapter.api_key || '';
  if (!key) return '-';
  if (key.length <= 10) return '***';
  return `${key.slice(0, 6)}***${key.slice(-4)}`;
});

// 模型数量
const modelCount = computed(() => {
  if (!props.models || !Array.isArray(props.models)) return 0;
  
  let count = 0;
  props.models.forEach(group => {
    if (group.models && Array.isArray(group.models)) {
      count += group.models.length;
    }
  });
  return count;
});

// 模型数量标签类型
const modelCountType = computed(() => {
  if (modelCount.value === 0) return 'danger';
  if (modelCount.value < 5) return 'warning';
  return 'success';
});

// 编辑
const handleEdit = () => {
  emit('edit', { type: props.type, index: props.index, adapter: props.adapter });
};

// 删除
const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除适配器 "${displayName.value}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    emit('delete', { type: props.type, index: props.index });
  } catch (error) {
    // 用户取消
  }
};

// 刷新模型
const handleRefresh = async () => {
  refreshing.value = true;
  try {
    await emit('refresh', { type: props.type, index: props.index });
  } finally {
    refreshing.value = false;
  }
};

// 切换启用/禁用
const handleToggle = async (value) => {
  toggling.value = true;
  try {
    await emit('toggle', {
      type: props.type,
      index: props.index,
      enable: value
    });
  } finally {
    toggling.value = false;
  }
};

// 选择
const handleSelect = (value) => {
  emit('select', { type: props.type, index: props.index, selected: value });
};
</script>

<style scoped lang="scss">
.adapter-card {
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border-radius: 16px;
  border: 1px solid transparent;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: visible;

  &.is-selected {
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
    z-index: 1;
  }

  :deep(.el-card__body) {
    padding: 0;
  }
}

.card-checkbox {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 10px; // 调整内边距

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    padding-left: 24px; // 给 checkbox 留位置
  }

  .adapter-name {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }
}

.card-body {
  padding: 10px 20px 20px;

  .info-container {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;

    .label {
      color: #909399;
    }

    .value {
      color: #606266;
      font-family: monospace;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      
      &.model-count {
        font-family: inherit;
      }
    }
  }
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid #f0f2f5;

  .el-button {
    border-radius: 8px;
    padding: 8px 16px;
  }
}
</style>
