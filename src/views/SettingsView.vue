<template>
  <div id="settings-view">
    <el-button type="info" plain @click="reset()">点我重置</el-button>
  </div>
</template>

<script>
import { client } from "@/lib/runtime.js";

export default {
  name: "SettingsView",
  data() {
    return {};
  },
  methods: {
    reset() {
      client.reset();
    },
  },
};
</script>

<style scoped>
#settings-view {
  flex-grow: 1;
  height: 100%;
  background-color: #f2f2f2;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
