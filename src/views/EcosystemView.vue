<script>
import {
  Cpu,
  Monitor,
  Connection,
  FolderOpened,
} from "@element-plus/icons-vue";

export default {
  name: "EcosystemView",
  components: {
    Cpu,
    Monitor,
    Connection,
    FolderOpened,
  },
  data() {
    return {
      onPhone: window.innerWidth < 768,
      modules: [
        {
          title: "Mio-Chat Backend",
          repoName: "Pretend-to/mio-chat-backend",
          desc: "系统核心底层运行时，提供 AOP Hooks 生命周期钩子拦截机制、MCP 协议支持以及 Native 插件热重载架构。",
          githubUrl: "https://github.com/Pretend-to/mio-chat-backend",
          badge: "Core Runtime",
          icon: "lucide-server",
        },
        {
          title: "Mio-Chat Frontend",
          repoName: "Pretend-to/mio-chat-frontend",
          desc: "基于 Vue 3 + Element Plus 的沉浸式多功能聊天工作区，集成富文本编辑器、截图预览分享、动态侧边滑栏等组件。",
          githubUrl: "https://github.com/Pretend-to/mio-chat-frontend",
          badge: "Vue3 Workspace",
          icon: "lucide-layout",
        },
        {
          title: "Mio-Previewer",
          repoName: "Pretend-to/mio-previewer",
          desc: "深度优化流式渲染（Streaming）的 Markdown 引擎，内建 LaTeX 数学公式、Mermaid 图表渲染和交互式 Artifacts 沙箱。",
          githubUrl: "https://github.com/Pretend-to/mio-previewer",
          badge: "MD Engine",
          icon: "lucide-book-open",
        },
        {
          title: "Awesome Plugins",
          repoName: "Pretend-to/awesome-miochat-plugins",
          desc: "官方与社区生态的通用扩展集合。沉淀行业专家经验的 Skills 策略包以及针对特定 OS/硬件桥接的钩子拦截脚本。",
          githubUrl: "https://github.com/Pretend-to/awesome-miochat-plugins",
          badge: "Plugins Market",
          icon: "lucide-puzzle",
        },
      ],
    };
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
  },
};
</script>

