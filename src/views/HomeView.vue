<template>
  <div v-if="!onPhone" id="main">
    <friendlist></friendlist>
    <router-view></router-view>
  </div>
  <div v-else-if="pagePath === '/'" id="main-mobile">
    <friendlist></friendlist>
  </div>
  <div v-else id="main-mobile" class="mobile-chat">
    <router-view></router-view>
  </div>
</template>

<script>
import friendlist from "@/components/FriendList.vue";

export default {
  components: {
    friendlist,
  },
  data() {
    const onPhone = window.innerWidth < 600;
    return {
      onPhone,
      pagePath: this.$route.path,
    };
  },
  watch: {
    $route: function (newVal) {
      this.pagePath = newVal.path;
    },
  },
};
</script>

<style>
#main {
  background-color: rgb(255, 255, 255);
  flex-grow: 1;
  display: flex;
  width: calc(100% - 4.5rem);
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
