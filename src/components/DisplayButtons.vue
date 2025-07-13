<template>
  <ul
    :class="{
      'window-controls': true,
      fullscreen: fullScreen,
      preview: preview,
    }"
    data-tauri-drag-region="true"
  >
    <li class="button" data-tauri-drag-region @click="minimizeWindow">
      <span class="window-min">—</span>
    </li>
    <li
      v-if="fullScreen"
      class="button"
      data-tauri-drag-region
      @click="configFullScreen(false)"
    >
      <span class="window-inmax">
        <i class="iconfont chuangkouhua"></i>
      </span>
    </li>
    <li
      v-else
      class="button"
      data-tauri-drag-region
      @click="configFullScreen(true)"
    >
      <span class="window-max">▢</span>
    </li>
    <li id="close" class="button" data-tauri-drag-region @click="closeWindow">
      <span class="window-close">&times;</span>
    </li>
  </ul>
</template>

<script>
import { Window } from "@tauri-apps/api/window";

let mainWindow = null;

export default {
  props: {
    fullScreen: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["set-screen","close"],
  data() {
    return {
      preview: false,
      isTauri: !!(window.__TAURI__ || window.__TAURI_INTERNALS__), // 检查是否存在任一对象
    };
  },
  created() {
    const urlParams = new URLSearchParams(window.location.search);
    const preview = urlParams.get("preview");
    if (preview === "true") {
      this.preview = true;
    }
    if (this.isTauri) {
      mainWindow = new Window("main");
    }
  },
  methods: {
    waiting() {
      if (this.$message) {
        this.$message({ message: "此功能尚未开放", type: "warning" });
      } else {
        console.warn("此功能尚未开放 (Tauri 环境外)");
        alert("此功能尚未开放");
      }
    },

    async getMainWindow() {
      try {
        if (!mainWindow) {
          console.error("Failed to get main window.");
          return null;
        }
        return mainWindow;
      } catch (error) {
        console.error("Error getting main window:", error);
        return null;
      }
    },

    async minimizeWindow() {
      if (this.isTauri) {
        if (mainWindow) {
          try {
            await mainWindow.minimize();
          } catch (e) {
            console.error("Failed to minimize window:", e);
            this.waiting(); // 最小化失败则提示
          }
        } else {
          this.waiting(); // 获取 mainWindow 失败则提示
        }
      } else {
        // this.waiting(); // Web 环境
        this.$emit("close");
      }
    },

    configFullScreen(fullScreen) {
      if (this.isTauri) {
        (async () => {
          if (mainWindow) {
            try {
              if (fullScreen) {
                await mainWindow.maximize();
              } else {
                await mainWindow.unmaximize();
              }
              this.$emit("set-screen", fullScreen); // Tauri 环境也 emit 事件，和 web 一致
            } catch (e) {
              console.error("Failed to toggle maximize:", e);
              this.waiting(); // Tauri 出错也 waiting
            }
          } else {
            this.waiting(); // 获取 mainWindow 失败则提示
          }
        })();
      } else {
        this.$emit("set-screen", fullScreen); // Web 环境使用原有的 emit 逻辑
      }
    },

    async closeWindow() {
      if (this.isTauri) {
        if (mainWindow) {
          try {
            await mainWindow.close();
          } catch (e) {
            console.error("Failed to close window:", e);
            this.waiting(); // 关闭失败则提示
          }
        } else {
          this.waiting(); // 获取 mainWindow 失败则提示
        }
      } else {
        // this.waiting(); // Web 环境
        this.$emit("close");
      }
    },
  },
};
</script>

<style scoped lang="sass">
.window-controls
    position: absolute
    display: flex
    height: 30px
    z-index: 1000
    right: 0
    top: 0
    background-color: transparent
    -webkit-app-region: drag

    &.preview
        display: none

    .button
        display: flex
        justify-content: center
        align-items: center
        width: 45px
        height: 100%
        padding: 0
        border: none
        background-color: transparent
        cursor: pointer
        color: #333
        font-size: 16px
        outline: none
        -webkit-app-region: no-drag

        span
          display: flex
          align-items: center
          justify-content: center
          line-height: 1

        .window-min
            font-weight: bold
            position: relative
            top: -2px

        .window-max
            font-size: 14px
            font-weight: bold

        .window-inmax
            i.iconfont
              font-size: 14px

        .window-close
            font-weight: bold
            font-size: 20px
            position: relative
            top: -1px

        &:hover
            background-color: rgba(0, 0, 0, 0.1)

        &#close:hover
            background-color: #e81123
            color: white
</style>
