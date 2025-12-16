# Mio Chat Frontend

一个现代化的聊天应用前端，支持多种AI模型和聊天平台，提供流畅的用户体验和丰富的功能。

## 项目介绍

Mio Chat是一个基于Vue 3开发的聊天应用前端，支持连接多种AI聊天平台，包括OpenAI和Onebot。项目采用现代化的前端技术栈，提供了丰富的聊天功能和优雅的用户界面。

## 功能特点

- **多平台支持**：支持OpenAI和Onebot等多种聊天平台
- **实时消息流**：支持流式响应，实时显示AI回复
- **工具调用**：支持AI模型的工具调用功能
- **文件上传**：支持图片和文件的上传和显示
- **消息历史**：保存和管理聊天历史记录
- **自定义头像**：支持多种头像显示策略
- **响应式设计**：适配不同设备屏幕尺寸
- **Markdown支持**：支持Markdown格式的消息渲染
- **消息转发**：支持消息的转发功能
- **上下文菜单**：提供丰富的右键菜单功能
- **离线支持**：通过Service Worker提供部分离线功能
- **日志管理**：实时日志查看、搜索、过滤和导出功能

## 技术栈

- **前端框架**：Vue 3 + Vite
- **状态管理**：Pinia
- **路由管理**：Vue Router
- **UI组件库**：Element Plus
- **样式处理**：Sass
- **存储方案**：LocalForage
- **Markdown渲染**：md-editor-v3
- **表情选择器**：emoji-picker-element
- **截图功能**：html2canvas
- **Web Worker**：用于文件上传处理

## 项目结构

```
src/
├── assets/         # 全局样式和资源
├── components/     # 可复用组件
├── lib/            # 核心库和适配器
│   ├── adapter/    # 平台适配器(OpenAI, Onebot)
│   ├── client.js   # 客户端核心类
│   ├── config.js   # 配置管理
│   ├── contactor.js # 联系人管理
│   └── runtime.js  # 运行时环境
├── router/         # 路由配置
├── utils/          # 工具函数
├── views/          # 页面视图
└── worker/         # Web Worker
```

## 安装步骤

### 环境要求

- Node.js 16+
- pnpm 7+

### 安装依赖

```bash
pnpm install
```

### 开发环境运行

```bash
pnpm dev
```

### 生产环境构建

```bash
pnpm build
```

## 核心模块

### Contactor 类

`contactor.js` 是项目的核心类之一，负责管理聊天联系人和消息处理。它支持不同的聊天平台，并提供统一的消息发送和接收接口。

### 适配器模式

项目使用适配器模式支持不同的聊天平台：

- `openai.js`：处理与OpenAI API的通信
- `onebot.js`：处理与Onebot协议的通信

### 客户端管理

`client.js` 负责管理用户会话、联系人列表和与后端的WebSocket通信。

## 配置说明

项目支持多种配置选项，包括：

- OpenAI模型配置
- Onebot服务器配置
- 显示设置
- 本地预设管理

## 贡献指南

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

[待定] - 请添加适当的许可证信息

---

*最后更新：2024年12月*
