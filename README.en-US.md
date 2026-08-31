<div align="center">

# 🦞 MioChat Frontend

**English** · [**简体中文**](./README.md)

[![License](https://img.shields.io/badge/License-MIT-green)](#license)
[![Vue](https://img.shields.io/badge/Vue-3.5-42b883)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff)](https://vite.dev/)
[![PWA](https://img.shields.io/badge/PWA-handwritten-yellow)](#what-makes-it-interesting)

**The render layer of a self-hosted agent harness.** The other half lives in [**mio-chat-backend**](https://github.com/Pretend-to/mio-chat-backend).

🖥️ [Backend (Agent OS)](https://github.com/Pretend-to/mio-chat-backend) · 🎨 [Mio-Previewer (MD Renderer)](https://github.com/Pretend-to/mio-previewer) · 🔌 [Plugin Marketplace](https://github.com/Pretend-to/awesome-miochat-plugins)

</div>

This is the frontend half of **MioChat**. Not a chat skin: it carries half of the harness's context engineering in the browser — crash-safe streaming, group-context isolation, client-side memory assembly, agent-authored UI, and a hand-written PWA layer.

## Demo

<img src="./docs/assets/demo/demo.gif" width="720" alt="MioChat Frontend demo" />

## Screenshots

<img src="./docs/assets/screenshots/dashboard.png" width="800" alt="Admin Settings & Observability Dashboard" />

<img src="./docs/assets/screenshots/channels.png" width="800" alt="WeChat Channel & Multi-Platform Gateway" />

<img src="./docs/assets/screenshots/group-chat.png" width="800" alt="Multi-Agent Group Discussion" />

<img src="./docs/assets/screenshots/crystallization.png" width="800" alt="Memory Crystallization & Context Compression" />

<img src="./docs/assets/screenshots/tool-suspend.png" width="800" alt="Sensitive Tool Second Confirmation & Suspension" />

<img src="./docs/assets/screenshots/cron-task.png" width="800" alt="Scheduled Tasks & Autonomous Inspection" />

## Client architecture

<img src="./.github/diagrams/client-architecture.svg" width="860" alt="MioChat Frontend — client dataflow / render layer" />

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
git clone git@github.com:Pretend-to/mio-chat-frontend.git && cd mio-chat-frontend
pnpm install
pnpm dev        # http://localhost:1314, proxies /socket.io & /api to the backend (:3080)
```

Run these checks before submitting changes:

```bash
pnpm test       # Run the Vitest suite
pnpm build      # Create a production build
pnpm lint       # Run oxlint; note that this command includes --fix and edits files
```

For a read-only lint check, run `pnpm exec oxlint .`. Before running the fixing lint command, make sure any worktree changes you want to keep are safely recorded.

> Backend, architecture diagram and the full bilingual README: [**mio-chat-backend**](https://github.com/Pretend-to/mio-chat-backend).

## 🙏 Acknowledgements

Developed with JetBrains' **Open Source Development License** — free professional JetBrains IDE licenses provided for this open-source project.

[![JetBrains](https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.svg)](https://www.jetbrains.com/)

## License

[MIT](LICENSE) — © 2026 MioChat contributors
