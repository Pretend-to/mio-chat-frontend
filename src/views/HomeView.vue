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
    const onPhone = window.innerWidth < 600;
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
  },
};
</script>

<style>
#main {
  background-color: rgb(255, 255, 255);
  flex-grow: 1;
  display: flex;
  width: calc(100% - 4.5rem);
  background-color: #f2f2f2;
}

#main > .profile-body {
  margin-top: 4rem;
}

#main-mobile {
  width: 100%;
  max-height: calc(100vh - 4rem);
  background-color: rgb(255, 255, 255);
  flex-grow: 1;
  display: flex;
}

.mobile-chat#main-mobile {
  max-height: 100%;
}
</style>
