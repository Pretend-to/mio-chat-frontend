<template>
  <div class="model-selector">
    <!-- 默认模型选择 -->
    <el-form-item label="默认模型" v-if="showDefault" required>
      <el-select
        :model-value="modelValue.default"
        @update:model-value="updateDefault"
        filterable
        placeholder="请选择默认模型"
        style="width: 100%"
      >
        <el-option
          v-for="model in availableModels"
          :key="model"
          :label="model"
          :value="model"
        />
      </el-select>
      <template #extra>
        <span class="form-item-tip">为所有用户设置的默认模型</span>
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
            <el-button :icon="Plus" @click="addKeyword">添加</el-button>
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
        />
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
        <span v-if="guestAvailableModels.length > 10" style="color: #909399; font-size: 12px;">
          等 {{ guestAvailableModels.length }} 个模型
        </span>
      </div>
    </el-alert>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Plus } from '@element-plus/icons-vue';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      default: '',
      guest: {
        keywords: [],
        full_name: []
      }
    })
  },
  availableModels: {
    type: Array,
    default: () => []
  },
  showDefault: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:modelValue']);

const newKeyword = ref('');

// 访客可用模型预览
const guestAvailableModels = computed(() => {
  const keywords = props.modelValue.guest?.keywords || [];
  const fullNames = props.modelValue.guest?.full_name || [];
  
  // 合并关键词匹配和完整名称
  const matched = new Set(fullNames);
  
  keywords.forEach(keyword => {
    props.availableModels.forEach(model => {
      if (model.toLowerCase().includes(keyword.toLowerCase())) {
        matched.add(model);
      }
    });
  });
  
  return Array.from(matched);
});

// 更新默认模型
const updateDefault = (value) => {
  emit('update:modelValue', {
    ...props.modelValue,
    default: value
  });
};

// 添加关键词
const addKeyword = () => {
  const keyword = newKeyword.value.trim();
  if (!keyword) return;
  
  const keywords = props.modelValue.guest?.keywords || [];
  if (keywords.includes(keyword)) {
    newKeyword.value = '';
    return;
  }
  
  emit('update:modelValue', {
    ...props.modelValue,
    guest: {
      ...props.modelValue.guest,
      keywords: [...keywords, keyword]
    }
  });
  
  newKeyword.value = '';
};

// 移除关键词
const removeKeyword = (keyword) => {
  const keywords = props.modelValue.guest?.keywords || [];
  emit('update:modelValue', {
    ...props.modelValue,
    guest: {
      ...props.modelValue.guest,
      keywords: keywords.filter(k => k !== keyword)
    }
  });
};

// 更新完整名称列表
const updateFullNames = (value) => {
  emit('update:modelValue', {
    ...props.modelValue,
    guest: {
      ...props.modelValue.guest,
      full_name: value
    }
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

:deep(.el-divider) {
  margin: 24px 0 16px 0;
}

:deep(.el-divider__text) {
  background-color: #fff;
  font-weight: 600;
  color: #606266;
}
</style>
