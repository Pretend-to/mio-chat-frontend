<template>
  <el-dialog 
    :model-value="visible" 
    :title="dialogTitle" 
    @close="handleClose" 
    width="700px"
    :close-on-click-modal="false"
    class="form-dialog adapter-editor-dialog"
  >
    <div class="dialog-content">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="120px" label-position="left">
        <!-- 动态生成的配置表单 -->
        <dynamic-adapter-form
          :type="type"
          :schema="currentAdapterSchema"
          v-model="formData"
          :show-api-key="showApiKey"
          @toggle-api-key="showApiKey = !showApiKey"
          @json-upload="() => {}"
        />

        <!-- 模型配置 -->
        <el-divider content-position="left">模型配置</el-divider>

        <model-selector v-model="modelConfig" :available-models="previewModels" :show-default="true"
          :show-fetch-button="true" :fetching-models="fetchingModels" @fetch-models="handleFetchModels" />
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ mode === 'add' ? '保存并测试连接' : '保存' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { configAPI } from '@/lib/configApi.js';
import { useConfigStore } from '@/stores/configStore.js';
import { ElMessage } from 'element-plus';
import { computed, ref, watch } from 'vue';
import DynamicAdapterForm from './DynamicAdapterForm.vue';
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
    required: true
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

const configStore = useConfigStore();
const formRef = ref(null);
const showApiKey = ref(false);
const submitting = ref(false);
const fetchingModels = ref(false);
const fetchedModels = ref([]);

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
// 将适配器类型格式化为友好显示名
const formatTypeLabel = (type) => {
  // 确保 configStore 和 adapterTypes 都存在
  if (configStore?.adapterTypes?.adapters) {
    // 优先从适配器类型信息中获取显示名称
    const adapterInfo = configStore.adapterTypes.adapters.find(a => a.type === type);
    if (adapterInfo?.name) {
      return adapterInfo.name;
    }
  }
  
  // 后备方案：使用硬编码映射
  const map = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    vertex: 'Vertex AI',
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic'
  };
  if (map[type]) return map[type];
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : '适配器';
};

const dialogTitle = computed(() => {
  const action = props.mode === 'add' ? '添加' : '编辑';
  return `${action} ${formatTypeLabel(props.type)} 适配器实例`;
});

// 获取当前适配器类型的配置模式
const currentAdapterSchema = computed(() => {
  if (!configStore?.adapterTypes?.adapters) {
    return {};
  }
  const adapterInfo = configStore.adapterTypes.adapters.find(a => a.type === props.type);
  return adapterInfo?.initialConfigSchema || {};
});

