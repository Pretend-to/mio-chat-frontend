<script>
import { useStatusBarColor } from "@/composables/useStatusBarColor";

export default {
  name: "EcosystemView",
  setup() {
    useStatusBarColor("var(--mio-bg-page)");
  },
  data() {
    return {
      onPhone: window.innerWidth < 768,
      activeHighlight: 0,

      // Modules Data
      modules: [
        {
          id: "01",
          title: "Mio-Chat Backend",
          repoName: "Pretend-to/mio-chat-backend",
          desc: "系统核心底层运行时，提供 AOP Hooks 生命周期钩子拦截机制、MCP 协议支持以及 Native 插件热重载架构。",
          githubUrl: "https://github.com/Pretend-to/mio-chat-backend",
          badge: "core runtime",
          status: "active",
        },
        {
          id: "02",
          title: "Mio-Chat Frontend",
          repoName: "Pretend-to/mio-chat-frontend",
          desc: "基于 Vue 3 + Element Plus 的沉浸式多功能聊天工作区，集成富文本编辑器、截图预览分享、动态侧边滑栏等组件。",
          githubUrl: "https://github.com/Pretend-to/mio-chat-frontend",
          badge: "vue3 workspace",
          status: "active",
        },
        {
          id: "03",
          title: "Mio-Previewer",
          repoName: "Pretend-to/mio-previewer",
          desc: "深度优化流式渲染（Streaming）的 Markdown 引擎，内建 LaTeX 数学公式、Mermaid 图表渲染和交互式 Artifacts 沙箱。",
          githubUrl: "https://github.com/Pretend-to/mio-previewer",
          badge: "markdown engine",
          status: "active",
        },
        {
          id: "04",
          title: "Awesome Plugins",
          repoName: "Pretend-to/awesome-miochat-plugins",
          desc: "官方与社区生态的通用扩展集合。沉淀行业专家经验的 Skills 策略包以及针对特定 OS/硬件桥接的钩子拦截脚本。",
          githubUrl: "https://github.com/Pretend-to/awesome-miochat-plugins",
          badge: "plugins market",
          status: "ready",
        },
      ],

      // Highlights text
      highlights: [
        {
          title: "上下文压缩系统",
          tag: "Token Compressor",
          desc: "针对复杂工程约束深度优化的上下文缩减机制。采用基于 XML 区块的结构化分析与语义提炼算法，在完全保留系统提示语与任务上下文完整性的前提下，过滤聊天冗余，将 Token 消耗最高降低 80% 以上，极大提升 API 响应效率并节省运行成本。",
        },
        {
          title: "真实环境桥接 (OS Bridge)",
          tag: "Pty & OS Terminal",
          desc: "连接虚拟 Agent 与真实物理系统的通道。内置基于 node-pty 的双向伪终端，配合操作系统视觉桥接驱动，允许 AI 代理像真人开发人员一般执行 Bash 指令、运行编译脚本，甚至在受控沙箱中执行文件修改与网页浏览。",
        },
        {
          title: "三层开放插件体系",
          tag: "Plugin Architecture",
          desc: "为 AI 注入无限专业能力的插拔式架构。分为三级阶梯：以自然语言编写的 Skills 专家策略包、遵循行业统一标准的 MCP（Model Context Protocol）网络插件协议、以及支持运行时动态插拔与热重载的 Node.js 原生插件，支持自主加载、按需装配。",
        },
        {
          title: "预设双源与 Hook 机制",
          tag: "AOP Filter Pipeline",
          desc: "构筑底层安全的切面过滤阀。将系统预设与用户自定义配置在物理层实施隔离，在对话流转、工具执行等各个核心事件节点注入类似 Koa 的切面拦截机制（Hooks），无缝实现全局防注入、敏感词过滤、安全审计及权限拦截。",
        },
      ],

      // Simulator states for OS Bridge (Terminal mockup)
      terminalLogs: [],

      // Simulator states for Compressor mockup
      compressionRatio: 100,
    };
  },
  watch: {
    activeHighlight: {
      handler(newVal) {
        if (newVal === 0) {
          this.clearTerminalTimers();
          this.startCompressionSimulation();
        } else if (newVal === 1) {
          this.clearCompressorTimers();
          this.startTerminalSimulation();
        } else {
          this.clearTerminalTimers();
          this.clearCompressorTimers();
        }
      },
      immediate: true,
    },
  },
  mounted() {
    this.resizeHandler = () => {
      this.onPhone = window.innerWidth < 768;
    };
    window.addEventListener("resize", this.resizeHandler);
  },
  beforeUnmount() {
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }
    this.clearTerminalTimers();
    this.clearCompressorTimers();
  },
  methods: {
    selectHighlight(index) {
      this.activeHighlight = index;
    },
    clearTerminalTimers() {
      if (this.terminalTimeoutId) {
        clearTimeout(this.terminalTimeoutId);
        this.terminalTimeoutId = null;
      }
      if (this.terminalIntervalId) {
        clearInterval(this.terminalIntervalId);
        this.terminalIntervalId = null;
      }
    },
    clearCompressorTimers() {
      if (this.compressorTimeoutId) {
        clearTimeout(this.compressorTimeoutId);
        this.compressorTimeoutId = null;
      }
    },
    // OS Bridge Mock Terminal Simulation
    startTerminalSimulation() {
      this.clearTerminalTimers();
      const script = [
        { type: "input", text: 'opencli run "npm run dev"' },
        { type: "log", text: "› [System] Initializing OS bridge loop..." },
        { type: "log", text: "› [Pty] Spawned node-pty terminal [PID: 28912]" },
        { type: "log", text: "› [Dev] Executing: vite dev-server..." },
        {
          type: "success",
          text: "✔ [Success] Server active on http://localhost:5173",
        },
        {
          type: "success",
          text: "✔ [Agent] Terminal session hijacked successfully.",
        },
      ];

      this.terminalLogs = [];
      let step = 0;

      const runStep = () => {
        if (step < script.length) {
          const item = script[step];
          if (item.type === "input") {
            let typedText = "";
            let charIndex = 0;
            const textToType = item.text;

            this.terminalLogs.push({ type: "input", text: "$ " });
            const logIndex = this.terminalLogs.length - 1;

            this.terminalIntervalId = setInterval(() => {
              if (charIndex < textToType.length) {
                typedText += textToType[charIndex];
                if (this.terminalLogs[logIndex]) {
                  this.terminalLogs[logIndex].text = "$ " + typedText;
                }
                charIndex++;
              } else {
                clearInterval(this.terminalIntervalId);
                this.terminalIntervalId = null;
                step++;
                this.terminalTimeoutId = setTimeout(runStep, 400);
              }
            }, 50);
          } else {
            this.terminalLogs.push({ type: item.type, text: item.text });
            step++;
            this.terminalTimeoutId = setTimeout(runStep, 800);
          }
        } else {
          this.terminalTimeoutId = setTimeout(() => {
            this.terminalLogs = [];
            step = 0;
            runStep();
          }, 3500);
        }
      };

      runStep();
    },
    // Context Compressor Simulation
    startCompressionSimulation() {
      this.clearCompressorTimers();
      let compressing = true;
      const animate = () => {
        if (compressing) {
          if (this.compressionRatio > 20) {
            this.compressionRatio -= 2;
            this.compressorTimeoutId = setTimeout(animate, 40);
          } else {
            compressing = false;
            this.compressorTimeoutId = setTimeout(animate, 3000);
          }
        } else {
          if (this.compressionRatio < 100) {
            this.compressionRatio += 4;
            this.compressorTimeoutId = setTimeout(animate, 20);
          } else {
            compressing = true;
            this.compressorTimeoutId = setTimeout(animate, 1500);
          }
        }
      };
      animate();
    },
  },
};
</script>

