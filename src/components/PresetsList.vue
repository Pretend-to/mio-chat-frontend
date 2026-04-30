<template>
  <div class="presets-list">
    <div
      v-for="(message, index) of presetMessages"
      :key="index"
      class="preset-message"
    >
      <div class="preset-message-block">
        <div
          class="message-avatar"
          @mouseover="hoveredIndex = index"
          @mouseleave="hoveredIndex = null"
        >
          <div v-if="hoveredIndex != index" class="avatar-emoji">
            {{ getMessageAvatar(message.role) }}
          </div>
          <div
            v-else
            title="删除消息"
            class="avatar-emoji hovered"
            @click="delPresetMessage"
          >
            🗑️
          </div>
        </div>
        <div
          :ref="`message-${index}`"
          class="message-content"
          contenteditable="true"
          @blur="handleMessageUpdate(index)"
        >
          {{ presetMessages[index].content }}
        </div>
      </div>
    </div>
    <div class="messages-buttons">
      <el-button title="添加系统消息" plain @click="addPresetMessage('system')"
        >➕ ⚙️</el-button
      >
      <el-button
        title="添加助手消息"
        plain
        @click="addPresetMessage('assistant')"
        >➕ 🤖</el-button
      >
      <el-button title="添加用户消息" plain @click="addPresetMessage('user')"
        >➕ 👤</el-button
      >
    </div>
  </div>
</template>

<script>
export default {
  props: {
    presetsHistory: {
      type: Array,
      default: () => [],
    },
  },
  emits: ["updatePresets"],
  data() {
    const presetMessages = [...this.presetsHistory];
    return {
      presetMessages,
      hoveredIndex: undefined,
    };
  },
  watch: {
    presetsHistory(newVal) {
      this.presetMessages = [...newVal];
    },
  },
  methods: {
    delPresetMessage() {
      this.presetMessages.splice(this.hoveredIndex, 1);
      this.$emit("updatePresets", this.presetMessages);
    },
    addPresetMessage(role) {
      if (role == "system" && this.presetMessages.length > 0) {
        this.$message.warning("系统消息必须是第一条消息");
        return;
      }
      this.presetMessages.push({
        role,
        content: "",
      });
      this.$emit("updatePresets", this.presetMessages);
    },
    getMessageAvatar(role) {
      return role == "assistant" ? "🤖" : role == "system" ? "⚙️" : "👤";
    },
    handleMessageUpdate(index) {
      this.presetMessages[index].content =
        this.$refs[`message-${index}`][0].innerText;
      this.$emit("updatePresets", this.presetMessages);
    },
  },
};
</script>
<style scoped>
.presets-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.messages-buttons {
  width: 100%;
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  margin: 0.5rem;
}

.preset-message {
  width: 100%;
}

.preset-message-block {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 0.5rem;
  justify-content: space-between;
  align-items: flex-start;
}

.preset-message-block .message-avatar {
  flex-basis: 2rem;
  font-size: 2rem;
  border: 1px solid #ccc;
  border-radius: 10%;
}

.message-avatar .hovered {
  cursor: pointer;
  box-shadow: inset 0px 0px 10px rgba(0, 0, 0, 0.493); /* 内阴影 */
}

.preset-message-block .message-content {
  margin-left: 0.5rem;
  font-size: 0.8rem;
  border: 1px solid #5a9cf8;
  border-radius: 0.5rem;
  flex-grow: 1;
  max-height: 10rem;
  overflow-y: auto;
  padding: 0.5rem;
  min-height: 2rem;
}

.message-content input {
  width: 100%;
  border: none;
  outline: none;
}
</style>
