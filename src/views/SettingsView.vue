<template>
  <div id="settings-view">
    <el-button type="info" plain @click="reset()">重置全部</el-button>
    <el-button type="info" plain @click="resetCache()">清理缓存</el-button>
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
    async reset() {
      const result = await client.reset();
      if (result) {
        this.$message.success("重置成功");
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    },
    async resetCache() {
      const result = await client.resetCache();
      if (result) {
        this.$message.success("清理缓存成功");
      }
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
