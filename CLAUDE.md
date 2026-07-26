# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

Mio-Chat 的 Vue 3 前端，配套后端仓库 `mio-chat-backend`（本机通常在 `../mio-chat-backend`）。

这是作者自用的个人项目，仍在开发阶段，**没有外部用户**。因此：

- 不需要为数据结构变更写迁移脚本，也不需要保留向后兼容分支 —— 直接改到对的形态即可。
- CI 只做构建，不卡合并。直接提交到 `master`，无 PR 流程。
- 反过来说，**没有测试网可以兜底**，所以逻辑改动的正确性完全依赖代码审查和手动验证。

## 命令

```bash
pnpm dev        # vite dev server，端口 1314（不是默认的 5173）
pnpm build      # vite build
pnpm lint       # oxlint --fix .  ← 注意带 --fix，会直接改文件
pnpm format     # prettier --write src/
```

**本仓库没有测试框架**（`package.json` 里没有 `test` 脚本，devDeps 里也没有 vitest/jest）。改动后唯一可用的自动验证是：

```bash
pnpm build && npx oxlint src/
```

`npx oxlint src/` 目前基线是 15 条 warning、0 error，都是既有的未使用 import 和未使用的 catch 参数。**改动后应保持 0 error，且不新增 warning。**

涉及渲染和交互的改动，构建通过不代表正确，需要实际跑起来看。

## 与后端的连接

dev server 把这几个路径代理到 `VITE_API_URL`（默认 `http://127.0.0.1:3080`）：`/socket.io`（含 ws 升级）、`/api`、`/f`、`/p/`。改代理配置在 `vite.config.js`。

生产构建产物直接由后端的 Express 作为静态资源托管（后端仓库的 `dist/`）。

## 架构

### 运行时单例

`src/lib/runtime.js` 导出 `client` 和 `config` 两个单例，**全项目都从这里 import**，不要自己 new。`client.init()` 在模块加载时就跑了。

```
runtime.js  →  client.js (Client 类)  →  websocket.js (Socket 类)
                    ↓
              localforage 持久化
```

### 持久化的两个入口（容易踩）

`client.setLocalStorage` 是 **500ms 防抖**的异步写入；`client.saveNow` 是同一个函数的立即版本（`client.js` 构造函数里绑定）。

高频更新（流式 chunk）用防抖版；**任何"落盘后才能做的事"必须 await `saveNow()`**。典型例子是消息 ACK（见下）。

### 消息收发链路

`src/lib/gateway.js` 是枢纽，两个方向：

**发送** — `gateway.send(platform, ...)` 按平台分流。`platform` 取值 `"openai"` / `"onebot"` / `"group"`。

**接收** — `gateway.handleLlmMessageEvent(e)` 处理后端推来的所有流式事件（`update` / `sync` / `complete` / `failed`），分发进 Pinia。流式文本走 `StreamBuffer`（80ms 节流后批量写 store，防止 Safari 高频重绘 OOM）。

### 上下文组装

三个函数，都在 `gateway.js`：

- `getValidOpenaiMessage(chain, from, max)` — 标准滑动窗口格式化。**assistant 分支是复用重点**：它处理 `tool_calls` 与配对的 `role:"tool"` 消息、`reasoning_content` 独立字段、以及 tool_call 前后的分段。群聊格式化 Agent 自己的历史发言时直接调它，不要另写压平逻辑。
- `getCrystallizationMessages(...)` — 结晶模式下只取结晶点之后的消息。
- `groupGateway.formatGroupMessagesForMember(group, member)` — 群聊专用，见下。

### 群聊（`src/lib/groupGateway.js`）

群聊与单聊的核心差异：**一条共享的 `messageChain`，N 个成员各自看到不同的上下文**。

- **上下文隔离** — 为成员 X 组装时，X 自己的发言走 `getValidOpenaiMessage` 保持原生 assistant 格式；其他人的发言打包进 `<group_chat_history>` XML 作为 `role:"user"`。
- **数组必须以 user 轮结尾** — 若 X 恰好是上一轮最后发言者，数组会以 assistant 收尾，接口直接拒绝。收尾处会补一条 `<group_chat_turn_notice>` 发言邀请。
- **@ 路由按 ID** — `resolveMentionedMembers(text, members)` 是用户侧和 Agent 侧共用的解析器。规范式 `@'名字'(ID)` 以 ID 为准；裸写 `@名字` 要求右边界且长名优先。**绝不要退回 `text.includes('@' + name)`** —— 名字互为前缀时会误唤起多个成员。
- **连锁唤起** — Agent 回复里 @ 别人会触发下一轮。深度记在**消息**上（`message.invocationDepth`），不是群对象上，这样多支线并发时各自独立计数。上限由 `group.maxInvocationDepth` 控制（默认 5，0 为禁用），到顶插入 `mio_system` 提示。

