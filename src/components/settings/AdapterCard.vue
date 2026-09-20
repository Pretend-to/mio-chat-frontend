<template>
  <el-card class="adapter-card" :class="{ 'is-selected': isSelected, 'is-disabled': !adapter.enable }">
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
        <div class="avatar-badge">
          <img
            v-if="!avatarFailed"
            :src="avatarUrl"
            :alt="`${displayName} avatar`"
            @error="avatarFailed = true"
          />
          <span v-else>{{ brandInfo.letter }}</span>
        </div>
        <div class="title-group">
          <div class="name-row">
            <h3 class="adapter-name" :title="displayName">{{ displayName }}</h3>
            <el-tag
              :type="adapter.enable ? 'success' : 'info'"
              size="small"
              effect="plain"
              class="status-tag"
            >
              {{ adapter.enable ? "已启用" : "已禁用" }}
            </el-tag>
          </div>
          <div class="tag-row">
            <el-tag
              size="small"
              :style="{
                color: protoInfo.color,
                borderColor: protoInfo.color + '40',
                backgroundColor: protoInfo.color + '15',
              }"
              effect="plain"
              class="proto-tag"
            >
              {{ protoInfo.short }}
            </el-tag>
            <el-tag
              v-if="connLabel"
              size="small"
              type="info"
              effect="plain"
              class="conn-tag"
            >
              {{ connLabel }}
            </el-tag>
          </div>
        </div>
      </div>
      <div class="header-right">
        <el-switch
          :model-value="adapter.enable"
          @change="handleToggle"
          :loading="toggling"
        />
      </div>
    </div>

    <!-- 配置信息主体 -->
    <div class="card-body">
      <div class="info-container">
        <!-- 端点 Base URL -->
        <div class="info-item url-item" v-if="adapter.base_url">
          <span class="label">端点</span>
          <span class="value mono url-val" :title="adapter.base_url">
            {{ adapter.base_url }}
          </span>
        </div>

        <!-- 默认模型 -->
        <div class="info-item">
          <span class="label">默认模型</span>
          <span class="value default-model-val mono" :title="adapter.default_model || '-'">
            <span class="bullet">●</span> {{ adapter.default_model || "-" }}
          </span>
        </div>

        <!-- 可用模型标签流预览 -->
        <div class="info-item models-item">
          <div class="models-header">
            <span class="label">可用模型</span>
            <el-tag size="small" :type="modelCountType" effect="plain" round class="count-tag">
              {{ modelCount }} 个
            </el-tag>
          </div>
          <div class="chips-preview">
            <template v-if="previewChips.length > 0">
              <span
                v-for="modelName in previewChips"
                :key="modelName"
                class="chip-preview-tag"
                :title="modelName"
              >
                {{ modelName }}
              </span>
              <span v-if="moreCount > 0" class="chip-more-tag">
                +{{ moreCount }}
              </span>
            </template>
            <span v-else class="empty-chips-hint">暂无已入库模型</span>
          </div>
        </div>

        <!-- 规格信息 (视觉 / 上下文) -->
        <div v-if="registrySummary" class="info-item specs-item">
          <span class="label">规格</span>
          <div class="specs-group">
            <el-tag
              v-if="registrySummary.visionCount > 0"
              size="small"
              type="success"
              effect="plain"
            >
              视觉 {{ registrySummary.visionCount }}
            </el-tag>
            <el-tooltip :content="registrySummary.sourceText" placement="top">
              <el-tag size="small" effect="plain">
                ctx {{ registrySummary.ctxRange }}
              </el-tag>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作按钮 -->
    <div class="card-actions">
      <el-button size="small" :icon="Edit" type="primary" plain @click="handleEdit">
        编辑
      </el-button>
      <el-button
        size="small"
        :icon="Refresh"
        type="success"
        plain
        @click="handleRefresh"
        :loading="refreshing"
      >
        刷新模型
      </el-button>
      <el-button
        size="small"
        type="danger"
        plain
        :icon="Delete"
        @click="handleDelete"
      >
        删除
      </el-button>
    </div>
  </el-card>
</template>

