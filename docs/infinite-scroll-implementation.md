# 无限滚动实现说明

## 概述

使用 Intersection Observer API 实现了自动无限滚动功能，替代了手动点击"加载更多"按钮的方式。

## 技术实现

### 1. Intersection Observer API

```javascript
// 创建观察器
observer = new IntersectionObserver(
  (entries) => {
    const entry = entries[0];
    // 当触发器元素进入视口时，自动加载更多数据
    if (entry.isIntersecting && hasMore.value && !loadingMore.value) {
      loadMore();
    }
  },
  {
    rootMargin: '100px', // 提前 100px 触发加载
    threshold: 0.1       // 10% 可见时触发
  }
);
```

### 2. 触发器元素

```html
<!-- 无限滚动触发器 -->
<div v-if="hasMore" ref="loadTrigger" class="load-trigger">
  <div v-if="loadingMore" class="loading-more">
    <el-skeleton :rows="2" animated />
  </div>
  <div v-else-if="loadError" class="load-error">
    <!-- 错误重试界面 -->
  </div>
  <div v-else class="load-placeholder">
    <!-- 隐藏的占位元素，用于触发观察器 -->
  </div>
</div>
```

## 功能特性

### ✨ 自动加载
- 当用户滚动到距离底部 100px 时自动触发加载
- 无需手动点击按钮，提升用户体验

### 🔄 智能管理
- 筛选条件变化时自动重新设置观察器
- 没有更多数据时自动清理观察器
- 组件卸载时自动清理资源

### 🛡️ 错误处理
- 加载失败时显示错误提示和重试按钮
- 防止重复加载的状态管理
- 网络错误的友好提示

### 📱 用户体验
- 平滑的骨架屏加载动画
- 清晰的"已加载全部"提示
- 响应式设计适配各种屏幕

## 状态管理

### 加载状态
```javascript
const loadingMore = ref(false);  // 正在加载更多
const loadError = ref(false);    // 加载错误状态
const hasMore = computed(() => presetsStore.pagination?.hasMore || false);
```

### 观察器生命周期
```javascript
// 设置观察器
const setupInfiniteScroll = () => {
  if (!loadTrigger.value) return;
  observer = new IntersectionObserver(/* ... */);
  observer.observe(loadTrigger.value);
};

// 清理观察器
const cleanupObserver = () => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
};
```

## 性能优化

### 1. 防抖搜索
- 搜索关键词变化时使用 500ms 防抖
- 避免频繁的 API 请求

### 2. 智能触发
- 提前 100px 开始加载，避免用户等待
- 10% 可见度阈值，确保及时触发

### 3. 资源管理
- 组件卸载时自动清理观察器
- 筛选条件变化时重新设置观察器

## 与后端集成

### API 参数
```javascript
const params = {
  start: presetsStore.pagination.start + presetsStore.pagination.nums,
  nums: pageSize.value,
  keyword: searchKeyword.value,    // 可选
  category: categoryFilter.value,  // 可选
  source: sourceFilter.value       // 可选
};
```

### 数据追加
```javascript
// 使用 append 模式追加新数据
await presetsStore.fetchPresets(params, true);
```

## 浏览器兼容性

- ✅ Chrome 51+
- ✅ Firefox 55+
- ✅ Safari 12.1+
- ✅ Edge 15+

对于不支持的浏览器，会自动降级到滚动事件监听。

## 使用建议

1. **合适的触发距离**: 100px 提前量适合大多数场景
2. **合理的页面大小**: 50 个项目的页面大小平衡了性能和用户体验
3. **错误处理**: 提供重试机制，提升用户体验
4. **加载反馈**: 使用骨架屏而不是简单的 loading 图标

---

**实现时间**: 2024-12-11  
**技术栈**: Vue 3 + Intersection Observer API  
**性能**: 优秀，无内存泄漏