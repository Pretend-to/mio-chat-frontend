<template>
  <div class="settings-container">
    <div v-if="activeContactorPlatform == 'openai'" class="openai-settings">
      <div class="settings-block">
        <div class="block-title">LLM 基本配置</div>
        <div class="block-content">
          <div class="block-content-item">
            <div class="item-title">来源渠道</div>
            <div class="item-content">
              <el-select v-model="localLlmProvider" style="width: 10rem" @change="handleProviderChange">
                <el-option v-for="item in llmProvidersList" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </div>
          </div>
          <div v-for="(_, key) in localLlmGeneralKeys" :key="key" class="block-content-item">
            <div class="item-title">{{ getShownKey(key) }}</div>
            <div class="item-content">
              <el-input v-if="key === 'model'" v-model="localLlmGeneralKeys[key]"
                @change="updateGeneralSettings"></el-input>
              <el-input-number v-else-if="key === 'max_messages_num'" v-model="localLlmGeneralKeys[key]" :min="1"
                :step="1" @change="updateGeneralSettings" />
              <el-switch v-else-if="['stream'].includes(key)" v-model="localLlmGeneralKeys[key]"
                @change="updateGeneralSettings"></el-switch>
              <el-slider v-else-if="['temperature'].includes(key)" v-model="localLlmGeneralKeys[key]"
                :step="sliderTypes.a.step" :min="sliderTypes.a.min" :max="sliderTypes.a.max"
                @change="updateGeneralSettings" />
              <el-slider v-else-if="['top_p'].includes(key)" v-model="localLlmGeneralKeys[key]"
                :step="sliderTypes.b.step" :min="sliderTypes.b.min" :max="sliderTypes.b.max"
                @change="updateGeneralSettings" />
              <el-slider v-else-if="
                ['frequency_penalty', 'presence_penalty'].includes(key)
              " v-model="localLlmGeneralKeys[key]" :step="sliderTypes.c.step" :min="sliderTypes.c.min"
                :max="sliderTypes.c.max" @change="updateGeneralSettings" />
              <el-slider v-else-if="['reasoning_effort'].includes(key)" v-model="localLlmGeneralKeys[key]"
                :step="sliderTypes.d.step" :min="sliderTypes.d.min" :max="sliderTypes.d.max"
                :format-tooltip="sliderTypes.d.formatter" @change="updateGeneralSettings" />
            </div>
          </div>
        </div>
      </div>

      <div class="settings-block">
        <div class="block-title">LLM 预设配置</div>
        <div class="block-content">
          <div class="block-content-item">
            <div class="item-title">预设历史记录</div>
            <div class="item-content">
              <button :class="{
                active: showPresetsDetail,
                'extra-info-button': true,
              }" @click="showPresetsDetail = !showPresetsDetail">
                <i class="iconfont icon-return"></i>
              </button>
            </div>
          </div>
          <transition name="expand-slide">
            <div v-show="showPresetsDetail" class="block-content-item preset-details-container">
              <el-scrollbar max-height="400px" style="width: 100%">
                <PresetsList :presets-history="presetsHistoryData" @update-presets="handleUpdatePresets" />
              </el-scrollbar>
            </div>
          </transition>
        </div>
      </div>

      <div class="settings-block">
        <div class="block-title">LLM 工具调用配置</div>
        <div class="block-content">
          <div class="block-content-item">
            <div class="item-title">工具调用模式</div>
            <div class="item-content">
              <el-select v-model="localLlmToolCallMode" placeholder="AUTO" style="width: 10rem"
                @change="handleToolCallModeChange">
                <el-option v-for="item in toolCallModesList" :key="item.value" :label="item.label"
                  :value="item.value" />
              </el-select>
            </div>
          </div>
          <div v-for="(plugin, index) in localAllLLMTools" :key="index" class="block-content-item parent-item">
            <div class="item-title">
              <span class="tool-group-name">{{ plugin.name }}</span>
              <el-switch v-model="plugin.isAllEnabled" size="small" style="margin-left: 8px; flex-shrink: 0;"
                @change="(val) => handleToggleAllTools(plugin, val)" />
            </div>
            <div class="item-content">
              <button :class="{
                active: !plugin.collapsed,
                'extra-info-button': true,
              }" @click="plugin.collapsed = !plugin.collapsed">
                <i class="iconfont icon-return"></i>
              </button>
            </div>
            <transition name="expand-slide">
              <div v-show="!plugin.collapsed" class="item-hidden-content plugin-tools-container">
                <div v-for="(tool, toolIndex) in plugin.tools" :key="toolIndex" class="block-content-item child-item"
                  :title="tool.description">
                  <div class="item-title">
                    {{ tool.name.split("_mid_")[0] }}
                  </div>
                  <div class="item-content">
                    <el-switch v-model="tool.enabled" @change="handleToolEnableChange"></el-switch>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <div class="settings-block skills-block">
        <div class="block-title">
          <span>Agent Skills 技能库</span>
          <el-button type="primary" link :loading="reloadingSkills" @click="handleReloadSkills" class="sync-link">
            <i class="iconfont reset"></i>
            同步
          </el-button>
        </div>
        <div class="block-content">
          <el-scrollbar max-height="360px" class="skills-scrollbar">
            <div class="skills-grid">
              <div v-if="availableSkills.length === 0" class="no-skills">
                <div class="empty-icon-wrapper">
                  <i class="iconfont robot"></i>
                </div>
                <p>暂无可用技能</p>
                <span>点击上方“同步”按钮刷新技能库</span>
              </div>
              <div v-for="skill in availableSkills" :key="skill.name" class="skill-item">
                <div class="skill-header">
                  <div class="skill-icon">
                    <i class="iconfont robot"></i>
                  </div>
                  <div class="skill-name">{{ skill.name }}</div>
                </div>
                <div class="skill-description" :title="skill.description">{{ skill.description }}</div>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </div>

    <div v-if="isGeminiAdapter" class="settings-block">
      <div class="block-title">Gemini 额外设置</div>
      <div class="block-content">
        <div class="block-content-item">
          <div class="item-title">图像生成</div>
          <div class="item-content">
            <el-switch v-model="localGeminiExtraSettings.imageGeneration"
              @change="handleGeminiSettingsChange"></el-switch>
          </div>
        </div>
        <div class="block-content-item">
          <div class="item-title">内置工具</div>
          <div class="item-content">
            <button :class="{
              active: showInternalTools,
              'extra-info-button': true,
            }" @click="showInternalTools = !showInternalTools">
              <i class="iconfont icon-return"></i>
            </button>
          </div>
        </div>
        <transition name="expand-slide">
          <div v-show="showInternalTools" class="block-content-item" style="overflow: hidden">
            <ul id="internal-tools-settings" class="sub-items">
              <li v-for="(value, key) of localGeminiExtraSettings.internalTools" :key="key"
                class="block-content-item child-item">
                <div class="item-title">{{ getShownKey(key) }}</div>
                <div class="item-content">
                  <el-switch v-model="localGeminiExtraSettings.internalTools[key]"
                    @change="handleGeminiSettingsChange"></el-switch>
                </div>
              </li>
            </ul>
          </div>
        </transition>
        <div class="block-content-item">
          <div class="item-title">过滤等级设置</div>
          <div class="item-content">
            <button :class="{
              active: showSafetySettings,
              'extra-info-button': true,
            }" @click="showSafetySettings = !showSafetySettings">
              <i class="iconfont icon-return"></i>
            </button>
          </div>
        </div>
        <transition name="expand-slide">
          <div v-show="showSafetySettings" class="block-content-item" style="overflow: hidden">
            <ul id="safety-settings" class="sub-items">
              <li v-for="(value, key) of localGeminiSafetySettings" :key="key" class="block-content-item child-item">
                <div class="item-title">{{ getShownKey(key) }}</div>
                <div class="item-content">
                  <el-select v-model="localGeminiSafetySettings[key]" style="width: 10rem"
                    @change="handleSafetySettingChange(key)">
                    <el-option v-for="item in safetySimpleValueOptions" :key="item.value" :label="item.label"
                      :value="item.value" />
                  </el-select>
                </div>
              </li>
            </ul>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script>
