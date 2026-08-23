<template>
  <div
    class="shadow-html-host"
    ref="host"
    @contextmenu.stop
    @dblclick.stop
  ></div>
</template>

<script>
import { client } from "@/lib/runtime.js";

/**
 * ShadowHtml - 用 Shadow DOM 同文档渲染 Agent 生成的 HTML UI。
 *
 * 相比 iframe 的优势：
 *   - CSS 天然隔离（shadow root 内样式不外泄，也不受主页面样式污染）
 *   - 高度自适应（内容撑开宿主 div，无需 postMessage / ResizeObserver）
 *   - 交互靠内联 onclick + window.__mio 白名单方法（script 不执行，安全）
 *   - 深度支持异步生图 (data-task-id) 通过 WebSocket 实时推送 + 离线轮询持久化回填
 *   - 支持离线、切后台（visibilitychange）、断线重连（socket.connect）自动补录完成任务
 *   - 拦截右键和双击事件，防止触发外部聊天消息气泡的菜单
 */
export default {
  name: "ShadowHtml",
  props: {
    html: { type: String, default: "" },
  },
  emits: ["update:html"],
  data() {
    return {
      pollingTimers: new Map(),
    };
  },
  watch: {
    html(newVal) {
      if (this.shadowRoot && this.shadowRoot.innerHTML !== newVal) {
        this.renderHtml();
      }
    },
  },
  mounted() {
    this.renderHtml();
    this.bindSocketEvents();
    this.bindWindowEvents();
  },
  beforeUnmount() {
    this.unbindSocketEvents();
    this.unbindWindowEvents();
    this.clearAllTimers();
    this.shadowRoot = null;
  },
  methods: {
    renderHtml() {
      const host = this.$refs.host;
      if (!host) return;
      if (!this.shadowRoot) {
        this.shadowRoot = host.attachShadow({ mode: "open" });
        host.addEventListener("contextmenu", (e) => e.stopPropagation());
        host.addEventListener("dblclick", (e) => e.stopPropagation());
      }
      this.shadowRoot.innerHTML = this.html || "";
      this.$nextTick(() => {
        this.processAsyncTasks();
      });
    },

    bindSocketEvents() {
      const socket = client?.socket?.socket || client?.socket;
      if (socket && typeof socket.on === "function") {
        this._onTaskComplete = (data) => this.handleTaskComplete(data);
        this._onTaskFailed = (data) => this.handleTaskFailed(data);
        this._onSocketConnect = () => this.processAsyncTasks();

        socket.on("image:task_complete", this._onTaskComplete);
        socket.on("image:task_failed", this._onTaskFailed);
        socket.on("connect", this._onSocketConnect);
      }
    },

    unbindSocketEvents() {
      const socket = client?.socket?.socket || client?.socket;
      if (socket && typeof socket.off === "function") {
        if (this._onTaskComplete) socket.off("image:task_complete", this._onTaskComplete);
        if (this._onTaskFailed) socket.off("image:task_failed", this._onTaskFailed);
        if (this._onSocketConnect) socket.off("connect", this._onSocketConnect);
      }
    },

    bindWindowEvents() {
      this._onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          this.processAsyncTasks();
        }
      };
      document.addEventListener("visibilitychange", this._onVisibilityChange);
    },

    unbindWindowEvents() {
      if (this._onVisibilityChange) {
        document.removeEventListener("visibilitychange", this._onVisibilityChange);
      }
    },

    clearAllTimers() {
      for (const timer of this.pollingTimers.values()) {
        clearTimeout(timer);
      }
      this.pollingTimers.clear();
    },

    processAsyncTasks() {
      if (!this.shadowRoot) return;
      const pendingElements = this.shadowRoot.querySelectorAll("[data-task-id]");
      if (!pendingElements || pendingElements.length === 0) return;

      pendingElements.forEach((el) => {
        const taskId = el.getAttribute("data-task-id");
        if (!taskId) return;

        // 立即向后端查询一次任务状态，若仍在处理中则启动退避轮询兜底
        this.checkTaskStatus(taskId, el, 1);
      });
    },

    async checkTaskStatus(taskId, targetEl, retryCount = 1) {
      if (!this.shadowRoot || !targetEl || !targetEl.isConnected) {
        return;
      }

      try {
        const res = await fetch(`/api/images/tasks/${encodeURIComponent(taskId)}`);
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data || json;

        if (data.status === "success" && data.url) {
          if (this.pollingTimers.has(taskId)) {
            clearTimeout(this.pollingTimers.get(taskId));
            this.pollingTimers.delete(taskId);
          }
          this.applyImageToElement(targetEl, data.url);
        } else if (data.status === "failed") {
          if (this.pollingTimers.has(taskId)) {
            clearTimeout(this.pollingTimers.get(taskId));
            this.pollingTimers.delete(taskId);
          }
          this.applyErrorToElement(targetEl, data.error);
        } else if (data.status === "pending") {
          // 仍在排队/生成中：以渐进间隔进行轮询兜底（防止错过 Socket 广播），最多重试 30 次（约 90 秒）
          if (retryCount <= 30) {
            const delay = Math.min(2000 + retryCount * 500, 6000);
            if (this.pollingTimers.has(taskId)) {
              clearTimeout(this.pollingTimers.get(taskId));
            }
            const timer = setTimeout(() => {
              this.checkTaskStatus(taskId, targetEl, retryCount + 1);
            }, delay);
            this.pollingTimers.set(taskId, timer);
          }
        }
      } catch (err) {
        // 网络异常时，5 秒后重试
        if (retryCount <= 10) {
          const timer = setTimeout(() => {
            this.checkTaskStatus(taskId, targetEl, retryCount + 1);
          }, 5000);
          this.pollingTimers.set(taskId, timer);
        }
      }
    },

    handleTaskComplete(data) {
      if (!data || !data.taskId || !this.shadowRoot) return;
      if (this.pollingTimers.has(data.taskId)) {
        clearTimeout(this.pollingTimers.get(data.taskId));
        this.pollingTimers.delete(data.taskId);
      }
      const targetEl = this.shadowRoot.querySelector(`[data-task-id="${data.taskId}"]`);
      if (targetEl && data.url) {
        this.applyImageToElement(targetEl, data.url);
      }
    },

    handleTaskFailed(data) {
      if (!data || !data.taskId || !this.shadowRoot) return;
      if (this.pollingTimers.has(data.taskId)) {
        clearTimeout(this.pollingTimers.get(data.taskId));
        this.pollingTimers.delete(data.taskId);
      }
      const targetEl = this.shadowRoot.querySelector(`[data-task-id="${data.taskId}"]`);
      if (targetEl) {
        this.applyErrorToElement(targetEl, data.error);
      }
    },

    notifyHtmlChange() {
      if (!this.shadowRoot) return;
      const finalHtml = this.shadowRoot.innerHTML;
      if (finalHtml && finalHtml !== this.html) {
        this.$emit("update:html", finalHtml);
      }
    },

    applyImageToElement(el, url) {
      if (!el) return;
      el.removeAttribute("data-task-id");

      const imgEl = el.tagName.toLowerCase() === "img" ? el : el.querySelector("img");
      const stageEl = el.classList?.contains("stage") || el.classList?.contains("ldr-box") ? el : el.closest?.(".stage, .ldr-box");

      if (imgEl) {
        imgEl.removeAttribute("data-task-id");
        const preload = new Image();
        preload.src = url;
        preload.onload = () => {
          imgEl.src = url;
          imgEl.classList.add("loaded");
          imgEl.style.opacity = "1";
          if (stageEl) {
            stageEl.classList.add("has-image");
            stageEl.style.aspectRatio = "unset";
          }
          this.notifyHtmlChange();
        };
        preload.onerror = () => {
          imgEl.src = url;
          imgEl.classList.add("loaded");
          imgEl.style.opacity = "1";
          if (stageEl) {
            stageEl.classList.add("has-image");
            stageEl.style.aspectRatio = "unset";
          }
          this.notifyHtmlChange();
        };
      } else {
        if (el.style.backgroundImage || el.classList.contains("has-bg")) {
          el.style.backgroundImage = `url("${url}")`;
          if (stageEl) {
            stageEl.classList.add("has-image");
            stageEl.style.aspectRatio = "unset";
          }
          this.notifyHtmlChange();
        } else {
          const img = document.createElement("img");
          img.src = url;
          img.style.width = "100%";
          img.style.height = "auto";
          img.style.maxHeight = "520px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "inherit";
          img.style.opacity = "0";
          img.style.transition = "opacity 0.45s ease";
          img.onload = () => {
            el.innerHTML = "";
            el.appendChild(img);
            if (stageEl) {
              stageEl.classList.add("has-image");
              stageEl.style.aspectRatio = "unset";
            }
            requestAnimationFrame(() => {
              img.style.opacity = "1";
            });
            this.notifyHtmlChange();
          };
          img.onerror = () => {
            el.innerHTML = "";
            el.appendChild(img);
            if (stageEl) {
              stageEl.classList.add("has-image");
              stageEl.style.aspectRatio = "unset";
            }
            this.notifyHtmlChange();
          };
        }
      }
    },

    applyErrorToElement(el, errorMsg) {
      if (!el) return;
      el.removeAttribute("data-task-id");
      const spinner = el.querySelector?.(".glass-spinner");
      if (spinner) {
        spinner.innerHTML = `<span style="color: #f87171; font-size: 11px;">⚠️ 失败</span>`;
      } else if (el.tagName.toLowerCase() === "img") {
        el.title = `生图失败: ${errorMsg || '未知错误'}`;
      } else {
        el.innerHTML = `<div style="padding: 12px; color: #f87171; font-size: 12px; text-align: center;">⚠️ 图片生成失败: ${errorMsg || '请重试'}</div>`;
      }
      this.notifyHtmlChange();
    },
  },
};
</script>

<style scoped>
.shadow-html-host {
  width: 100%;
  min-height: 20px;
}
</style>