// 预览模型列表（用于模型选择器）
const previewModels = computed(() => {
  // 优先使用手动获取的模型列表
  if (fetchedModels.value.length > 0) {
    return fetchedModels.value;
  }

  const typeModels = new Set();

  // 1. 如果是编辑模式，优先使用当前适配器实例对应的模型列表
  if (props.mode === 'edit' && props.adapter) {
    const adapterName = props.adapter.name || `${props.type}-${props.index + 1}`;
    const instanceModels = configStore.models[adapterName];
    
    if (Array.isArray(instanceModels)) {
      instanceModels.forEach(group => {
        if (group.models && Array.isArray(group.models)) {
          group.models.forEach(model => typeModels.add(model));
        }
      });
    }
  }

  // 2. 如果当前适配器实例有自定义模型配置，也包含进来
  if (formData.value?.models && Array.isArray(formData.value.models) && formData.value.models.length > 0) {
    formData.value.models.forEach(model => typeModels.add(model));
  }

  // 3. 如果还没有模型，尝试从该类型的其他实例获取
  if (typeModels.size === 0) {
    // 从该适配器类型的所有实例中获取模型
    const typeInstances = configStore.adapters[props.type] || [];
    typeInstances.forEach((instance, index) => {
      const instanceName = instance.name || `${props.type}-${index + 1}`;
      const instanceModels = configStore.models[instanceName];
      
      if (Array.isArray(instanceModels)) {
        instanceModels.forEach(group => {
          if (group.models && Array.isArray(group.models)) {
            group.models.forEach(model => typeModels.add(model));
          }
        });
      }
    });
  }

  // 4. 如果有模型数据，返回排序后的列表
  if (typeModels.size > 0) {
    return Array.from(typeModels).sort();
  }

  // 5. 最后的后备方案：根据类型返回默认列表
  if (props.type === 'openai') {
    return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  } else if (props.type === 'gemini') {
    return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  } else if (props.type === 'vertex') {
    return ['gemini-2.0-flash-001', 'claude-3-5-sonnet-v2@20241022'];
  } else if (props.type === 'deepseek') {
    return ['deepseek-chat', 'deepseek-coder'];
  } else if (props.type === 'anthropic') {
    return ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'];
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
  const rules = {};
  const schema = currentAdapterSchema.value;
  
  // 基于配置模式动态生成验证规则
  Object.entries(schema).forEach(([fieldName, fieldConfig]) => {
    const fieldRules = [];
    
    // 必填验证
    if (fieldConfig.required) {
      fieldRules.push({
        required: true,
        message: `请输入${fieldConfig.label || fieldName}`,
        trigger: fieldConfig.type === 'select' ? 'change' : 'blur'
      });
    }
    
    // 自定义验证规则
    if (fieldConfig.validation) {
      if (fieldConfig.validation.pattern) {
        fieldRules.push({
          pattern: new RegExp(fieldConfig.validation.pattern),
          message: fieldConfig.validation.message || '格式不正确',
          trigger: 'blur'
        });
      }
      
      if (fieldConfig.validation.min) {
        fieldRules.push({
          min: fieldConfig.validation.min,
          message: fieldConfig.validation.message || `最少${fieldConfig.validation.min}个字符`,
          trigger: 'blur'
        });
      }
      
      if (fieldConfig.validation.isJson) {
        fieldRules.push({
          validator: (rule, value, callback) => {
            if (!value) {
              callback();
              return;
            }
            try {
              JSON.parse(value);
              callback();
            } catch {
              callback(new Error(fieldConfig.validation.message || 'JSON 格式不正确'));
            }
          },
          trigger: 'blur'
        });
      }
    }
    
    // 特殊类型验证
    if (fieldConfig.type === 'url') {
      fieldRules.push({
        type: 'url',
        message: '请输入有效的 URL',
        trigger: 'blur',
        transform: (value) => {
          return value && (value.startsWith('http://') || value.startsWith('https://'))
            ? value
            : `https://${value}`;
        }
      });
    }
    
    if (fieldConfig.type === 'textarea' && fieldName === 'service_account_json') {
      fieldRules.push({
        validator: (rule, value, callback) => {
          try {
            JSON.parse(value);
            callback();
          } catch {
            callback(new Error('JSON 格式不正确'));
          }
        },
        trigger: 'blur'
      });
    }
    
    if (fieldRules.length > 0) {
      rules[fieldName] = fieldRules;
    }
  });
  
  return rules;
});



// 获取模型列表
const handleFetchModels = async () => {
  // 验证必要字段
  if (props.type !== 'vertex') {
    if (!formData.value.api_key) {
      ElMessage.warning('请先填写 API Key');
      return;
    }
    if (!formData.value.base_url) {
      ElMessage.warning('请先填写 Base URL');
      return;
    }
  } else if (props.type === 'vertex') {
    if (!formData.value.region) {
      ElMessage.warning('请先选择区域');
      return;
    }
    if (!formData.value.service_account_json) {
      ElMessage.warning('请先提供服务账号 JSON');
      return;
    }
  }

  fetchingModels.value = true;
  try {
    // 构建测试请求参数（只包含认证相关字段）
    const testConfig = {};

    // 根据适配器类型添加必要的认证信息
    if (props.type === 'vertex') {
      testConfig.region = formData.value.region;
      testConfig.service_account_json = formData.value.service_account_json;
      if (formData.value.models && formData.value.models.length > 0) {
        testConfig.models = formData.value.models;
      }
    } else {
      testConfig.api_key = formData.value.api_key;
      testConfig.base_url = formData.value.base_url;
    }

    // 调用后端 API 测试连接并获取模型
    const response = await configAPI.request(`/api/config/llm/${props.type}/test-models`, {
      method: 'POST',
      body: JSON.stringify(testConfig)
    });

    if (response.data && response.data.models) {
      // 将模型列表平铺
      const models = [];
      if (Array.isArray(response.data.models)) {
        response.data.models.forEach(group => {
          if (group.models && Array.isArray(group.models)) {
            models.push(...group.models);
          }
        });
      }

      fetchedModels.value = [...new Set(models)].sort();

      if (fetchedModels.value.length > 0) {
        ElMessage.success(`成功获取 ${fetchedModels.value.length} 个模型`);
      } else {
        ElMessage.warning('获取模型列表为空');
      }
    } else {
      ElMessage.warning('获取模型列表为空');
    }
  } catch (error) {
    console.error('获取模型失败:', error);
    ElMessage.error('获取模型失败：' + error.message);
  } finally {
    fetchingModels.value = false;
  }
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
    fetchedModels.value = [];
  }, 300);
};

// 初始化表单数据
const initFormData = () => {
  const schema = currentAdapterSchema.value;
  
  if (props.mode === 'edit' && props.adapter) {
    formData.value = { ...props.adapter };
    modelConfig.value = {
      default: props.adapter.default_model || '',
      guest: props.adapter.guest_models || { keywords: [], full_name: [] }
    };
    // 保存原始数据副本
    originalData.value = JSON.parse(JSON.stringify(props.adapter));
  } else {
    // 添加模式 - 基于配置模式设置默认值
    const defaultData = {};
    
    // 从配置模式中获取默认值
    Object.entries(schema).forEach(([fieldName, fieldConfig]) => {
      defaultData[fieldName] = fieldConfig.default !== undefined ? fieldConfig.default : '';
      
      // 特殊处理数组类型
      if (fieldConfig.type === 'array' && !Array.isArray(defaultData[fieldName])) {
        defaultData[fieldName] = [];
      }
      
      // 特殊处理布尔类型
      if (fieldConfig.type === 'boolean' && typeof defaultData[fieldName] !== 'boolean') {
        defaultData[fieldName] = fieldConfig.default === true;
      }
    });

    formData.value = {
      ...defaultData,
      // 确保关键字段总是被初始化
      models: defaultData.models || [],
      manual_models: defaultData.manual_models || '',
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
.dialog-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 0;
}

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

// 统一输入框附加按钮宽度
:deep(.el-input-group__append) {
  .input-append-button {
    width: 100px;
  }
}
</style>