### 记忆结晶

"结晶宿主"是核心抽象（`contactorsStore.getCrystalHost(contactorId, memberId)`）：

- **单聊** — 宿主是联系人本身，结晶在 `contactor.options.crystallization`
- **群聊** — 宿主是**成员**，结晶在 `member.options.crystallization`，另有 `member.lastCompressedIndex` 记录它压缩到了群消息链的哪个下标

两者结晶结构完全一致，所以解析出宿主后下游逻辑通用。群聊时 `memberId` 缺失会返回 `null` 而不是退化到群对象 —— 宁可不写，也不能让各成员记忆串号。

**群聊强制开启结晶，不提供关闭开关**（消息链共享且只增不减，不压缩会无限膨胀）。

水位线由前端下发给后端，逐成员组装：`crystallization_token_watermark` / `previous_summary` / `crystallization_keep_turns`。**后端只管推理，不维护水位线状态。**

`lastCompressedIndex` 是数组下标，消息链一变就会失准 —— `deleteMessage` 和 `clearHistory` 里都有对应的修正逻辑，改动消息链结构时记得同步。

### 消息持久化 ACK

后端把流式内容缓存在 `streamCache` 里，用于断线重连补发。清除缓存的**唯一**入口是前端的 ACK：

```
收到 complete/failed → await client.saveNow() → socket.ackMessage() → 后端 deleteMessage
```

ACK 必须在落盘之后发，否则存在"缓存已清、本地未落盘"的丢失窗口。`gateway.js` 的 `ackPersistedMessage()` 封装了这个顺序，新增触发点走它，不要直接调 `ackMessage`。

### 状态管理

`src/stores/contactorsStore.js` 是主 store（1100+ 行），承载联系人、消息链、结晶、记忆工具落点。其余 store 职责单一，看名字即可。

消息对象的 `role` 取值：`"user"` / `"other"`（AI 回复）/ `"mio_system"`（本地系统提示，**不进 LLM 上下文**）。

群聊消息额外带 `senderMemberId` / `senderName` / `senderAvatar` —— 这些是**发送当时的快照**。渲染时要按 ID 去 `group.members` 里取实时数据（`MessageItem.vue` 的 `replyingMember`），否则改名改模型后界面不更新。

### 输入框

`InputEditor.vue` 是 contenteditable，不是 textarea。命令补全逻辑在 `composables/useInputCommandPopup.js`：

- 触发符 `/` `#` 出工具与技能；`@` 出群成员，**且仅在群聊生效**（`buildTriggerRegex()` 按平台生成）
- 选中后插入一个 `.command-badge` DOM 节点，`data-preset` 存实际要发送的文本，显示文本另存 `data-label`
- `useInputSend.js` 发送时把 badge 还原成 `data-preset` 的内容

群成员 mention 的 `data-preset` 是 `@'名字'(ID)`，显示却是 `@名字` —— 这是 @ 按 ID 路由的实现基础。

## 约定

- ES modules，`@` 别名指向 `src/`
- Vue 3 以 `<script setup>` 为主，但 `ProfileView.vue` 等少数老文件仍是 Options API
- 样式混用 SCSS 和 Sass 缩进语法，跟随所在文件
- **profile 系设置页的共享样式**（`.settings-card` / `.setting-field` / `.field-label` / `.label-hint-icon` / `.mio-hint-popper`）定义在 `ProfileView.vue` 的**非 scoped** `<style>` 块里，被 `ContactorSettings.vue`、`GroupSettingsView.vue`、`MemoryManager.vue` 等子组件共用。改这些类要考虑全部使用方。
- 选项说明统一用 tooltip 图标（`.label-hint-icon` + `el-tooltip`），不要在 `.field-label` 里塞说明文字块 —— 该列桌面仅 14rem、移动端仅 100px，长文案会折成很高一坨。
- 移动端全屏浮层用 `100dvh` 而非 `100vh`（`100vh` 是地址栏收起后的大视口高度，底部内容会被压出屏幕且 fixed 定位滚不到）。

## 已知的坑

- `logger` 在前端不存在（那是后端的全局），调试用 `console`。
- `README.md` 的「项目结构」一节已过时，写的是早已重构掉的 `src/lib/adapter/` 和 `contactor.js`。以本文件为准。
