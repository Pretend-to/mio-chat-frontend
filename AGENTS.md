# AGENTS.md

> 本文件是 `mio-chat-frontend` 的**唯一权威** Agent 指南（人类协作者同样适用）。
> `CLAUDE.md` 是指向本文件的软链接 —— 读 `AGENTS.md` 或 `CLAUDE.md` 的工具都能命中同一份内容。
> 配套后端仓库 `mio-chat-backend`（本机通常在 `../mio-chat-backend`）。

## 项目定位

Mio-Chat 的 Vue 3 前端。作者自用的个人项目，仍在开发阶段，**没有外部用户**。因此：

- 数据结构变更不需要写迁移脚本，也不必保留向后兼容分支 —— 直接改到对的形态。
- CI 只做构建，不卡合并。主干是 `dev`（`master` 与它保持同步）；仓库里还留有若干历史 `codex/*`、`feat/*` 分支，不要在其上继续开发。
- **没有测试网可以兜底**：自动验证只有构建 + lint，逻辑改动的正确性依赖代码审查和手动验证。

## 红线（动手前先读这一节）

1. **单例只有一个来源**：`src/lib/runtime.js` 导出 `client` / `config`，全项目从那里 import，不要自己 new。
2. **落盘顺序**：任何"落盘后才能做的事"必须 `await client.saveNow()`（`setLocalStorage` 是 500ms 防抖版）。最典型的是消息 ACK —— 见"消息持久化 ACK"。
3. **输入区是 contenteditable，不是 textarea**：所有往编辑区塞内容的动作必须走 `insertAtCursor()`（`composables/useInputCursorAndTextarea.js`），它内部用 `document.execCommand('insertText'/'insertHTML')` —— 只有走浏览器编辑管线才会落在光标处、才能被 Ctrl+Z 撤销。**禁止** `innerHTML +=` 或手工 `insertNode` 插入（不进 undo 栈、丢光标）。
4. **编辑区取文本必须用 `getSafeText(节点)`**：脱离文档的克隆节点 `innerText` 等价 `textContent`，`<br>` / 块级边界带来的换行会全部丢失。`getSafeText` 会把节点挂到离屏位置渲染后再读。
5. **图片尺寸只由一处决定**：`MessageContent.vue::imageSlotStyle`（公式见"图片渲染"）。不要再往 `.image-slot` 内的 `img` 上加 `max-height` 之类的二次上限。
6. **按分支处理构建产物**：`master` 上的前端改动由 GitHub Action 构建并更新后端产物，**不要手动**把 `dist/` 同步到后端；`dev` 上可以在 `pnpm build` 后执行 `rsync -a --delete dist/ ../mio-chat-backend/dist/`，让本地后端使用最新前端构建产物。
7. **HMR 会把中间态实时推给正在运行的页面**：同一处逻辑的"定义 + 调用"不要分两次落盘 —— 曾因此在 `mounted` 里抛 `ReferenceError`，导致 ChatView 初始化中断、消息列表全空（只能硬刷新恢复）。改大块代码要么一次写完，要么先落定义再落调用。

## 命令

```bash
pnpm dev        # vite dev server，端口 1314（不是默认的 5173）
pnpm build      # vite build → dist/
pnpm lint       # oxlint --fix .   ← 注意带 --fix，会直接改文件
pnpm format     # prettier --write src/
pnpm test       # vitest run（见下）
```

**自动验证的现实**：

```bash
pnpm build && npx oxlint src/
```

- oxlint 当前基线是 **17 条 warning、0 error**（既有的未使用 catch 参数等）。改动后应保持 **0 error 且不新增 warning**。
- 仓库里已有 vitest 与若干纯逻辑单测（`src/**/__tests__/*.test.js`，如 `groupGateway`、`agentTurnPayload`、`interactionFrames`）。但 **devDeps 里没有 jsdom / happy-dom**，所以组件与 DOM 行为测不了 —— 涉及渲染和交互的改动，构建通过不代表正确，**必须实际跑起来看**。

## 与后端的连接

