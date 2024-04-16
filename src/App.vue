<script>
import { client } from '@/lib/runtime.js'
import sideBar from '@/components/SideBar.vue'
import router from '@/router'

export default {
  data() {
    return {
    }
  },
  components: {
    sideBar
  },
  computed: {

  },
  async created() {
    await client.beforeInit();

    if (!client.isConnected) {
      const conncted = await client.init()
      if (conncted) {
        console.log('已经链接成功')
        if (this.$route.path === '/' || this.$route.path === '/auth') router.push('/home')
      }
    }
  },
  methods: {}
}
</script>

<template>
  <div id="app">
    <div class="mio-chat">
      <sideBar></sideBar>
      <router-view></router-view>
    </div>
  </div>
</template>

<style scoped>
#app {
  background-image: url(https://blog.krumio.com/upload/background2.jpg);
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
}

#sidebar {
  width: 4.5rem;
}

@media (min-width: 1024px) {}
</style>
