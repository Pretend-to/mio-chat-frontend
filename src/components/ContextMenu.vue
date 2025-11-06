<template>
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
        <span>复制消息</span>
      </div>
      <div v-if="seletedImage" @click.stop="copySeletedImage">
        <i class="iconfont fuzhi"></i>
        <span>复制图片</span>
      </div>
      <div v-if="seletedImage" @click.stop="saveSeletedImage">
        <i class="iconfont fuzhi"></i>
        <span>保存图片</span>
      </div>
      <div @click.stop="retryMessage">
        <i class="iconfont reset"></i>
        <span>重试消息</span>
      </div>
      <div @click.stop="replyMessage">
        <i class="iconfont yinyong"></i>
        <span>引用消息</span>
      </div>
      <div @click.stop="deleteMessage">
        <i class="iconfont shanchu"></i>
        <span>删除消息</span>
      </div>
    </template>
  </div>
</template>
<script>
export default {
  name: "MessageMenu", // 建议添加组件 name，方便调试
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
      this.copyTextToClipboard(this.seletedText);
      this.$emit("close");
    },
    retryMessage() {
      this.$emit("message-option", "retry");
      this.$emit("close");
    },
    replyMessage() {
      this.$emit("message-option", "reply");
      this.$emit("close");
    },
    deleteMessage() {
      this.$emit("message-option", "delete");
      this.$emit("close");
    },
    enterChat() {
      this.$emit("message-option", "enter");
      this.$emit("close");
    },
    togglePriority() {
      this.$emit("message-option", "priority");
      this.$emit("close");
    },
    shareBot() {
      this.$emit("message-option", "share");
      this.$emit("close");
    },
    deleteBot() {
      this.$emit("message-option", "delete");
      this.$emit("close");
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
      try {
        const response = await fetch(imgSrc);
        if (!response.ok) {
          throw new Error("网络错误，无法获取图片");
        }
        const blob = await response.blob();
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          // 使用 Promise 包装 toBlob
          const pngBlob = await new Promise((resolve) => {
            canvas.toBlob(resolve, "image/png");
          });
          if (pngBlob) {
            const item = new ClipboardItem({ "image/png": pngBlob });
            await navigator.clipboard.write([item]); // 使用 await
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
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          this.$message({ message: "加载图片失败", type: "error" });
          URL.revokeObjectURL(url); // 确保在错误时也释放 URL
        };
        img.src = url;
      } catch (err) {
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
    background-color: hsla(0, 0%, 100%, .78)
    backdrop-filter: blur(0.5rem)
    border-radius: 0.5rem
    padding: .5rem
    z-index: 9999
    -webkit-user-select: none
    -moz-user-select: none
    -ms-user-select: none
    user-select: none
    
    // 移动端样式 - 横向网格布局
    @media (max-width: 768px)
        display: grid
        grid-template-columns: repeat(auto-fit, minmax(60px, 1fr))
        padding: 0.5rem
        max-width: 16rem
        background-color: rgba(40, 44, 52, 0.85)
        border-radius: 1rem
        left: 50%
        transform: translateX(-50%)
        
    @keyframes pop-up
        0%
            transform: scale(1)
        50%
            transform: scale(1.2)
        100%
            transform: scale(1)
            
    & div
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
        background-color: hsla(0, 0%, 90%, .88)
        
        // 移动端悬停效果
        @media (max-width: 768px)
            background-color: rgba(255, 255, 255, 0.1)
            
    & div:hover > i
        animation: pop-up 0.5s ease-in-out 1 forwards
        
    & i
        position: absolute
        display: flex
        justify-content: center
        align-items: center
        transform-origin: center
        
        // 移动端图标样式
        @media (max-width: 768px)
            position: static
            font-size: 1rem
            margin-bottom: 0.3rem
            color: rgba(255, 255, 255, 0.9)
            
    & span
        font-size: 0.8rem
        color: rgb(120, 124, 127)
        margin-left: 1.8rem
        
        // 移动端文字样式
        @media (max-width: 768px)
            margin-left: 0
            font-size: 0.7rem
            color: rgba(255, 255, 255, 0.8)
            line-height: 1.2
            word-break: break-all

    &.expand-down
      // 当向下展开，三角在顶部居中，指向触发点
      &::before
        content: ''
        position: absolute
        top: -6px
        left: 50%
        transform: translateX(-50%)
        width: 0
        height: 0
        border-left: 6px solid transparent
        border-right: 6px solid transparent
        // 与移动端菜单主体保持一致的背景色
        border-bottom: 6px solid rgba(40, 44, 52, 0.85)
  
    &.expand-up
      // 当向上展开，三角在底部居中，指向触发点
      &::after
        content: ''
        position: absolute
        bottom: -6px
        left: 50%
        transform: translateX(-50%)
        width: 0
        height: 0
        border-left: 6px solid transparent
        border-right: 6px solid transparent
        // 与移动端菜单主体保持一致的背景色
        border-top: 6px solid rgba(40, 44, 52, 0.85)
</style>
