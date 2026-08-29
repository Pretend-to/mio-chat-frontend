<template>
  <div class="profile-body">
    <!-- Mobile Header -->
    <div class="mobile-nav" v-if="isMobile">
      <div class="back-btn" @click="handleBack">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </div>
      <div class="nav-title">{{ activeMember ? '群聊成员设置' : (activeContactor?.platform === 'group' ? '群聊设置' : '联系人详情') }}</div>
      <!-- 移动端 .action-bar 是隐藏的，三个操作全部收进这里的「更多」菜单 -->
      <el-dropdown
        v-if="activeContactor"
        trigger="click"
        placement="bottom-end"
        @command="handleMobileAction"
      >
        <div class="more-btn">⋯</div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="chat">发送消息</el-dropdown-item>
            <el-dropdown-item v-if="!activeMember" command="save">
              保存本地
            </el-dropdown-item>
            <el-dropdown-item command="delete" divided>
              <span style="color: var(--el-color-danger)">
                {{ activeMember ? '移出群聊' : (activeContactor?.platform === 'group' ? '解散群聊' : '删除好友') }}
              </span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <div v-else class="more-btn"></div>
    </div>

    <div id="profile" class="profile-main">
      <div v-if="activeContactor" class="profile-container">
        <!-- 桌面端从群成员设置返回群聊设置的导航条 -->
        <div v-if="activeMember && !isMobile" class="desktop-member-header">
          <button class="back-group-btn" @click="$router.push(`/profile/${activeContactor.id}`)">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span>返回「{{ activeContactor.name || '群聊' }}」设置</span>
          </button>
          <span class="member-badge">群成员专属配置</span>
        </div>

        <div class="info-blocks">
          <ContactorSettings
            v-if="options && basicInfo"
            v-model:model-value="options"
            v-model:basic-info="basicInfo"
            :contactor-id="activeContactor.id"
            :active-contactor-platform="activeContactor.platform"
            :llm-providers-list="llmProviders"
            :tool-call-modes-list="toolCallModes"
            :all-llm-tools-data="allLLMTools"
            :safety-settings-params="safetyParams"
            :safety-simple-value-options="safetySimpleValue"
            :presets-history-data="options.presetSettings?.history"
            :name="activeMember ? activeMember.name : activeContactor.name"
            :avatar="activeMember ? activeMember.avatar : activeContactor.avatar"
            :is-group-member="!!activeMember"
            :group-member-id="activeMember ? String(activeMember.id) : null"
            :group-name="activeContactor?.name || ''"
            :is-connected="isConnected"
            :avatar-policy-list="avatarPolicyList"
            :name-policy-list="namePolicyList"
            @provider-changed="handleProviderSwitched"
            @update-presets="handleUpdateOpenaiPresets"
          />
        </div>
      </div>
      <div v-else class="profile-container skeleton-container" style="padding: 24px; width: 100%; box-sizing: border-box;">
        <el-skeleton animated :rows="8" />
      </div>
    </div>
    <div v-if="activeContactor" class="action-bar">
      <el-button v-if="activeMember" plain @click="$router.push(`/profile/${activeContactor.id}`)">
        返回群聊设置
      </el-button>
      <el-button plain @click="$router.push(`/chat/${activeContactor.id}`)">
        发送消息
      </el-button>
      <el-button type="danger" plain @click="centerDialogVisible = true">
        {{ activeMember ? '移出群聊' : (activeContactor?.platform === 'group' ? '解散群聊' : '删除好友') }}
      </el-button>
      <!-- 群成员详情没有「保存本地」：成员配置隶属于群，不是可独立复用的预设 -->
      <el-button v-if="!activeMember" type="primary" plain @click="saveAsPreset">
        保存本地
      </el-button>
      <el-dialog
        v-model="centerDialogVisible"
        title="警告"
        width="300"
        center
        class="confirm-dialog"
      >
        <span> {{ activeMember ? '确认要从群聊中移出该成员吗？' : '确认要删除此好友吗？该操作不可逆。' }} </span>
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
import { useStatusBarColor } from "@/composables/useStatusBarColor";
import { saveLocalPreset } from "@/lib/clientSettings.js";
import { useContactorsStore, getAvatarByModel } from "@/stores/contactorsStore.js";

