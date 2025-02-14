<script>
import { client,config } from "@/lib/runtime.js";
import sideBar from "@/components/SideBar.vue";
import displayButtons from "./components/DisplayButtons.vue";
export default {
  data() {
    const displayConfig = config.getDisplayConfig();

    return {
      onPhone: client.onPhone,
      client: client,
      fullScreen: displayConfig?.full_screen || false,
      beian: displayConfig?.beian || "",
    };
  },
  methods: {
    setWindowSize(fullScreen) {
      this.fullScreen = fullScreen;
      config.updateDisplayConfig({
        full_screen: fullScreen, 
      })
    }, 
  },
  components: {
    sideBar,
    displayButtons,
  },
  computed: {
    onPrivate() {
      return this.$route.path.includes("/profile") || this.$route.path.includes("/chat");
    }
  },
  async created() {

    await client.beforeInit();
    await client.init();
    const displayConfig = config.getDisplayConfig();

    if(displayConfig) {
      this.fullScreen = displayConfig.full_screen;
      this.beian = displayConfig.beian;
      document.title = displayConfig.title;
    }
  },
  mounted() {
    client.on('device-change',(type)=>{
      if(type == "mobile") {
        this.onPhone = true;
      }else {
        this.onPhone = false;
      }
    })
  },
};
</script>
<template>
  <div id="app">
    <div v-if="onPhone" class="mio-chat-mobile">
      <router-view></router-view>
      <sideBar v-if="!onPrivate"></sideBar>
    </div>
    <div v-else class="mio-chat" :class="{ fullscreen: fullScreen }">
      <displayButtons :fullScreen @full-screen="setWindowSize"></displayButtons>
      <sideBar ref="sidebar"></sideBar>
      <router-view></router-view>
    </div>
  </div>
  <a v-if="beian" id="beian" href="https://beian.miit.gov.cn/" target="_blank">{{ beian }}</a>
</template>
<style scoped>
#app {
  background-image: url(/static/background/default.jpg);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
#app::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  /* 黑色蒙版，可调整透明度 */
}
.mio-chat {
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
.mio-chat.fullscreen {
  width: 100%;
  height: 100%;
  border-radius: 0rem;
  margin: 0rem;
}
.mio-chat-mobile {
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
@media (min-width: 1024px) {}
</style>