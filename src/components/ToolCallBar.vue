<template>
  <ActionBlock
    :iconClass="iconClass"
    :title="toolTitle"
    :statusText="statusText"
    :isLoading="isLoading"
    :isFailed="toolCallFail"
    :defaultExpanded="showExtraInfo"
    @toggle="toggleExtraInfo"
  >
    <div class="detail-section">
      <div class="section-header">
        <div class="section-label">参数</div>
        <button class="copy-text-btn" @click.stop="copyParameters">
          复制
        </button>
      </div>
      <pre class="json-box">{{ formattedParameters }}</pre>
    </div>
    <div v-if="toolCall.result" class="detail-section">
      <div class="section-header">
        <div class="section-label">结果</div>
        <button class="copy-text-btn" @click.stop="copyResult">复制</button>
      </div>
      <pre class="json-box" :class="{ 'error-text': toolCallFail }">{{
        formattedResult
      }}</pre>
    </div>
  </ActionBlock>
</template>

<script>
import ActionBlock from './ActionBlock.vue';

export default {
  components: {
    ActionBlock
  },
  props: {
    toolCall: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      // 正在运行、就绪或准备中时默认展开细节，结束后默认收起
      showExtraInfo:
        this.toolCall.action === "running" ||
        this.toolCall.action === "pending" ||
        this.toolCall.action === "started",
      wasManuallyToggled: false,
    };
  },
  computed: {
    iconClass() {
      const name = this.toolCall.name || '';
      if (name.startsWith('Skill_mid_') || name === 'Skill') {
        return 'mio-icon-skill';
      }
      if (name.split('_mid_')[0] === 'memory') {
        return 'mio-icon-memory';
      }
      return 'mio-icon-tool';
    },
    toolTitle() {
      const name = this.toolCall.name || '';
      if (name.startsWith('Skill_mid_') || name === 'Skill') {
        return this.getSkillName(this.toolCall.parameters);
      }
      if (name.split('_mid_')[0] === 'memory') {
        return '记录记忆';
      }
      return name.split('_mid_')[0] || '未知工具';
    },
    statusText() {
      const name = this.toolCall.name || '';
      if (name.startsWith('Skill_mid_') || name === 'Skill') {
        return this.skill_status_text;
      }
      return this.call_status;
    },
    isLoading() {
      const action = this.toolCall.action;
      return action === 'running' || action === 'pending' || action === 'started';
    },
    toolCallSuccess() {
      return (
        this.toolCall.action === "finished" && !this.toolCall?.result?.error
      );
    },
    toolCallFail() {
      return (
        (this.toolCall.action === "finished" && this.toolCall?.result?.error) ||
        this.toolCall.action === "failed"
      );
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
      } catch (e) {
        return String(p);
      }
    },
    formattedResult() {
      const r = this.toolCall.result;
      if (r === undefined || r === null) return "等待中...";
      try {
        if (typeof r === "object") {
          return JSON.stringify(r, null, 2);
        }
        return String(r);
      } catch (e) {
        return String(r);
      }
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
        this.handleAutoCollapse();
      } else if (
        newVal === "running" ||
        newVal === "pending" ||
        newVal === "started"
      ) {
        if (!this.wasManuallyToggled) {
          this.showExtraInfo = true;
        }
      }
    },
  },
  mounted() {
    // 如果挂载时就在运行，且是实时消息，强制展开一次
    if (
      this.toolCall.action === "running" ||
      this.toolCall.action === "pending" ||
      this.toolCall.action === "started"
    ) {
      this.showExtraInfo = true;
    }
  },
  methods: {
    toggleExtraInfo(expanded) {
      this.showExtraInfo = expanded;
      this.wasManuallyToggled = true;
    },
    handleAutoCollapse() {
      if (!this.wasManuallyToggled) {
        setTimeout(() => {
          this.showExtraInfo = false;
        }, 800); // 工具调用通常稍微慢一点，给 0.8s 观察结果
      }
    },
    getSkillName(params) {
      try {
        const p = typeof params === "string" ? JSON.parse(params) : params;
        return p.SkillName || p.skill_name || "未知技能";
      } catch (e) {
        return "未知技能";
      }
    },
    copyParameters() {
      navigator.clipboard.writeText(this.formattedParameters);
      if (this.$message) this.$message.success("参数已复制");
    },
    copyResult() {
      navigator.clipboard.writeText(this.formattedResult);
      if (this.$message) this.$message.success("结果已复制");
    },
  },
};
</script>

<style scoped>
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
  font-family: "Fira Code", monospace;
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
</style>
