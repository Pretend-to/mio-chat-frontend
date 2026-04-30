<template>
  <div class="reason-block">
    <div class="head-bar" @click="toggleShow">
      <div class="reason-info">{{ getReasonInfo }}</div>
      <button :class="{ active: show, 'extra-info-button': true }">
        <i class="iconfont icon-return" />
      </button>
    </div>
    <div 
      ref="reasonContent" 
      class="reason-content" 
      :class="{ 'is-expanded': show }"
      @scroll="handleScroll"
    >
      {{ content }}
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
  },
  data() {
    return {
      show: true,
      isUserScrolledUp: false,
    };
  },
  computed: {
    getReasonInfo() {
      if (this.endTime) {
        const timeDiff = this.endTime - this.startTime;
        return `已深度思考（耗时 ${(timeDiff / 1000).toFixed(2)} 秒）`;
      } else {
        return `正在深度思考......`;
      }
    },
  },
  watch: {
    content() {
      if (this.show) {
        this.$nextTick(() => {
          this.scrollToBottomIfNeeded();
        });
      }
    },
  },
  methods: {
    toggleShow() {
      this.show = !this.show;
      if (this.show) {
        this.isUserScrolledUp = false;
        this.$nextTick(() => {
          this.scrollToBottomIfNeeded();
        });
      }
    },
    handleScroll(e) {
      const el = e.target;
      // 距离底部超过20px则认为用户已经主动向上滚动
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
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
}

.reason-info {
  margin: 0.5rem 0;
  font-size: 0.8rem;
  min-width: 8rem;
  flex-basis: 10rem;
  text-wrap: nowrap;
}

.head-bar {
  flex-basis: 1rem;
  margin: 0.5rem 0;
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-start;
  align-items: center;
  width: fit-content;
  background-color: #f5f5f5;
  border-radius: 10px;
  padding: 0px 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.head-bar:hover {
  background-color: #ededed;
}

.head-bar button {
  flex-basis: 1rem;
  margin-left: 0.5rem;
  background-color: transparent;
  border: none;
  cursor: pointer;
  transition: transform 0.3s ease-in-out;
  display: flex;
  align-items: center;
  gap: 2px;
}

.head-bar button i {
  font-size: 0.8rem;
}

.head-bar button.active {
  transform: rotate(-90deg);
}

.reason-content {
  max-width: 100%;
  max-height: 0;
  overflow: hidden;
  word-break: break-word;
  user-select: text;
  font-size: 0.8rem;
  color: #6f6f6f;
  white-space: pre-line;
  border-left: 2px solid transparent;
  transition: max-height 0.3s ease-in-out, margin 0.3s ease-in-out, border-color 0.3s ease-in-out, opacity 0.3s ease-in-out;
  padding-left: 1rem;
  margin-top: 0;
  margin-bottom: 0;
  opacity: 0;
}

.reason-content.is-expanded {
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
  border-left-color: #ccc;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  opacity: 1;
}

/* 隐藏 reason-content 的默认粗大滚动条，美化一下 */
.reason-content::-webkit-scrollbar {
  width: 6px;
}
.reason-content::-webkit-scrollbar-thumb {
  background-color: #d1d1d1;
  border-radius: 3px;
}
.reason-content::-webkit-scrollbar-track {
  background: transparent;
}
</style>