<template>
  <div class="mio-ecosystem-view">
    <div class="editorial-container">
      <!-- Asymmetric Editorial Hero -->
      <header class="editorial-hero">
        <div class="hero-left">
          <h1 class="hero-title">
            MioChat<br />Ecosystem<span class="dot">.</span>
          </h1>
        </div>
        <div class="hero-right">
          <p class="hero-lead">
            不仅仅是对话转发，更是下一代轻量化 Agent 操作系统。
          </p>
          <p class="hero-body">
            构建在切面拦截与真实环境桥接之上的多端智能 network。
            将复杂的多代理生态提炼为高度一致的生产力工具集。
          </p>
        </div>
      </header>

      <div class="divider-line"></div>

      <!-- Section: Ecosystem Nodes -->
      <section class="editorial-section">
        <div class="section-header">
          <span class="section-label">01 // THE COMPONENT NODES</span>
          <h2 class="section-title">生态全景家族</h2>
        </div>

        <div class="nodes-grid">
          <div v-for="mod in modules" :key="mod.id" class="node-card">
            <div class="card-header">
              <span class="card-number">{{ mod.id }}</span>
              <span class="card-badge" :class="mod.status">{{
                mod.badge
              }}</span>
            </div>

            <div class="card-content">
              <h3 class="card-title">{{ mod.title }}</h3>
              <p class="card-repo">{{ mod.repoName }}</p>
              <p class="card-desc">{{ mod.desc }}</p>
            </div>

            <div class="card-footer">
              <a :href="mod.githubUrl" target="_blank" class="card-link">
                <span>View Source</span>
                <span class="arrow">→</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <div class="divider-line"></div>

      <!-- Section: Core Highlights (Interactive Split Console) -->
      <section class="editorial-section">
        <div class="section-header">
          <span class="section-label">02 // ARCHITECTURE HIGHLIGHTS</span>
          <h2 class="section-title">核心设计特色</h2>
        </div>

        <div class="highlights-panel">
          <!-- Left: Tab Selectors -->
          <div class="highlights-nav">
            <button
              v-for="(hl, idx) in highlights"
              :key="idx"
              class="nav-tab-btn"
              :class="{ active: activeHighlight === idx }"
              @click="selectHighlight(idx)"
            >
              <span class="tab-index">{{
                String(idx + 1).padStart(2, "0")
              }}</span>
              <div class="tab-meta">
                <span class="tab-title">{{ hl.title }}</span>
                <span class="tab-tag">{{ hl.tag }}</span>
              </div>
            </button>
          </div>

          <!-- Right: Visualizer Telemetry (Editorial Schematics) -->
          <div class="highlights-visualizer">
            <div class="visualizer-content">
              <div class="visualizer-header">
                <span class="visualizer-tag"
                  >TELEMETRY_STREAM // SYSTEM_MOCK</span
                >
                <span class="visualizer-status">RUNNING</span>
              </div>

              <!-- Telemetry Pane 0: Context Compressor -->
              <div
                v-if="activeHighlight === 0"
                class="telemetry-pane compression-pane"
              >
                <div class="compressor-blocks">
                  <div class="token-source-block block-frame">
                    <span class="block-label">RAW SESSION DATA</span>
                    <div class="fake-tokens original">
                      <div
                        v-for="i in 18"
                        :key="i"
                        class="token-chip"
                        :style="{ opacity: 0.2 + (i % 6) * 0.15 }"
                      >
                        TOK_{{ 1000 + i }}
                      </div>
                    </div>
                    <span class="block-footer">120,400 Tokens (100%)</span>
                  </div>

                  <div class="compressor-flow">
                    <div class="flow-arrow">→</div>
                    <div class="ratio-badge">
                      -{{ 100 - compressionRatio }}%
                    </div>
                  </div>

                  <div
                    class="token-dest-block block-frame"
                    :style="{ height: 35 + compressionRatio * 0.65 + '%' }"
                  >
                    <span class="block-label">COMPRESSED PAYLOAD</span>
                    <div class="fake-tokens compressed">
                      <div
                        v-for="i in 5"
                        :key="i"
                        class="token-chip highlight"
                        :style="{
                          transform: `scale(${0.8 + compressionRatio / 200})`,
                        }"
                      >
                        CTX_XML_{{ i }}
                      </div>
                    </div>
                    <span class="block-footer">24,080 Tokens (20%)</span>
                  </div>
                </div>
              </div>

              <!-- Telemetry Pane 1: OS Bridge -->
              <div
                v-if="activeHighlight === 1"
                class="telemetry-pane terminal-pane"
              >
                <div class="terminal-mock">
                  <div class="terminal-body">
                    <div
                      v-for="(line, idx) in terminalLogs"
                      :key="idx"
                      class="terminal-line"
                      :class="line.type"
                    >
                      {{ line.text }}
                    </div>
                    <div class="terminal-line active-line">
                      <span class="cursor">_</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Telemetry Pane 2: Plugin Architecture -->
              <div
                v-if="activeHighlight === 2"
                class="telemetry-pane plugins-pane"
              >
                <div class="plugins-diagram">
                  <div class="diagram-node level-1">
                    <div class="node-inner">
                      <span class="node-level">Level 01</span>
                      <span class="node-name">Skills (专家策略包)</span>
                      <span class="node-details"
                        >YAML Frontmatter / Prompt Injectors</span
                      >
                    </div>
                  </div>
                  <div class="diagram-connector">⋮</div>
                  <div class="diagram-node level-2">
                    <div class="node-inner">
                      <span class="node-level">Level 02</span>
                      <span class="node-name">MCP (模型上下文协议)</span>
                      <span class="node-details"
                        >Standard Server Hooks / JSON-RPC</span
                      >
                    </div>
                  </div>
                  <div class="diagram-connector">⋮</div>
                  <div class="diagram-node level-3">
                    <div class="node-inner">
                      <span class="node-level">Level 03</span>
                      <span class="node-name">Native Plugins (二进制重载)</span>
                      <span class="node-details"
                        >Node.js Lifecycle Hooks / AOP Execution</span
                      >
                    </div>
                  </div>
                </div>
              </div>

              <!-- Telemetry Pane 3: Preset & Hook System -->
              <div
                v-if="activeHighlight === 3"
                class="telemetry-pane hook-pane"
              >
                <div class="hook-pipeline">
                  <div class="pipeline-step step-input">
                    <span class="step-num">01</span>
                    <span class="step-name">Event Dispatch</span>
                    <span class="step-val">Dialog / Tool Trigger</span>
                  </div>
                  <div class="pipeline-connector">⟶</div>
                  <div class="pipeline-step step-hook pre">
                    <span class="step-num">02</span>
                    <span class="step-name">Pre-Hook Intercept</span>
                    <span class="step-val">Security / Token Compression</span>
                  </div>
                  <div class="pipeline-connector">⟶</div>
                  <div class="pipeline-step step-core">
                    <span class="step-num">03</span>
                    <span class="step-name">Execution</span>
                    <span class="step-val">Main LLM / Function Call</span>
                  </div>
                  <div class="pipeline-connector">⟶</div>
                  <div class="pipeline-step step-hook post">
                    <span class="step-num">04</span>
                    <span class="step-name">Post-Hook Audit</span>
                    <span class="step-val">Safety Filtering / Format Fix</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="highlight-explanation">
              <p class="explanation-text">
                {{ highlights[activeHighlight].desc }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div class="divider-line"></div>

      <!-- Section: Footer / Editorial Call to Action -->
      <footer class="editorial-footer">
        <div class="footer-wrap">
          <div class="footer-heading">
            <h2 class="footer-title">🤝 Joint Development.</h2>
            <p class="footer-subtitle">
              我们相信开放共享的生态力量。欢迎共同建设下一代 Agent
              运行标准，分享您的 Skills、MCP 协议或贡献预览渲染核心。
            </p>
          </div>

          <div class="footer-actions">
            <a
              href="https://github.com/Pretend-to/mio-chat-backend"
              target="_blank"
              class="footer-btn"
            >
              <span>贡献 Plugin/Hook</span>
              <span class="arrow">→</span>
            </a>
            <a
              href="https://github.com/Pretend-to/mio-previewer"
              target="_blank"
              class="footer-btn outline"
            >
              <span>贡献 MD 渲染器</span>
              <span class="arrow">→</span>
            </a>
          </div>
        </div>

        <div class="footer-copyright">
          <span class="copyright-text"
            >© 2026 Mio-Chat Team. Licensed under MIT.</span
          >
          <span class="edition-tag">FIRST EDITION // V0.1</span>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap");

.mio-ecosystem-view {
  flex-grow: 1;
  height: 100%;
  width: 100%;
  background-color: var(--mio-bg-page);
  overflow-y: auto;
  box-sizing: border-box;
  font-family: "Plus Jakarta Sans", sans-serif;
  color: var(--mio-text-primary);
  -webkit-font-smoothing: antialiased;
}

.editorial-container {
  max-width: 68rem;
  margin: 0 auto;
  padding: 4rem 2rem 5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 4rem;
  box-sizing: border-box;
}

/* Divider Lines */
.divider-line {
  height: 1px;
  background-color: var(--mio-border-color-light);
  width: 100%;
}

/* Asymmetric Hero */
.editorial-hero {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 3rem;
  align-items: start;
  margin-top: 1rem;
}

.hero-title {
  font-family: "Lora", serif;
  font-size: 3.5rem;
  font-weight: 600;
  line-height: 1.1;
  margin: 0;
  letter-spacing: -0.03em;
  color: var(--mio-text-primary);
}

.hero-title .dot {
  color: var(--mio-color-primary);
}

.hero-lead {
  font-family: "Lora", serif;
  font-size: 1.4rem;
  font-style: italic;
  line-height: 1.5;
  color: var(--mio-text-primary);
  margin: 0 0 1.5rem 0;
  font-weight: 400;
}

.hero-body {
  font-size: 0.95rem;
  line-height: 1.8;
  color: var(--mio-text-regular);
  margin: 0;
}

/* Section Header */
.editorial-section {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--mio-text-secondary);
}

