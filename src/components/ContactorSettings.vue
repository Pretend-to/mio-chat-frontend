<template>
  <div class="settings-container">
    <div v-if="activeContactorPlatform == 'openai'" class="openai-settings">
      <div class="settings-block">
        <div class="block-title">LLM 基本配置</div>
        <div class="block-content">
          <div class="block-content-item">
            <div class="item-title">来源渠道</div>
            <div class="item-content">
              <el-select
                v-model="localLlmProvider"
                style="width: 10rem"
                @change="handleProviderChange"
              >
                <el-option
                  v-for="item in llmProvidersList"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
          </div>
          <div
            v-for="(_, key) in localLlmGeneralKeys"
            :key="key"
            class="block-content-item"
          >
            <div class="item-title">{{ getShownKey(key) }}</div>
            <div class="item-content">
              <el-input
                v-if="['model', 'max_messages_num'].includes(key)"
                v-model="localLlmGeneralKeys[key]"
                @change="updateGeneralSettings"
              ></el-input>
              <el-switch
                v-else-if="['stream'].includes(key)"
                v-model="localLlmGeneralKeys[key]"
                @change="updateGeneralSettings"
              ></el-switch>
              <el-slider
                v-else-if="['temperature'].includes(key)"
                v-model="localLlmGeneralKeys[key]"
                :step="sliderTypes.a.step"
                :min="sliderTypes.a.min"
                :max="sliderTypes.a.max"
                @change="updateGeneralSettings"
              />
              <el-slider
                v-else-if="['top_p'].includes(key)"
                v-model="localLlmGeneralKeys[key]"
                :step="sliderTypes.b.step"
                :min="sliderTypes.b.min"
                :max="sliderTypes.b.max"
                @change="updateGeneralSettings"
              />
              <el-slider
                v-else-if="
                  ['frequency_penalty', 'presence_penalty'].includes(key)
                "
                v-model="localLlmGeneralKeys[key]"
                :step="sliderTypes.c.step"
                :min="sliderTypes.c.min"
                :max="sliderTypes.c.max"
                @change="updateGeneralSettings"
              />
              <el-slider
                v-else-if="['reasoning_effort'].includes(key)"
                v-model="localLlmGeneralKeys[key]"
                :step="sliderTypes.d.step"
                :min="sliderTypes.d.min"
                :max="sliderTypes.d.max"
                :format-tooltip="sliderTypes.d.formatter"
                @change="updateGeneralSettings"
              />
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
              <button
                :class="{
                  active: showPresetsDetail,
                  'extra-info-button': true,
                }"
                @click="showPresetsDetail = !showPresetsDetail"
              >
                <i class="iconfont icon-return"></i>
              </button>
            </div>
          </div>
          <transition name="expand-slide">
            <div
              v-show="showPresetsDetail"
              class="block-content-item"
              style="overflow: hidden"
            >
              <PresetsList
                :presets-history="presetsHistoryData"
                @update-presets="handleUpdatePresets"
              />
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
              <el-select
                v-model="localLlmToolCallMode"
                placeholder="AUTO"
                style="width: 10rem"
                @change="handleToolCallModeChange"
              >
                <el-option
                  v-for="item in toolCallModesList"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
          </div>
          <div
            v-for="(plugin, index) in localAllLLMTools"
            :key="index"
            class="block-content-item parent-item"
          >
            <div class="item-title">{{ plugin.name }}</div>
            <div class="item-content">
              <button
                :class="{
                  active: !plugin.collapsed,
                  'extra-info-button': true,
                }"
                @click="plugin.collapsed = !plugin.collapsed"
              >
                <i class="iconfont icon-return"></i>
              </button>
            </div>
            <transition name="expand-slide">
              <div
                v-show="!plugin.collapsed"
                class="item-hidden-content plugin-tools-container"
              >
                <div
                  v-for="(tool, toolIndex) in plugin.tools"
                  :key="toolIndex"
                  class="block-content-item child-item"
                  :title="tool.description"
                >
                  <div class="item-title">
                    {{ tool.name.split("-_-")[0] }}
                  </div>
                  <div class="item-content">
                    <el-switch
                      v-model="tool.enabled"
                      @change="handleToolEnableChange"
                    ></el-switch>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="['gemini', 'vertex'].includes(localLlmProvider)"
      class="settings-block"
    >
      <div class="block-title">Gemini 额外设置</div>
      <div class="block-content">
        <div class="block-content-item">
          <div class="item-title">图像生成</div>
          <div class="item-content">
            <el-switch
              v-model="localGeminiExtraSettings.imageGeneration"
              @change="handleGeminiSettingsChange"
            ></el-switch>
          </div>
        </div>
        <div class="block-content-item">
          <div class="item-title">内置工具</div>
          <div class="item-content">
            <button
              :class="{
                active: showInternalTools,
                'extra-info-button': true,
              }"
              @click="showInternalTools = !showInternalTools"
            >
              <i class="iconfont icon-return"></i>
            </button>
          </div>
        </div>
        <transition name="expand-slide">
          <div
            v-show="showInternalTools"
            class="block-content-item"
            style="overflow: hidden"
          >
            <ul id="internal-tools-settings" class="sub-items">
              <li
                v-for="(value, key) of localGeminiExtraSettings.internalTools"
                :key="key"
                class="block-content-item child-item"
              >
                <div class="item-title">{{ getShownKey(key) }}</div>
                <div class="item-content">
                  <el-switch
                    v-model="localGeminiExtraSettings.internalTools[key]"
                    @change="handleGeminiSettingsChange"
                  ></el-switch>
                </div>
              </li>
            </ul>
          </div>
        </transition>
        <div class="block-content-item">
          <div class="item-title">过滤等级设置</div>
          <div class="item-content">
            <button
              :class="{
                active: showSafetySettings,
                'extra-info-button': true,
              }"
              @click="showSafetySettings = !showSafetySettings"
            >
              <i class="iconfont icon-return"></i>
            </button>
          </div>
        </div>
        <transition name="expand-slide">
          <div
            v-show="showSafetySettings"
            class="block-content-item"
            style="overflow: hidden"
          >
            <ul id="safety-settings" class="sub-items">
              <li
                v-for="(value, key) of localGeminiSafetySettings"
                :key="key"
                class="block-content-item child-item"
              >
                <div class="item-title">{{ getShownKey(key) }}</div>
                <div class="item-content">
                  <el-select
                    v-model="localGeminiSafetySettings[key]"
                    style="width: 10rem"
                    @change="handleSafetySettingChange(key)"
                  >
                    <el-option
                      v-for="item in safetySimpleValueOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
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
import { config } from "@/lib/runtime.js"; // For getDefaultModel

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
  created() {
    this.initializeSettings();
  },
  methods: {
    initializeSettings() {
      this.localLlmGeneralKeys = {
        ...this.modelValue.base,
        ...this.modelValue.chatParams,
      };
      if (["gemini", "vertex"].includes(this.localLlmProvider)) {
        this.localGeminiSafetySettings = this.safeSimplify(
          this.localGeminiExtraSettings.safetySettings,
        );
      }
      this.updateEnabledTools();
    },
    updateEnabledTools() {
      const enabledTools = this.modelValue.toolCallSettings?.tools || [];
      this.localAllLLMTools = this.localAllLLMTools.map((plugin) => ({
        ...plugin,
        tools: plugin.tools.map((tool) => ({
          ...tool,
          enabled: enabledTools.includes(tool.name),
        })),
      }));
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
      if (["gemini", "vertex"].includes(newProvider)) {
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
      this.emitUpdate();
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
