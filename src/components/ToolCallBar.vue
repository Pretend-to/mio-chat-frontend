<template>
  <div class="tool-call-bar" :class="[toolCall.action, { 'is-success': toolCallSuccess, 'is-fail': toolCallFail }]">
    <!-- 左侧状态指示器 -->
    <div class="status-indicator">
      <div v-if="toolCall.action === 'running' || toolCall.action === 'pending'" class="mini-spinner"></div>
      <div v-else-if="toolCallSuccess" class="dot success"></div>
      <div v-else-if="toolCallFail" class="dot fail"></div>
      <div v-else class="dot started"></div>
    </div>
    
    <!-- 中间信息区 -->
    <div class="tool-content" @click="toggleExtraInfo">
      <div class="tool-main">
        <span class="tool-name">{{ toolCall.name.split("_mid_")[0] }}</span>
        <span class="tool-status-text">{{ call_status }}</span>
      </div>
    </div>

    <!-- 右侧操作区 -->
    <div class="tool-actions">
      <button
        ref="show-extra-info"
        :class="{ active: showExtraInfo, 'action-btn': true }"
        @click="toggleExtraInfo"
      >
        <svg class="chevron" viewBox="0 0 1024 1024" width="14" height="14">
          <path d="M778.965749 128.759549l-383.064442 383.063419 388.097062 388.096039-0.070608 0.033769c12.709463 13.137205 20.529569 31.024597 20.529569 50.731428 0 40.376593-32.736589 73.112158-73.115228 73.112158-19.705807 0-37.591153-7.819083-50.730405-20.528546l-0.034792 0.035816L241.890654 564.622498l0.035816-0.035816c-13.779841-13.281491-22.3838-31.915897-22.3838-52.585659 0-0.071631 0-0.106424 0-0.178055 0-0.072655 0-0.10847 0-0.144286 0-20.669762 8.603959-39.341007 22.3838-52.622498l-0.035816-0.034792L680.573835 20.337187l0.180102 0.179079c13.139252-12.5662 30.950919-20.313651 50.587142-20.313651 40.378639 0 73.115228 32.736589 73.115228 73.114205C804.455283 95.485725 794.567076 115.334795 778.965749 128.759549z" fill="currentColor"></path>
        </svg>
      </button>
    </div>

    <teleport to="body">
      <transition name="panel-fade">
        <div
          v-if="showExtraInfo"
          ref="teleportContent"
          class="detail-panel"
          :class="{ upward: openUp }"
          :style="teleportStyle"
          @click.stop
        >
          <div class="detail-header">
            <span class="header-title">执行细节</span>
            <div class="header-actions">
              <button class="mini-btn" @click="copyParameters" title="复制参数">参数</button>
              <button class="mini-btn" @click="copyResult" title="复制结果">结果</button>
            </div>
          </div>
          <div class="detail-body">
            <pre class="json-box">{{ formattedParameters }}</pre>
            <div class="divider"></div>
            <pre class="json-box" :class="{ 'error-text': toolCallFail }">{{ formattedResult }}</pre>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script>
