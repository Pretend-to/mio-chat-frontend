<template>
  <transition name="menu">
    <div id="message-menu" :class="{ 'expand-up': isUp, 'expand-down': !isUp }">
      <template v-if="type === 'friend'">
        <div @click.stop="enterChat">
          <i class="iconfont chat"></i>
          <span>进入对话</span>
        </div>
        <div @click.stop="togglePriority">
          <i class="iconfont star"></i>
          <span>{{ message.priority === 0 ? "取消置顶" : "置顶" }}</span>
        </div>
        <div @click.stop="shareBot">
          <i class="iconfont icon-share"></i>
          <span>分享</span>
        </div>
        <div @click.stop="deleteBot">
          <i class="iconfont shanchu"></i>
          <span>删除</span>
        </div>
      </template>
      <template v-else>
        <div v-if="seletedText" @click.stop="copySeletedText">
          <i class="iconfont fuzhi"></i>
          <span>复制选中</span>
        </div>
        <div @click.stop="copyText">
          <i class="iconfont fuzhi"></i>
          <span>复制</span>
        </div>
        <div @click.stop="readAloud">
          <template v-if="message.id === currentSpeakingMessageId">
            <i class="mio-icon mio-icon-speaker-mute"></i>
            <span>停止朗读</span>
          </template>
          <template v-else>
            <i class="mio-icon mio-icon-speaker"></i>
            <span>朗读</span>
          </template>
        </div>
        <div v-if="seletedImage && !onPhone" @click.stop="copySeletedImage">
          <i class="iconfont fuzhi"></i>
          <span>复制图片</span>
        </div>
        <div v-if="seletedImage" @click.stop="saveSeletedImage">
          <i class="iconfont fuzhi"></i>
          <span>保存图片</span>
        </div>
        <div v-if="canRetry" @click.stop="retryMessage">
          <i class="iconfont reset"></i>
          <span>重试</span>
        </div>
        <div
          v-if="['pending', 'retrying'].includes(message.status)"
          @click.stop="stopGeneration"
        >
          <i class="iconfont stop"></i>
          <span>停止</span>
        </div>
        <div @click.stop="replyMessage">
          <i class="iconfont yinyong"></i>
          <span>引用</span>
        </div>
        <div @click.stop="togglePin">
          <el-icon class="iconfont-el"><CollectionTag /></el-icon>
          <span>{{ message.isPinned ? "取消钉住" : "钉住消息" }}</span>
        </div>
        <div @click.stop="multiSelect">
          <i class="iconfont xuanze"></i>
          <span>多选</span>
        </div>
        <div @click.stop="deleteMessage">
          <i class="iconfont shanchu"></i>
          <span>删除</span>
        </div>
      </template>
    </div>
  </transition>
</template>
<script>
import { CollectionTag } from "@element-plus/icons-vue";