<script setup>
import { computed, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { Delete, Edit, Refresh } from "@element-plus/icons-vue";
import { getAvatarByAdapterType } from "@/utils/avatar.js";

const props = defineProps({
  adapter: {
    type: Object,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  instanceId: {
    type: String,
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
const avatarFailed = ref(false);
const avatarUrl = computed(() => getAvatarByAdapterType(props.type));

// 显示名称
const displayName = computed(() => {
  return props.adapter.name || `${props.type}-${props.instanceId.slice(-6)}`;
});

// 协议信息映射
const protoInfo = computed(() => {
  const t = props.type;
  if (t === "anthropic") {
    return { short: "Anthropic Messages", color: "#c1613e" };
  }
  if (t === "gemini" || t === "agentPlatform" || t === "geminiOauth" || t === "vertexExpress" || t === "vertex") {
    return { short: "Gemini", color: "#2f9e6f" };
  }
  if (t === "openai-responses" || t === "volcengine" || t === "xai") {
    return { short: "OpenAI Responses", color: "#7c5cff" };
  }
  return { short: "OpenAI Chat", color: "#409eff" };
});

// 品牌图标与主色
const brandInfo = computed(() => {
  const t = props.type.toLowerCase();
  const presetsMap = {
    deepseek: { letter: "D", color: "#4d6bfe" },
    zhipu: { letter: "智", color: "#3b6ef6" },
    volcengine: { letter: "火", color: "#2b6cf6" },
    xiaomimimo: { letter: "M", color: "#ff6900" },
    moonshot: { letter: "K", color: "#1f1f1f" },
    minimax: { letter: "M", color: "#e8443a" },
    baichuan: { letter: "百", color: "#2f6fed" },
    stepfun: { letter: "阶", color: "#5b5bd6" },
    zeroone: { letter: "01", color: "#0f9d8f" },
    openai: { letter: "O", color: "#10a37f" },
    anthropic: { letter: "A", color: "#c1613e" },
    gemini: { letter: "G", color: "#2f9e6f" },
    geminioauth: { letter: "GC", color: "#1a73e8" },
    agentplatform: { letter: "V", color: "#4285f4" },
    vertexexpress: { letter: "V", color: "#4285f4" },
    xai: { letter: "X", color: "#1c1c1c" },
    openrouter: { letter: "R", color: "#6b4ee6" },
    groq: { letter: "Q", color: "#f55036" },
    perplexity: { letter: "P", color: "#20808d" },
  };
  if (presetsMap[t]) return presetsMap[t];
  const char = (displayName.value.charAt(0) || t.charAt(0) || "M").toUpperCase();
  return { letter: char, color: protoInfo.value.color };
});

// 连接方式标签
const connLabel = computed(() => {
  const t = props.type;
  if (t === "geminiOauth") return "OAuth";
  if (t === "agentPlatform" || t === "vertexExpress" || t === "vertex") {
    return props.adapter.block_express ? "Vertex ADC" : "Vertex Express";
  }
  return "";
});

// 提取所有平铺模型列表
const flatModelNames = computed(() => {
  const set = new Set();
  if (props.models && Array.isArray(props.models)) {
    props.models.forEach((group) => {
      if (group.models && Array.isArray(group.models)) {
        group.models.forEach((m) => set.add(typeof m === "string" ? m : m.id || m.name));
      }
    });
  }
  if (props.adapter.models && Array.isArray(props.adapter.models)) {
    props.adapter.models.forEach((m) => set.add(m));
  }
  return Array.from(set);
});

// 模型数量
const modelCount = computed(() => flatModelNames.value.length);

// 模型芯片预览（最多显示前 3 个）
const previewChips = computed(() => flatModelNames.value.slice(0, 3));
const moreCount = computed(() => Math.max(0, flatModelNames.value.length - 3));

// 模型数量标签类型
const modelCountType = computed(() => {
  if (modelCount.value === 0) return "danger";
  if (modelCount.value < 5) return "warning";
  return "success";
});

// Registry 元数据摘要
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
    instanceId: props.instanceId,
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

    emit("delete", { type: props.type, instanceId: props.instanceId });
  } catch {
    // 用户取消
  }
};

// 刷新模型
const handleRefresh = async () => {
  refreshing.value = true;
  try {
    await emit("refresh", { type: props.type, instanceId: props.instanceId });
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
      instanceId: props.instanceId,
      enable: value,
    });
  } finally {
    toggling.value = false;
  }
};

// 选择
const handleSelect = (value) => {
  emit("select", { type: props.type, instanceId: props.instanceId, selected: value });
};
</script>

<style scoped lang="scss">
.adapter-card {
  position: relative;
  transition: all 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.1);
  border-radius: 14px;
  border: 1px solid var(--mio-border-color-lighter, #e4e7ed) !important;
  background: var(--mio-bg-card, #ffffff);
  box-shadow: var(--mio-shadow-light, 0 4px 16px rgba(31, 45, 61, 0.05)) !important;
  display: flex;
  flex-direction: column;
  height: 100%;

  &.is-selected {
    border-color: var(--el-color-primary, #409eff);
    background-color: var(--mio-bg-primary-light, #ecf5ff);
  }

  &.is-disabled {
    opacity: 0.85;
    background: var(--mio-bg-surface-soft, #fafbfc);
  }

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    transform: translateY(-2px);
  }

  :deep(.el-card__body) {
    padding: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
}

.card-checkbox {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 5;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 16px 10px;
  border-bottom: 1px solid var(--mio-border-color-light, #f0f2f5);

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
    padding-left: 22px; // 给复选框留位置
  }

  .avatar-badge {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    border: 1px solid #e4e7ed;
    color: #303133;
    font-weight: 700;
    font-size: 15px;
    flex-shrink: 0;
    overflow: hidden;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
    }
  }

  .title-group {
    min-width: 0;
    flex: 1;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .adapter-name {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
    color: var(--mio-text-primary, #303133);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 170px;
  }

  .status-tag {
    font-size: 11px;
    padding: 0 6px;
    height: 20px;
    line-height: 18px;
  }

  .tag-row {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .proto-tag,
  .conn-tag {
    font-size: 11px;
    height: 20px;
    line-height: 18px;
    padding: 0 6px;
  }

  .header-right {
    flex-shrink: 0;
    margin-left: 8px;
  }
}

.card-body {
  padding: 12px 16px;
  flex: 1;

  .info-container {
    background: var(--mio-bg-surface-soft, #fbfcfe);
    border: 1px solid var(--mio-border-color-light, #eef0f3);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12.5px;
    min-width: 0;

    .label {
      color: var(--mio-text-secondary, #909399);
      font-weight: 500;
      flex-shrink: 0;
      margin-right: 8px;
    }

    .value {
      color: var(--mio-text-regular, #606266);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: right;
    }

    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    .url-val {
      color: #409eff;
      max-width: 220px;
      font-size: 11.8px;
    }

    .default-model-val {
      font-weight: 600;
      color: var(--mio-text-primary, #303133);
      .bullet {
        color: #67c23a;
        margin-right: 2px;
      }
    }
  }

  .models-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;

    .models-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .count-tag {
      font-size: 11px;
      height: 19px;
      line-height: 17px;
      padding: 0 7px;
    }

    .chips-preview {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      width: 100%;
    }

    .chip-preview-tag {
      display: inline-block;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      color: #409eff;
      background: var(--mio-bg-primary-light, #ecf5ff);
      border: 1px solid var(--mio-border-color-light, #d9ecff);
      border-radius: 6px;
      padding: 1px 6px;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chip-more-tag {
      font-size: 10.5px;
      color: var(--mio-text-secondary, #909399);
      background: var(--mio-bg-info-light, #f4f4f5);
      border: 1px solid var(--mio-border-color-light, #e9e9eb);
      border-radius: 6px;
      padding: 1px 5px;
    }

    .empty-chips-hint {
      font-size: 11.5px;
      color: var(--mio-text-placeholder, #c0c4cc);
      font-style: italic;
    }
  }

  .specs-item {
    border-top: 1px dashed var(--mio-border-color-light, #eef0f3);
    padding-top: 6px;

    .specs-group {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--mio-border-color-light, #f0f2f5);
  background: var(--mio-bg-surface-soft, #fafbfc);
  border-radius: 0 0 14px 14px;

  .el-button {
    border-radius: 8px;
    font-size: 12.5px;
    padding: 6px 12px;
  }
}

// 暗色主题下使用比页面背景更亮的结构线，避免卡片和内部信息区融成一块。
:global([data-theme="dark"] .adapter-card),
:global(html.dark .adapter-card) {
  border: 1px solid #4a4a55 !important;
  background: #2b2b31;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.28) !important;
}

:global([data-theme="dark"] .adapter-card.is-selected),
:global(html.dark .adapter-card.is-selected) {
  border-color: #4aa8ff;
  background: rgba(0, 153, 255, 0.12);
}

:global([data-theme="dark"] .adapter-card.is-disabled),
:global(html.dark .adapter-card.is-disabled) {
  background: #25252b;
}

:global([data-theme="dark"] .adapter-card:hover),
:global(html.dark .adapter-card:hover) {
  border-color: #626271;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42) !important;
}

:global([data-theme="dark"] .adapter-card .card-header),
:global(html.dark .adapter-card .card-header) {
  border-bottom-color: #41414b;
}

:global([data-theme="dark"] .adapter-card .card-body .info-container),
:global(html.dark .adapter-card .card-body .info-container) {
  background: #232329;
  border-color: #41414b;
}

:global([data-theme="dark"] .adapter-card .card-body .specs-item),
:global(html.dark .adapter-card .card-body .specs-item) {
  border-top-color: #41414b;
}

:global([data-theme="dark"] .adapter-card .card-actions),
:global(html.dark .adapter-card .card-actions) {
  background: #232329;
  border-top-color: #41414b;
}

:global([data-theme="dark"] .adapter-card .chip-preview-tag),
:global(html.dark .adapter-card .chip-preview-tag) {
  background: rgba(64, 158, 255, 0.14);
  border-color: rgba(64, 158, 255, 0.36);
}

:global([data-theme="dark"] .adapter-card .chip-more-tag),
:global(html.dark .adapter-card .chip-more-tag) {
  background: rgba(144, 147, 153, 0.14);
  border-color: #41414b;
}

:global([data-theme="dark"] .adapter-card .avatar-badge),
:global(html.dark .adapter-card .avatar-badge) {
  background: #fff;
  border-color: #dcdfe6;
  color: #303133;
}

:global([data-theme="dark"] .adapter-card .el-button.is-plain),
:global(html.dark .adapter-card .el-button.is-plain) {
  background: transparent;
}

:global([data-theme="dark"] .adapter-card .el-button.is-plain:hover),
:global(html.dark .adapter-card .el-button.is-plain:hover) {
  background: rgba(255, 255, 255, 0.08);
}
</style>
