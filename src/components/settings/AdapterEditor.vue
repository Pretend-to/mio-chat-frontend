<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    @close="handleClose"
    width="700px"
    :close-on-click-modal="false"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
      label-position="left"
    >
      <!-- 基本信息 -->
      <el-divider content-position="left">基本信息</el-divider>
      
      <el-form-item label="实例名称" prop="name">
        <el-input
          v-model="formData.name"
          placeholder="留空自动生成"
          clearable
        />
      </el-form-item>

      <el-form-item label="启用状态">
        <el-switch
          v-model="formData.enable"
          active-text="启用"
          inactive-text="禁用"
        />
      </el-form-item>

      <!-- 认证信息 - OpenAI / Gemini -->
      <template v-if="type === 'openai' || type === 'gemini'">
        <el-divider content-position="left">认证信息</el-divider>
        
        <el-form-item label="API Key" prop="api_key">
          <el-input
            v-model="formData.api_key"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="请输入 API Key"
            clearable
          >
            <template #append>
              <el-button :icon="showApiKey ? View : Hide" @click="showApiKey = !showApiKey" />
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="Base URL" prop="base_url">
          <el-input
            v-model="formData.base_url"
            placeholder="API 基础 URL"
            clearable
          />
        </el-form-item>
      </template>

      <!-- 认证信息 - Vertex AI -->
      <template v-if="type === 'vertex'">
        <el-divider content-position="left">认证信息</el-divider>
        
        <el-form-item label="区域" prop="region">
          <el-select
            v-model="formData.region"
            placeholder="选择 Vertex AI 区域"
            filterable
            style="width: 100%"
          >
            <el-option label="us-central1 (美国中部)" value="us-central1" />
            <el-option label="us-east4 (美国东部)" value="us-east4" />
            <el-option label="asia-northeast1 (日本东京)" value="asia-northeast1" />
            <el-option label="asia-southeast1 (新加坡)" value="asia-southeast1" />
            <el-option label="europe-west4 (荷兰)" value="europe-west4" />
            <el-option label="europe-west1 (比利时)" value="europe-west1" />
          </el-select>
        </el-form-item>

        <el-form-item label="认证方式">
          <el-radio-group v-model="vertexAuthType">
            <el-radio value="json">粘贴 JSON</el-radio>
            <el-radio value="file">上传文件</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item
          v-if="vertexAuthType === 'json'"
          label="服务账号 JSON"
          prop="service_account_json"
        >
          <el-input
            v-model="formData.service_account_json"
            type="textarea"
            :rows="6"
            placeholder='{"type": "service_account", "project_id": "...", ...}'
          />
        </el-form-item>

        <el-form-item
          v-if="vertexAuthType === 'file'"
          label="JSON 文件"
        >
          <el-upload
            :before-upload="handleJsonUpload"
            :show-file-list="false"
            accept=".json"
            drag
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
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
            v-if="formData.service_account_json"
            :model-value="jsonFilePreview"
            type="textarea"
            :rows="3"
            readonly
            style="margin-top: 8px"
          />
        </el-form-item>

        <el-form-item label="自定义模型">
          <el-select
            v-model="formData.models"
            multiple
            filterable
            allow-create
            placeholder="添加模型（可选）"
            style="width: 100%"
          >
            <el-option label="gemini-2.0-flash-001" value="gemini-2.0-flash-001" />
            <el-option label="gemini-1.5-pro-002" value="gemini-1.5-pro-002" />
            <el-option label="claude-3-5-sonnet-v2@20241022" value="claude-3-5-sonnet-v2@20241022" />
            <el-option label="claude-3-5-haiku@20241022" value="claude-3-5-haiku@20241022" />
          </el-select>
          <template #extra>
            <span class="form-item-tip">
              Claude 模型必须在此配置，其他模型可自动获取
            </span>
          </template>
        </el-form-item>
      </template>

      <!-- 模型配置 -->
      <el-divider content-position="left">模型配置</el-divider>
      
      <model-selector
        v-model="modelConfig"
        :available-models="previewModels"
        :show-default="true"
      />
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ mode === 'add' ? '保存并测试连接' : '保存' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { View, Hide, UploadFilled } from '@element-plus/icons-vue';
import ModelSelector from './ModelSelector.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'add',
    validator: (value) => ['add', 'edit'].includes(value)
  },
  type: {
    type: String,
    required: true,
    validator: (value) => ['openai', 'gemini', 'vertex'].includes(value)
  },
  adapter: {
    type: Object,
    default: null
  },
  index: {
    type: Number,
    default: -1
  }
});

