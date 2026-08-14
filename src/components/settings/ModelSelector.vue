<template>
  <div class="model-selector">
    <!-- 默认模型选择 -->
    <el-form-item label="默认模型" v-if="showDefault" required>
      <div class="model-input-wrapper">
        <el-select
          :model-value="modelValue.default"
          @update:model-value="updateDefault"
          filterable
          allow-create
          default-first-option
          placeholder="请选择或输入默认模型"
          class="model-select"
        >
          <el-option
            v-for="model in availableModels"
            :key="model"
            :label="model"
            :value="model"
          >
            <template #default>
              <span class="model-option">
                <span class="model-name">{{ model }}</span>
                <template v-if="modelMeta(model)">
                  <el-tag
                    v-if="modelMeta(model).vision"
                    size="small"
                    type="success"
                    effect="plain"
                  >
                    视觉
                  </el-tag>
                  <el-tag
                    v-if="modelMeta(model).maxInput"
                    size="small"
                    effect="plain"
                  >
                    {{ formatCtx(modelMeta(model).maxInput) }} ctx
                  </el-tag>
                  <el-tag
                    v-if="modelMeta(model).watermark"
                    size="small"
                    type="warning"
                    effect="plain"
                  >
                    上限 {{ formatCtx(modelMeta(model).watermark) }}
                  </el-tag>
                  <el-tag
                    size="small"
                    :type="matchSourceType[modelMeta(model).matchSource]"
                  >
                    {{ matchSourceLabel[modelMeta(model).matchSource] }}
                  </el-tag>
                </template>
              </span>
            </template>
          </el-option>
        </el-select>
        <el-button
          v-if="showFetchButton"
          type="primary"
          :icon="Refresh"
          :loading="fetchingModels"
          @click="handleFetchModels"
          class="fetch-button"
        >
          获取模型
        </el-button>
      </div>
      <template #extra>
        <span class="form-item-tip">
          {{
            availableModels.length > 0
              ? "为所有用户设置的默认模型"
              : "暂无模型列表，请先获取或手动输入"
          }}
        </span>
      </template>
    </el-form-item>

    <!-- 访客模型配置 -->
    <el-divider content-position="left">访客模型配置</el-divider>

    <!-- 关键词匹配 -->
    <el-form-item label="关键词匹配">
      <div class="keyword-input-wrapper">
        <div class="keyword-tags">
          <el-tag
            v-for="keyword in modelValue.guest?.keywords || []"
            :key="keyword"
            closable
            @close="removeKeyword(keyword)"
            size="default"
          >
            {{ keyword }}
          </el-tag>
        </div>
        <el-input
          v-model="newKeyword"
          @keyup.enter="addKeyword"
          placeholder="输入关键词后按回车添加"
          size="default"
          clearable
          style="margin-top: 8px"
        >
          <template #append>
            <el-button
              :icon="Plus"
              @click="addKeyword"
              class="input-append-button"
              >添加</el-button
            >
          </template>
        </el-input>
      </div>
      <template #extra>
        <span class="form-item-tip">
          访客可使用包含这些关键词的模型（如：gpt、4o、flash）
        </span>
      </template>
    </el-form-item>

    <!-- 完整名称匹配 -->
    <el-form-item label="完整名称">
      <el-select
        :model-value="modelValue.guest?.full_name || []"
        @update:model-value="updateFullNames"
        multiple
        filterable
        placeholder="选择访客可用的模型"
        style="width: 100%"
      >
        <el-option
          v-for="model in availableModels"
          :key="model"
          :label="model"
          :value="model"
        >
          <template #default>
            <span class="model-option">
              <span class="model-name">{{ model }}</span>
              <template v-if="modelMeta(model)">
                <el-tag
                  v-if="modelMeta(model).vision"
                  size="small"
                  type="success"
                  effect="plain"
                >
                  视觉
                </el-tag>
                <el-tag
                  v-if="modelMeta(model).maxInput"
                  size="small"
                  effect="plain"
                >
                  {{ formatCtx(modelMeta(model).maxInput) }} ctx
                </el-tag>
                <el-tag
                  v-if="modelMeta(model).watermark"
                  size="small"
                  type="warning"
                  effect="plain"
                >
                  上限 {{ formatCtx(modelMeta(model).watermark) }}
                </el-tag>
                <el-tag
                  size="small"
                  :type="matchSourceType[modelMeta(model).matchSource]"
                >
                  {{ matchSourceLabel[modelMeta(model).matchSource] }}
                </el-tag>
              </template>
            </span>
          </template>
        </el-option>
      </el-select>
      <template #extra>
        <span class="form-item-tip">访客可使用的具体模型列表</span>
      </template>
    </el-form-item>

    <!-- 预览访客可用模型 -->
    <el-alert
      v-if="guestAvailableModels.length > 0"
      type="info"
      :closable="false"
      show-icon
      style="margin-top: 16px"
    >
      <template #title>
        <div class="preview-title">
          访客可用模型预览
          <el-tag size="small">{{ guestAvailableModels.length }} 个</el-tag>
        </div>
      </template>
      <div class="preview-models">
        <el-tag
          v-for="model in guestAvailableModels.slice(0, 10)"
          :key="model"
          size="small"
          style="margin: 4px"
        >
          {{ model }}
        </el-tag>
        <span
          v-if="guestAvailableModels.length > 10"
          style="color: #909399; font-size: 12px"
        >
          等 {{ guestAvailableModels.length }} 个模型
        </span>
      </div>
    </el-alert>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { Plus, Refresh } from "@element-plus/icons-vue";

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      default: "",
      guest: {
        keywords: [],
        full_name: [],
      },
    }),
  },
  availableModels: {
    type: Array,
    default: () => [],
  },
  showDefault: {
    type: Boolean,
    default: true,
  },
  showFetchButton: {
    type: Boolean,
    default: false,
  },
  fetchingModels: {
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

const emit = defineEmits(["update:modelValue", "fetch-models"]);

const newKeyword = ref("");

// 获取模型列表
const handleFetchModels = () => {
  emit("fetch-models");
};

// ===== 模型规格元数据（来自后端 Registry 决策，前端零硬编码）=====
const modelMeta = (model) => {
  if (!props.providerName || !props.modelsMeta?.[props.providerName]) {
    return null;
  }
  return props.modelsMeta[props.providerName][model] || null;
};

const formatCtx = (n) => {
  if (!n) return "";
  return n >= 1000000
    ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}K`
      : `${n}`;
};

const matchSourceLabel = {
  "litellm-exact": "LiteLLM 精确",
  "litellm-prefix": "LiteLLM 前缀",
  "builtin-rule": "内置规则",
  fallback: "兜底",
};
const matchSourceType = {
  "litellm-exact": "success",
  "litellm-prefix": "primary",
  "builtin-rule": "warning",
  fallback: "info",
};

// 访客可用模型预览
const guestAvailableModels = computed(() => {
  const keywords = props.modelValue.guest?.keywords || [];
  const fullNames = props.modelValue.guest?.full_name || [];

  // 合并关键词匹配和完整名称
  const matched = new Set(fullNames);

  keywords.forEach((keyword) => {
    props.availableModels.forEach((model) => {
      if (model.toLowerCase().includes(keyword.toLowerCase())) {
        matched.add(model);
      }
    });
  });

  return Array.from(matched);
});

// 更新默认模型
const updateDefault = (value) => {
  emit("update:modelValue", {
    ...props.modelValue,
    default: value,
  });
};

// 添加关键词
const addKeyword = () => {
  const keyword = newKeyword.value.trim();
  if (!keyword) return;

  const keywords = props.modelValue.guest?.keywords || [];
  if (keywords.includes(keyword)) {
    newKeyword.value = "";
    return;
  }

  emit("update:modelValue", {
    ...props.modelValue,
    guest: {
      ...props.modelValue.guest,
      keywords: [...keywords, keyword],
    },
  });

  newKeyword.value = "";
};

// 移除关键词
const removeKeyword = (keyword) => {
  const keywords = props.modelValue.guest?.keywords || [];
  emit("update:modelValue", {
    ...props.modelValue,
    guest: {
      ...props.modelValue.guest,
      keywords: keywords.filter((k) => k !== keyword),
    },
  });
};

// 更新完整名称列表
const updateFullNames = (value) => {
  emit("update:modelValue", {
    ...props.modelValue,
    guest: {
      ...props.modelValue.guest,
      full_name: value,
    },
  });
};
</script>

<style scoped lang="scss">
.model-selector {
  :deep(.el-form-item) {
    margin-bottom: 22px;
  }

  :deep(.el-form-item__label) {
    font-weight: 600;
  }
}

.model-input-wrapper {
  display: flex;
  gap: 8px;
  width: 100%;

  .model-select {
    flex: 1;
  }

  .fetch-button {
    flex-shrink: 0;
    width: 100px;
  }
}

.form-item-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

.keyword-input-wrapper {
  width: 100%;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 32px;
  padding: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px dashed #dcdfe6;
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.preview-models {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.model-option {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding-right: 12px;
}

.model-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.el-divider) {
  margin: 24px 0 16px 0;
}

:deep(.el-divider__text) {
  background-color: #fff;
  font-weight: 600;
  color: #606266;
}

// 统一输入框附加按钮宽度
:deep(.el-input-group__append) {
  .input-append-button {
    width: 100px;
  }
}
</style>
