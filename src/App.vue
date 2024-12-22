<script>
import { client, config } from "@/lib/runtime.js";
import sideBar from "@/components/SideBar.vue";

export default {
  data() {
    return {
      windowWidth: window.innerWidth, // 存储窗口宽度
      client: client,
      fullScreen: true,
      beian: "",
    };
  },
  components: {
    sideBar,
  },
  computed: {
    onPhone() {
      return this.windowWidth >= 600 ? false : true;
    },
    onPrivate() {
      return this.$route.path.includes("/profile") || this.$route.path.includes("/chat");
    }

  },
  async created() {
    await client.beforeInit();
    await client.init();

    this.fullScreen = client.fullScreen;
    this.beian = client.beian;
    document.title = client.webTitle;

    if (this.onPhone) {
      client.onPhone = true;
      this.$router.push("/");
    }
    else {
      client.onPhone = false;
      this.$refs.sidebar.loadAvatar(client.admin_qq);
    }

    await config.init();

    client.on("screenChange", async (status) => {
      this.fullScreen = status
      client.fullScreen = status
      await client.setLocalStorage();
    });

  },
  methods: {
    handleResize() {
      this.windowWidth = window.innerWidth; // 更新窗口宽度
    }
  },
  mounted() {
    // 监听窗口宽度变化
    window.addEventListener("resize", this.handleResize);
  },
  beforeUnmounted() {
    // 在组件销毁前移除事件监听
    window.removeEventListener("resize", this.handleResize);
  },
  watch: {
    async onPhone(newValue) {
      console.log("onPhone changed:", newValue);
      client.onPhone = newValue;
      await client.setLocalStorage();

      if (newValue) {
        this.$router.push("/");
      } else {
        this.$refs.sidebar.loadAvatar(client.admin_qq);
      }

    },
  },
};
</script>

<template>
  <div id="app">
    <div v-if="onPhone" class="mio-chat-mobile">
      <router-view></router-view>
      <sideBar v-if="!onPrivate"></sideBar>
    </div>
    <div v-else class="mio-chat" :id="fullScreen ? 'fullscreen' : ''">
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

.mio-chat#fullscreen {
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