.section-title {
  font-family: "Lora", serif;
  font-size: 2rem;
  font-weight: 500;
  margin: 0;
  color: var(--mio-text-primary);
}

/* Nodes Grid */
.nodes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
}

.node-card {
  background-color: var(--mio-bg-card);
  border: 1px solid var(--mio-border-color-light);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 14rem;
  box-sizing: border-box;
  transition:
    border-color var(--mio-transition-fast),
    background-color var(--mio-transition-fast);
}

.node-card:hover {
  border-color: var(--mio-text-secondary);
  background-color: var(--mio-bg-hover);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.card-number {
  font-family: "Lora", serif;
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--mio-text-secondary);
}

.card-badge {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid var(--mio-border-color-light);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  color: var(--mio-text-regular);
}

.card-badge.active {
  color: var(--mio-color-success);
  border-color: var(--mio-color-success);
}

.card-title {
  font-family: "Lora", serif;
  font-size: 1.25rem;
  font-weight: 500;
  margin: 0 0 0.4rem 0;
  color: var(--mio-text-primary);
}

.card-repo {
  font-size: 0.8rem;
  color: var(--mio-text-secondary);
  font-family: "JetBrains Mono", monospace;
  margin: 0 0 1rem 0;
}

.card-desc {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--mio-text-regular);
  margin: 0;
}

