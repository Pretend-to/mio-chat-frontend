<template>
  <div class="reason-block">
    <div class="head-bar">
      <div class="reason-info">{{ getReasonInfo }}</div>
      <button
        :class="{ active: show, 'extra-info-button': true }"
        @click="toggleShow"
      >
        <i class="iconfont icon-return" />
      </button>
    </div>
    <div
      ref="reasonContent"
      class="reason-content"
      :style="{ 'max-height': maxHeight }"
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
      maxHeight: "auto", // 初始值
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
  mounted() {
    this.updateMaxHeight(); //初始展开
  },
  updated() {
    this.updateMaxHeight(); //防止内容更新,导致高度计算错误
  },
  methods: {
    toggleShow() {
      this.show = !this.show;
      this.updateMaxHeight();
    },
    updateMaxHeight() {
      if (this.show) {
        // 展开时，设置为内容实际高度 + 一些额外空间 (如 padding)
        this.maxHeight = this.$refs.reasonContent.scrollHeight + 20 + "px";
      } else {
        // 收起时，设置为 0
        this.maxHeight = "0px";
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
  /* 使用 ease-in-out */
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
  /* max-height 在 JavaScript 中动态控制 */
  overflow: hidden;
  /* 隐藏超出部分 */
  user-select: text;
  font-size: 0.8rem;
  color: #6f6f6f;
  white-space: pre-line;
  border-left: 2px solid #ccc;
  transition: max-height 0.3s ease-in-out;
  /* 对 max-height 应用过渡 */
  padding-left: 1rem;
}
</style>
