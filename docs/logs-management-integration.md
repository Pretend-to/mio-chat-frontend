# 日志管理集成指南

本文档说明如何将日志管理功能集成到 MIO Chat 前端应用中。

## 已实现的功能

### 1. 日志管理界面 (`src/views/settings/LogsView.vue`)

- **实时日志查看**: 通过 Socket.IO 连接实时接收日志流
- **日志过滤**: 支持按级别、模块、关键词过滤
- **日志搜索**: 支持历史日志搜索
- **日志导出**: 支持导出为 JSON、CSV、TXT 格式
- **连接状态监控**: 显示连接状态和统计信息
- **响应式设计**: 支持桌面端和移动端

### 2. 日志查看器 Composable (`src/composables/useLogViewer.js`)

- **复用现有连接**: 复用 `client.socket` 的 Socket.IO 连接，避免重复连接
- **消息处理**: 处理各种日志协议消息
- **状态管理**: 管理连接状态、订阅状态、日志数据
- **API 封装**: 封装所有日志 API 调用
- **智能监听**: 动态添加和移除日志消息监听器

### 3. 设置页面集成

- 在设置菜单中添加了"日志管理"选项
- 配置了相应的路由
- 使用 Tickets 图标标识

## 使用方法

### 1. 访问日志管理

1. 进入设置页面 (`/settings`)
2. 点击侧边栏的"日志管理"
3. 或直接访问 `/settings/logs`

### 2. 基本操作

#### 连接和订阅
```javascript
// 自动连接到日志服务器
// 连接信息从 configStore 获取

// 开始订阅日志
await subscribe({
  level: 'INFO',        // 日志级别
  modules: ['llm'],     // 模块过滤
  realtime: true,       // 实时推送
  bufferSize: 1000,     // 缓冲区大小
  sendHistory: true     // 发送历史日志
})
```

#### 搜索日志
```javascript
const results = await search({
  keyword: 'error',
  level: 'ERROR',
  modules: ['llm'],
  page: 1,
  pageSize: 50
})
```

#### 导出日志
```javascript
const exportData = await exportLogs({
  format: 'json',
  level: 'ERROR',
  maxRecords: 10000,
  includeMetadata: true
})
```

## 后端集成要求

### 1. Socket.IO 服务器扩展

需要在现有的 Socket.IO 服务器中添加日志协议支持，参考 `docs/logs-api.md` 中的 API 规范。

### 2. 协议扩展

在现有的消息处理中添加日志协议：
```javascript
// 在 websocket.js 的 messageHandler 中添加
if (e.protocol === "logs") {
  this.emit("logs_message", e);
}
```

### 3. 消息格式

所有消息都使用 JSON 格式，包含以下字段：
- `request_id`: 请求唯一标识
- `protocol`: 固定为 'logs'
- `type`: 消息类型
- `data`: 消息数据

## 配置说明

### 1. 连接复用

日志管理复用现有的 Socket.IO 连接：
```javascript
// 复用 client.socket 连接
const socket = computed(() => client.socket)
const isConnected = computed(() => client.isConnected)
```

### 2. 消息监听

动态添加日志消息监听器：
```javascript
// 添加日志消息监听器
socket.value.socket.on('message', logMessageHandler)

// 清理时移除监听器
socket.value.socket.off('message', logMessageHandler)
```

## 错误处理

### 1. 连接错误
- 自动重连机制
- 连接状态指示
- 错误消息提示

### 2. API 错误
- 请求超时处理
- 错误响应处理
- 用户友好的错误提示

### 3. 数据处理
- 日志缓存大小限制
- 内存泄漏防护
- 异常数据过滤

## 性能优化

### 1. 前端优化
- 虚拟滚动（可选）
- 日志缓存限制（2000条）
- 防抖搜索
- 懒加载导出

### 2. 网络优化
- 心跳检测（30秒间隔）
- 请求超时控制
- 连接复用

## 移动端适配

- 响应式布局
- 触摸友好的交互
- 移动端优化的控件大小
- 简化的操作流程

## 开发调试

### 1. 本地开发

如果后端日志服务未启动，前端会显示"未连接"状态，但不会影响其他功能。

### 2. 模拟数据

可以在 `useLogViewer.js` 中添加模拟数据用于开发测试：

```javascript
// 开发模式下的模拟数据
if (import.meta.env.DEV) {
  // 添加模拟日志数据
  const mockLogs = [
    {
      id: 'mock_1',
      timestamp: new Date().toISOString(),
      level: 'INFO',
      module: 'llm',
      message: '这是一条模拟日志消息',
      caller: 'mock.js:1'
    }
  ]
  logs.value.push(...mockLogs)
}
```

## 扩展功能

### 1. 日志分析
- 日志统计图表
- 错误趋势分析
- 性能指标监控

### 2. 高级过滤
- 正则表达式搜索
- 时间范围选择
- 自定义过滤规则

### 3. 通知功能
- 错误日志通知
- 关键事件提醒
- 邮件/短信通知

## 注意事项

1. **权限控制**: 日志管理功能仅限管理员使用
2. **性能影响**: 大量日志可能影响前端性能，需要合理控制缓存大小
3. **安全考虑**: 日志可能包含敏感信息，需要注意数据保护
4. **网络稳定性**: 实时日志依赖网络连接，需要处理断线重连
5. **浏览器兼容性**: Socket.IO 需要现代浏览器支持

## 故障排除

### 1. 连接失败
- 检查服务器地址和端口配置
- 验证管理员访问码
- 检查网络连接

### 2. 日志不显示
- 确认已成功订阅
- 检查过滤条件
- 验证日志级别设置

### 3. 导出失败
- 检查导出参数
- 确认有足够的日志数据
- 验证浏览器下载权限