.card-footer {
  margin-top: 1.5rem;
}

.card-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--mio-text-primary);
  text-decoration: none;
}

.card-link .arrow {
  transition: transform 0.2s ease;
}

.node-card:hover .card-link .arrow {
  transform: translateX(4px);
}

/* Highlights Section (Asymmetric Split Panel) */
.highlights-panel {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 3rem;
  align-items: start;
}

.highlights-nav {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--mio-border-color-light);
}

.nav-tab-btn {
  display: flex;
  align-items: flex-start;
  gap: 1.2rem;
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  margin-left: -1px;
  padding: 1.25rem 1.5rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-tab-btn:hover {
  background-color: var(--mio-bg-hover);
}

.nav-tab-btn.active {
  border-left: 2px solid var(--mio-text-primary);
  background-color: var(--mio-bg-card);
}

.tab-index {
  font-family: "Lora", serif;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--mio-text-secondary);
  margin-top: 0.1rem;
}

.nav-tab-btn.active .tab-index {
  color: var(--mio-color-primary);
}

.tab-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.tab-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--mio-text-primary);
}

.tab-tag {
  font-size: 0.75rem;
  color: var(--mio-text-secondary);
  font-family: "JetBrains Mono", monospace;
}

.highlights-visualizer {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.visualizer-content {
  background-color: var(--mio-bg-card);
  border: 1px solid var(--mio-border-color-light);
  height: 20rem;
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.visualizer-header {
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--mio-border-color-light);
  display: flex;
  justify-content: space-between;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  color: var(--mio-text-secondary);
  letter-spacing: 0.05em;
}

.visualizer-status {
  color: var(--mio-color-success);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.visualizer-status::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  background-color: var(--mio-color-success);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.9);
    opacity: 0.6;
  }
}