dev server（端口 1314）把这几个路径代理到 `VITE_API_URL`（默认 `http://127.0.0.1:3080`）：`/socket.io`（含 ws 升级）、`/api`、`/f`、`/p/`。代理配置在 `vite.config.js`。

生产构建产物直接由后端的 Express 作为静态资源托管（后端仓库的 `dist/`），所以**改完要 rsync 过去**（见红线 6）。

## 架构

### 运行时单例

```
runtime.js  →  client.js (Client 类)  →  websocket.js (Socket 类)
                    ↓
              localforage 持久化
```

`client.init()` 在模块加载时就跑了。

### 持久化的两个入口（容易踩）

`client.setLocalStorage` 是 **500ms 防抖**的异步写入；`client.saveNow` 是同一函数的立即版本。高频更新（流式 chunk）用防抖版；**任何"落盘后才能做的事"必须 await `saveNow()`**。

### 消息收发链路

`src/lib/gateway.js` 是枢纽，两个方向：

**发送** — `gateway.send(platform, ...)` 按平台分流，`platform` 取值 `"openai"` / `"onebot"` / `"group"`。

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

`lastCompressedIndex` 是数组下标，消息链一变就会失准 —— `deleteMessage` 和 `clearHistory` 里都有对应修正逻辑，改动消息链结构时记得同步。

### 消息持久化 ACK

后端把流式内容缓存在 `streamCache` 里，用于断线重连补发。清除缓存的**唯一**入口是前端的 ACK：

```
收到 complete/failed → await client.saveNow() → socket.ackMessage() → 后端 deleteMessage
```

ACK 必须在落盘之后发，否则存在"缓存已清、本地未落盘"的丢失窗口。`gateway.js` 的 `ackPersistedMessage()` 封装了这个顺序，新增触发点走它，不要直接调 `ackMessage`。

### 状态管理

`src/stores/contactorsStore.js` 是主 store（1000+ 行），承载联系人、消息链、结晶、记忆工具落点。其余 store 职责单一，看名字即可。

消息对象的 `role` 取值：`"user"` / `"other"`（AI 回复）/ `"mio_system"`（本地系统提示，**不进 LLM 上下文**）。

群聊消息额外带 `senderMemberId` / `senderName` / `senderAvatar` —— 这些是**发送当时的快照**。渲染时要按 ID 去 `group.members` 里取实时数据（`MessageItem.vue` 的 `replyingMember`），否则改名改模型后界面不更新。

### 输入区（contenteditable）

`InputEditor.vue` 是 contenteditable。命令补全逻辑在 `composables/useInputCommandPopup.js`：触发符 `/` `#` 出工具与技能，`@` 出群成员且**仅在群聊生效**（`buildTriggerRegex()` 按平台生成）；选中后插入 `.command-badge` DOM 节点，`data-preset` 存实际要发送的文本，显示文本另存 `data-label`；`useInputSend.js` 发送时把 badge 还原成 `data-preset`。群成员 mention 的 `data-preset` 是 `@'名字'(ID)`，显示却是 `@名字` —— 这是 @ 按 ID 路由的实现基础。

**插入与撤销的唯一入口是 `insertAtCursor(content, { html })`**（`useInputCursorAndTextarea.js`）：

- 内部优先 `document.execCommand`（deprecated 但唯一能进浏览器 undo 栈的插入方式），失败才退回手工 range 插入；表情、粘贴文字、图片插入都走它。
- 光标由 `selectionchange` 持续记忆（`savedRange`）：点表情面板、点预设按钮会让焦点离开编辑区，`window.getSelection()` 就指不到编辑区了，插入前要 `focusEditorAtCursor()` 还原。
- 粘贴走**纯文本原样插入**，不要做 HTML 转义 / 空格替换 / `\n → <br>` 之类的加工；编辑区样式保持 `white-space: pre-wrap`（否则缩进和多空格被折叠，markdown 会变样）。
- 取文本用 `getSafeText(节点)`（见红线 4）。

### 图片渲染（`.image-slot`）

