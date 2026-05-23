<script>
import { client, config } from "@/lib/runtime.js";
import sideBar from "@/components/SideBar.vue";

export default {
  components: {
    sideBar,
  },
  data() {
    const displayConfig = config.getBaseConfig();
    const onPhone = window.innerWidth < 768;
    return {
      onPhone,
      client: client,
      beian: displayConfig?.beian || "",
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
    isDashboardPage() {
      return this.$route.path === "/dashboard";
    },
  },
  created() {
    const displayConfig = config.getBaseConfig();
    if (Object.keys(displayConfig).length > 0) {
      this.beian = displayConfig.beian;
      document.title = displayConfig.title;
    } else {
      config.setBaseConfigCallback((data) => {
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
    handleResize() {
      this.onPhone = window.innerWidth < 768;
    },
  },
};
</script>
<template>
  <div v-if="isDashboardPage" class="app-full-viewport">
    <router-view></router-view>
  </div>
  <template v-else>
    <div id="mio-chat">
      <div v-if="onPhone" class="app-mobile">
        <router-view></router-view>
        <sideBar v-if="!onPrivate"></sideBar>
      </div>
      <div v-else class="app-desktop">
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
</template>
<style scoped>
.app-full-viewport {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #f8fafc;
}

#mio-chat {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-desktop {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 1;
  display: flex;
  overflow: hidden;
  background-color: #f5f5f5;
}

.app-mobile {
  width: 100%;
  height: 100%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: rgba(255, 255, 255);
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
</style>