.telemetry-pane {
  flex-grow: 1;
  padding: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  box-sizing: border-box;
}

/* Pane 0: Compression Visualizer */
.compression-pane {
  flex-direction: column;
}

.compressor-blocks {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 10rem;
}

.block-frame {
  width: 40%;
  height: 100%;
  border: 1px dashed var(--mio-border-color);
  padding: 0.75rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background-color: var(--mio-bg-page);
  transition: height 0.3s ease;
}

.block-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  color: var(--mio-text-secondary);
}

.block-footer {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  text-align: right;
  color: var(--mio-text-primary);
}

.fake-tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  overflow: hidden;
  align-content: flex-start;
  flex-grow: 1;
  margin: 0.5rem 0;
}

.token-chip {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  background-color: var(--mio-bg-hover);
  border: 1px solid var(--mio-border-color-light);
  padding: 0.1rem 0.3rem;
  border-radius: 2px;
  color: var(--mio-text-regular);
}

.token-chip.highlight {
  background-color: var(--mio-bg-primary-light);
  color: var(--mio-color-primary);
  border-color: var(--mio-color-primary);
}

.compressor-flow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.flow-arrow {
  font-size: 1.5rem;
  color: var(--mio-text-secondary);
}

.ratio-badge {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--mio-color-primary);
  background-color: var(--mio-bg-primary-light);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

