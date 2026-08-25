# MioChat 前端 —— 渲染层（render layer）

> 这是 **MioChat** 的前端半壁（完整叙事见 `mio-chat-backend` 仓库）。它不是聊天皮肤——harness 的上下文工程，有一半发生在浏览器里。

**MioChat 前端** 是一个 Vue 3 / Vite 8 的实时 Agent 工作台：流式对话、工具调用时间线、可视化记忆编辑、Agent 自产 UI 动态渲染（AnyUI）、群聊上下文隔离，以及一套手写的 PWA 层。

## 截图

<!-- 图片回填清单：将下列 img src 指向 docs/assets/screenshots/ 下你的实际截图即可。
     已预留桌面端聊天、移动端聊天两个槽位。 -->

<img src="./docs/assets/screenshots/desktop-chat.png" width="720" alt="桌面端 · 聊天界面（流式输出与工具调用时间线）" />

<img src="./docs/assets/screenshots/mobile-chat.png" width="360" alt="移动端 · 聊天界面" />

## 技术亮点

- **崩溃安全的流式链路** —— 消息先落盘（`localforage`）成功才发 ACK；落盘失败不发 ACK，服务端保留缓存待重同步。`StreamBuffer` 以 80ms 节流批量写 store，防止 Safari 高频重绘 OOM。
- **群聊上下文隔离引擎** —— 一条共享消息链、N 个成员各自的视图。自己的发言保持原生 `assistant` 格式，其他人打包进 `group_chat_history` XML；数组强制以 user 轮收尾；`@` 路由按 ID 解析，从构造上避免前缀误唤起。
- **客户端记忆工程** —— `SystemPromptAssembler` 把人格 + 全局长期记忆 + 结晶记忆合并成唯一一条 system 消息；`MemoryManager.vue` 让用户可视化查看/编辑五个记忆分区。
- **手写 PWA，不用 Workbox** —— 版本化 Service Worker（v4/v5）+ 自研 IndexedDB 响应缓存：7 天 TTL、每日过期清扫、`CACHE_VERSION=17` 迁移、`postMessage` 开发模式握手。
- **还有** —— Web Worker 分块 MD5 上传、自写 markdown-it @提及插件、Shadow DOM 动态渲染（AnyUI）、20+ 交互组合式函数、8 组手调 Rolldown 分包（把 1MB 图表库隔离在启动路径之外）。

## 技术栈

Vue 3.5 · Vite 8 · Pinia · Element Plus · Socket.io-client · localforage（IndexedDB）· emoji-picker · echarts · mio-previewer · 兼容 Tauri

## 快速开始

```bash
pnpm install
pnpm dev        # http://localhost:1314，代理 /socket.io 与 /api 到后端 (:3080)
```

> 后端 + 架构 + 完整 README（双语）见 `mio-chat-backend` 仓库。

## 许可证

待定稿——与后端仓库在首个公开版本发布前统一（见后端 README）。
