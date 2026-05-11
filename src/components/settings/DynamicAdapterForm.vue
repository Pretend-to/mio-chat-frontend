<template>
  <div class="dynamic-adapter-form">
    <!-- 适配器描述 (支持简单 Markdown) -->
    <div v-if="description" class="adapter-description-container">
      <el-icon class="info-icon"><InfoFilled /></el-icon>
      <div class="adapter-description" v-html="renderedDescription"></div>
    </div>

    <!-- 基本信息 -->
    <el-divider content-position="left">配置详情</el-divider>
    
    <!-- 动态生成的字段 -->
    <template v-for="(fieldConfig, fieldName) in schema" :key="fieldName">
      <el-form-item 
        :label="fieldConfig.label || fieldName" 
        :prop="fieldName"
        :required="fieldConfig.required"
      >
        <!-- 布尔类型 - 开关 -->
        <el-switch 
          v-if="fieldConfig.type === 'boolean'"
          :model-value="modelValue[fieldName]"
          @update:model-value="updateField(fieldName, $event)"
          :active-text="fieldConfig.label || '启用'"
          :inactive-text="fieldConfig.inactiveText || '禁用'"
        />
        
        <!-- 密码类型 - 密码输入框 -->
        <el-input 
          v-else-if="fieldConfig.type === 'password'"
          :model-value="modelValue[fieldName]"
          @update:model-value="updateField(fieldName, $event)"
          :type="showApiKey ? 'text' : 'password'"
          :placeholder="fieldConfig.placeholder || fieldConfig.description"
          clearable
        >
          <template #append>
            <el-button 
              :icon="showApiKey ? View : Hide" 
              @click="$emit('toggle-api-key')"
              class="input-append-button" 
            />
          </template>
        </el-input>
        
        <!-- URL 类型 - URL 输入框 -->
        <el-input 
          v-else-if="fieldConfig.type === 'url'"
          :model-value="modelValue[fieldName]"
          @update:model-value="updateField(fieldName, $event)"
          :placeholder="fieldConfig.placeholder || fieldConfig.description"
          clearable
        />
        
        <!-- 选择框类型 -->
        <el-select 
          v-else-if="fieldConfig.type === 'select'"
          :model-value="modelValue[fieldName]"
          @update:model-value="updateField(fieldName, $event)"
          :placeholder="fieldConfig.placeholder || `选择${fieldConfig.label}`"
          filterable
          style="width: 100%"
        >
          <el-option 
            v-for="option in fieldConfig.options" 
            :key="option.value" 
            :label="option.label" 
            :value="option.value" 
          />
        </el-select>
        
        <!-- 文本区域类型 -->
        <el-input 
          v-else-if="fieldConfig.type === 'textarea'"
          :model-value="modelValue[fieldName]"
          @update:model-value="updateField(fieldName, $event)"
          type="textarea"
          :rows="fieldConfig.rows || 4"
          :placeholder="fieldConfig.placeholder || fieldConfig.description"
        />
        
        <!-- 数组类型 - 多选标签 -->
        <el-select 
          v-else-if="fieldConfig.type === 'array'"
          :model-value="modelValue[fieldName]"
          @update:model-value="updateField(fieldName, $event)"
          multiple
          filterable
          :allow-create="!fieldConfig.readonly"
          :disabled="fieldConfig.readonly"
          :placeholder="fieldConfig.placeholder || `添加${fieldConfig.label}`"
          style="width: 100%"
        >
          <el-option 
            v-for="option in (fieldConfig.options || [])" 
            :key="option.value || option" 
            :label="option.label || option" 
            :value="option.value || option" 
          />
        </el-select>
        
        <!-- 默认字符串类型 -->
        <el-input 
          v-else
          :model-value="modelValue[fieldName]"
          @update:model-value="updateField(fieldName, $event)"
          :placeholder="fieldConfig.placeholder || fieldConfig.description"
          :readonly="fieldConfig.readonly"
          clearable
        />
        
        <!-- 字段描述 -->
        <div v-if="fieldConfig.description && fieldConfig.type !== 'boolean'" class="field-description">
          {{ fieldConfig.description }}
        </div>
      </el-form-item>
    </template>
    
    <!-- 特殊处理：Vertex AI 的 JSON 文件上传 -->
    <template v-if="type === 'vertex' && schema.service_account_json">
      <el-form-item label="认证方式">
        <el-radio-group v-model="vertexAuthType">
          <el-radio value="json">粘贴 JSON</el-radio>
          <el-radio value="file">上传文件</el-radio>
        </el-radio-group>
      </el-form-item>
      
      <el-form-item v-if="vertexAuthType === 'file'" label="JSON 文件">
        <el-upload 
          :before-upload="handleJsonUpload" 
          :show-file-list="false" 
          accept=".json" 
          drag
        >
          <el-icon class="el-icon--upload">
            <UploadFilled />
          </el-icon>
          <div class="el-upload__text">
            拖拽文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              仅支持 .json 格式的服务账号文件
            </div>
          </template>
        </el-upload>
        <el-input 
          v-if="modelValue.service_account_json" 
          :model-value="jsonFilePreview" 
          type="textarea" 
          :rows="3"
          readonly 
          style="margin-top: 8px" 
        />
      </el-form-item>
    </template>
  </div>
