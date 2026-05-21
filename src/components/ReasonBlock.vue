<template>
  <div class="reason-block" :class="{ 'is-collapsed': !show }">
    <div class="head-bar" @click="toggleShow">
      <i class="mio-icon mio-icon-thinking"></i>
      <div class="reason-info" :class="{ 'is-loading': isThinking }">
        {{ getReasonInfo }}
      </div>
      <button :class="{ active: show, 'extra-info-button': true }">
        <svg class="chevron" viewBox="0 0 1024 1024" width="10" height="10">
          <path d="M338.752 104.704a64 64 0 0 0 0 90.496l316.8 316.8-316.8 316.8a64 64 0 0 0 90.496 90.496l362.048-362.048a64 64 0 0 0 0-90.496L429.248 14.208a64 64 0 0 0-90.496 90.496z" fill="currentColor"></path>
        </svg>
      </button>
    </div>
    <div 
      ref="reasonContent" 
      class="reason-content" 
      :class="{ 'is-expanded': show }"
      @scroll="handleScroll"
    >
      <div class="content-text">
        {{ content }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    content: {
      required: true,
      type: String,
      default: "",
    },
    startTime: {
      required: true,
      type: Number,
    },
    endTime: {
      required: false,
      type: Number,
      default: 0,
    },
    duration: {
      required: false,
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      show: !this.endTime && !(this.duration > 0), // 正在思考时默认展开，思考完默认收起
      wasManuallyToggled: false,
      isUserScrolledUp: false,
      currentTime: Date.now(),
      timer: null,
    };
  },
  computed: {
    getReasonInfo() {
      // 1. 如果已有固定时长，直接显示
      if (this.duration > 0) {
        return `已深度思考 (${(this.duration / 1000).toFixed(1)}s)`;
      }
      
      // 2. 如果已结束但只有时间戳，计算时长
      if (this.endTime) {
        const timeDiff = this.endTime - this.startTime;
        if (timeDiff <= 0) return `已深度思考`;
        return `已深度思考 (${(timeDiff / 1000).toFixed(1)}s)`;
      }
      
      // 3. 正在思考中，显示实时计时器
      const liveDiff = this.currentTime - this.startTime;
      const seconds = Math.max(0, liveDiff / 1000).toFixed(1);
      return `正在深度思考 (${seconds}s)`;
    },
    isThinking() {
      // 只有既没有 endTime 也没有正数 duration 时，才认为正在思考
      return !this.endTime && !(this.duration > 0);
    },
  },
  watch: {
    endTime(newVal) {
      if (newVal) {
        this.handleAutoCollapse();
        this.stopTimer();
      }
    },
    duration(newVal) {
      if (newVal > 0) {
        this.handleAutoCollapse();
        this.stopTimer();
      }
    },
    content() {
      // 只要内容在更新且没有被手动折叠，确保展开
      if (this.isThinking && !this.wasManuallyToggled) {
        this.show = true;
      }
      if (this.show) {
        this.$nextTick(() => {
          this.scrollToBottomIfNeeded();
        });
      }
    },
  },
  mounted() {
    if (this.isThinking) {
      this.startTimer();
      this.show = true; // 强制直播态展开
    }
  },
  beforeUnmount() {
    this.stopTimer();
  },
  methods: {
    startTimer() {
      if (this.timer) return;
      this.timer = setInterval(() => {
        this.currentTime = Date.now();
      }, 100);
    },
    stopTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    },
    toggleShow() {
      this.show = !this.show;
      this.wasManuallyToggled = true; // 只要用户点过，我们就停止自动干预
      if (this.show) {
        this.isUserScrolledUp = false;
        this.$nextTick(() => {
          this.scrollToBottomIfNeeded();
        });
      }
    },
    handleAutoCollapse() {
      // 如果用户没有手动点过，我们延迟收起，给用户一点反应时间
      if (!this.wasManuallyToggled) {
        setTimeout(() => {
          this.show = false;
        }, 500); // 延迟 0.5s 收起
      }
    },
    handleScroll(e) {
      const el = e.target;
      this.isUserScrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 20;
    },
    scrollToBottomIfNeeded() {
      const el = this.$refs.reasonContent;
      if (!el) return;
      if (!this.isUserScrolledUp) {
        el.scrollTop = el.scrollHeight;
      }
    },
  },
};
</script>

<style scoped>
.reason-block {
  margin: 2px 0;
  display: flex;
  flex-direction: column;
}

.head-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  width: fit-content;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-left: -8px; /* Offset padding */
}

.head-bar:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.head-bar .reason-info {
  color: #666;
  font-weight: 450;
}

.head-bar:hover .reason-info {
  color: #111;
}

.head-bar .extra-info-button {
  color: #bbb;
}

.head-bar:hover .extra-info-button {
  color: #888;
}

.reason-info {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.2px;
  line-height: 1;
  transition: color 0.2s;
}

.is-loading {
  animation: dot-blink 1.5s infinite;
}

@keyframes dot-blink {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.extra-info-button {
  background: transparent;
  border: none;
  color: #bbb; /* 统一颜色 */
  display: flex;
  align-items: center;
  padding: 0;
  transition: transform 0.3s ease;
  cursor: pointer;
}

.chevron {
  transition: transform 0.3s ease;
  transform: rotate(90deg);
}

.extra-info-button.active .chevron {
  transform: rotate(-90deg);
}

.reason-content {
  max-width: 100%;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  opacity: 0;
  will-change: max-height; /* 性能优化 */
}

.reason-content.is-expanded {
  max-height: 120px;
  overflow-y: auto; /* 开启滚动 */
  opacity: 1;
  margin-bottom: 4px;
}

.content-text {
  font-size: 12.5px;
  line-height: 1.6;
  color: #666;
  white-space: pre-line;
  word-break: break-word;
  padding: 4px 12px;
  border-left: 2px solid #efefef;
  margin-left: 1px;
}

.reason-content::-webkit-scrollbar {
  width: 3px;
}
.reason-content::-webkit-scrollbar-thumb {
  background-color: #eee;
  border-radius: 2px;
}
</style>



