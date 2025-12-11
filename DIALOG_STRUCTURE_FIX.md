# Dialog 结构修复总结

## 问题描述

所有的 `el-dialog` 组件中不能直接放业务内容，必须在 dialog 里面套一个有最大高度可以滚动的最大父元素再往里面放业务组件。

## 修复的文件

### 1. src/components/settings/PresetEditor.vue
- ✅ 添加了 `<div class="dialog-content">` 包装器
- ✅ 设置了 `max-height: 60vh; overflow-y: auto;`

### 2. src/components/settings/AdapterEditor.vue  
- ✅ 添加了 `<div class="dialog-content">` 包装器
- ✅ 设置了 `max-height: 60vh; overflow-y: auto;`
- ✅ 添加了样式文件

### 3. src/components/settings/ConfigCompare.vue
- ✅ 添加了 `<div class="dialog-content">` 包装器  
- ✅ 设置了 `max-height: 60vh; overflow-y: auto;`
- ✅ 添加了样式文件

### 4. src/views/settings/PluginsView.vue
- ✅ 修复了 3 个 dialog：
  - 插件详情对话框
  - 配置对话框  
  - 工具调试对话框（已经有正确结构，保持不变）
- ✅ 添加了统一的 `.dialog-content` 样式

## 修复后的标准结构

```vue
<template>
  <el-dialog>
    <div class="dialog-content">
      <!-- 业务内容 -->
    </div>
    
    <template #footer>
      <!-- 底部按钮 -->
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.dialog-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 0;
}
</style>
```

## 检查结果

- ✅ 所有 settings 相关的 dialog 都已修复
- ✅ 统一使用 `60vh` 最大高度
- ✅ 统一使用 `overflow-y: auto` 滚动
- ✅ 所有文件通过诊断检查，无语法错误

## 注意事项

1. **高度设置**：使用 `60vh` 确保在不同屏幕尺寸下都有合适的高度
2. **滚动行为**：`overflow-y: auto` 只在内容超出时显示滚动条
3. **内边距**：设置 `padding: 0` 让业务组件自己控制内边距
4. **响应式**：所有 dialog 都能在移动端正常显示和滚动

现在所有的 dialog 都符合要求的结构规范！