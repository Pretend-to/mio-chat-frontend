<template>
  <ActionBlock
    iconClass="mio-icon-thinking"
    :title="getReasonInfo"
    :isLoading="isThinking"
    :defaultExpanded="show"
    @toggle="toggleShow"
    @scroll="handleScroll"
  >
    <div class="content-text" ref="contentEl">
      {{ content }}
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
      return `深度思考 (${seconds}s)`;
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
    toggleShow(expanded) {
      this.show = expanded;
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
      this.isUserScrolledUp =
        el.scrollHeight - el.scrollTop - el.clientHeight > 20;
    },
    scrollToBottomIfNeeded() {
      // 找到实际滚动容器：ActionBlock.vue 中的 action-block-details，通过寻找 DOM 父级或子级容器
      const el = this.$el.querySelector('.action-block-details');
      if (!el) return;
      if (!this.isUserScrolledUp) {
        el.scrollTop = el.scrollHeight;
      }
    },
  },
};
</script>

<style scoped>
.content-text {
  font-size: 12.5px;
  line-height: 1.6;
  color: #666;
  white-space: pre-line;
  word-break: break-word;
  padding: 4px 0; /* 边框缩进交给 ActionBlock 的 details-inner */
}
</style>

