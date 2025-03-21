<script>
export default {
  name: "VirtualMessageList",
  props: {
    items: {
      type: Array,
      required: true,
    },
    itemHeight: {
      type: Number,
      default: 100,
    },
    visibleItems: {
      type: Number,
      default: 10,
    },
    buffer: {
      type: Number,
      default: 5,
    },
  },
  emits: { scroll: null },
  data() {
    return {
      scrollTop: 0,
      containerHeight: 0,
      startIndex: 0,
      endIndex: 0,
      observer: null,
    };
  },
  computed: {
    totalHeight() {
      return this.items.length * this.itemHeight;
    },
    visibleRange() {
      const start = Math.max(0, this.startIndex - this.buffer);
      const end = Math.min(this.items.length, this.endIndex + this.buffer);
      return this.items.slice(start, end);
    },
    containerStyle() {
      return {
        height: "100%",
        overflow: "auto",
        position: "relative",
      };
    },
    innerStyle() {
      return {
        height: `${this.totalHeight}px`,
        position: "relative",
      };
    },
  },
  mounted() {
    this.updateVisibleItems();
    this.initResizeObserver();
  },
  beforeUnmount() {
    if (this.observer) {
      this.observer.disconnect();
    }
  },
  methods: {
    handleScroll(event) {
      this.scrollTop = event.target.scrollTop;
      this.updateVisibleItems();
      this.$emit("scroll", event);
    },
    updateVisibleItems() {
      const container = this.$refs.container;
      if (!container) return;

      this.containerHeight = container.clientHeight;
      this.startIndex = Math.floor(this.scrollTop / this.itemHeight);
      this.endIndex = Math.min(
        this.items.length,
        Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight),
      );
    },
    getItemStyle(index) {
      const top = (index + (this.startIndex - this.buffer)) * this.itemHeight;
      return {
        position: "absolute",
        top: `${top}px`,
        width: "100%",
        height: `${this.itemHeight}px`,
      };
    },
    initResizeObserver() {
      this.observer = new ResizeObserver(() => {
        this.updateVisibleItems();
      });
      this.observer.observe(this.$refs.container);
    },
    scrollToIndex(index) {
      if (this.$refs.container) {
        this.$refs.container.scrollTop = index * this.itemHeight;
      }
    },
    scrollToBottom() {
      if (this.$refs.container) {
        this.$refs.container.scrollTop = this.totalHeight;
      }
    },
  },
};
</script>

<template>
  <div ref="container" :style="containerStyle" @scroll="handleScroll">
    <div :style="innerStyle">
      <div
        v-for="(item, index) in visibleRange"
        :key="index + (startIndex - buffer)"
        :style="getItemStyle(index)"
      >
        <slot :item="item" :index="index + (startIndex - buffer)" />
      </div>
    </div>
  </div>
</template>
