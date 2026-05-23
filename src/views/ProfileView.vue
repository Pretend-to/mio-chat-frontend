<template>
  <div class="profile-body" style="background-color: #f5f5f5">
    <!-- Mobile Header -->
    <div class="mobile-nav" v-if="isMobile">
      <div class="back-btn" @click="$router.push('/chat/' + $route.params.id)">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#333"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </div>
      <div class="nav-title">联系人详情</div>
      <div class="more-btn"></div>
    </div>

    <div id="profile" class="profile-main">
      <div v-if="activeContactor" class="profile-container">
        <div class="info-blocks">
          <ContactorSettings
            v-if="options && basicInfo"
            v-model:model-value="options"
            v-model:basic-info="basicInfo"
            :active-contactor-platform="activeContactor.platform"
            :llm-providers-list="llmProviders"
            :tool-call-modes-list="toolCallModes"
            :all-llm-tools-data="allLLMTools"
            :safety-settings-params="safetyParams"
            :safety-simple-value-options="safetySimpleValue"
            :presets-history-data="options.presetSettings?.history"
            :name="activeContactor.name"
            :avatar="activeContactor.avatar"
            :is-connected="isConnected"
            :avatar-policy-list="avatarPolicyList"
            :name-policy-list="namePolicyList"
            @provider-changed="handleProviderSwitched"
            @update-presets="handleUpdateOpenaiPresets"
          />
        </div>
      </div>
    </div>
    <div v-if="activeContactor" class="action-bar">
      <el-button plain @click="$router.push(`/chat/${activeContactor.id}`)">
        发送消息
      </el-button>
      <el-button type="danger" plain @click="centerDialogVisible = true">
        删除好友
      </el-button>
      <el-dialog
        v-model="centerDialogVisible"
        title="警告"
        width="300"
        center
        class="confirm-dialog"
      >
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
import ContactorSettings from "@/components/ContactorSettings.vue"; // Import the new component
import { client, config } from "@/lib/runtime.js";
import { useConnectionStore } from "@/stores/connectionStore";
import { mapState } from "pinia";

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
      client: client, // 导出 client 到模板
      activeContactor: contactor,
      options: null, // Will be initialized in initContactor
      centerDialogVisible: false,
      avatarPolicyList: avatarPolicyList,
      namePolicyList: namePolicyList,

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
    ...mapState(useConnectionStore, ["isConnected"]),
    isOnebot() {
      return this.activeContactor?.platform === "onebot";
    },
    isMobile() {
      // Basic mobile detection
      return window.innerWidth <= 768;
    },
    getDelayStatus() {
      return this.isConnected ? "ultra" : "offline";
    },
    getAvatarPolicyValue() {
      return this.basicInfo?.avatarPolicy === 1 ? "自定义" : "跟随模型";
    },
  },
  watch: {
    "$route.params.id"(newVal) {
      const newId = parseInt(newVal);
      this.activeContactor = client.getContactor(newId);
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
    if (!this.activeContactor) {
      client.on("loaded", this.handleClientLoaded);
    }
  },
  mounted() {
    // Socket 连接状态现在统一通过 Pinia Store 管理
    client.on("plugins_updated", this.handlePluginsUpdated);
  },
  beforeUnmount() {
    client.off("plugins_updated", this.handlePluginsUpdated);
    client.off("loaded", this.handleClientLoaded);
  },
  methods: {
    handlePluginsUpdated() {
      console.log("[ProfileView] 检测到后端插件更新，正在刷新工具数据...");
      this.refreshAllLLMTools();
      this.$message.success("工具箱定义已实时刷新");
    },
    refreshAllLLMTools() {
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
      this.allLLMTools = allLLMTools;
    },
    handleClientLoaded() {
      console.log("[ProfileView] Client loaded, initializing contactor...");
      const currentId = parseInt(this.$route.params.id);
      this.activeContactor = client.getContactor(currentId);
      this.initContactor();
    },
    initContactor() {
      if (!this.activeContactor) {
        console.warn(
          "[ProfileView] activeContactor is undefined, waiting for client initialization",
        );
        return;
      }
      // Deep clone options to avoid direct mutation of contactor's options by child
      // The watcher on `this.options` will handle persisting changes.
      this.options = JSON.parse(JSON.stringify(this.activeContactor.options));

      const { id, name, avatar, namePolicy, avatarPolicy, priority } =
        this.activeContactor;
      this.basicInfo = {
        id,
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
      if (!this.activeContactor) return;
      this.centerDialogVisible = false;
      await client.rmContactor(this.activeContactor.id);
      this.$router.push("/");
    },
    handleProviderSwitched() {
      if (!this.activeContactor) return;
      // This event is specifically for actions parent needs to take,
      // like reloading avatar, that are outside the 'options' object.
      this.activeContactor.loadAvatar();
      // The options object (including provider and default model)
      // would have already been updated by the child component via v-model.
    },

    updateContactorName() {
      if (!this.activeContactor) return;
      if (this.basicInfo.namePolicy === 0) {
        this.basicInfo.name = this.activeContactor.options.base.model;
      }
    },
    updateContactorAvatar() {
      if (!this.activeContactor) return;
      const { avatarPolicy } = this.basicInfo;
      this.activeContactor.avatarPolicy = avatarPolicy;
      this.basicInfo.avatar = this.activeContactor.loadAvatar();
    },
  },
};
</script>

<style>
/* Shared Settings Styles for Profile View and its children */
.settings-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: transparent;
  color: #333;
}

