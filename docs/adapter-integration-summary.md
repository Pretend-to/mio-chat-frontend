# 适配器类型 API 集成总结

## 概述

基于 `docs/llm-providers.md` 中的适配器类型 API 文档，我们已经完成了前端与后端适配器类型 API 的集成，实现了动态适配器配置界面。

## 主要更改

### 1. API 层更新 (`src/lib/configApi.js`)

- 添加了 `getAdapterTypes()` 方法来获取适配器类型信息
- 该方法调用 `/api/config/adapter-types` 端点

### 2. 状态管理更新 (`src/stores/configStore.js`)

- 添加了 `adapterTypes` 状态来存储适配器类型信息
- 添加了 `fetchAdapterTypes()` 方法来获取适配器类型数据
- 更新了返回的公开 API

### 3. 动态表单组件 (`src/components/settings/DynamicAdapterForm.vue`)

新创建的组件，根据适配器类型的 `initialConfigSchema` 动态生成表单字段：

- 支持多种字段类型：`boolean`, `password`, `url`, `select`, `textarea`, `array`, `string`
- 自动处理字段验证规则
- 支持字段描述和占位符
- 特殊处理 Vertex AI 的 JSON 文件上传

### 4. 适配器编辑器更新 (`src/components/settings/AdapterEditor.vue`)

- 集成了 `DynamicAdapterForm` 组件
- 更新了表单验证规则，基于配置模式动态生成
- 更新了表单初始化逻辑，使用配置模式的默认值
- 改进了适配器类型显示名称的获取逻辑

### 5. 适配器管理视图更新 (`src/views/settings/LLMAdaptersView.vue`)

- 更新了适配器类型获取逻辑，使用新的 API
- 改进了适配器类型显示名称
- 在组件初始化时加载适配器类型信息

### 6. 概览视图更新 (`src/views/settings/OverviewView.vue`)

- 更新了适配器类型名称显示逻辑
- 在初始化时并行加载适配器类型信息

## 支持的适配器类型

根据 API 文档，系统支持以下适配器类型：

1. **OpenAI** (`openai`)
   - API Key 认证
   - 支持聊天、流式输出、函数调用、视觉理解

2. **Google Gemini** (`gemini`)
   - API Key 认证
   - 支持聊天、流式输出、视觉理解、多模态

3. **Google Vertex AI** (`vertex`)
   - Service Account JSON 认证
   - 支持聊天、流式输出、视觉理解、多模态、企业级

4. **DeepSeek** (`deepseek`)
   - API Key 认证
   - 支持聊天、流式输出、函数调用、推理链

## 配置模式字段类型

动态表单支持以下字段类型：

- `boolean` - 布尔开关
- `password` - 密码输入框（带显示/隐藏切换）
- `url` - URL 输入框
- `select` - 下拉选择框
- `textarea` - 多行文本输入
- `array` - 多选标签输入
- `string` - 普通文本输入（默认）

## 验证规则

支持以下验证规则：

- `required` - 必填验证
- `validation.pattern` - 正则表达式验证
- `validation.min` - 最小长度验证
- 特殊类型验证（URL 格式、JSON 格式等）

## 使用流程

1. 系统启动时，前端调用 `/api/config/adapter-types` 获取适配器类型信息
2. 用户在适配器管理页面选择要添加的适配器类型
3. 系统根据该类型的 `initialConfigSchema` 动态生成配置表单
4. 用户填写配置信息并提交
5. 前端验证配置并调用相应的 API 保存配置

## 扩展性

该实现具有良好的扩展性：

- 新增适配器类型只需在后端定义相应的 `initialConfigSchema`
- 前端会自动根据配置模式生成对应的表单界面
- 支持自定义字段类型和验证规则
- 支持国际化（通过 `label` 和 `description` 字段）

## 注意事项

1. 确保后端 `/api/config/adapter-types` 端点已实现
2. 适配器类型信息会在页面初始化时加载并缓存
3. 表单验证基于配置模式自动生成，无需手动维护
4. 支持向后兼容，如果 API 不可用会使用硬编码的类型映射