export default {
  name: "MessageMenu", // 建议添加组件 name，方便调试
  components: {
    CollectionTag,
  },
  props: {
    type: {
      type: String,
      default: "message",
    },
    message: {
      type: Object,
      default: () => ({}),
    },
    seletedText: {
      type: String,
      default: "",
    },
    seletedImage: {
      type: String,
      default: "",
    },
    clientX: {
      type: Number,
      default: 0,
    },
    currentSpeakingMessageId: {
      type: [String, Number],
      default: null,
    },
    canRetry: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    onPhone() {
      return window.innerWidth < 768;
    },
  },
  data() {
    return {
      isUp: false,
    };
  },
  emits: ["close", "message-option"], //显式声明emit的事件
  methods: {
    updateArrow() {
      // 判断根元素是否通过 inline style 使用 bottom 定位（表示向上展开）
      const el = this.$el;
      if (!el) return;
      const hasBottom = el.style && el.style.bottom && el.style.bottom !== "";
      this.isUp = !!hasBottom;

      if (window.innerWidth < 768 && this.clientX) {
        const rect = el.getBoundingClientRect();
        let relativeX = this.clientX - rect.left;
        const arrowMargin = 16;
        relativeX = Math.max(
          arrowMargin,
          Math.min(rect.width - arrowMargin, relativeX),
        );
        el.style.setProperty("--arrow-left", `${relativeX}px`);
      } else {
        el.style.setProperty("--arrow-left", "50%");
      }
    },
    onWindowResize() {
      // 重新计算三角位置（样式由 CSS 控制，这里主要保持 isUp 更新）
      this.updateArrow();
    },
    async copySeletedImage() {
      this.$emit("close");
      try {
        await this.copyImageToClipboard(this.seletedImage);
      } catch (error) {
        console.error("复制选择图片失败：", error);
      }
    },
    async saveSeletedImage() {
      this.$emit("close");
      try {
        await this.downloadImage(this.seletedImage);
      } catch (error) {
        console.error("保存选择图片失败：", error);
      }
    },
    copyText() {
      console.log("[DEBUG-MENU] 复制全文, messageId:", this.message.id);
      let text = "";
      this.message.content.forEach((element) => {
        if (element.type === "text") {
          text += element.data.text;
        } else if (element.type === "image") {
          text += `\n![图片](${element.data.file})`;
        }
      });
      this.copyTextToClipboard(text);
      this.$emit("close");
    },
    copySeletedText() {
      console.log("[DEBUG-MENU] 复制选中文字, messageId:", this.message.id);
      this.copyTextToClipboard(this.seletedText);
      this.$emit("close");
    },
    readAloud() {
      this.$emit("message-option", "read-aloud");
      this.$emit("close");
    },
    retryMessage() {
      this.$emit("message-option", "retry");
    },
    replyMessage() {
      this.$emit("message-option", "reply");
    },
    togglePin() {
      this.$emit("message-option", "toggle-pin");
      this.$emit("close");
    },
    deleteMessage() {
      this.$emit("message-option", "delete");
    },
    multiSelect() {
      this.$emit("message-option", "multi-select");
    },
    enterChat() {
      this.$emit("message-option", "enter");
    },
    stopGeneration() {
      this.$emit("message-option", "stop");
    },
    togglePriority() {
      this.$emit("message-option", "priority");
    },
    shareBot() {
      this.$emit("message-option", "share");
    },
    deleteBot() {
      this.$emit("message-option", "delete");
    },
    // 封装复制文本到剪贴板的函数
    async copyTextToClipboard(text) {
      let textarea;
      try {
        textarea = document.createElement("textarea");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, 99999); // For mobile devices
        await document.execCommand("copy");
        this.$message({ message: "复制成功", type: "success" });
      } catch (err) {
        console.error("复制失败:", err);
        this.$message({ message: "复制失败", type: "error" });
      } finally {
        document.body.removeChild(textarea);
      }
    },
    // 封装复制图片到剪贴板的函数
    async copyImageToClipboard(imgSrc) {
      const loadingMsg = this.$message({
        message: "正在复制图片，请稍候...",
        type: "info",
        duration: 0,
      });
      try {
        const img = new Image();
        const isSameOrigin = (() => {
          if (!imgSrc) return false;
          if (imgSrc.startsWith("/") && !imgSrc.startsWith("//")) return true;
          try {
            const url = new URL(imgSrc, window.location.origin);
            return url.origin === window.location.origin;
          } catch (e) {
            return false;
          }
        })();

        if (!isSameOrigin) {
          img.crossOrigin = "anonymous";
          const timestamp = Date.now();
          img.src =
            imgSrc + (imgSrc.includes("?") ? "&" : "?") + "t_cors=" + timestamp;
        } else {
          img.src = imgSrc;
        }

        img.onload = async () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            // 使用 Promise 包装 toBlob
            const pngBlob = await new Promise((resolve) => {
              canvas.toBlob(resolve, "image/png");
            });
            loadingMsg.close();
            if (pngBlob) {
              const item = new ClipboardItem({ "image/png": pngBlob });
              await navigator.clipboard.write([item]);
              this.$message({
                message: "图片已复制到剪贴板",
                type: "success",
              });
            } else {
              this.$message({
                message: "转换为 PNG 失败",
                type: "error",
              });
            }
          } catch (canvasErr) {
            loadingMsg.close();
            console.error("Canvas操作失败（可能是跨域头未通过）：", canvasErr);
            this.$message({ message: "复制图片失败，安全限制", type: "error" });
          }
        };
        img.onerror = () => {
          loadingMsg.close();
          this.$message({ message: "加载图片失败", type: "error" });
        };
      } catch (err) {
        loadingMsg.close();
        console.error("复制图片失败:", err);
        this.$message({ message: "复制图片失败", type: "error" });
      }
    },
    // 封装下载图片的函数
    async downloadImage(imgSrc) {
      try {
        const link = document.createElement("a");
        link.href = imgSrc;
        link.download = "image.png";
        link.click();
      } catch (err) {
        console.error("保存图片失败：", err);
        this.$message({ message: "保存图片失败", type: "error" });
      }
    },
  },
  mounted() {
    // 初次渲染后根据 inline style 判断展开方向
    this.$nextTick(() => {
      this.updateArrow();
    });
    window.addEventListener("resize", this.onWindowResize);
  },
  updated() {
    // 当父组件改变 inline style（top/bottom）时更新箭头方向
    this.$nextTick(() => {
      this.updateArrow();
    });
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.onWindowResize);
  },
};
</script>
<style lang="sass" scoped>
#message-menu
    position: fixed
    display: flex
    flex-direction: column
    justify-content: center
    background-color: var(--mio-bg-blur)
    backdrop-filter: blur(0.5rem)
    border-radius: 0.5rem
    padding: .5rem
    z-index: 9999
    -webkit-user-select: none
    user-select: none
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease

    // 移动端样式 - 横向网格布局
    @media (max-width: 768px)
        display: grid
        grid-template-columns: repeat(auto-fit, minmax(60px, 1fr))
        padding: 0.5rem
        max-width: 16rem
        background-color: var(--mio-bg-sidebar-mobile)
        border-radius: 1rem
        left: 50%
        transform: translateX(-50%) scale(1)
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease

    @keyframes pop-up
        0%
            transform: scale(1)
        50%
            transform: scale(1.2)
        100%
            transform: scale(1)

    & div
        position: relative
        margin: 0.4rem 0
        padding: .2rem .4rem
        border-radius: .2rem
        display: flex
        justify-content: space-between
        align-items: center
        cursor: pointer

        // 移动端单个菜单项样式
        @media (max-width: 768px)
            margin: 0
            flex-direction: column
            justify-content: center
            align-items: center
            text-align: center
            border-radius: 0.8rem
            padding: 0rem 0rem
            min-height: 3rem
            background-color: transparent
            transition: background-color 0.2s ease

    & div:hover
        background-color: var(--mio-bg-hover)

        // 移动端悬停效果
        @media (max-width: 768px)
            background-color: var(--mio-bg-hover)

    & div:hover > i
        animation: pop-up 0.5s ease-in-out 1 forwards

    & i, & .iconfont-el
        position: absolute
        left: 0.75rem
        width: 16px
        height: 16px
        top: 50%
        margin-top: -8px
        display: flex
        justify-content: center
        align-items: center
        transform-origin: center

        // 移动端图标样式
        @media (max-width: 768px)
            position: static
            width: 1.2rem
            height: 1.2rem
            font-size: 1rem
            margin-bottom: 0.3rem
            margin-top: 0
            top: auto
            left: auto
            color: var(--mio-text-regular)

    & span
        font-size: 0.8rem
        color: var(--mio-text-regular)
        margin-left: 2.1rem

        // 移动端文字样式
        @media (max-width: 768px)
            margin-left: 0
            font-size: 0.7rem
            color: var(--mio-text-secondary)
            line-height: 1.2
            word-break: break-all

    &.expand-down
      @media (max-width: 768px)
        // 当向下展开，三角在顶部，指向触发点（仅移动端）
        &::before
          content: ''
          position: absolute
          top: -6px
          left: var(--arrow-left, 50%)
          transform: translateX(-50%)
          width: 0
          height: 0
          border-left: 6px solid transparent
          border-right: 6px solid transparent
          // 与移动端菜单主体保持一致的背景色
          border-bottom: 6px solid var(--mio-bg-card)

    &.expand-up
      @media (max-width: 768px)
        // 当向上展开，三角在底部，指向触发点（仅移动端）
        &::after
          content: ''
          position: absolute
          bottom: -6px
          left: var(--arrow-left, 50%)
          transform: translateX(-50%)
          width: 0
          height: 0
          border-left: 6px solid transparent
          border-right: 6px solid transparent
          // 与移动端菜单主体保持一致的背景色
          border-top: 6px solid var(--mio-bg-card)

    // 动画 transition classes
    &.menu-enter-from, &.menu-leave-to
        opacity: 0
        @media (max-width: 768px)
            transform: translateX(-50%) scale(0)
        @media (min-width: 769px)
            transform: scale(0.8)

    &.menu-enter-active, &.menu-leave-active
        @media (max-width: 768px)
            &.expand-down
              transform-origin: center top
            &.expand-up
              transform-origin: center bottom
        @media (min-width: 769px)
            &.expand-down
              transform-origin: top left
            &.expand-up
              transform-origin: bottom left
</style>
