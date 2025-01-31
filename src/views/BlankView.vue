<template>
  <div class="blank-view">
    <div class="upside-bar">
      <div class="options">
        <ul class="window-controls">
          <li class="button" @click="waiting()">
            <span class="window-min">—</span>
          </li>
          <li
            v-if="fullScreen"
            class="button"
            @click="configFullScreen(false)"
          >
            <span class="window-inmax">⿹</span>
          </li>
          <li v-else class="button" @click="configFullScreen(true)">
            <span class="window-max">▢</span>
          </li>
          <li class="button" @click="waiting()" id="close">
            <span class="window-close">&times;</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script>
import { client } from "@/lib/runtime.js";

export default {
  name: "BlankView",
  data() {
    return {
        fullScreen: false,
        client: client,
    };
  },
  created() {
    this.fullScreen = client.fullScreen;
  },
  methods: {
    configFullScreen(status) {
      client.emit("screenChange", status);
      this.fullScreen = status;
    },
    waiting() {
      this.$message({ message: "此功能尚未开放", type: "warning" });
    },
  },
  watch:{},
}
</script>
<style lang="sass" scoped>
.blank-view 
  background-color: #f2f2f2
  flex-grow: 1

.upside-bar
    flex-basis: 3.75rem
    flex-shrink: 0
    height: 3.75rem
    width: 100%
    display: flex
    align-items: flex-end
    flex-direction: row-reverse
    justify-content: space-between

    .options
        flex-basis: 6rem
        display: flex
        height: 100%
        width: 100%
        flex-wrap: wrap
        flex-direction: row-reverse


        .window-controls
            display: flex
            flex-basis: 100%
            width: 100%
            height: 34px
            
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