import PresetsList from "@/components/PresetsList.vue";
import { client, config } from "@/lib/runtime.js";
import { skillAPI } from "@/lib/configApi.js";

export default {
  name: "ContactorSettings",
  components: {
    PresetsList,
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
  },
  emits: ["update:modelValue", "provider-changed", "update-presets"],
  data() {
    return {
      localLlmProvider: this.modelValue.provider,
      localLlmGeneralKeys: {},
      localLlmToolCallMode: this.modelValue.toolCallSettings?.mode,
      localAllLLMTools: JSON.parse(JSON.stringify(this.allLlmToolsData)), // Deep copy
      localGeminiExtraSettings: JSON.parse(
        JSON.stringify(this.modelValue.extraSettings.gemini),
      ), // Deep copy
      localGeminiSafetySettings: {},

      showPresetsDetail: false,
      showInternalTools: false,
      showSafetySettings: false,

      availableSkills: [],
      reloadingSkills: false,
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
    isGeminiAdapter() {
      const adapterType = config.getProviderAdapterType(this.localLlmProvider);
      return ['gemini', 'vertex', 'vertexExpress'].includes(adapterType);
    }
  },
  watch: {
    modelValue: {
      handler(newVal) {
        this.localLlmProvider = newVal.provider;
        this.localLlmToolCallMode = newVal.toolCallSettings?.mode;
        this.localGeminiExtraSettings = JSON.parse(
          JSON.stringify(newVal.extraSettings.gemini),
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
  },
  mounted() {
    this.initializeSettings();
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
    initializeSettings() {
      this.localLlmGeneralKeys = {
        ...this.modelValue.base,
        ...this.modelValue.chatParams,
      };
      const adapterType = config.getProviderAdapterType(this.localLlmProvider);
      if (['gemini', 'vertex'].includes(adapterType)) {
        this.localGeminiSafetySettings = this.safeSimplify(
          this.localGeminiExtraSettings.safetySettings,
        );
      }
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
      if (!newOptions.extraSettings.gemini)
        newOptions.extraSettings.gemini = {
          internalTools: {},
          safetySettings: {},
        };
      newOptions.extraSettings.gemini = JSON.parse(
        JSON.stringify(this.localGeminiExtraSettings),
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

      // Re-initialize Gemini settings if switching to/from Gemini
      const adapterType = config.getProviderAdapterType(newProvider);
      if (['gemini', 'vertex'].includes(adapterType)) {
        this.localGeminiSafetySettings = this.safeSimplify(
          this.localGeminiExtraSettings.safetySettings,
        );
      }
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
    handleGeminiSettingsChange() {
      this.emitUpdate();
    },
    safeSimplify(rawSafetySettings) {
      const result = {};
      const simplifyMethod = new Map();
      const table = this.safetySettingsParams;
      Object.keys(table).forEach((key) => {
        simplifyMethod.set(table[key], key);
      });
      Object.keys(rawSafetySettings || {}).forEach((key) => {
        result[key] = simplifyMethod.get(rawSafetySettings[key]);
      });
      return result;
    },
    handleSafetySettingChange(key) {
      const simplifiedValue = this.localGeminiSafetySettings[key];
      const originalValue = this.safetySettingsParams[simplifiedValue];
      if (!this.localGeminiExtraSettings.safetySettings) {
        // Ensure safetySettings exists
        this.localGeminiExtraSettings.safetySettings = {};
      }
      this.localGeminiExtraSettings.safetySettings[key] = originalValue;
      this.emitUpdate();
    },
  },
};
</script>

<style scoped>
.skills-block .block-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sync-link {
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sync-link i {
  font-size: 14px;
}

.skills-scrollbar {
  padding: 8px 12px;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.skill-item {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  transition: all 0.2s ease;
  cursor: default;
}

.skill-item:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: #409eff50;
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.skill-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #409eff 0%, #3a8ee6 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 8px rgba(64, 158, 255, 0.2);
}

.skill-icon i {
  font-size: 20px;
  color: #fff;
}

.skill-name {
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-description {
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  height: 38px;
  opacity: 0.85;
}

.no-skills {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #94a3b8;
  background: rgba(248, 250, 252, 0.5);
  border-radius: 20px;
  border: 2px dashed rgba(0, 0, 0, 0.05);
}

.empty-icon-wrapper {
  width: 64px;
  height: 64px;
  background: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.no-skills i {
  font-size: 32px;
  color: #cbd5e1;
}

.no-skills p {
  font-size: 15px;
  font-weight: 500;
  margin: 0 0 8px 0;
  color: #64748b;
}

.no-skills span {
  font-size: 12px;
  opacity: 0.6;
}

.settings-block :deep(.el-button--small) {
  padding: 5px 15px;
}
</style>
