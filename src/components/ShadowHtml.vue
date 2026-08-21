<template>
  <div class="shadow-html-host" ref="host"></div>
</template>
<script>
/**
 * ShadowHtml - 用 Shadow DOM 同文档渲染 Agent 生成的 HTML UI。
 *
 * 相比 iframe 的优势：
 *   - CSS 天然隔离（shadow root 内样式不外泄，也不受主页面样式污染）
 *   - 高度自适应（内容撑开宿主 div，无需 postMessage / ResizeObserver）
 *   - 交互靠内联 onclick + window.__mio 白名单方法（script 不执行，安全）
 */
export default {
  name: "ShadowHtml",
  props: {
    html: { type: String, default: "" },
  },
  watch: {
    html() {
      this.renderHtml();
    },
  },
  mounted() {
    this.renderHtml();
  },
  beforeUnmount() {
    this.shadowRoot = null;
  },
  methods: {
    renderHtml() {
      const host = this.$refs.host;
      if (!host) return;
      if (!this.shadowRoot) {
        this.shadowRoot = host.attachShadow({ mode: "open" });
      }
      this.shadowRoot.innerHTML = this.html || "";
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
