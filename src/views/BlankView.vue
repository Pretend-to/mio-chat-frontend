<template>
  <div class="blank-view">
    <div class="upside-bar">
      <div class="options"></div>
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
  watch: {},
  created() {
    this.fullScreen = client.fullScreen;
  },
  methods: {
    waiting() {
      this.$message({ message: "此功能尚未开放", type: "warning" });
    },
  },
};
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
</style>
