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
        <el-tag size="small" type="primary" effect="plain">{{ typeLabel }}</el-tag>
        <el-tag :type="adapter.enable ? 'success' : 'info'" size="small">
          {{ adapter.enable ? "已启用" : "已禁用" }}
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
          <span class="value">{{ adapter.default_model || "-" }}</span>
        </div>
        <div class="info-item">
          <span class="label">可用模型</span>
          <span class="value model-count">
            <el-tag size="small" :type="modelCountType" effect="plain" round>
              {{ modelCount }} 个
            </el-tag>
            <template v-if="registrySummary">
              <el-tag
                v-if="registrySummary.visionCount > 0"
                size="small"
                type="success"
                effect="plain"
              >
                视觉 {{ registrySummary.visionCount }}
              </el-tag>
              <el-tooltip
                :content="registrySummary.sourceText"
                placement="top"
              >
                <el-tag size="small" effect="plain">
                  ctx {{ registrySummary.ctxRange }}
                </el-tag>
              </el-tooltip>
            </template>
          </span>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="card-actions">
      <el-button size="small" :icon="Edit" @click="handleEdit">
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
import { ref, computed } from "vue";
import { ElMessageBox, ElMessage } from "element-plus";
import { Edit, Refresh, Delete } from "@element-plus/icons-vue";

const props = defineProps({
  adapter: {
    type: Object,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  models: {
    type: Array,
    default: () => [],
  },
  selectable: {
    type: Boolean,
    default: false,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
  modelsMeta: {
    type: Object,
    default: () => ({}),
  },
  providerName: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["edit", "delete", "refresh", "toggle", "select"]);

const toggling = ref(false);
const refreshing = ref(false);

// 显示名称
const displayName = computed(() => {
  return props.adapter.name || `${props.type}-${props.index + 1}`;
});

// 类型显示名（openai -> OpenAI，anthropic-chat -> Anthropic Chat）
const typeLabel = computed(() => {
  return props.type
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
});

// 脱敏的 API Key
const maskedApiKey = computed(() => {
  const key = props.adapter.api_key || "";
  if (!key) return "-";
  if (key.length <= 10) return "***";
  return `${key.slice(0, 6)}***${key.slice(-4)}`;
});

// 模型数量
const modelCount = computed(() => {
  if (!props.models || !Array.isArray(props.models)) return 0;

  let count = 0;
  props.models.forEach((group) => {
    if (group.models && Array.isArray(group.models)) {
      count += group.models.length;
    }
  });
  return count;
});

// 模型数量标签类型
const modelCountType = computed(() => {
  if (modelCount.value === 0) return "danger";
  if (modelCount.value < 5) return "warning";
  return "success";
});

// Registry 元数据摘要（ctx 范围 / 视觉数 / 规则来源分布）
const registrySummary = computed(() => {
  if (!props.providerName || !props.modelsMeta?.[props.providerName]) {
    return null;
  }
  const entries = Object.values(props.modelsMeta[props.providerName]);
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

  const formatCtx = (n) => {
    if (!n) return "-";
    return n >= 1000000
      ? `${(n / 1000000).toFixed(1)}M`
      : n >= 1000
        ? `${Math.round(n / 1000)}K`
        : `${n}`;
  };

  return {
    visionCount,
    ctxRange: ctxs.length
      ? `${formatCtx(Math.min(...ctxs))} ~ ${formatCtx(Math.max(...ctxs))}`
      : "-",
    sourceText,
  };
});

// 编辑
const handleEdit = () => {
  emit("edit", {
    type: props.type,
    index: props.index,
    adapter: props.adapter,
  });
};

// 删除
const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除适配器 "${displayName.value}" 吗？`,
      "确认删除",
      {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    emit("delete", { type: props.type, index: props.index });
  } catch (error) {
    // 用户取消
  }
};

// 刷新模型
const handleRefresh = async () => {
  refreshing.value = true;
  try {
    await emit("refresh", { type: props.type, index: props.index });
  } finally {
    refreshing.value = false;
  }
};

// 切换启用/禁用
const handleToggle = async (value) => {
  toggling.value = true;
  try {
    await emit("toggle", {
      type: props.type,
      index: props.index,
      enable: value,
    });
  } finally {
    toggling.value = false;
  }
};

// 选择
const handleSelect = (value) => {
  emit("select", { type: props.type, index: props.index, selected: value });
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
        max-width: none;
        white-space: normal;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
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

// 移动端紧凑样式
@media (max-width: 768px) {
  .card-checkbox {
    top: 12px;
    left: 12px;
  }

  .card-header {
    padding: 14px 14px 8px;

    .header-left {
      gap: 6px;
      padding-left: 22px;
      flex-wrap: wrap;
    }

    .adapter-name {
      font-size: 15px;
      width: 100%;
    }
  }

  .card-body {
    padding: 8px 14px 14px;

    .info-container {
      padding: 10px;
      gap: 6px;
      border-radius: 8px;
    }

    .info-item {
      font-size: 12px;

      .value {
        max-width: 120px;

        &.model-count {
          max-width: none;
        }
      }
    }
  }

  .card-actions {
    gap: 6px;
    padding: 10px 14px;

    .el-button {
      flex: 1;
      padding: 7px 0;
      margin-left: 0;
    }
  }
}
</style>
