# 动态适配器配置使用示例

## 后端 API 响应示例

### 获取适配器类型信息

**请求：** `GET /api/config/adapter-types`

**响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "types": ["openai", "gemini", "vertex", "deepseek"],
    "adapters": [
      {
        "type": "openai",
        "name": "OpenAI",
        "description": "OpenAI GPT 系列模型适配器，支持 GPT-3.5、GPT-4 等模型",
        "supportedFeatures": ["chat", "streaming", "function_calling", "vision"],
        "initialConfigSchema": {
          "enable": {
            "type": "boolean",
            "default": true,
            "description": "是否启用此适配器实例",
            "required": true,
            "label": "启用"
          },
          "name": {
            "type": "string",
            "default": "",
            "description": "适配器实例名称，留空自动生成",
            "required": false,
            "label": "实例名称",
            "placeholder": "留空自动生成"
          },
          "api_key": {
            "type": "password",
            "default": "",
            "description": "OpenAI API 密钥，支持多个密钥用逗号分隔",
            "required": true,
            "label": "API Key",
            "placeholder": "输入您的 API Key"
          },
          "base_url": {
            "type": "url",
            "default": "https://api.openai.com/v1",
            "description": "OpenAI API 基础 URL",
            "required": true,
            "label": "Base URL",
            "placeholder": "https://api.openai.com/v1"
          }
        }
      },
      {
        "type": "vertex",
        "name": "Google Vertex AI",
        "description": "Google Vertex AI 适配器，支持企业级 AI 服务",
        "supportedFeatures": ["chat", "streaming", "vision", "multimodal", "enterprise"],
        "initialConfigSchema": {
          "enable": {
            "type": "boolean",
            "default": true,
            "description": "是否启用此适配器实例",
            "required": true,
            "label": "启用"
          },
          "name": {
            "type": "string",
            "default": "",
            "description": "适配器实例名称，留空自动生成",
            "required": false,
            "label": "实例名称"
          },
          "region": {
            "type": "select",
            "default": "us-central1",
            "description": "Google Cloud 地区",
            "required": true,
            "label": "区域",
            "options": [
              { "value": "us-central1", "label": "us-central1 (美国中部)" },
              { "value": "us-east4", "label": "us-east4 (美国东部)" },
              { "value": "asia-northeast1", "label": "asia-northeast1 (日本东京)" },
              { "value": "asia-southeast1", "label": "asia-southeast1 (新加坡)" }
            ]
          },
          "service_account_json": {
            "type": "textarea",
            "default": "",
            "description": "Service Account JSON 内容",
            "required": true,
            "label": "服务账号 JSON",
            "rows": 6,
            "placeholder": "{\"type\": \"service_account\", \"project_id\": \"...\", ...}"
          },
          "manual_models": {
            "type": "array",
            "default": [],
            "description": "手动配置的模型列表",
            "required": false,
            "label": "自定义模型",
            "placeholder": "添加模型（可选）",
            "options": [
              "gemini-2.0-flash-001",
              "gemini-1.5-pro-002",
              "claude-3-5-sonnet-v2@20241022",
              "claude-3-5-haiku@20241022"
            ]
          }
        }
      }
    ],
    "count": 4
  }
}
```

## 前端使用流程

### 1. 初始化时加载适配器类型

```javascript
// 在组件 onMounted 中
onMounted(async () => {
  try {
    // 加载适配器类型信息
    await configStore.fetchAdapterTypes();
    
    // 加载现有配置
    await configStore.fetchConfig();
  } catch (error) {
    ElMessage.error('加载失败：' + error.message);
  }
});
```

### 2. 显示可用适配器类型

```javascript
// 获取适配器类型列表
const adapterTypes = computed(() => {
  return configStore.adapterTypes.types || [];
});

// 获取适配器显示名称
const formatTypeLabel = (type) => {
  const adapterInfo = configStore.adapterTypes.adapters?.find(a => a.type === type);
  return adapterInfo?.name || type;
};
```

### 3. 动态生成配置表单

```vue
<template>
  <!-- 适配器类型选择 -->
  <el-dropdown @command="handleAddAdapter">
    <el-button type="primary">添加适配器</el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="type in adapterTypes"
          :key="type"
          :command="type"
        >
          {{ formatTypeLabel(type) }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <!-- 动态配置表单 -->
  <dynamic-adapter-form
    :type="selectedType"
    :schema="currentAdapterSchema"
    v-model="formData"
  />
</template>

<script setup>
// 获取当前适配器的配置模式
const currentAdapterSchema = computed(() => {
  const adapterInfo = configStore.adapterTypes.adapters?.find(a => a.type === selectedType.value);
  return adapterInfo?.initialConfigSchema || {};
});
</script>
```

### 4. 表单验证

```javascript
// 基于配置模式动态生成验证规则
const rules = computed(() => {
  const rules = {};
  const schema = currentAdapterSchema.value;
  
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
    if (fieldConfig.validation?.pattern) {
      fieldRules.push({
        pattern: new RegExp(fieldConfig.validation.pattern),
        message: fieldConfig.validation.message || '格式不正确',
        trigger: 'blur'
      });
    }
    
    if (fieldRules.length > 0) {
      rules[fieldName] = fieldRules;
    }
  });
  
  return rules;
});
```

### 5. 提交配置

```javascript
const handleSubmit = async () => {
  try {
    // 表单验证
    await formRef.value.validate();
    
    // 提交配置
    await configStore.addAdapter(selectedType.value, formData.value);
    
    ElMessage.success('添加成功');
  } catch (error) {
    ElMessage.error('添加失败：' + error.message);
  }
};
```

## 支持的字段类型

### 基本类型

- `string` - 文本输入框
- `password` - 密码输入框（带显示/隐藏切换）
- `boolean` - 开关组件
- `url` - URL 输入框（带格式验证）

### 选择类型

- `select` - 下拉选择框
- `array` - 多选标签输入

### 文本类型

- `textarea` - 多行文本输入

### 字段配置选项

```json
{
  "field_name": {
    "type": "string",           // 字段类型
    "label": "显示标签",         // 字段标签
    "description": "字段描述",   // 字段描述
    "placeholder": "占位符文本", // 占位符
    "default": "默认值",        // 默认值
    "required": true,           // 是否必填
    "readonly": false,          // 是否只读
    "rows": 4,                  // textarea 行数
    "options": [                // select/array 选项
      {"value": "val1", "label": "标签1"},
      {"value": "val2", "label": "标签2"}
    ],
    "validation": {             // 验证规则
      "pattern": "^[a-zA-Z]+$", // 正则表达式
      "message": "验证失败消息", // 验证失败消息
      "min": 5,                 // 最小长度
      "isJson": true            // JSON 格式验证
    }
  }
}
```

## 扩展新适配器类型

要添加新的适配器类型，只需：

1. 在后端定义适配器类的 `getAdapterMetadata()` 方法
2. 返回包含 `initialConfigSchema` 的元数据
3. 前端会自动根据配置模式生成对应的表单界面

无需修改前端代码，实现了真正的动态配置。