<template>
  <div v-if="!onPhone" class="mio-main-layout">
    <friendlist></friendlist>
    <router-view v-if="loaded"></router-view>
    <blankView v-else></blankView>
  </div>
  <div
    v-else-if="pagePath === '/'"
    class="mio-main-layout mio-main-layout--mobile"
  >
    <friendlist v-if="loaded"></friendlist>
    <blankView v-else></blankView>
  </div>
  <div
    v-else
    class="mio-main-layout mio-main-layout--mobile mio-main-layout--mobile-chat"
  >
    <router-view v-if="loaded"></router-view>
    <blankView v-else></blankView>
  </div>
</template>

<script>
import friendlist from "@/components/FriendList.vue";
import { client } from "@/lib/runtime.js";
import blankView from "@/views/BlankView.vue";

export default {
  components: {
    friendlist,
    blankView,
  },
  data() {
    const onPhone = window.innerWidth < 768;
    return {
      onPhone,
      pagePath: this.$route.path,
      loaded: false,
    };
  },
  watch: {
    $route: function (newVal) {
      this.pagePath = newVal.path;
    },
  },
  mounted() {
    if (client.inited) {
      this.loaded = true;
    } else {
      client.on(
        "loaded",
        () => {
          this.loaded = true;
        },
        false,
      );
    }
    this.resizeHandler = () => {
      this.onPhone = window.innerWidth < 768;
    };
    window.addEventListener("resize", this.resizeHandler);
  },
  beforeUnmount() {
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }
  },
};
</script>

<style>
.mio-main-layout {
  flex-grow: 1;
  display: flex;
  width: calc(100% - 4.5rem);
  background-color: transparent;
}

.mio-main-layout > .profile-body {
  margin-top: 4rem;
}

.mio-main-layout--mobile {
  width: 100%;
  height: calc(100% - 4.2rem - env(safe-area-inset-bottom, 0px));
  flex-grow: 1;
  flex-shrink: 1;
  min-height: 0;
  display: flex;
}

.mio-main-layout--mobile.mio-main-layout--mobile-chat {
  height: 100%;
}
</style>