/* Pane 1: Terminal Visualizer */
.terminal-pane {
  padding: 0;
  align-items: stretch;
}

.terminal-mock {
  width: 100%;
  height: 100%;
  background-color: #1a1a1a;
  color: #e0e0e0;
  font-family: "JetBrains Mono", monospace;
  padding: 1.25rem;
  box-sizing: border-box;
  text-align: left;
  overflow-y: auto;
}

.terminal-body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.terminal-line {
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.terminal-line.input {
  color: #38bdf8;
}

.terminal-line.success {
  color: #4ade80;
}

.terminal-line.log {
  color: #a3a3a3;
}

.active-line .cursor {
  background-color: #e0e0e0;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  from,
  to {
    background-color: transparent;
  }
  50% {
    background-color: #e0e0e0;
  }
}

/* Pane 2: Plugins Visualizer */
.plugins-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  width: 90%;
}

.diagram-node {
  width: 100%;
  border: 1px solid var(--mio-border-color-light);
  background-color: var(--mio-bg-page);
  padding: 0.6rem 1rem;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}

.diagram-node:hover {
  border-color: var(--mio-text-secondary);
}

.node-inner {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.node-level {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  color: var(--mio-text-secondary);
}

.node-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--mio-text-primary);
}

.node-details {
  font-size: 0.7rem;
  color: var(--mio-text-regular);
}

.diagram-connector {
  color: var(--mio-text-secondary);
  font-size: 0.9rem;
}

/* Pane 3: Hook pipeline visualizer */
.hook-pipeline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 0.5rem;
  box-sizing: border-box;
}

.pipeline-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.25rem;
  width: 22%;
}

.step-num {
  font-family: "Lora", serif;
  font-size: 0.9rem;
  color: var(--mio-text-secondary);
}

.step-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--mio-text-primary);
}

.step-val {
  font-size: 0.6rem;
  color: var(--mio-text-secondary);
}

.pipeline-connector {
  color: var(--mio-text-placeholder);
  font-size: 1rem;
  animation: moveRight 1.5s infinite linear;
}

@keyframes moveRight {
  0% {
    transform: translateX(-3px);
    opacity: 0.4;
  }
  50% {
    transform: translateX(3px);
    opacity: 1;
  }
  100% {
    transform: translateX(-3px);
    opacity: 0.4;
  }
}

