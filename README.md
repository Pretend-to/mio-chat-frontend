# MioChat Frontend — the render layer

> This is the frontend half of **MioChat** (repo: `mio-chat-backend` for the full story). Not a chat skin: it carries half of the harness's context engineering in the browser.

**MioChat Frontend** is a Vue 3 / Vite 8 real-time agent workspace: streaming conversation, tool-call timelines, edit-in-place agent memory, dynamic agent-authored UI (AnyUI), group-context isolation, and a hand-written PWA layer.

## Screenshots

<!-- 图片回填清单：将下列 img src 指向 docs/assets/screenshots/ 下你的实际截图即可。
     已预留桌面端聊天、移动端聊天两个槽位。 -->

<img src="./docs/assets/screenshots/desktop-chat.png" width="720" alt="Desktop chat — streaming output with a tool-call timeline" />

<img src="./docs/assets/screenshots/mobile-chat.png" width="360" alt="Mobile chat interface" />

## What makes it interesting

- **Crash-safe streaming** — a message is only ACKed *after* it survives `localforage` persistence; failed persistence means no ACK so the server keeps the buffer and resyncs. An 80ms `StreamBuffer` throttle batches store writes to avoid Safari OOM on high-frequency repaints.
- **Group-context isolation engine** — one shared message chain, N per-member views. Own turns keep native `assistant` shape; others are packaged into `group_chat_history` XML. Arrays are forced to end on a `user` turn; `@` routing is ID-based (prefix-clash-safe).
- **Client-side memory engineering** — `SystemPromptAssembler` merges persona + global long-term memory + memory crystal into a single system message; `MemoryManager.vue` lets users inspect and edit the five memory zones.
- **Hand-written PWA, no Workbox** — versioned Service Workers (`v4`/`v5`) with a custom IndexedDB response cache (7-day TTL, daily expiry sweep, `CACHE_VERSION=17` migrations, dev-mode handshake).
- **And a few more** — Web Worker chunked MD5 uploads, a bespoke `markdown-it` mention plugin, Shadow-DOM dynamic rendering (`AnyUI`), 20+ interaction composables, and hand-tuned Rolldown code splitting (8 groups) so a 1MB charting lib never leaks into the startup path.

## Tech stack

Vue 3.5 · Vite 8 · Pinia · Element Plus · Socket.io-client · localforage (IndexedDB) · emoji-picker · echarts · mio-previewer · Tauri-ready

## Quick start

```bash
pnpm install
pnpm dev        # http://localhost:1314, proxies /socket.io & /api to the backend (:3080)
```

> Backend + architecture + full README (bilingual): see the `mio-chat-backend` repository.

## License

Pending — unified with the backend repo before the first public release (see the backend README).