<template>
  <div class="mio-ecosystem">
    <div class="mio-ecosystem__container">
      <!-- Title & Branding -->
      <div class="mio-ecosystem__hero">
        <div class="mio-ecosystem__logo">
          <img src="/static/icons/512x512.png" alt="MioChat Logo" />
        </div>
        <h1 class="mio-ecosystem__title">MioChat Ecosystem 🚀</h1>
        <p class="mio-ecosystem__subtitle">
          不仅仅是对话转发，更是下一代轻量化 Agent 操作系统
        </p>
      </div>

      <!-- Family Grid -->
      <div class="mio-ecosystem__section">
        <h2 class="mio-ecosystem__section-title">
          📦 生态全景 (Ecosystem Family)
        </h2>
        <div class="mio-ecosystem__grid">
          <div
            v-for="(mod, index) in modules"
            :key="index"
            class="mio-ecosystem-card"
          >
            <div class="mio-ecosystem-card__badge">{{ mod.badge }}</div>
            <h3 class="mio-ecosystem-card__title">{{ mod.title }}</h3>
            <span class="mio-ecosystem-card__repo">{{ mod.repoName }}</span>
            <p class="mio-ecosystem-card__desc">{{ mod.desc }}</p>
            <a
              :href="mod.githubUrl"
              target="_blank"
              class="mio-ecosystem-card__btn"
            >
              <svg
                class="lucide lucide-github"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
                />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
              <span>查看源码</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Core Highlights -->
      <div class="mio-ecosystem__section">
        <h2 class="mio-ecosystem__section-title">
          🌟 核心特色 (Core Highlights)
        </h2>
        <p class="mio-ecosystem__section-subtitle">
          传统对话平台只是 “API 搬运工”，而 Mio-Chat
          是为复杂生产环境设计的下一代 Agent 操作系统。
        </p>
        <div class="mio-ecosystem__features">
          <div class="mio-ecosystem-feature">
            <div class="mio-ecosystem-feature__header">
              <el-icon class="mio-ecosystem-feature__icon"><Cpu /></el-icon>
              <h3 class="mio-ecosystem-feature__title">🧠 上下文压缩系统</h3>
            </div>
            <p class="mio-ecosystem-feature__desc">
              独创无状态上下文压缩算法。通过 XML 结构化分区，在保留 100%
              关键工程约束的前提下，将 Token 消耗降低 80% 以上，并极限命中
              Prompt Cache。
            </p>
          </div>

          <div class="mio-ecosystem-feature">
            <div class="mio-ecosystem-feature__header">
              <el-icon class="mio-ecosystem-feature__icon"><Monitor /></el-icon>
              <h3 class="mio-ecosystem-feature__title">
                🖥️ 真实环境桥接 (OS Bridge)
              </h3>
            </div>
            <p class="mio-ecosystem-feature__desc">
              内置 <code>node-pty</code> 真实伪终端和视觉自动化驱动。允许 Agent
              像真实开发人员一样使用 Bash、编译运行代码、浏览网页及视觉交互。
            </p>
          </div>

          <div class="mio-ecosystem-feature">
            <div class="mio-ecosystem-feature__header">
              <el-icon class="mio-ecosystem-feature__icon"
                ><Connection
              /></el-icon>
              <h3 class="mio-ecosystem-feature__title">🔌 三层开放插件体系</h3>
            </div>
            <p class="mio-ecosystem-feature__desc">
              原生支持 <strong>Skills (专家包)</strong>、<strong
                >MCP (标准协议)</strong
              >
              以及 <strong>Native Plugins (热重载)</strong>。Agent
              甚至能自动编写插件并即时动态加载运行。
            </p>
          </div>

          <div class="mio-ecosystem-feature">
            <div class="mio-ecosystem-feature__header">
              <el-icon class="mio-ecosystem-feature__icon"
                ><FolderOpened
              /></el-icon>
              <h3 class="mio-ecosystem-feature__title">
                📂 预设双源与 Hook 机制
              </h3>
            </div>
            <p class="mio-ecosystem-feature__desc">
              物理隔离系统预设与用户预设。通过仿 Koa 的切面 Hook
              机制（如对话、工具执行拦截），实现无缝鉴权、行为审计和出入参安全过滤。
            </p>
          </div>
        </div>
      </div>

      <!-- Contribution Footer -->
      <div class="mio-ecosystem__footer">
        <h3>🤝 共同建设生态</h3>
        <p>
          我们热忱欢迎任何形式的贡献。不论是分享一个新的 Skills 专家包，设计一套
          MCP 协议接口，还是优化渲染器的解析性能，都是 MioChat 生态的无价财富。
        </p>
        <div class="mio-ecosystem__footer-actions">
          <a
            href="https://github.com/Pretend-to/mio-chat-backend"
            target="_blank"
            class="mio-ecosystem__footer-btn"
          >
            贡献 Plugin/Hook
          </a>
          <a
            href="https://github.com/Pretend-to/mio-previewer"
            target="_blank"
            class="mio-ecosystem__footer-btn secondary"
          >
            贡献 MD 渲染器
          </a>
        </div>
        <div class="mio-ecosystem__copyright">
          © 2026 Mio-Chat Team. Licensed under MIT.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mio-ecosystem {
  flex-grow: 1;
  height: 100%;
  width: 100%;
  background-color: var(--mio-bg-page);
  overflow-y: auto;
  box-sizing: border-box;
}

.mio-ecosystem__container {
  max-width: 68rem;
  margin: 0 auto;
  padding: 3rem 2rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
}

/* Hero Branding */
.mio-ecosystem__hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1rem;
}

.mio-ecosystem__logo {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  overflow: hidden;
  background-color: var(--mio-bg-card);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mio-ecosystem__logo img {
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.mio-ecosystem__title {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--mio-text-primary);
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.5px;
}

.mio-ecosystem__subtitle {
  font-size: 1.05rem;
  color: var(--mio-text-secondary);
  font-weight: 500;
  margin: 0;
}

/* Section Header */
.mio-ecosystem__section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.mio-ecosystem__section-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--mio-text-primary);
  margin: 0;
}

.mio-ecosystem__section-subtitle {
  font-size: 0.9rem;
  color: var(--mio-text-regular);
  margin: -0.75rem 0 0.5rem 0;
  line-height: 1.6;
}