图片元素（OneBot 图片、粘贴/上传的图）走 `MessageContent.vue` 的 `.image-slot` 包装，目标是**图片解码前就把高度留对**（避免气泡突然长高、滚动位置跳动）：

1. **先量后插**：`src/lib/imageSize.js` 预加载读 `naturalWidth/naturalHeight`（带 URL 缓存 + 800ms 超时），`gateway.js::patchImageSizes` 把 `{width,height}` patch 回消息元素。
2. **预留盒子**：

```js
// MessageContent.vue::imageSlotStyle
fittedWidth = Math.min(自然宽, 540, 520 * (自然宽 / 自然高));
// 只写 width + aspect-ratio，不要再写 max-height
```

确定宽度 + `max-height` 会让 `aspect-ratio` 无法回缩宽度，比例被破坏 → `object-fit: contain` 左右补白。未量到尺寸时用 4:3 占位 + shimmer。

3. 内部 `img` 绝对定位填满盒子；`_common.scss` 里 `.content > .inner-content img { max-width/max-height: 20rem }` 会**二次限制**它，已在同文件用更高优先级的选择器排除 `.image-slot` —— 别把那两条合并回去。
4. 内容异步变高（图片/代码块/mermaid/工具条）时的自动跟随靠 `ChatView.vue` 里 `messagesInner` 的 **ResizeObserver**（`autoScroll` 为真时贴底），不依赖 `img load` 事件。

### 悬浮按钮定位

滚动到底等悬浮按钮的位置若依赖布局高度（如输入框高度），**不要只在 `onMounted` 算一次**：输入框长高会把按钮盖住。用 `ResizeObserver` 盯住 `.input-bar` 实时重算（`ChatView.vue::updateInputBarTop`）。

## 约定

- ES modules，`@` 别名指向 `src/`。
- Vue 3 以 `<script setup>` 为主，但 `ProfileView.vue` 等少数老文件仍是 Options API。
- 样式混用 SCSS 和 Sass 缩进语法，跟随所在文件。
- **profile 系设置页的共享样式**（`.settings-card` / `.setting-field` / `.field-label` / `.label-hint-icon` / `.mio-hint-popper`）定义在 `ProfileView.vue` 的**非 scoped** `<style>` 块里，被 `ContactorSettings.vue`、`GroupSettingsView.vue`、`MemoryManager.vue` 等子组件共用。改这些类要考虑全部使用方。
- 选项说明统一用 tooltip 图标（`.label-hint-icon` + `el-tooltip`），不要在 `.field-label` 里塞说明文字块 —— 该列桌面仅 14rem、移动端仅 100px，长文案会折成很高一坨。
- 移动端全屏浮层用 `100dvh` 而非 `100vh`（`100vh` 是地址栏收起后的大视口高度，底部内容会被压出屏幕且 fixed 定位滚不到）。

## 已知的坑

- **生产环境不能让 SW / index.html 长缓存**：SW 的脚本 URL 是固定的，一旦被 CDN 或源站用 `max-age=604800` 缓存，设备就永远拿不到新 SW（曾导致移动端 PWA 卡在旧版本、旧 shell 指向已删除的 chunk → 白屏）。
  代码侧已有防护：注册 URL 带「SW 内容哈希」（`?v=`，见 `vite.config.js` 的 `VITE_SW_VERSION`），SW 一改 URL 就变，可绕过陈旧边缘缓存；但 `index.html` 仍必须由服务端返回 `no-cache`（后端已如此，生产反代/CDN 需一致）。
- 前端**没有** `logger`（那是后端的全局），调试用 `console`。
- `README.md` / `README.en-US.md` 面向使用者（介绍 + 「类型清单」），本文件面向改动者（约定 + 红线）。**README 里的类型清单与规模数字是手工维护的，改代码时记得同步**。
- `pnpm lint` 带 `--fix`：在未提交的改动上跑它可能顺带改到别的文件，注意 `git diff`。
- HMR 会把中间态推给运行中的页面（见红线 7）：如果刚改完页面报"某个标识符未定义"而代码里明明有，先硬刷新再判断。
