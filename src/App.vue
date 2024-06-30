<script>
import { client, config } from "@/lib/runtime.js";
import sideBar from "@/components/SideBar.vue";

export default {
  data() {
    return {
      onPhone: window.innerWidth >= 600 ? false : true,
      onPrivate: this.checkPrivate(),
      client: client,
      fullScreen: true,
      beian: "",
    };
  },
  components: {
    sideBar,
  },
  computed: {},
  async created() {
    await client.beforeInit();
    const conncted = await client.init();

    if (conncted) {
      console.log("已经链接成功");
    }

    this.fullScreen = client.fullScreen;
    this.beian = client.beian;
    document.title = client.webTitle;
    this.$refs.sidebar.loadAvatar(client.admin_qq);

    await config.init();
  },
  mounted() {
    if (window.innerWidth < 600) this.onPhone = client.onPhone = true;
    else if (window.innerWidth >= 600) this.onPhone = client.onPhone = false;
    // 监听窗口宽度变化
    window.addEventListener("resize", () => {
      if (window.innerWidth < 600) {
        this.onPhone = client.onPhone = true;
      } else if (window.innerWidth >= 600) {
        this.onPhone = client.onPhone = false;
      }
    });
    

  },
  methods: {
    checkPrivate() {  
      const onPrivate =
        this.$route.name === "privateChat" ||
        this.$route.name === "privateProfile";
      return onPrivate;
    },
  },
  watch: {
    async onPhone() {
      await client.setLocalStorage();
    },
    $route() {
      this.onPrivate = this.checkPrivate();
    },
    "client.fullScreen"(val) {
      this.fullScreen = val
      client.setLocalStorage()
    },
  },
};
</script>

<template>
  <div id="app">
    <div class="mio-chat" :id="fullScreen ? 'fullscreen' : ''" v-if="!onPhone">
      <sideBar ref="sidebar"></sideBar>
      <router-view></router-view>
    </div>
    <div class="mio-chat-mobile" v-else>
      <router-view></router-view>
      <sideBar v-if="!onPrivate"></sideBar>
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
#app {
  background-image: url(/api/background/default.jpg);
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

@media (min-width: 1024px) {
}
</style>