/* Grid Layout */
.mio-ecosystem__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.mio-ecosystem-card {
  background-color: var(--mio-bg-card);
  border: 1px solid var(--mio-border-color-light);
  border-radius: 16px;
  padding: 1.75rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.mio-ecosystem-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.04);
  border-color: var(--mio-color-primary);
}

.mio-ecosystem-card__badge {
  align-self: flex-start;
  font-size: 0.7rem;
  font-weight: 700;
  background-color: var(--mio-bg-primary-light, rgba(0, 153, 255, 0.1));
  color: var(--mio-color-primary);
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.8rem;
}

.mio-ecosystem-card__title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--mio-text-primary);
  margin: 0 0 0.25rem 0;
}

.mio-ecosystem-card__repo {
  font-size: 0.8rem;
  color: var(--mio-text-secondary);
  font-family: monospace;
  margin-bottom: 0.8rem;
}

.mio-ecosystem-card__desc {
  font-size: 0.85rem;
  color: var(--mio-text-regular);
  line-height: 1.6;
  margin: 0 0 1.5rem 0;
  flex-grow: 1;
}

.mio-ecosystem-card__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--mio-text-regular);
  border: 1px solid var(--mio-border-color);
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  text-decoration: none;
  background-color: transparent;
  transition: all 0.2s ease;
}

.mio-ecosystem-card__btn:hover {
  background-color: var(--mio-bg-hover);
  color: var(--mio-text-primary);
  border-color: var(--mio-text-secondary);
}

/* Features Grid */
.mio-ecosystem__features {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.mio-ecosystem-feature {
  background-color: var(--mio-bg-card);
  border: 1px solid var(--mio-border-color-light);
  border-radius: 16px;
  padding: 1.5rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.mio-ecosystem-feature:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.03);
  border-color: var(--mio-color-primary);
}

.mio-ecosystem-feature__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mio-ecosystem-feature__icon {
  font-size: 22px;
  color: var(--mio-color-primary);
  background-color: var(--mio-bg-hover);
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mio-ecosystem-feature__title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--mio-text-primary);
  margin: 0;
}

.mio-ecosystem-feature__desc {
  font-size: 0.85rem;
  color: var(--mio-text-regular);
  line-height: 1.6;
  margin: 0;
}

/* Footer Section */
.mio-ecosystem__footer {
  background-color: var(--mio-bg-card);
  border: 1px solid var(--mio-border-color-light);
  border-radius: 20px;
  padding: 2.5rem;
  box-sizing: border-box;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.mio-ecosystem__footer h3 {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--mio-text-primary);
  margin: 0;
}

.mio-ecosystem__footer p {
  font-size: 0.9rem;
  color: var(--mio-text-regular);
  max-width: 38rem;
  line-height: 1.6;
  margin: 0 0 1rem 0;
}

.mio-ecosystem__footer-actions {
  display: flex;
  gap: 1rem;
}

.mio-ecosystem__footer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: #ffffff;
  background-color: var(--mio-color-primary);
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 153, 255, 0.2);
}

.mio-ecosystem__footer-btn:hover {
  background-color: var(--mio-color-primary-hover);
}

.mio-ecosystem__footer-btn.secondary {
  color: var(--mio-text-primary);
  background-color: transparent;
  border: 1px solid var(--mio-border-color);
  box-shadow: none;
}

.mio-ecosystem__footer-btn.secondary:hover {
  background-color: var(--mio-bg-hover);
}

.mio-ecosystem__copyright {
  font-size: 0.75rem;
  color: var(--mio-text-secondary);
  margin-top: 1.5rem;
}

/* Mobile Responsive */
@media screen and (max-width: 768px) {
  .mio-ecosystem__container {
    padding: 2rem 1rem 4.5rem 1rem; /* Extra padding bottom for mobile tabs */
    gap: 2.5rem;
  }

  .mio-ecosystem__title {
    font-size: 1.8rem;
  }

  .mio-ecosystem__grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .mio-ecosystem-card {
    padding: 1.25rem;
  }

  .mio-ecosystem__features {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .mio-ecosystem-feature {
    padding: 1.25rem;
  }

  .mio-ecosystem__footer {
    padding: 1.5rem;
  }

  .mio-ecosystem__footer-actions {
    flex-direction: column;
    width: 100%;
    gap: 0.75rem;
  }

  .mio-ecosystem__footer-btn {
    width: 100%;
    box-sizing: border-box;
  }
}
</style>
