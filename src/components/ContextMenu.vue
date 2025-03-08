<template>
  <div id="message-menu">
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
  emits: ["close", "message-option"], //显式声明emit的事件
  methods: {
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

    & div:hover
        background-color: hsla(0, 0%, 90%, .88)

    & div:hover > i
        animation: pop-up 0.5s ease-in-out 1 forwards

    & i
        position: absolute
        display: flex
        justify-content: center
        align-items: center
        transform-origin: center


    & span
        font-size: 0.8rem
        color: rgb(120, 124, 127)
        margin-left: 1.8rem
</style>