const emit = defineEmits(['close', 'submit']);

const formRef = ref(null);
const showApiKey = ref(false);
const submitting = ref(false);
const vertexAuthType = ref('json');

// 表单数据
const formData = ref({
  name: '',
  enable: true,
  api_key: '',
  base_url: '',
  region: 'us-central1',
  service_account_json: '',
  models: [],
  default_model: '',
  guest_models: {
    keywords: [],
    full_name: []
  }
});

// 保存原始数据用于对比变更
const originalData = ref(null);

// 模型配置（用于 ModelSelector）
const modelConfig = ref({
  default: '',
  guest: {
    keywords: [],
    full_name: []
  }
});

// 对话框标题
const dialogTitle = computed(() => {
  const typeNames = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    vertex: 'Vertex AI'
  };
  const action = props.mode === 'add' ? '添加' : '编辑';
  return `${action} ${typeNames[props.type]} 适配器实例`;
});

// 预览模型列表（用于模型选择器）
const previewModels = computed(() => {
  // 这里应该从实际 API 获取，暂时使用示例数据
  if (props.type === 'openai') {
    return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  } else if (props.type === 'gemini') {
    return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  } else if (props.type === 'vertex') {
    return formData.value.models.length > 0
      ? formData.value.models
      : ['gemini-2.0-flash-001', 'claude-3-5-sonnet-v2@20241022'];
  }
  return [];
});

// JSON 文件预览
const jsonFilePreview = computed(() => {
  if (!formData.value.service_account_json) return '';
  try {
    const json = JSON.parse(formData.value.service_account_json);
    return `项目: ${json.project_id}\n客户端邮箱: ${json.client_email}`;
  } catch {
    return '已上传 JSON 文件';
  }
});

// 表单验证规则
const rules = computed(() => {
  const baseRules = {
    name: [],
    enable: []
  };

  if (props.type === 'openai' || props.type === 'gemini') {
    baseRules.api_key = [
      { required: true, message: '请输入 API Key', trigger: 'blur' },
      { min: 10, message: 'API Key 长度不足', trigger: 'blur' }
    ];
    baseRules.base_url = [
      { required: true, message: '请输入 Base URL', trigger: 'blur' },
      {
        type: 'url',
        message: '请输入有效的 URL',
        trigger: 'blur',
        transform: (value) => {
          // 简单的 URL 验证
          return value && (value.startsWith('http://') || value.startsWith('https://'))
            ? value
            : `https://${value}`;
        }
      }
    ];
  }

  if (props.type === 'vertex') {
    baseRules.region = [
      { required: true, message: '请选择区域', trigger: 'change' }
    ];
    baseRules.service_account_json = [
      { required: true, message: '请提供服务账号 JSON', trigger: 'blur' },
      {
        validator: (rule, value, callback) => {
          try {
            JSON.parse(value);
            callback();
          } catch {
            callback(new Error('JSON 格式不正确'));
          }
        },
        trigger: 'blur'
      }
    ];
  }

  return baseRules;
});

