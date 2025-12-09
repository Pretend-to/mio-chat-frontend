<template>
  <div class="profile-body">
    <div id="profile">
      <div class="profile-container">
        <div class="base-info">
          <div class="base-info-avatar">
            <el-image
              :src="activeContactor.avatar"
              :preview-src-list="[activeContactor.avatar]"
            />
          </div>
          <div class="base-info-content">
            <div class="name">{{ activeContactor.name }}</div>
            <div class="id">ID {{ activeContactor.id }}</div>
            <div class="status">
              <span :class="'delay-status ' + getDelayStatus"></span>
              在线
            </div>
          </div>
          <!-- LLM Provider select is now inside ContactorSettings -->
        </div>

        <div class="info-blocks">
          <div class="settings-block">
            <div class="block-title">Bot 基本配置</div>
            <div class="block-content">
              <div class="block-content-item">
                <div class="item-title">昵称</div>
                <div class="item-content">
                  <el-input
                    v-model="basicInfo.name"
                    :disabled="basicInfo.namePolicy !== 1"
                  ></el-input>
                </div>
              </div>
              <div class="block-content-item">
                <div class="item-title">头像</div>
                <div class="item-content">
                  <el-input 
                    v-if="basicInfo.avatarPolicy !== 1"
                    :value="'跟随模型'"
                    :disabled="true"
                  ></el-input>
                  <el-input 
                    v-else
                    v-model="basicInfo.avatar"
                    :disabled="isOnebot"
                  ></el-input>
                </div>
              </div>
              <div v-if="!isOnebot" class="block-content-item">
                <div class="item-title">头像策略</div>
                <div class="item-content">
                  <el-select v-model="basicInfo.avatarPolicy"
                  @change="updateContactorAvatar"
                  >
                    <el-option
                      v-for="item in avatarPolicyList"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
              </div>
              <div v-if="!isOnebot" class="block-content-item">
                <div class="item-title">昵称策略</div>
                <div class="item-content">
                  <el-select
                    v-model="basicInfo.namePolicy"
                    @change="updateContactorName"
                  >
                    <el-option
                      v-for="item in namePolicyList"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
              </div>
              <div class="block-content-item">
                <div class="item-title">会话置顶</div>
                <div class="item-content">
                  <el-switch v-model="basicInfo.priority"> </el-switch>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="info-blocks">
          <ContactorSettings
            v-if="!isOnebot"
            v-model:model-value="options"
            :active-contactor-platform="activeContactor.platform"
            :llm-providers-list="llmProviders"
            :tool-call-modes-list="toolCallModes"
            :all-llm-tools-data="allLLMTools"
            :safety-settings-params="safetyParams"
            :safety-simple-value-options="safetySimpleValue"
            :presets-history-data="options.presetSettings?.history"
            @provider-changed="handleProviderSwitched"
            @update-presets="handleUpdateOpenaiPresets"
          />
        </div>
      </div>
    </div>
    <div class="action-bar">
      <el-button plain @click="$router.push(`/chat/${activeContactor.id}`)">
        发送消息
      </el-button>
      <el-button type="danger" plain @click="centerDialogVisible = true">
        删除好友
      </el-button>
      <el-dialog v-model="centerDialogVisible" title="警告" width="300" center>
        <span> 确认要删除此好友吗？该操作不可逆。 </span>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="centerDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="delContactor"> 确认 </el-button>
          </div>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script>
import { client, config } from "@/lib/runtime.js";
import ContactorSettings from "@/components/ContactorSettings.vue"; // Import the new component

