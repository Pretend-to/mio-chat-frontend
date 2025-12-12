<template>
  <div class="preset-card" :class="{ selected: selected }">
    <!-- 选择框 -->
    <div class="card-header">
      <el-checkbox
        :model-value="selected"
        @change="handleSelect"
        class="select-checkbox"
      />
      <div class="preset-tags">
        <el-tag
          v-if="preset.source"
          :type="getSourceTagType(preset.source)"
          size="small"
          effect="light"
        >
          {{ getSourceLabel(preset.source) }}
        </el-tag>
        <el-tag
          v-if="preset.category"
          :type="getCategoryTagType(preset.category)"
          size="small"
          effect="light"
        >
          {{ getCategoryLabel(preset.category) }}
        </el-tag>
      </div>
    </div>

    <!-- 预设信息 -->
    <div class="card-content">
      <div class="preset-header">
        <el-avatar
          v-if="preset.avatar"
          :src="preset.avatar"
          :size="48"
          class="preset-avatar"
        />
        <el-avatar
          v-else
          :size="48"
          :icon="UserFilled"
          class="preset-avatar default-avatar"
        />
        <div class="preset-name">
          <h4>{{ preset.name }}</h4>
        </div>
      </div>

      <div class="preset-opening" v-if="preset.opening">
        <p>{{ preset.opening }}</p>
      </div>

      <div class="preset-history" v-if="preset.history && preset.history.length > 0">
        <div class="history-item" v-for="(item, index) in preset.history.slice(0, 2)" :key="index">
          <el-tag size="small" :type="getRoleTagType(item.role)">
            {{ getRoleLabel(item.role) }}
          </el-tag>
          <span class="history-content">{{ truncateText(item.content, 100) }}</span>
        </div>
        <div v-if="preset.history.length > 2" class="more-history">
          <el-text type="info" size="small">
            还有 {{ preset.history.length - 2 }} 条消息...
          </el-text>
        </div>
      </div>

      <div class="preset-tools" v-if="preset.tools && preset.tools.length > 0">
        <div class="tools-label">工具：</div>
        <div class="tools-list">
          <el-tag
            v-for="tool in preset.tools"
            :key="tool"
            size="small"
            type="info"
            effect="plain"
          >
            {{ tool }}
          </el-tag>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="card-actions">
      <el-button
        size="small"
        type="primary"
        text
        @click="handleEdit"
      >
        编辑
      </el-button>
      <el-button
        size="small"
        type="success"
        text
        @click="handleExport"
      >
        导出
      </el-button>
      <el-button
        v-if="preset.source !== 'built-in'"
        size="small"
        type="danger"
        text
        @click="handleDelete"
      >
        删除
      </el-button>
      <el-tooltip v-else content="内置预设无法删除" placement="top">
        <el-button
          size="small"
          type="info"
          text
          disabled
        >
          删除
        </el-button>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup>
import { UserFilled } from '@element-plus/icons-vue';

const props = defineProps({
  preset: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select', 'edit', 'delete', 'export']);

// 获取来源标签颜色
const getSourceTagType = (source) => {
  const map = {
    'built-in': 'warning',
    'custom': 'success'
  };
  return map[source] || 'primary';
};

// 获取来源标签文本
const getSourceLabel = (source) => {
  const map = {
    'built-in': '内置',
    'custom': '自定义'
  };
  return map[source] || source;
};

// 获取分类标签颜色
const getCategoryTagType = (category) => {
  const map = {
    'common': 'primary',
    'recommended': 'danger',
    'hidden': 'info'
  };
  return map[category] || 'primary';
};

// 获取分类标签文本
const getCategoryLabel = (category) => {
  const map = {
    'common': '常用',
    'recommended': '推荐',
    'hidden': '隐藏'
  };
  return map[category] || category;
};

// 获取角色标签颜色
const getRoleTagType = (role) => {
  const map = {
    'system': 'warning',
    'user': 'primary',
    'assistant': 'success'
  };
  return map[role] || 'info';
};

// 获取角色标签文本
const getRoleLabel = (role) => {
  const map = {
    'system': '系统',
    'user': '用户',
    'assistant': '助手'
  };
  return map[role] || role;
};

// 截断文本
const truncateText = (text, maxLength) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// 处理选择
const handleSelect = (selected) => {
  emit('select', selected);
};

// 处理编辑
const handleEdit = () => {
  emit('edit', props.preset);
};

// 处理删除
const handleDelete = () => {
  emit('delete', props.preset);
};

// 处理导出
const handleExport = () => {
  emit('export', props.preset);
};
</script>

<style scoped lang="scss">
.preset-card {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  height: fit-content;
  cursor: pointer;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: #409eff;
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.12);
    transform: translateY(-2px);
  }

  &.selected {
    border-color: #409eff;
    background: #f0f9ff;
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.2);
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: #409eff;
    }
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  .select-checkbox {
    :deep(.el-checkbox__input) {
      .el-checkbox__inner {
        border-radius: 4px;
      }
    }
  }

  .preset-tags {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
}

.card-content {
  margin-bottom: 16px;

  .preset-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .preset-avatar {
      flex-shrink: 0;
      border: 2px solid #f0f0f0;
      transition: border-color 0.3s ease;

      &.default-avatar {
        background-color: #f5f7fa;
        color: #909399;
      }
    }

    .preset-name {
      flex: 1;
      min-width: 0;

      h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #303133;
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .preset-opening {
    margin-bottom: 12px;

    p {
      margin: 0;
      font-size: 14px;
      color: #606266;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }

  .preset-history {
    margin-bottom: 12px;

    .history-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 13px;

      &:last-child {
        margin-bottom: 0;
      }

      .history-content {
        color: #606266;
        line-height: 1.4;
        flex: 1;
        word-break: break-word;
      }
    }

    .more-history {
      margin-top: 8px;
      text-align: center;
    }
  }

  .preset-tools {
    .tools-label {
      font-size: 13px;
      color: #909399;
      margin-bottom: 6px;
    }

    .tools-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  }
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}
</style>