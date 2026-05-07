<template>
  <div class="settings-container">
    <!-- Header: Basic Info (QQ Style) -->
    <div class="profile-header">
      <div class="avatar-container">
        <div class="avatar" :style="{ backgroundImage: `url(${avatar || ''})` }"></div>
        <div :class="{ 'status-dot': true, offline: !isConnected }"></div>
      </div>
      <div class="profile-info">
        <h1 class="profile-name">{{ name || 'Mio Assistant' }}</h1>
        <div class="profile-id">ID {{ localBasicInfo.id || '114514' }}</div>
        <div class="status-text">
          <span :class="{ 'online-indicator': true, offline: !isConnected }">●</span>
          {{ isConnected ? '在线' : '离线' }}
        </div>
      </div>
    </div>

    <!-- Top Tabs -->
    <div class="tabs-container">
      <div class="segmented-tabs">
        <div :class="{ 'tab-item': true, active: activeTab === 'basic' }" @click="activeTab = 'basic'">基础配置</div>
        <div :class="{ 'tab-item': true, active: activeTab === 'tools' }" @click="activeTab = 'tools'">工具调用</div>
        <div :class="{ 'tab-item': true, active: activeTab === 'skills' }" @click="activeTab = 'skills'">技能库</div>
        <div :class="{ 'tab-item': true, active: activeTab === 'presets' }" @click="activeTab = 'presets'">历史预设</div>
        <div :class="{ 'tab-item': true, active: activeTab === 'advanced' }" @click="activeTab = 'advanced'">高级扩展</div>
      </div>
    </div>

    <!-- Settings Content Area -->
    <div class="settings-content">

      <!-- Tab: Basic -->
      <div v-if="activeTab === 'basic'" class="tab-pane">
        <!-- Identity Group -->
        <div class="group-title">Bot 基本配置</div>
        <div class="settings-card">
          <div class="setting-field">
            <div class="field-label">昵称</div>
            <div class="field-value">
              <el-input v-model="localBasicInfo.name" :disabled="localBasicInfo.namePolicy !== 1" />
            </div>
          </div>
          <div class="setting-field">
            <div class="field-label">头像</div>
            <div class="field-value">
              <el-input v-if="localBasicInfo.avatarPolicy !== 1" value="跟随模型" disabled />
              <el-input v-else v-model="localBasicInfo.avatar" />
            </div>
          </div>
          <div class="setting-field">
            <div class="field-label">头像策略</div>
            <div class="field-value">
              <el-select v-model="localBasicInfo.avatarPolicy" style="width: 100%">
                <el-option v-for="item in avatarPolicyList" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </div>
          </div>
          <div class="setting-field">
            <div class="field-label">昵称策略</div>
            <div class="field-value">
              <el-select v-model="localBasicInfo.namePolicy" style="width: 100%">
                <el-option v-for="item in namePolicyList" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </div>
          </div>
          <div class="setting-field">
            <div class="field-label">会话置顶</div>
            <div class="field-value">
              <el-switch v-model="localBasicInfo.priority" />
            </div>
          </div>
        </div>

        <div class="group-title">LLM 基本配置</div>
        <div class="settings-card">
          <div class="setting-field">
            <div class="field-label">来源渠道</div>
            <div class="field-value">
              <el-select v-model="localLlmProvider" style="width: 100%" @change="handleProviderChange">
                <el-option v-for="item in llmProvidersList" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </div>
          </div>

          <template v-for="(_, key) in localLlmGeneralKeys" :key="key">
            <div v-if="['model', 'max_messages_num', 'stream', 'temperature', 'reasoning_effort'].includes(key)"
              class="setting-field">
              <div class="field-label">{{ getShownKey(key) }}</div>
              <div class="field-value">
                <el-select v-if="key === 'model'" v-model="localLlmGeneralKeys[key]" filterable allow-create
                  default-first-option placeholder="选择或输入模型" style="width: 100%" @change="updateGeneralSettings">
                  <el-option v-for="m in currentModelsList" :key="m" :label="m" :value="m" />
                </el-select>
                <el-input-number v-else-if="key === 'max_messages_num'" v-model="localLlmGeneralKeys[key]" :min="1"
                  :step="1" style="width: 100%" @change="updateGeneralSettings" />
                <el-switch v-else-if="['stream'].includes(key)" v-model="localLlmGeneralKeys[key]"
                  @change="updateGeneralSettings" />
                <el-slider v-else-if="['temperature'].includes(key)" v-model="localLlmGeneralKeys[key]"
                  :step="sliderTypes.a.step" :min="sliderTypes.a.min" :max="sliderTypes.a.max"
                  @change="updateGeneralSettings" />
                <el-slider v-else-if="['reasoning_effort'].includes(key)" v-model="localLlmGeneralKeys[key]"
                  :step="sliderTypes.d.step" :min="sliderTypes.d.min" :max="sliderTypes.d.max"
                  :format-tooltip="sliderTypes.d.formatter" @change="updateGeneralSettings" />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Tab: Tools -->
      <div v-if="activeTab === 'tools'" class="tab-pane">
        <div class="group-title">调用模式</div>
        <div class="settings-card">
          <div class="setting-field">
            <div class="field-label">调用模式</div>
            <div class="field-value">
              <el-select v-model="localLlmToolCallMode" placeholder="AUTO" style="width: 100%"
                @change="handleToolCallModeChange">
                <el-option v-for="item in toolCallModesList" :key="item.value" :label="item.label"
                  :value="item.value" />
              </el-select>
            </div>
          </div>
        </div>

        <div class="group-title">插件工具</div>
        <div v-for="(plugin, index) in localAllLLMTools" :key="index" class="settings-card plugin-card">
          <div class="plugin-header">
            <span class="plugin-name">{{ plugin.name }}</span>
            <el-switch v-model="plugin.isAllEnabled" @change="(val) => handleToggleAllTools(plugin, val)" />
          </div>
          <el-scrollbar max-height="200px">
            <div class="plugin-tools-grid">
              <div v-for="(tool, toolIndex) in plugin.tools" :key="toolIndex" class="tool-mini-item">
                <span class="tool-name">{{ tool.name.split("_mid_")[0] }}</span>
                <el-switch v-model="tool.enabled" size="small" @change="handleToolEnableChange" />
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>

      <!-- Tab: Skills -->
      <div v-if="activeTab === 'skills'" class="tab-pane skills-tab-pane">
        <div class="group-title" v-if="!isMobile">
          Agent Skills 技能库
        </div>
        <div class="skills-scroll-container">
          <div class="skills-grid" :class="{ 'mobile-skills': isMobile }">
            <div v-if="availableSkills.length === 0" class="no-skills">
              <p>暂无可用技能，点击同步刷新</p>
            </div>
            <div v-for="skill in availableSkills" :key="skill.name" class="skill-item">
              <div class="skill-icon">
                <i class="iconfont robot"></i>
              </div>
              <div class="skill-info">
                <div class="skill-name">{{ skill.name }}</div>
                <div class="skill-description">{{ skill.description }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Presets -->
      <div v-if="activeTab === 'presets'" class="tab-pane">
        <div class="group-title">历史预设</div>
        <div class="settings-card presets-card">
          <PresetsList :presets-history="presetsHistoryData" @update-presets="handleUpdatePresets" />
        </div>
      </div>

      <!-- Tab: Advanced (Dynamic Settings) -->
      <div v-if="activeTab === 'advanced'" class="tab-pane">
        <!-- Sampling Settings moved from Basic -->
        <div class="group-title">采样与高级参数</div>
        <div class="settings-card">
          <template v-for="(_, key) in localLlmGeneralKeys" :key="key">
            <div v-if="['top_p', 'frequency_penalty', 'presence_penalty'].includes(key)" class="setting-field">
              <div class="field-label">{{ getShownKey(key) }}</div>
              <div class="field-value">
                <el-slider v-if="key === 'top_p'" v-model="localLlmGeneralKeys[key]" :step="sliderTypes.b.step"
                  :min="sliderTypes.b.min" :max="sliderTypes.b.max" @change="updateGeneralSettings" />
                <el-slider v-else-if="['frequency_penalty', 'presence_penalty'].includes(key)"
                  v-model="localLlmGeneralKeys[key]" :step="sliderTypes.c.step" :min="sliderTypes.c.min"
                  :max="sliderTypes.c.max" @change="updateGeneralSettings" />
              </div>
            </div>
          </template>
        </div>

        <DynamicSettingsForm v-if="currentExtraSettingsSchema && Object.keys(currentExtraSettingsSchema).length > 0"
          :schema="currentExtraSettingsSchema"
          :values="extraSettingsKey ? (localExtraSettings[extraSettingsKey] || {}) : localExtraSettings"
          @update:values="handleExtraSettingsChange" />
        <div v-else class="settings-card no-skills" style="padding: 20px 0;">
          <p>当前适配器暂无额外扩展项</p>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import PresetsList from "@/components/PresetsList.vue";
import DynamicSettingsForm from "@/components/DynamicSettingsForm.vue";
import { client, config } from "@/lib/runtime.js";
import { skillAPI, configAPI } from "@/lib/configApi.js";

export default {
  name: "ContactorSettings",
  components: {
    PresetsList,
    DynamicSettingsForm,
  },
  props: {
    modelValue: {
      // for v-model:options
      type: Object,
      required: true,
    },
    activeContactorPlatform: {
      type: String,
      required: true,
    },
    llmProvidersList: {
      type: Array,
      required: true,
    },
    toolCallModesList: {
      type: Array,
      required: true,
    },
    allLlmToolsData: {
      // Renamed from allLLMTools to avoid confusion
      type: Array,
      required: true,
    },
    safetySettingsParams: {
      type: Object,
      required: true,
    },
    safetySimpleValueOptions: {
      type: Array,
      required: true,
    },
    presetsHistoryData: {
      type: Array,
      default: () => [],
    },
    name: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    isConnected: {
      type: Boolean,
      default: false,
    },
    basicInfo: {
      type: Object,
      default: () => ({}),
    },
    avatarPolicyList: {
      type: Array,
      default: () => [],
    },
    namePolicyList: {
      type: Array,
      default: () => [],
    },
  },
  emits: ["update:modelValue", "update:basicInfo", "provider-changed", "update-presets"],
  data() {
    return {
      localLlmProvider: this.modelValue.provider,
      localLlmGeneralKeys: {},
      localLlmToolCallMode: this.modelValue.toolCallSettings?.mode,
      localAllLLMTools: JSON.parse(JSON.stringify(this.allLlmToolsData)), // Deep copy
      localExtraSettings: JSON.parse(JSON.stringify(this.modelValue.extraSettings || {})),
      localBasicInfo: JSON.parse(JSON.stringify(this.basicInfo || {})),
      adapterMetadata: [], // 存储所有适配器的元数据

      showPresetsDetail: false,
      showInternalTools: false,
      showSafetySettings: false,

      availableSkills: [],
      reloadingSkills: false,
      activeTab: 'basic',
      // Moved from parent
      sliderTypes: {
        a: { min: 0, max: 2, step: 0.1 },
        b: { min: 0, max: 1, step: 0.1 },
        c: { min: -2, max: 2, step: 0.1 },
        d: {
          min: -1,
          max: 3,
          step: 1,
          formatter: (value) => {
            const map = {
              "-1": "默认",
              0: "关闭思考",
              1: "基础思考",
              2: "均衡思考",
              3: "深度思考",
            };
            return map[value];
          },
        },
      },
    };
  },
  computed: {
    extraSettingsKey() {
      const adapterType = config.getProviderAdapterType(this.localLlmProvider);
      const meta = this.adapterMetadata.find(m => m.type === adapterType);
      const schemaWrap = meta?.extraSettingsSchema || {};
      const keys = Object.keys(schemaWrap);
      return keys.length > 0 ? keys[0] : null;
    },
    currentExtraSettingsSchema() {
      const adapterType = config.getProviderAdapterType(this.localLlmProvider);
      const meta = this.adapterMetadata.find(m => m.type === adapterType);
      const schemaWrap = meta?.extraSettingsSchema || {};
      const key = this.extraSettingsKey;
      return key ? schemaWrap[key] : {};
    },
    currentModelsList() {
      const provider = this.localLlmProvider;
      // 1. 优先从 config 获取该 provider 已经加载的真实模型列表 (结构为 [{group, models:[]}, ...])
      const modelGroups = config.getLlmModels(provider);
      if (Array.isArray(modelGroups) && modelGroups.length > 0) {
        // 展平所有分组中的模型名
        const flatModels = modelGroups.flatMap(group => group.models || []);
        if (flatModels.length > 0) return flatModels;
      }

      // 2. 如果是新配置或者还没加载出来，从元数据中找该适配器类型的推荐模型
      const adapterType = config.getProviderAdapterType(provider);
      const meta = (this.adapterMetadata || []).find(m => m.type === adapterType);

      console.log("[ModelList Debug]", {
        provider,
        adapterType,
        hasLoadedGroups: !!(modelGroups && modelGroups.length),
        metaFound: !!meta
      });

      return meta?.models || [];
    },
    isMobile() {
      return window.innerWidth <= 768;
    }
  },
  watch: {
    activeTab(newTab) {
      if (newTab === 'skills') {
        this.handleReloadSkills();
      }
    },
    modelValue: {
      handler(newVal) {
        this.localLlmProvider = newVal.provider;
        this.localLlmToolCallMode = newVal.toolCallSettings?.mode;
        this.localExtraSettings = JSON.parse(
          JSON.stringify(newVal.extraSettings || {}),
        );
        this.initializeSettings();
      },
      deep: true,
    },
    allLlmToolsData: {
      handler(newVal) {
        this.localAllLLMTools = JSON.parse(JSON.stringify(newVal));
        this.updateEnabledTools();
      },
      deep: true,
    },
    localBasicInfo: {
      handler(newVal) {
        // Prevent infinite loops by comparing stringified values
        if (JSON.stringify(newVal) !== JSON.stringify(this.basicInfo)) {
          this.$emit("update:basicInfo", newVal);
        }
      },
      deep: true,
    },
    basicInfo: {
      handler(newVal) {
        if (JSON.stringify(newVal) !== JSON.stringify(this.localBasicInfo)) {
          this.localBasicInfo = JSON.parse(JSON.stringify(newVal));
        }
      },
      deep: true,
    },
  },
  mounted() {
    this.initializeSettings();
    this.fetchAdapterMetadata();
    client.on("plugins_updated", this.handlePluginsUpdated);
  },
  beforeUnmount() {
    client.off("plugins_updated", this.handlePluginsUpdated);
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    handlePluginsUpdated() {
      console.log("[Plugin System] 检测到后端插件更新，正在刷新技能列表...");
      this.fetchSkills();
      this.$message.success("插件技能库已同步");
    },
    async fetchAdapterMetadata() {
      try {
        const res = await configAPI.getAdapterTypes();
        // 后端响应为 { code: 0, data: { adapters: [], types: [], count: 0 } }
        if (res.code === 0 && res.data?.adapters) {
          this.adapterMetadata = res.data.adapters;
          console.log("[Debug] 适配器元数据加载成功，共", this.adapterMetadata.length, "个");
        }
      } catch (err) {
        console.error("获取适配器元数据失败:", err);
      }
    },
    initializeSettings() {
      this.localLlmGeneralKeys = {
        ...this.modelValue.base,
        ...this.modelValue.chatParams,
      };
      this.updateEnabledTools();
      this.fetchSkills();
    },
    async fetchSkills() {
      try {
        const res = await skillAPI.getSkills();
        if (res.success) {
          this.availableSkills = res.data;
        }
      } catch (err) {
        console.error("获取技能列表失败:", err);
      }
    },
    async handleReloadSkills() {
      this.reloadingSkills = true;
      try {
        const res = await skillAPI.reloadSkills();
        if (res.success) {
          this.availableSkills = res.data;
          if (this.$message) this.$message.success("技能库已同步");
        }
      } catch (err) {
        if (this.$message) this.$message.error("同步失败: " + err.message);
      } finally {
        this.reloadingSkills = false;
      }
    },
    updateEnabledTools() {
      const enabledTools = this.modelValue.toolCallSettings?.tools || [];

      // 1. 同步 modelValue 中的已启用工具
      this.localAllLLMTools = this.localAllLLMTools.map((plugin) => {
        const updatedTools = plugin.tools.map((tool) => ({
          ...tool,
          enabled: enabledTools.includes(tool.name),
        }));
        return {
          ...plugin,
          tools: updatedTools,
        };
      });

      // 2. 检查是否有 Skill 工具被启用
      const isSkillEnabled = this.localAllLLMTools.some(plugin =>
        plugin.tools.some(tool => tool.name.toLowerCase().startsWith('skill') && tool.enabled)
      );

      if (isSkillEnabled) {
        // 如果启用了 Skill，强制同步激活 terminal 插件的所有工具
        this.localAllLLMTools.forEach(plugin => {
          if (plugin.name.toLowerCase().includes('terminal')) {
            plugin.tools.forEach(tool => {
              tool.enabled = true;
            });
          }
        });
      }

      // 3. 重新计算每个 plugin 的 isAllEnabled 状态
      this.localAllLLMTools.forEach(plugin => {
        plugin.isAllEnabled = plugin.tools.length > 0 && plugin.tools.every(t => t.enabled);
      });
    },
    getShownKey(key) {
      const shownNameMap = {
        mode: "工具调用",
        model: "模型",
        max_messages_num: "最大历史消息数",
        stream: "流式响应",
        reasoning_effort: "思考强度",
        temperature: "温度",
        top_p: "核采样",
        frequency_penalty: "重复惩罚度",
        presence_penalty: "话题新鲜度",
        HARM_CATEGORY_HARASSMENT: "骚扰",
        HARM_CATEGORY_HATE_SPEECH: "仇恨言论",
        HARM_CATEGORY_SEXUALLY_EXPLICIT: "色情",
        HARM_CATEGORY_DANGEROUS_CONTENT: "危险内容",
        HARM_CATEGORY_CIVIC_INTEGRITY: "公民诚信",
        imageGeneration: "图像生成",
        google_search: "联网搜索",
        code_execution: "代码执行",
        url_context: "网页解析",
      };
      return shownNameMap[key] || key;
    },
    emitUpdate() {
      const newOptions = JSON.parse(JSON.stringify(this.modelValue)); // Start with a copy of the prop

      const {
        model,
        stream,
        max_messages_num,
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        reasoning_effort,
      } = this.localLlmGeneralKeys;
      newOptions.base = { model, max_messages_num, stream };
      newOptions.chatParams = {
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        reasoning_effort,
      };

      newOptions.provider = this.localLlmProvider;
      if (!newOptions.toolCallSettings) newOptions.toolCallSettings = {};
      newOptions.toolCallSettings.mode = this.localLlmToolCallMode;

      const activeTools = this.localAllLLMTools.flatMap((plugin) =>
        plugin.tools.filter((tool) => tool.enabled).map((tool) => tool.name),
      );
      console.log("Active tools:", activeTools);
      newOptions.toolCallSettings.tools = activeTools;

      if (!newOptions.extraSettings) newOptions.extraSettings = {};
      newOptions.extraSettings = JSON.parse(
        JSON.stringify(this.localExtraSettings),
      );

      this.$emit("update:modelValue", newOptions);
    },
    updateGeneralSettings() {
      this.emitUpdate();
    },
    handleProviderChange(newProvider) {
      this.localLlmProvider = newProvider;
      const defaultModel = config.getDefaultModel(newProvider);
      if (defaultModel) {
        this.localLlmGeneralKeys.model = defaultModel;
      }
      this.emitUpdate();
      this.$emit("provider-changed", newProvider); // Inform parent for avatar, etc.

      const adapterType = config.getProviderAdapterType(newProvider);
    },
    handleUpdatePresets(presets) {
      this.$emit("update-presets", presets); // Pass through to parent
    },
    handleToolCallModeChange() {
      this.emitUpdate();
    },
    handleToolEnableChange() {
      // 检查是否有 Skill 工具被启用
      const isSkillEnabled = this.localAllLLMTools.some(plugin =>
        plugin.tools.some(tool => tool.name.toLowerCase().startsWith('skill') && tool.enabled)
      );

      if (isSkillEnabled) {
        // 如果启用了 Skill，强制同步激活 terminal 插件的所有工具
        this.localAllLLMTools.forEach(plugin => {
          if (plugin.name.toLowerCase().includes('terminal')) {
            plugin.tools.forEach(tool => {
              tool.enabled = true;
            });
          }
        });
      }

      // 重新计算每个 plugin 的 isAllEnabled 状态
      this.localAllLLMTools.forEach(plugin => {
        plugin.isAllEnabled = plugin.tools.length > 0 && plugin.tools.every(t => t.enabled);
      });
      this.emitUpdate();
    },
    handleToggleAllTools(plugin, value) {
      plugin.tools.forEach(tool => {
        tool.enabled = value;
      });
      this.handleToolEnableChange();
    },
    handleExtraSettingsChange(newValues) {
      if (this.extraSettingsKey) {
        this.localExtraSettings[this.extraSettingsKey] = newValues;
      } else {
        this.localExtraSettings = newValues;
      }
      this.emitUpdate();
    },
  },
};
</script>

<style scoped>
/* Profile Header */
.profile-header {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  background: #fff;
  border-radius: 16px;
  margin-bottom: 24px;
}

.avatar-container {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  background-color: #f0f0f0;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.status-dot {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 14px;
  height: 14px;
  background: #2ecc71;
  border: 2px solid #fff;
  border-radius: 50%;
  transition: background 0.3s;
}

.status-dot.offline {
  background: #ccc;
}

.profile-info {
  flex: 1;
  padding-top: 4px;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.profile-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.profile-id {
  font-size: 13px;
  color: #999;
  margin: 4px 0 8px;
}

.status-text {
  color: #000;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.online-indicator {
  color: #2ecc71;
  font-size: 12px;
}

.online-indicator.offline {
  color: #ccc;
}

.stats-row {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #999;
}

/* Tabs */
.tabs-container {
  display: flex;
  justify-content: center;
  padding: 0 20px;
  margin-bottom: 20px;
  overflow-x: auto;
  scrollbar-width: none;
  /* Firefox */
}

.tabs-container::-webkit-scrollbar {
  display: none;
  /* Chrome/Safari */
}

.segmented-tabs {
  display: flex;
  background: #f0f2f5;
  padding: 3px;
  border-radius: 10px;
  width: fit-content;
  white-space: nowrap;
  margin: 0 auto;
}

.tab-item {
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.tab-item.active {
  background: #fff;
  color: #000;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

/* Content Area */
.settings-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 4rem;
}

.divider {
  height: 1px;
  background: #f0f0f0;
  margin: 24px 0;
  width: 100%;
}

/* Mobile Adaptation */
@media (max-width: 768px) {
  .settings-container {
    background: white;
    flex: 1;
    overflow: hidden;
  }

  .profile-header {
    background: #fff;
    margin-bottom: 12px;
    padding: 24px 16px;
    border-radius: 16px;
  }

  .el-icon-arrow-right {
    color: #ccc;
    font-size: 14px;
    margin-left: 8px;
  }

  .tabs-container {
    margin-bottom: 12px;
    padding: 0 16px;
    justify-content: flex-start;
    -webkit-overflow-scrolling: touch;
  }

  .segmented-tabs {
    margin: 0;
    padding: 4px;
    background: #f5f6f8;
  }

  .tab-item {
    padding: 8px 18px;
    font-size: 14px;
  }

  .settings-content {
    padding: 0;
    background: #ffffff;
    flex: 1;
    overflow: hidden;
    /* Constrain this so child can scroll */
    display: flex;
    flex-direction: column;
  }

  .tab-pane {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 0 20px;
  }

  .skills-tab-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* Skills will use inner scroll container */
  }

  .skills-scroll-container {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    max-height: none !important;
  }

  .avatar {
    width: 64px;
    height: 64px;
  }

  .mobile-skills {
    padding: 0 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .mobile-skills .skill-item {
    background: #fff;
    margin-bottom: 0;
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .stats-row .iq-level {
    display: none;
  }
}

.tab-pane {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 600;
}

/* Plugins */
.plugin-block {
  background: #f9fafb;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.plugin-name {
  font-size: 14px;
  font-weight: 600;
}

.plugin-tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}

.tool-mini-item {
  background: #fff;
  padding: 6px 10px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.tool-name {
  font-size: 11px;
  color: #444;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Skills */
.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.skill-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  transition: all 0.2s;
}

.skill-item:hover {
  border-color: #409eff50;
  background: #f9fcff;
}

.skill-icon {
  width: 36px;
  height: 36px;
  background: #eef6ff;
  color: #409eff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.skills-scroll-container {
  max-height: 500px;
  overflow-y: auto;
  padding: 4px;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.skill-item {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
}

.skill-icon {
  width: 44px;
  height: 44px;
  background: #f0f4ff;
  color: #409eff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.skill-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.skill-description {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.no-skills {
  grid-column: 1 / -1;
  padding: 40px;
  text-align: center;
  color: #ccc;
  font-size: 13px;
}

.plugin-card {
  padding: 16px 24px;
}

.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.plugin-name {
  font-weight: 600;
  font-size: 15px;
}

.plugin-tools-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.tool-mini-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fb;
  padding: 8px 12px;
  border-radius: 8px;
}

.tool-name {
  font-size: 13px;
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.skill-field {
  padding: 14px 0;
}

.skills-card-list {
  padding: 4px 24px;
}

.presets-card {
  padding: 16px 24px;
}
</style>
