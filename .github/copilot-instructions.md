# Mio Chat Frontend — Copilot Instructions

## 项目架构与核心知识

- 本项目为 Vue 3 + Vite 构建的多平台聊天前端，核心目录为 `src/`。
- 主要服务于多种 AI 聊天平台（如 OpenAI、Onebot），通过适配器模式实现平台解耦。
- 关键模块：
  - `src/lib/client.js`：管理用户会话、联系人列表、WebSocket 通信。
  - `src/lib/contactor.js`：统一管理联系人与消息收发，支持多平台。
  - `src/lib/adapter/openai.js`、`src/lib/adapter/onebot.js`：分别对接 OpenAI 和 Onebot 协议。
  - `src/lib/config.js`：集中管理配置项（模型、服务器、显示等）。
- 组件（`src/components/`）和页面视图（`src/views/`）均采用 Vue 单文件组件，配合 Pinia 状态管理和 Vue Router。
- 样式统一采用 Sass，入口为 `src/assets/global.sass`。
- 文件上传、消息流等异步任务通过 Web Worker（`src/worker/`）处理。

## 开发与构建流程

- 依赖管理：使用 `pnpm`，需 Node.js 16+。
- 启动开发环境：`pnpm dev`
- 构建生产环境：`pnpm build`
- 主要配置文件：`vite.config.js`、`eslint.config.cjs`、`package.json`
- 本地存储方案采用 LocalForage，消息历史与预设均存储于本地。

## 约定与模式

- 平台适配统一走 `src/lib/adapter/`，新增平台需实现同名适配器并在 `contactor.js` 注册。
- 所有消息收发逻辑集中于 `contactor.js`，避免在组件中直接操作底层通信。
- 配置项变更应通过 `config.js`，避免硬编码。
- 组件命名采用 PascalCase，工具函数放于 `src/utils/`，页面视图放于 `src/views/`。
- 样式变量、全局样式统一在 `global.sass` 管理。

## 调试与扩展

- 推荐在浏览器 DevTools 中调试，WebSocket 日志可在 `client.js` 跟踪。
- 新增聊天平台时，参考 `openai.js` 和 `onebot.js` 适配器实现。
- 贡献流程遵循 README 指南，建议分支开发并提交 Pull Request。

## 参考文件
- `README.md`：项目结构、核心模块、开发流程说明
- `src/lib/contactor.js`、`src/lib/client.js`、`src/lib/adapter/`：核心业务逻辑
- `src/components/`、`src/views/`：UI 组件与页面结构
- `vite.config.js`、`eslint.config.cjs`：构建与代码规范

---
如有不清楚或遗漏的部分，请反馈以便补充完善。