export default {
  props: {
    toolCall: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      showExtraInfo: false,
      teleportStyle: {},
      openUp: false,
    };
  },
  computed: {
    toolCallSuccess() {
      return this.toolCall.action === "finished" && !this.toolCall?.result?.error;
    },
    toolCallFail() {
      return (this.toolCall.action === "finished" && this.toolCall?.result?.error) || (this.toolCall.action === "failed");
    },
    call_status() {
      if (this.toolCall.action == "started") return "就绪";
      if (this.toolCall.action == "pending") return "准备中";
      if (this.toolCall.action == "running") return "执行中";
      if (this.toolCallSuccess) return "完成";
      if (this.toolCallFail) return "失败";
      return "未知";
    },
    formattedParameters() {
      const p = this.toolCall.parameters;
      if (!p) return "{}";
      try {
        const obj = typeof p === "string" ? JSON.parse(p) : p;
        return JSON.stringify(obj, null, 2);
      } catch (e) { return String(p); }
    },
    formattedResult() {
      const r = this.toolCall.result;
      if (r === undefined || r === null) return "等待中...";
      try {
        const obj = typeof r === "string" ? JSON.parse(r) : r;
        return JSON.stringify(obj, null, 2);
      } catch (e) { return String(r); }
    }
  },
  methods: {
    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        if (this.$message) this.$message({ message: "已复制", type: "success", duration: 1500 });
      } catch (e) {}
    },
    copyParameters() { this.copyToClipboard(this.formattedParameters); },
    copyResult() { this.copyToClipboard(this.formattedResult); },
    toggleExtraInfo() {
      this.showExtraInfo = !this.showExtraInfo;
      if (this.showExtraInfo) {
        this.positionTeleport();
        window.addEventListener("resize", this.positionTeleport);
        document.addEventListener("click", this.onDocClick);
      } else { this.cleanup(); }
    },
    onDocClick(e) {
      const root = this.$el;
      const t = this.$refs.teleportContent;
      if (root && !root.contains(e.target) && t && !t.contains(e.target)) {
        this.showExtraInfo = false;
        this.cleanup();
      }
    },
    cleanup() {
      window.removeEventListener("resize", this.positionTeleport);
      document.removeEventListener("click", this.onDocClick);
    },
    positionTeleport() {
      const root = this.$el;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const left = Math.max(12, rootRect.left);
      this.teleportStyle = {
        position: "fixed",
        top: (rootRect.bottom + 8) + "px",
        left: left + "px",
        width: Math.min(320, window.innerWidth - 24) + "px",
        zIndex: 10000,
      };
      this.$nextTick(() => {
        const content = this.$refs.teleportContent;
        if (!content) return;
        const contentRect = content.getBoundingClientRect();
        if (rootRect.bottom + contentRect.height + 20 > window.innerHeight) {
          this.openUp = true;
          this.teleportStyle.top = (rootRect.top - contentRect.height - 8) + "px";
        }
      });
    },
  },
  beforeUnmount() { this.cleanup(); },
};
</script>

<style scoped>
.tool-call-bar {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 40px;
  border-radius: 10px;
  margin: 8px 0;
  background: #f0f7ff; /* Default Blue Tint (Option A) */
  border: 1px solid #d9ecff;
  transition: all 0.2s ease;
  user-select: none;
}

/* 状态配色 (Option A Style) */
.tool-call-bar.is-success { background: #f6ffed; border-color: #d9f7be; }
.tool-call-bar.is-fail { background: #fff1f0; border-color: #ffccc7; }
.tool-call-bar.running, .tool-call-bar.pending { background: #e6f7ff; border-color: #91d5ff; }

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  margin-right: 10px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot.success { background: #52c41a; box-shadow: 0 0 6px rgba(82, 196, 26, 0.4); }
.dot.fail { background: #ff4d4f; box-shadow: 0 0 6px rgba(255, 77, 79, 0.4); }
.dot.started { background: #bfbfbf; }

.mini-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(24, 144, 255, 0.2);
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.tool-content {
  flex-grow: 1;
  cursor: pointer;
  overflow: hidden;
}

.tool-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.tool-name {
  font-size: 13px;
  font-weight: 600;
  color: #262626;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-status-text {
  font-size: 11px;
  color: #8c8c8c;
  min-width: 48px; /* 固定宽度，防止字数变化引起抖动 */
  text-align: left;
  flex-shrink: 0;
}

.action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #bfbfbf;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}
.action-btn:hover { color: #595959; }
.action-btn.active .chevron { transform: rotate(-90deg); }
.chevron { transition: transform 0.3s ease; transform: rotate(90deg); }

/* Detail Panel */
.detail-panel {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  border: 1px solid #f0f0f0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: 8px 12px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title { font-size: 11px; font-weight: 600; color: #8c8c8c; text-transform: uppercase; }

.header-actions { display: flex; gap: 4px; }
.mini-btn {
  background: white;
  border: 1px solid #d9d9d9;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  color: #595959;
}
.mini-btn:hover { border-color: #40a9ff; color: #40a9ff; }

.detail-body {
  padding: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.json-box {
  margin: 0;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  color: #595959;
  white-space: pre-wrap;
  word-break: break-all;
}
.error-text { color: #ff4d4f; }
.divider { height: 1px; background: #f0f0f0; margin: 8px 0; }

.panel-fade-enter-active, .panel-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.panel-fade-enter-from, .panel-fade-leave-to { opacity: 0; transform: translateY(5px); }
</style>