</template>

<script setup>
import { Hide, InfoFilled, UploadFilled, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, ref } from 'vue';

const props = defineProps({
  type: {
    type: String,
    required: true
  },
  schema: {
    type: Object,
    default: () => ({})
  },
  modelValue: {
    type: Object,
    required: true
  },
  showApiKey: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'toggle-api-key', 'json-upload']);

const vertexAuthType = ref('json');

// 简单的 Markdown 渲染逻辑
const renderedDescription = computed(() => {
  if (!props.description) return '';
  
  let html = props.description;
  
  // 处理加粗 **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 处理链接 [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="markdown-link">$1</a>');
  
  // 处理有序列表 1. 2. (特别针对多行描述)
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    const trimmedLine = line.trim();
    const listMatch = trimmedLine.match(/^(\d+)\.\s+(.*)$/);
    if (listMatch) {
      return `<div class="desc-list-item"><span class="desc-list-index">${listMatch[1]}</span><span class="desc-list-content">${listMatch[2]}</span></div>`;
    }
    return line;
  });
  
  html = processedLines.join('\n');

  // 处理换行
  html = html.replace(/\n/g, '<br>');
  
  return html;
});

// 更新字段值
const updateField = (fieldName, value) => {
  const newValue = { ...props.modelValue };
  newValue[fieldName] = value;
  emit('update:modelValue', newValue);
};

// JSON 文件预览
const jsonFilePreview = computed(() => {
  if (!props.modelValue.service_account_json) return '';
  try {
    const json = JSON.parse(props.modelValue.service_account_json);
    return `项目: ${json.project_id}\n客户端邮箱: ${json.client_email}`;
  } catch {
    return '已上传 JSON 文件';
  }
});

// 处理 JSON 文件上传
const handleJsonUpload = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = e.target.result;
      JSON.parse(json); // 验证 JSON 格式
      
      // 更新模型值
      const newValue = { ...props.modelValue };
      newValue.service_account_json = json;
      emit('update:modelValue', newValue);
      
      ElMessage.success('JSON 文件上传成功');
    } catch (error) {
      ElMessage.error('JSON 文件格式不正确');
    }
  };
  reader.readAsText(file);
  emit('json-upload', file);
  return false; // 阻止自动上传
};
</script>

<style scoped lang="scss">
.dynamic-adapter-form {
  .adapter-description-container {
    padding: 16px 20px;
    background: linear-gradient(135deg, #f0f7ff 0%, #f5faff 100%);
    border-radius: 14px;
    border: 1px solid #d9ecff;
    margin-bottom: 24px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
    box-shadow: 0 4px 15px rgba(64, 158, 255, 0.05);
    
    .info-icon {
      font-size: 20px;
      color: #409eff;
      margin-top: 2px;
      flex-shrink: 0;
    }
    
    .adapter-description {
      font-size: 14px;
      line-height: 1.7;
      color: #5e6d82;
      flex: 1;
      
      :deep(strong) {
        color: #2c3e50;
        font-weight: 600;
      }
      
      :deep(.markdown-link) {
        color: #409eff;
        text-decoration: none;
        font-weight: 500;
        border-bottom: 1px solid rgba(64, 158, 255, 0.3);
        transition: all 0.2s ease;
        padding-bottom: 1px;
        
        &:hover {
          color: #66b1ff;
          border-bottom-color: #409eff;
          background: rgba(64, 158, 255, 0.05);
        }
      }

      :deep(.desc-list-item) {
        display: flex;
        gap: 10px;
        margin: 6px 0;
        align-items: flex-start;
      }

      :deep(.desc-list-index) {
        width: 20px;
        height: 20px;
        background: #409eff;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        flex-shrink: 0;
        margin-top: 2px;
        box-shadow: 0 2px 4px rgba(64, 158, 255, 0.2);
      }

      :deep(.desc-list-content) {
        flex: 1;
      }

      :deep(br) {
        display: block;
        margin: 4px 0;
        content: "";
      }
    }
  }

  .field-description {
    color: #909399;
    font-size: 12px;
    margin-top: 4px;
    line-height: 1.4;
  }
  
  :deep(.el-form-item__content) {
    flex-direction: column;
    align-items: flex-start;
  }
  
  :deep(.el-divider) {
    margin: 24px 0 16px 0;
  }
  
  :deep(.el-divider__text) {
    font-weight: 600;
    color: #606266;
  }
  
  :deep(.el-upload-dragger) {
    padding: 20px;
  }
  
  // 统一输入框附加按钮宽度
  :deep(.el-input-group__append) {
    .input-append-button {
      width: 100px;
    }
  }
}
</style>