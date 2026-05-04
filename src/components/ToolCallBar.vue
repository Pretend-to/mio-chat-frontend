<template>
  <div class="tool-call-block">
    <div class="tool-call-bar" :class="[toolCall.action, { 'is-success': toolCallSuccess, 'is-fail': toolCallFail }]"
      @click="toggleExtraInfo">
      <template v-if="toolCall.name.startsWith('Skill_mid_') || toolCall.name === 'Skill'">
        <i class="mio-icon mio-icon-skill" :class="{ 'is-loading': toolCall.action === 'running' || toolCall.action === 'pending' }"></i>
        <span class="tool-name" :class="{ 'is-loading': toolCall.action === 'running' || toolCall.action === 'pending' }">
          {{ getSkillName(toolCall.parameters) }}
        </span>
        <span class="tool-status-text">{{ skill_status_text }}</span>
      </template>
      <template v-else>
        <i class="mio-icon mio-icon-tool" :class="{ 'is-loading': toolCall.action === 'running' || toolCall.action === 'pending' }"></i>
        <span class="tool-name" :class="{ 'is-loading': toolCall.action === 'running' || toolCall.action === 'pending' }">
          {{ toolCall.name.split("_mid_")[0] }}
        </span>
        <span class="tool-status-text">{{ call_status }}</span>
      </template>

      <!-- 状态指示器 (仅在失败时显示) -->
      <div v-if="toolCallFail" class="status-indicator">
        <div class="dot fail"></div>
      </div>

      <!-- 右侧操作区 -->
      <div class="tool-actions">
        <button :class="{ active: showExtraInfo, 'action-btn': true }">
          <svg class="chevron" viewBox="0 0 1024 1024" width="10" height="10">
            <path
              d="M338.752 104.704a64 64 0 0 0 0 90.496l316.8 316.8-316.8 316.8a64 64 0 0 0 90.496 90.496l362.048-362.048a64 64 0 0 0 0-90.496L429.248 14.208a64 64 0 0 0-90.496 90.496z"
              fill="currentColor"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- 内联展开详情区 -->
    <div class="tool-details" :class="{ 'is-expanded': showExtraInfo }">
      <div class="details-inner">
        <div class="detail-section">
          <div class="section-header">
            <div class="section-label">参数</div>
            <button class="copy-text-btn" @click.stop="copyParameters">复制</button>
          </div>
          <pre class="json-box">{{ formattedParameters }}</pre>
        </div>
        <div v-if="toolCall.result" class="detail-section">
          <div class="section-header">
            <div class="section-label">结果</div>
            <button class="copy-text-btn" @click.stop="copyResult">复制</button>
          </div>
          <pre class="json-box" :class="{ 'error-text': toolCallFail }">{{ formattedResult }}</pre>
        </div>
      </div>
    </div>
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
      // 正在运行或准备中时默认展开细节，结束后默认收起
      showExtraInfo: this.toolCall.action === "running" || this.toolCall.action === "pending",
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
        if (typeof r === 'object') {
          return JSON.stringify(r, null, 2);
        }
        return String(r);
      } catch (e) { return String(r); }
    },
    skill_status_text() {
      if (this.toolCall.action === "finished") return "已激活";
      if (this.toolCall.action === "failed") return "失败";
      if (this.toolCall.action === "running") return "执行中";
      return "准备中";
    },
  },
  watch: {
    "toolCall.action"(newVal) {
      // 当工具执行结束或失败时，自动收起
      if (newVal === "finished" || newVal === "failed") {
        this.showExtraInfo = false;
      } else if (newVal === "running") {
        this.showExtraInfo = true;
      }
    },
  },
  methods: {
    toggleExtraInfo() {
      this.showExtraInfo = !this.showExtraInfo;
    },
    getSkillName(params) {
      try {
        const p = typeof params === "string" ? JSON.parse(params) : params;
        return p.SkillName || p.skill_name || "未知技能";
      } catch (e) { return "未知技能"; }
    },
    copyParameters() {
      navigator.clipboard.writeText(this.formattedParameters);
      if (this.$message) this.$message.success("参数已复制");
    },
    copyResult() {
      navigator.clipboard.writeText(this.formattedResult);
      if (this.$message) this.$message.success("结果已复制");
    }
  },
};
</script>

<style scoped>
.tool-call-block {
  display: flex;
  flex-direction: column;
  margin: 2px 0;
}

.tool-call-bar {
  display: flex;
  align-items: center;
  width: fit-content;
  height: 32px;
  background: transparent;
  border: none;
  transition: all 0.2s;
  user-select: none;
  cursor: pointer;
  gap: 6px;
}

.tool-call-bar .tool-name {
  color: #555;
  /* 正常状态加深 */
}

.tool-call-bar:hover .tool-name {
  color: #222;
  /* 悬浮状态进一步加深 */
}

.tool-call-bar .tool-actions {
  color: #bbb;
}

.tool-call-bar:hover .tool-actions {
  color: #888;
}

.tool-name {
  font-size: 13px;
  font-weight: 500;
  transition: color 0.2s;
}

.tool-status-text {
  font-size: 12px;
  color: #999;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.dot.fail {
  background: #ff4d4f;
}

.is-loading {
  animation: dot-blink 1.5s infinite;
}

@keyframes dot-blink {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}



.tool-actions {
  display: flex;
  align-items: center;
  color: #bbb;
  /* 统一颜色 */
}

.action-btn {
  background: transparent;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  cursor: pointer;
  color: inherit;
}

.chevron {
  transition: transform 0.3s ease;
  transform: rotate(90deg);
}

.action-btn.active .chevron {
  transform: rotate(-90deg);
}

.tool-details {
  max-width: 100%;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  opacity: 0;
  will-change: max-height;
  /* 性能优化 */
}

.tool-details.is-expanded {
  max-height: 160px;
  overflow-y: auto;
  opacity: 1;
  margin-bottom: 8px;
}

.details-inner {
  padding: 8px 12px;
  border-left: 2px solid #efefef;
  margin-left: 1px;
  background: rgba(0, 0, 0, 0.01);
  border-radius: 0 4px 4px 4px;
}

.detail-section {
  margin-bottom: 8px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.section-label {
  font-size: 10px;
  color: #aaa;
  text-transform: uppercase;
  font-weight: bold;
}

.copy-text-btn {
  background: transparent;
  border: none;
  color: #aaa;
  /* 与标签一致的浅灰色 */
  cursor: pointer;
  padding: 0;
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
  transition: all 0.2s;
  opacity: 0.8;
}

.copy-text-btn:hover {
  color: #1890ff;
  /* 悬浮时变蓝 */
  opacity: 1;
}

.json-box {
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  background: transparent;
  color: #666;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  padding: 0;
}

.error-text {
  color: #cf1322;
}

.tool-details::-webkit-scrollbar {
  width: 3px;
}

.tool-details::-webkit-scrollbar-thumb {
  background-color: #eee;
  border-radius: 2px;
}

</style>