export default {
  components: {
    ContactorSettings, // Register the new component
  },
  setup() {
    useStatusBarColor("var(--mio-bg-card)");
  },
  data() {
    const currentId = String(this.$route.params.id);
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
      if (!toolsObject || typeof toolsObject !== "object") continue;
      const toolsList = Object.keys(toolsObject).map((toolKey) => ({
        enabled: false, // Initial state, child component will sync with options
        ...toolsObject[toolKey],
      }));
      if (toolsList.length > 0) {
        allLLMTools.push({
          name: key,
          tools: toolsList,
          collapsed: true,
        });
      }
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
      activeMember: null,
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
      const newId = String(newVal);
      this.activeContactor = client.getContactor(newId);
      this.initContactor();
    },
    "$route.query.memberId"() {
      this.initContactor();
    },
    options: {
      handler(newOptions) {
        if (newOptions && this.activeContactor) {
          const model = newOptions?.base?.model;
          const provider = newOptions?.provider;

          if (this.activeMember) {
            // 群聊成员设置模式（this.activeContactor.platform 为 "group"）
            this.activeMember.options = JSON.parse(JSON.stringify(newOptions));
            if (model) {
              if (
                this.activeMember.avatarPolicy === 0 ||
                this.activeMember.avatarPolicy === "MODEL"
              ) {
                const newAvatar = getAvatarByModel(model, provider);
                this.activeMember.avatar = newAvatar;
                if (this.basicInfo) this.basicInfo.avatar = newAvatar;
              }
              if (
                this.activeMember.namePolicy === 0 ||
                this.activeMember.namePolicy === "MODEL"
              ) {
                this.activeMember.name = model;
                if (this.basicInfo) this.basicInfo.name = model;
              }
            }
            const store = useContactorsStore();
            store.updateContactor(this.activeContactor.id, {
              members: [...this.activeContactor.members],
            });
          } else {
            // 单聊联系人模式
            this.activeContactor.options = JSON.parse(JSON.stringify(newOptions));
            if (
              model &&
              (this.activeContactor.platform === "openai" ||
                this.activeContactor.platform === "llm")
            ) {
              if (
                this.activeContactor.avatarPolicy === 0 ||
                this.activeContactor.avatarPolicy === "MODEL"
              ) {
                useContactorsStore().loadContactorAvatar(this.activeContactor);
                if (this.basicInfo) this.basicInfo.avatar = this.activeContactor.avatar;
              }
              if (
                this.activeContactor.namePolicy === 0 ||
                this.activeContactor.namePolicy === "MODEL"
              ) {
                this.activeContactor.name = model;
                if (this.basicInfo) this.basicInfo.name = model;
              }
            }
            client.setLocalStorage();
          }
        }
      },
      deep: true,
    },
    basicInfo: {
      handler(newInfo, oldInfo) {
        if (newInfo && this.activeContactor) {
          const isGroupMember = !!this.activeMember;
          const target = isGroupMember ? this.activeMember : this.activeContactor;
          const options = target?.options || this.options;
          const model = options?.base?.model || options?.model;
          const provider = options?.provider;

          // 当头像策略被切换为「跟随模型」(0 / "MODEL") 时，立即重新算并响应式更新头像
          const isAvatarModelPolicy =
            newInfo.avatarPolicy === 0 || newInfo.avatarPolicy === "MODEL";
          const wasAvatarModelPolicy =
            oldInfo &&
            (oldInfo.avatarPolicy === 0 || oldInfo.avatarPolicy === "MODEL");

          if (isAvatarModelPolicy && (!wasAvatarModelPolicy || !newInfo.avatar)) {
            if (model) {
              const modelAvatar = getAvatarByModel(model, provider);
              if (modelAvatar) {
                newInfo.avatar = modelAvatar;
              }
            }
          }

          // 当名称策略被切换为「跟随模型」(0 / "MODEL") 时，立即同步模型名
          const isNameModelPolicy =
            (newInfo.namePolicy === 0 || newInfo.namePolicy === "MODEL") &&
            this.activeContactor?.platform !== "channel";
          const wasNameModelPolicy =
            oldInfo &&
            (oldInfo.namePolicy === 0 || oldInfo.namePolicy === "MODEL");

          if (isNameModelPolicy && (!wasNameModelPolicy || !newInfo.name)) {
            if (model) {
              newInfo.name = model;
            }
          }

          if (isGroupMember) {
            this.activeMember.name = newInfo.name;
            this.activeMember.avatar = newInfo.avatar;
            this.activeMember.title = newInfo.title;
            this.activeMember.intro = newInfo.intro;
            this.activeMember.namePolicy = newInfo.namePolicy;
            this.activeMember.avatarPolicy = newInfo.avatarPolicy;
            this.activeMember.priority = newInfo.priority ? 0 : 1;
            const store = useContactorsStore();
            store.updateContactor(this.activeContactor.id, {
              members: [...this.activeContactor.members],
            });
          } else {
            this.activeContactor.name = newInfo.name;
            this.activeContactor.avatar = newInfo.avatar;
            this.activeContactor.namePolicy = newInfo.namePolicy;
            this.activeContactor.avatarPolicy = newInfo.avatarPolicy;
            this.activeContactor.priority = newInfo.priority ? 0 : 1;
            client.setLocalStorage();
          }
        }
      },
      deep: true,
    },
  },
  created() {
    // Use created instead of beforeMount for data initialization
    this.initContactor();
    if (!this.activeContactor) {
      if (client.inited) {
        this.handleClientLoaded();
      } else {
        client.on("loaded", this.handleClientLoaded, false);
      }
    }
  },
  mounted() {
    client.on("plugins_updated", this.handlePluginsUpdated, false);
    client.on("channel_bots_synced", this.handleClientLoaded, false);
  },
  beforeUnmount() {
    client.off("plugins_updated", this.handlePluginsUpdated);
    client.off("loaded", this.handleClientLoaded);
    client.off("channel_bots_synced", this.handleClientLoaded);
  },
  methods: {
    handleBack() {
      if (this.activeMember) {
        this.$router.push(`/profile/${this.activeContactor.id}`);
      } else {
        this.$router.push(`/chat/${this.activeContactor.id}`);
      }
    },
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
    async handleClientLoaded() {
      console.log("[ProfileView] Client loaded, initializing contactor...");
      const rawId = this.$route.params.id;
      const currentId = isNaN(Number(rawId)) ? String(rawId) : Number(rawId);
      this.activeContactor = client.getContactor(currentId);
      if (!this.activeContactor && String(rawId).startsWith("c_")) {
        try {
          const { configAPI } = await import("@/lib/configApi.js");
          const res = await configAPI.request(`/api/channels/${rawId}`);
          if (res?.data) {
            const ch = res.data;
            const store = useContactorsStore();
            this.activeContactor = await store.addChannelContactor({
              id: ch.id,
              channelId: ch.id,
              name: ch.name || "微信助手",
              avatar: ch.avatar || "/static/icons/512x512.png",
              agentId: ch.agentId || "wechat-master",
              model: ch.model || "",
              provider: ch.provider || "",
              intro: `微信渠道 Bot (${ch.id})`,
            });
          }
        } catch (e) {
          console.warn("[ProfileView] 自动补录渠道联系人失败:", e);
        }
      }
      this.initContactor();
    },
    initContactor() {
      if (!this.activeContactor) {
        console.warn(
          "[ProfileView] activeContactor is undefined, waiting for client initialization",
        );
        return;
      }

      const memberId = this.$route.query?.memberId;
      if (this.activeContactor.platform === "group" && memberId) {
        const foundMember = this.activeContactor.members?.find(
          (m) => m.id === memberId || m.agentId === memberId
        );
        if (foundMember) {
          this.activeMember = foundMember;
          if (!this.activeMember.options) this.activeMember.options = {};
          this.options = JSON.parse(JSON.stringify(this.activeMember.options));

          const { id, name, avatar, title, intro, namePolicy, avatarPolicy, priority } =
            this.activeMember;
          this.basicInfo = {
            id,
            name: name || "Agent 成员",
            avatar: avatar || "/static/icons/512x512.png",
            title: title || "",
            intro: intro || "",
            namePolicy: namePolicy ?? 0,
            avatarPolicy: avatarPolicy ?? 0,
            priority: priority === 1 ? false : true,
          };
          return;
        }
      }

      this.activeMember = null;
      this.options = JSON.parse(JSON.stringify(this.activeContactor.options));

      const { id, name, avatar, namePolicy, avatarPolicy, priority } =
        this.activeContactor;
      this.basicInfo = {
        id,
        name,
        avatar,
        namePolicy: namePolicy !== undefined ? namePolicy : (this.activeContactor.platform === "channel" ? 1 : 0),
        avatarPolicy: avatarPolicy !== undefined ? avatarPolicy : (this.activeContactor.platform === "channel" ? 1 : 0),
        priority: priority === 1 ? false : true,
      };

      if (this.activeContactor.platform === "onebot") {
        if (this.options.toolCallSettings) {
          this.options.toolCallSettings.mode = "none";
          this.options.toolCallSettings.tools = [];
        }
      }
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
    // 移动端「更多」菜单：复用 .action-bar 的三个操作（该栏在移动端被隐藏）
    handleMobileAction(command) {
      if (command === "chat") {
        this.$router.push(`/chat/${this.activeContactor.id}`);
      } else if (command === "save") {
        this.saveAsPreset();
      } else if (command === "delete") {
        this.centerDialogVisible = true;
      }
    },
    async saveAsPreset() {
      const c = this.activeContactor;
      if (!c) return;

      const preset = {
        id: String(c.id),
        name: c.name || "未命名",
        title: c.title || "",
        avatar: c.avatar || "",
        namePolicy: c.namePolicy !== undefined ? c.namePolicy : 0,
        avatarPolicy: c.avatarPolicy !== undefined ? c.avatarPolicy : 0,
        model: c.options?.base?.model || "",
        tools: c.options?.toolCallSettings?.tools || [],
        history: c.options?.presetSettings?.history || [],
        opening: c.options?.presetSettings?.opening || "",
        temperature: c.options?.chatParams?.temperature,
        reasoning_effort: c.options?.chatParams?.reasoning_effort,
      };

      try {
        const result = await saveLocalPreset(preset);
        if (result.action === "updated") {
          this.$message.success("预设已更新");
        } else {
          this.$message.success("已保存为本地预设");
        }
      } catch (e) {
        this.$message.error("保存失败: " + e.message);
      }
    },

    async delContactor() {
      if (!this.activeContactor) return;
      this.centerDialogVisible = false;

      if (this.activeMember) {
        const updatedMembers = (this.activeContactor.members || []).filter(
          (m) => m.id !== this.activeMember.id && m.agentId !== this.activeMember.id
        );
        const store = useContactorsStore();
        await store.updateContactor(this.activeContactor.id, {
          members: updatedMembers,
        });
        this.$message.success(`已从群聊中移出成员【${this.activeMember.name}】`);
        this.activeMember = null;
        this.$router.push(`/profile/${this.activeContactor.id}`);
      } else {
        await client.rmContactor(this.activeContactor.id);
        this.$router.push("/");
      }
    },
    handleProviderSwitched() {
      if (!this.activeContactor) return;
      // This event is specifically for actions parent needs to take,
      // like reloading avatar, that are outside the 'options' object.
      // title 同步已统一归口到 options watcher（provider 切换同样走 emitUpdate）
      useContactorsStore().loadContactorAvatar(this.activeContactor);
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
      useContactorsStore().loadContactorAvatar(this.activeContactor);
      this.basicInfo.avatar = this.activeContactor.avatar;
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
  color: var(--mio-text-primary);
}

.settings-card {
  background: var(--mio-bg-card);
  border-radius: 12px;
  padding: 8px 24px;
  margin-bottom: 24px;
  box-shadow: var(--mio-shadow-light);
}

.group-title {
  padding: 0 4px 12px;
  font-size: 15px;
  font-weight: 500;
  color: var(--mio-text-primary);
  text-align: left;
}

.setting-field {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid var(--mio-border-color-lighter);
}

.setting-field:last-child {
  border-bottom: none;
}

.field-label {
  width: 14rem;
  font-size: 13px;
  color: var(--mio-text-secondary);
  padding-top: 8px;
  flex-shrink: 0;
  text-align: left;
}

/* 选项说明统一走 tooltip，不要在 .field-label 里塞说明文字块：
   该列桌面仅 14rem、移动端仅 100px，长文案会折成很高的一坨。 */
.label-hint-icon {
  font-size: 14px;
  color: var(--mio-text-placeholder);
  cursor: help;
  vertical-align: middle;
  margin-left: 4px;
  transition: color 0.15s;
}

.label-hint-icon:hover {
  color: var(--mio-color-primary);
}

.label-hint-icon.danger {
  color: var(--mio-color-warning);
}

/* tooltip 默认不限宽，长文案会拉成一条极宽的横条 */
.mio-hint-popper {
  max-width: 260px !important;
  line-height: 1.6 !important;
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
  background: var(--mio-bg-page) !important;
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
    border-bottom: 1px solid var(--mio-border-color-lighter);
  }

  .field-label {
    font-size: 13px;
    color: var(--mio-text-secondary);
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

.desktop-member-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding: 8px 14px;
  background: var(--mio-bg-card);
  border: 1px solid var(--mio-border-color-light);
  border-radius: 8px;
}

.back-group-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--mio-color-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.back-group-btn:hover {
  background: var(--mio-bg-hover);
  color: var(--mio-color-primary-hover, #007acd);
}

.member-badge {
  font-size: 11px;
  color: var(--mio-text-secondary);
  background: var(--mio-bg-hover);
  padding: 2px 8px;
  border-radius: 12px;
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
  background-color: var(--mio-bg-page);
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
  background-color: var(--mio-bg-page);
}

/* Mobile Nav */
.mobile-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--mio-bg-card);
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
  color: var(--mio-text-primary);
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--mio-text-primary);
}

@media (max-width: 768px) {
  .profile-body {
    background-color: var(--mio-bg-page) !important;
  }

  .profile-container {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    min-width: 0 !important;
    background-color: var(--mio-bg-page) !important;
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
    background-color: var(--mio-color-success)
  &.offline
    background-color: var(--mio-text-placeholder)
</style>
