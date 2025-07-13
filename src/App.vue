<script>
import { client, config } from "@/lib/runtime.js";
import sideBar from "@/components/SideBar.vue";
import displayButtons from "./components/DisplayButtons.vue";
export default {
  components: {
    sideBar,
    displayButtons,
  },
  data() {
    const displayConfig = config.getBaseConfig();
    const onPhone = window.innerWidth < 600;
    return {
      onPhone,
      client: client,
      fullScreen: displayConfig?.full_screen || false,
      beian: displayConfig?.beian || "",
      isTauri: !!(window.__TAURI__ || window.__TAURI_INTERNALS__),
    };
  },
  computed: {
    onPrivate() {
      return (
        this.$route.path.includes("/auth") ||
        this.$route.path.includes("/profile") ||
        this.$route.path.includes("/chat")
      );
    },
  },
  created() {
    const displayConfig = config.getBaseConfig();
    if (Object.keys(displayConfig).length > 0) {
      this.fullScreen = displayConfig.full_screen;
      this.beian = displayConfig.beian;
      document.title = displayConfig.title;
    } else {
      config.setBaseConfigCallback((data) => {
        this.fullScreen = data.full_screen;
        this.beian = data.beian;
        document.title = data.title;
      });
    }

    window.addEventListener("resize", this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    setWindowSize(fullScreen) {
      this.fullScreen = fullScreen;
      config.updateBaseConfig({
        full_screen: fullScreen,
      });
    },
    handleResize() {
      this.onPhone = window.innerWidth < 600;
    },
    closeApp() {
      this.$message({
        message: "浏览器端暂不支持关闭",
        type: "warning",
      });
    }
  },
};
</script>
<template>
  <div id="mio-chat" :class="{ browser: !isTauri }">
    <div v-if="onPhone" class="app-mobile">
      <router-view></router-view>
      <sideBar v-if="!onPrivate"></sideBar>
    </div>
    <div
      v-else
      class="app-desktop"
      :class="{ fullscreen: fullScreen || isTauri }"
    >
      <displayButtons :full-screen @close="closeApp" @set-screen="setWindowSize"></displayButtons>
      <sideBar></sideBar>
      <router-view></router-view>
    </div>
  </div>
  <a
    v-if="beian"
    id="beian"
    href="https://beian.miit.gov.cn/"
    target="_blank"
    >{{ beian }}</a
  >
</template>
<style scoped>
#mio-chat {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
#mio-chat.browser {
  background-image: url(/static/background/default.png);
}
#mio-chat.browser::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  /* 黑色蒙版，可调整透明度 */
}
.app-desktop {
  position: relative;
  width: 60rem;
  height: 85%;
  min-height: 30rem;
  z-index: 1;
  box-shadow: 0px 0px 10px 0px rgba(0, 0, 0, 0.5);
  border-radius: 1rem;
  display: flex;
  overflow: hidden;
  margin: 5rem 5rem;
  min-width: 35rem;
}
.app-desktop.fullscreen {
  width: 100%;
  height: 100%;
  border-radius: 0rem;
  margin: 0rem;
}
.app-mobile {
  width: 100%;
  height: 100%;
  z-index: 1;
  box-shadow: 0px 0px 10px 0px rgba(0, 0, 0, 0.5);
  border-radius: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 0;
}
a#beian {
  position: fixed;
  bottom: 1rem;
  right: 50%;
  transform: translateX(50%);
  font-size: 0.8rem;
  color: #fff;
  text-decoration: none;
}
@media (min-width: 1024px) {
}
</style>