// 处理 JSON 文件上传
const handleJsonUpload = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = e.target.result;
      JSON.parse(json); // 验证 JSON 格式
      formData.value.service_account_json = json;
      ElMessage.success('JSON 文件上传成功');
    } catch (error) {
      ElMessage.error('JSON 文件格式不正确');
    }
  };
  reader.readAsText(file);
  return false; // 阻止自动上传
};

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate();
    
    let submitData;
    
    if (props.mode === 'add') {
      // 添加模式：提交所有字段
      submitData = {
        ...formData.value,
        default_model: modelConfig.value.default,
        guest_models: modelConfig.value.guest
      };

      // 清理不需要的字段
      if (props.type !== 'vertex') {
        delete submitData.region;
        delete submitData.service_account_json;
        delete submitData.models;
      } else {
        delete submitData.api_key;
        delete submitData.base_url;
      }
    } else {
      // 编辑模式：只提交变更的字段
      submitData = {};
      
      // 比对基本字段
      const fieldsToCheck = ['name', 'enable', 'api_key', 'base_url', 'region', 'service_account_json', 'models'];
      for (const field of fieldsToCheck) {
        // 跳过加密字段（以 *** 开头的值表示未修改）
        if (field === 'api_key' && formData.value[field]?.startsWith('***')) {
          continue;
        }
        if (field === 'service_account_json' && formData.value[field]?.startsWith('***')) {
          continue;
        }
        
        // 只在字段值发生变化时添加
        if (JSON.stringify(formData.value[field]) !== JSON.stringify(originalData.value?.[field])) {
          // 根据适配器类型过滤字段
          if (props.type !== 'vertex' && ['region', 'service_account_json', 'models'].includes(field)) {
            continue;
          }
          if (props.type === 'vertex' && ['api_key', 'base_url'].includes(field)) {
            continue;
          }
          submitData[field] = formData.value[field];
        }
      }
      
      // 检查模型配置变更
      if (JSON.stringify(modelConfig.value.default) !== JSON.stringify(originalData.value?.default_model)) {
        submitData.default_model = modelConfig.value.default;
      }
      if (JSON.stringify(modelConfig.value.guest) !== JSON.stringify(originalData.value?.guest_models)) {
        submitData.guest_models = modelConfig.value.guest;
      }
    }

    submitting.value = true;
    await emit('submit', {
      type: props.type,
      index: props.index,
      data: submitData,
      mode: props.mode
    });
    
    handleClose();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('表单验证失败，请检查输入');
    }
  } finally {
    submitting.value = false;
  }
};

// 关闭对话框
const handleClose = () => {
  emit('close');
  // 重置表单
  setTimeout(() => {
    formRef.value?.resetFields();
    showApiKey.value = false;
  }, 300);
};

// 初始化表单数据
const initFormData = () => {
  if (props.mode === 'edit' && props.adapter) {
    formData.value = { ...props.adapter };
    modelConfig.value = {
      default: props.adapter.default_model || '',
      guest: props.adapter.guest_models || { keywords: [], full_name: [] }
    };
    // 保存原始数据副本
    originalData.value = JSON.parse(JSON.stringify(props.adapter));
  } else {
    // 添加模式 - 设置默认值
    const defaults = {
      openai: {
        base_url: 'https://api.openai.com/v1'
      },
      gemini: {
        base_url: 'https://generativelanguage.googleapis.com/v1beta'
      },
      vertex: {
        region: 'us-central1',
        models: []
      }
    };

    formData.value = {
      name: '',
      enable: true,
      ...defaults[props.type],
      default_model: '',
      guest_models: {
        keywords: [],
        full_name: []
      }
    };

    modelConfig.value = {
      default: '',
      guest: {
        keywords: [],
        full_name: []
      }
    };
  }
};

// 监听对话框打开
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      initFormData();
    }
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.form-item-tip {
  color: #909399;
  font-size: 12px;
}

:deep(.el-form-item__content) {
  flex-direction: column;
  align-items: flex-start;
}

:deep(.el-form-item__extra) {
  margin-top: 4px;
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
</style>
