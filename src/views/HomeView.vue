<template>
  <div v-if="!onPhone" id="main">
    <friendlist></friendlist>
    <router-view v-if="loaded"></router-view>
    <blankView v-else></blankView>
  </div>
  <div v-else-if="pagePath === '/'" id="main-mobile">
    <friendlist v-if="loaded"></friendlist>
    <blankView v-else></blankView>
  </div>
  <div v-else id="main-mobile" class="mobile-chat">
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
#main {
  flex-grow: 1;
  display: flex;
  width: calc(100% - 4.5rem);
  background-color: transparent;
}

#main > .profile-body {
  margin-top: 4rem;
}

#main-mobile {
  width: 100%;
  height: calc(100% - 3.2rem - env(safe-area-inset-bottom, 0px));
  flex-grow: 1;
  flex-shrink: 1;
  min-height: 0;
  display: flex;
}

.mobile-chat#main-mobile {
  height: 100%;
}
</style>