export default {
  components: {
    ContactorSettings, // Register the new component
  },
  data() {
    const currentId = parseInt(this.$route.params.id);
    const contactor = client.getContactor(currentId);

    const toolCallModes = config.getToolCallModes();
    const providers = config.getLLMProviders();
    const safetyParams = config.getSafetySettingsParams();
    const safetySimpleValue = Object.keys(safetyParams).map((key) => ({
      value: key,
      label: key,
    }));

    // Initial construction of allLLMTools remains here as it depends on global config
    const allLLMTools = [];
    for (const key in config.llmTools) {
      const toolsObject = config.llmTools[key];
      const toolsList = Object.keys(toolsObject).map((toolKey) => ({
        enabled: false, // Initial state, child component will sync with options
        ...toolsObject[toolKey],
      }));
      allLLMTools.push({
        name: key,
        tools: toolsList,
        collapsed: true,
      });
    }
    const avatarPolicyList = [
      { value: 0, label: "跟随模型" },
      { value: 1, label: "自定义" },
    ];
    const namePolicyList = [
      { value: 0, label: "跟随模型" },
      { value: 1, label: "自定义" },
      { value: 2, label: "对话摘要" },
    ];

    return {
      activeContactor: contactor,
      options: null, // Will be initialized in initContactor
      currentDelay: 0,
      centerDialogVisible: false,
      avatarPolicyList: avatarPolicyList,
      namePolicyList: namePolicyList,
      isOnebot: contactor.platform === "onebot",

      // Static config passed as props
      llmProviders: providers,
      toolCallModes: toolCallModes,
      safetyParams: safetyParams,
      safetySimpleValue: safetySimpleValue,
      allLLMTools: allLLMTools, // This structure is passed to child
      basicInfo: null,
    };
  },
  computed: {
    getDelayStatus() {
      return this.currentDelay > 1000
        ? "high"
        : this.currentDelay > 500
          ? "mid"
          : this.currentDelay > 100
            ? "low"
            : "ultra";
    },
    getAvatarPolicyValue() {
      return this.basicInfo.avatarPolicy === 1 ? "自定义" : "跟随模型";
    },
  },
  watch: {
    "$route.params.id"(newVal) {
      const newId = parseInt(newVal);
      this.activeContactor = client.getContactor(newId);
      if (this.activeContactor) {
        this.isOnebot = this.activeContactor.platform === "onebot";
      }
      this.initContactor();
    },
    options: {
      handler(newOptions) {
        if (newOptions && this.activeContactor) {
          // Sync back to the source of truth
          this.activeContactor.options = JSON.parse(JSON.stringify(newOptions));
          client.setLocalStorage();
        }
      },
      deep: true,
    },
    basicInfo: {
      handler(newInfo) {
        if (newInfo && this.activeContactor) {
          // Sync back to the source of truth
          this.activeContactor.name = newInfo.name;
          this.activeContactor.avatar = newInfo.avatar;
          this.activeContactor.namePolicy = newInfo.namePolicy;
          this.activeContactor.avatarPolicy = newInfo.avatarPolicy;
          this.activeContactor.priority = newInfo.priority ? 0 : 1;
          client.setLocalStorage();
        }
      },
      deep: true,
    },
  },
  created() {
    // Use created instead of beforeMount for data initialization
    this.initContactor();
  },
  mounted() {
    this.delayInterval = setInterval(() => {
      this.currentDelay = client.socket.delay;
    }, 3000);
  },
  beforeUnmount() {
    if (this.delayInterval) {
      clearInterval(this.delayInterval);
    }
  },
  methods: {
    initContactor() {
      // Deep clone options to avoid direct mutation of contactor's options by child
      // The watcher on `this.options` will handle persisting changes.
      this.options = JSON.parse(JSON.stringify(this.activeContactor.options));

      const { name, avatar, namePolicy, avatarPolicy, priority } =
        this.activeContactor;
      this.basicInfo = {
        name,
        avatar,
        namePolicy,
        avatarPolicy,
        priority: priority === 1 ? false : true,
      };

      // If contactor platform is onebot, tool call related options might need to be forced
      if (this.activeContactor.platform === "onebot") {
        if (this.options.toolCallSettings) {
          this.options.toolCallSettings.mode = "none";
          this.options.toolCallSettings.tools = [];
        }
      }
      // The child component `ContactorSettings` will use this.options
      // to initialize its internal state.
    },
    handleUpdateOpenaiPresets(presets) {
      if (this.options && this.options.presetSettings) {
        this.options.presetSettings.history = presets;
        // The watcher on `this.options` will trigger saving
        this.$message({
          message: "预设历史记录已更新",
          type: "success",
        });
      }
    },
    async delContactor() {
      this.centerDialogVisible = false;
      await client.rmContactor(this.activeContactor.id);
      this.$router.push("/");
    },
    handleProviderSwitched(newProvider) {
      // This event is specifically for actions parent needs to take,
      // like reloading avatar, that are outside the 'options' object.
      this.activeContactor.loadAvatar();
      // The options object (including provider and default model)
      // would have already been updated by the child component via v-model.
    },
    getBaseInfoShownValue(value) {
      const table = {};
    },
    updateContactorName() {
      if (this.basicInfo.namePolicy === 0) {
        this.basicInfo.name = this.activeContactor.options.base.model;
      }
    },
    updateContactorAvatar() {
      const { avatarPolicy } = this.basicInfo;
      this.activeContactor.avatarPolicy = avatarPolicy;
      this.basicInfo.avatar = this.activeContactor.loadAvatar();
    }
  },
};
</script>