.highlight-explanation {
  background-color: var(--mio-bg-page);
  border: 1px solid var(--mio-border-color-light);
  padding: 0.85rem 1.25rem;
  box-sizing: border-box;
  height: 5.5rem;
  overflow-y: auto;
}

.explanation-text {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--mio-text-regular);
  margin: 0;
}

/* Editorial Footer */
.editorial-footer {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  margin-top: 1rem;
}

.footer-wrap {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 3rem;
  align-items: center;
}

.footer-title {
  font-family: "Lora", serif;
  font-size: 2.2rem;
  font-weight: 500;
  margin: 0 0 1rem 0;
  color: var(--mio-text-primary);
}

.footer-subtitle {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--mio-text-regular);
  margin: 0;
}

.footer-actions {
  display: flex;
  gap: 1.5rem;
  justify-content: flex-end;
}

.footer-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--mio-bg-card);
  background-color: var(--mio-text-primary);
  border: 1px solid var(--mio-text-primary);
  padding: 0.8rem 1.5rem;
  text-decoration: none;
  transition: all 0.2s ease;
}

.footer-btn:hover {
  background-color: var(--mio-bg-hover);
  color: var(--mio-text-primary);
  border-color: var(--mio-text-primary);
}

.footer-btn.outline {
  background-color: transparent;
  color: var(--mio-text-primary);
  border: 1px solid var(--mio-border-color);
}

.footer-btn.outline:hover {
  background-color: var(--mio-bg-hover);
  border-color: var(--mio-text-primary);
}

.footer-btn .arrow {
  transition: transform 0.2s ease;
}

.footer-btn:hover .arrow {
  transform: translateX(4px);
}

.footer-copyright {
  border-top: 1px solid var(--mio-border-color-light);
  padding-top: 1.5rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--mio-text-secondary);
}

.edition-tag {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
}

/* Mobile Responsive */
@media screen and (max-width: 768px) {
  .editorial-container {
    padding: 2.5rem 1.25rem 6rem 1.25rem; /* bottom padding for mobile tabbar */
    gap: 2.5rem;
  }

  .editorial-hero {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .hero-title {
    font-size: 2.5rem;
  }

  .hero-lead {
    font-size: 1.2rem;
  }

  .nodes-grid {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }

  .node-card {
    min-height: auto;
    padding: 1.5rem;
  }

  .highlights-panel {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .highlights-nav {
    border-left: none;
    border-bottom: 1px solid var(--mio-border-color-light);
    flex-direction: row;
    overflow-x: auto;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 0.5rem;
  }

  .nav-tab-btn {
    padding: 0.75rem 1rem;
    border-left: none;
    border-bottom: 2px solid transparent;
    margin-left: 0;
    margin-bottom: -1px;
    flex-shrink: 0;
    gap: 0.5rem;
  }

  .nav-tab-btn.active {
    border-left: none;
    border-bottom: 2px solid var(--mio-text-primary);
  }

  .tab-meta .tab-tag {
    display: none; /* Hide subtitle tags on mobile tab to save space */
  }

  .visualizer-content {
    height: 18rem;
  }

  .highlight-explanation {
    height: 8.5rem;
  }

  .compressor-blocks {
    height: 9rem;
  }

  .hook-pipeline {
    flex-direction: column;
    gap: 0.8rem;
    align-items: center;
  }

  .pipeline-step {
    width: 80%;
  }

  .pipeline-connector {
    transform: rotate(90deg);
    animation: moveDown 1.5s infinite linear;
  }

  @keyframes moveDown {
    0% {
      transform: rotate(90deg) translateX(-3px);
      opacity: 0.4;
    }
    50% {
      transform: rotate(90deg) translateX(3px);
      opacity: 1;
    }
    100% {
      transform: rotate(90deg) translateX(-3px);
      opacity: 0.4;
    }
  }

  .footer-wrap {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    text-align: left;
  }

  .footer-title {
    font-size: 1.8rem;
  }

  .footer-actions {
    flex-direction: column;
    width: 100%;
    gap: 0.75rem;
  }

  .footer-btn {
    width: 100%;
    justify-content: center;
    box-sizing: border-box;
  }

  .footer-copyright {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
}
</style>
