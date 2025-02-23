<template>
  <ul :class="{ 'window-controls': true, fullscreen: fullScreen }">
    <li class="button" @click="waiting()">
      <span class="window-min">—</span>
    </li>
    <li v-if="fullScreen" class="button" @click="configFullScreen(false)">
      <span class="window-inmax">
        <i class="iconfont chuangkouhua"></i>
      </span>
    </li>
    <li v-else class="button" @click="configFullScreen(true)">
      <span class="window-max">▢</span>
    </li>
    <li id="close" class="button" @click="waiting()">
      <span class="window-close">&times;</span>
    </li>
  </ul>
</template>

<script>
export default {
  props: {
    fullScreen: {
      type: Boolean,
      default: false,
    },
  },
  emits: "full-screen",
  methods: {
    waiting() {
      this.$message({ message: "此功能尚未开放", type: "warning" });
    },
    configFullScreen(fullScreen) {
      this.$emit("full-screen", fullScreen);
    },
  },
};
</script>

<style scoped lang="sass">
.window-controls
    position: absolute
    display: flex
    width: 6rem
    height: 2rem
    z-index: 100
    right: 0

    &.fullscreen
        position: fixed

    .button
        display: flex
        justify-content: center
        align-items: flex-start
        flex-grow: 1
        height: 100%
        align-items: center
        .window-min
            font-size: .6rem
            margin-top: .2rem
        .window-max
            font-size: .9rem
        .window-close
            margin-top: -.15rem
        &:hover
            background-color: rgb(231, 231, 231)
        &#close:hover
            background-color: rgb(255, 0, 0)
            color: white
</style>