<style>
/* Copied from parent for .settings-block, .block-title etc. */
.block-title {
  font-size: 0.8rem;
}
.block-content {
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  width: 100%;
  display: flex;
  background-color: #fff;
  min-height: 1rem;
  border-radius: 0.5rem;
  flex-direction: column;
}
.block-content:last-child {
  margin-bottom: 2rem;
}
.block-content-item {
  max-height: 50rem; /* Ensure this is sufficient for PresetsList */
  overflow-y: auto;
  transition: max-height 0.5s ease;
  position: relative;
  display: flex;
  width: 100%;
  justify-content: space-between;
  flex-wrap: nowrap;
}
.block-content-item.parent-item {
  flex-wrap: wrap;
}
.child-item {
  width: calc(100% - 1rem);
  padding-left: 1rem;
}
.item-hidden-content {
  width: 100%;
}
/* Styles specific to settings can be moved here or kept in parent if generic enough */
.settings-container {
  width: 100%;
}
.base-info-provider {
  /* Copied from parent, ensure it's styled correctly in context */
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-right: 2rem;
  margin-bottom: 1rem; /* Added margin for spacing */
}

.plugin-tools-container {
  max-height: 20rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.block-content-item::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 5%;
  width: 90%;
  height: 1px;
  background-color: rgba(145, 145, 145, 0.155);
}
.item-title {
  font-size: 0.8rem;
  margin-left: 1rem;
  height: 2.5rem;
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: flex-start;
  max-width: calc(100% - 5rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-content {
  transform: scale(0.9);
  flex-basis: 2rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-right: 1.5rem;
}
.item-content .el-input-number,
.item-content .el-input,
.item-content .el-slider,
.item-content .el-select {
  width: 10rem;
}
.sub-items {
  width: 100%;
  display: flex;
  flex-direction: column;
  padding-left: 0; /* Reset ul default padding */
  list-style: none; /* Reset ul default list-style */
}
.extra-info-button.active {
  transform: rotate(-90deg);
}
.item-content button {
  background-color: transparent;
  border: none; /* Ensure button is clean */
  cursor: pointer; /* Add cursor pointer */
  transition: transform 0.3s ease;
}
.block-content-item.hidden {
  /* This style seems unused, but keeping for now */
  min-height: 0px;
  max-height: 0px;
}
/* 自定义动画 - Kept in parent as it's a general utility transition */
.expand-slide-enter-active,
.expand-slide-leave-active {
  transition:
    max-height 0.4s cubic-bezier(0.78, 0.14, 0.15, 0.86),
    opacity 0.4s;
}
.expand-slide-enter-from,
.expand-slide-leave-to {
  max-height: 0;
  opacity: 0;
}
.expand-slide-enter-to,
.expand-slide-leave-from {
  max-height: 20rem; /* Adjust if necessary for PresetsList or other content */
  opacity: 1;
}
</style>

<style scoped>
/* Styles from original component that are general layout */
#profile {
  position: relative;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
}
/* .sub-items and other specific styles are now in ContactorSettings.vue or can be if specific to it */
/* Keep .base-info-provider here if it's also used for other things, or move if only for provider select */
/* Moved to child: .base-info-provider */

.profile-container {
  overflow-y: auto;
  margin: 2rem 0rem 0rem 0rem;
  width: calc(100% - 8rem);
  min-width: 20rem;
  max-width: 40rem;
  display: flex;
  flex-direction: column;
}
.base-info {
  background-color: #fff;
  border-radius: 0.5rem;
  display: flex;
  padding-bottom: 1rem;
  border-bottom: 1px solid #88888888;
  flex-wrap: wrap;
  margin-bottom: 2rem; /* This was on base-info, now applies before info-blocks */
}
.base-info-avatar {
  margin-top: 1rem;
  margin-left: 1rem;
  flex-basis: 5.5rem;
  height: 5.5rem;
}
.base-info-avatar .el-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}
.base-info-content {
  margin-left: 1.5rem;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
}
.base-info-content .name {
  font-size: 1.25rem;
}
.base-info-content .id {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: dimgrey;
}
.base-info-content .status {
  margin-top: 0.25rem;
}
.info-blocks {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.action-bar {
  position: sticky;
  background-color: #f2f2f2;
  bottom: 0px;
  left: 0px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 6rem;
  width: 100%;
  z-index: 2;
}
.profile-body {
  position: relative;
  overflow-y: auto;
  flex-grow: 1;
  background-color: #f2f2f2;
}
</style>

<style scoped lang="sass">
/* SASS styles remain in parent */
.delay-status
  display: inline-block
  width: 1rem
  height: 1rem
  border-radius: 50%
  transform: translateY(.25rem)
  margin-right: .25rem
  &:hover + .delay-num
    display: inline-block
  &.ultra
    background-color: rgb(53, 233, 146)
  &.low
    background-color: rgb(255, 204, 0)
  &.mid
    background-color: rgb(255, 102, 102)
  &.high
    background-color: #ccc
</style>