.settings-card {
  background: #fff;
  border-radius: 12px;
  padding: 8px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
}

.group-title {
  padding: 0 4px 12px;
  font-size: 15px;
  font-weight: 500;
  color: #333;
  text-align: left;
}

.setting-field {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.setting-field:last-child {
  border-bottom: none;
}

.field-label {
  width: 14rem;
  font-size: 13px;
  color: #999;
  padding-top: 8px;
  flex-shrink: 0;
  text-align: left;
}

.field-value {
  flex: 1;
  max-width: 60%;
  text-align: right;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

/* Global overrides for Element Plus inside field-value */
.field-value .el-input__wrapper,
.field-value .el-select__wrapper {
  box-shadow: none !important;
  background: #f5f7fa !important;
  border-radius: 8px;
  padding: 0 12px !important;
}

.field-value input {
  text-align: right;
  padding-right: 12px !important;
}

.field-value .el-switch {
  transform: scale(0.9);
}

.field-value .el-input-number {
  width: 100%;
}

@media (max-width: 768px) {
  .group-title {
    display: none;
  }

  .settings-card {
    margin: 0 12px 12px;
    padding: 4px 16px;
    border-radius: 12px;
  }

  .setting-field {
    padding: 12px 0;
    border-bottom: 1px solid #f9f9f9;
  }

  .field-label {
    font-size: 13px;
    color: #999;
    width: 100px;
    padding-top: 8px;
  }
}

/* Transitions */
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
  max-height: 20rem;
  opacity: 1;
}
</style>

<style scoped>
/* Styles from original component that are general layout */
.profile-main {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.profile-container {
  flex: 1;
  width: 100%;
  max-width: 36rem;
  min-height: 0;
  margin-top: 2rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-bottom: 0;
}

.info-blocks {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.action-bar {
  position: sticky;
  background-color: #f5f5f5;
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
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
}

/* Mobile Nav */
.mobile-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 100;
}

.back-btn,
.more-btn {
  font-size: 20px;
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
}

@media (max-width: 768px) {
  .profile-body {
    background-color: #f2f2f2 !important;
  }

  .profile-container {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    min-width: 0 !important;
    background-color: #f2f2f2 !important;
    padding-bottom: 0;
  }

  .action-bar {
    display: none !important;
  }
}
</style>

<style scoped lang="sass">
/* SASS styles remain in parent */
.delay-status
  display: inline-block
  width: 1rem
  height: 1rem
  border-radius: 50%
  transform: translateY(.15rem)
  margin-right: .25rem
  &:hover + .delay-num
    display: inline-block
  &.ultra
    background-color: rgb(53, 233, 146)
  &.offline
    background-color: #ccc
</style>
