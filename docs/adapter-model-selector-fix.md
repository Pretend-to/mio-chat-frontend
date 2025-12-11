# 适配器模型选择器修复说明

## 问题描述

在适配器编辑器中，默认模型下拉列表显示的模型与当前适配器类型不匹配。例如：
- 选择 DeepSeek 适配器时，下拉列表显示 OneHub 或其他 provider 的模型
- 这导致用户困惑，无法正确选择适配器对应的模型

## 问题原因

`previewModels` 计算属性的逻辑有误：

```javascript
// 错误的逻辑：获取所有 provider 的模型
Object.values(configStore.models).forEach(providerModels => {
  // 这会包含所有类型的模型，不仅仅是当前适配器类型的
});
```

这导致下拉列表中混合了所有 provider 的模型，而不是只显示当前适配器类型对应的模型。

## 修复方案

### 1. 修改模型获取逻辑

```javascript
// 修复后的逻辑：只获取当前适配器类型的模型
const providerModels = configStore.models[props.type];
if (Array.isArray(providerModels)) {
  providerModels.forEach(group => {
    if (group.models && Array.isArray(group.models)) {
      group.models.forEach(model => typeModels.add(model));
    }
  });
}
```

### 2. 优先级调整

新的模型选择优先级：

1. **手动获取的模型** (`fetchedModels.value`) - 最高优先级
2. **当前类型的模型** (`configStore.models[props.type]`) - 从配置中获取
3. **自定义模型** (`formData.value.models`) - 用户添加的模型
4. **类型默认模型** - 硬编码的后备列表

### 3. 扩展默认模型支持

为更多适配器类型添加了默认模型：

```javascript
// 新增的默认模型
else if (props.type === 'deepseek') {
  return ['deepseek-chat', 'deepseek-coder'];
} else if (props.type === 'anthropic') {
  return ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'];
}
```

## 修复效果

### ✅ 修复前的问题
- DeepSeek 适配器显示 OneHub 模型
- 模型列表混乱，用户难以选择
- 不同类型适配器显示相同的模型列表

### ✅ 修复后的改进
- 每个适配器类型只显示对应的模型
- DeepSeek 适配器显示 DeepSeek 模型
- OpenAI 适配器显示 OpenAI 模型
- 自定义模型正确合并显示

## 数据流程

```
1. 用户选择适配器类型 (如 deepseek)
   ↓
2. previewModels 计算属性触发
   ↓
3. 检查是否有手动获取的模型
   ↓
4. 从 configStore.models['deepseek'] 获取模型
   ↓
5. 合并自定义模型 (formData.models)
   ↓
6. 返回排序后的模型列表
   ↓
7. ModelSelector 显示正确的模型选项
```

## 测试建议

1. **创建不同类型的适配器**，验证模型列表是否正确
2. **添加自定义模型**，确认它们出现在下拉列表中
3. **使用"获取模型"功能**，验证手动获取的模型优先显示
4. **检查默认模型选择**，确保只能选择当前类型的模型

## 相关文件

- `src/components/settings/AdapterEditor.vue` - 主要修复文件
- `src/components/settings/ModelSelector.vue` - 模型选择器组件
- `src/stores/configStore.js` - 模型配置存储

---

**修复时间**: 2024-12-11  
**影响范围**: 适配器编辑器的模型选择功能  
**向后兼容**: ✅ 完全兼容，只是修复了显示逻辑