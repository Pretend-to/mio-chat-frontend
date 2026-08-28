<template>
  <div class="tab-pane">
    <!-- Identity Group -->
    <div class="group-title">Bot 基本配置</div>
    <div class="settings-card">
      <div class="setting-field">
        <div class="field-label">昵称</div>
        <div class="field-value">
          <el-input
            v-model="basicInfo.name"
            :disabled="basicInfo.namePolicy !== 1"
            @change="emitBasicInfoUpdate"
          />
        </div>
      </div>
      <div class="setting-field">
        <div class="field-label">头像</div>
        <div class="field-value">
          <el-input
            v-if="basicInfo.avatarPolicy !== 1"
            :value="
              activeContactorPlatform === 'onebot' ? '跟随QQ头像' : '跟随模型'
            "
            disabled
          />
          <el-input
            v-else
            v-model="basicInfo.avatar"
            @change="emitBasicInfoUpdate"
          />
        </div>
      </div>
      <div class="setting-field">
        <div class="field-label">头像策略</div>
        <div class="field-value">
          <el-select
            v-model="basicInfo.avatarPolicy"
            style="width: 100%"
            @change="emitBasicInfoUpdate"
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
      <div class="setting-field">
        <div class="field-label">昵称策略</div>
        <div class="field-value">
          <el-select
            v-model="basicInfo.namePolicy"
            style="width: 100%"
            @change="emitBasicInfoUpdate"
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
      <!-- 群成员专属头衔与职责配置 -->
      <template v-if="isGroupMember">
        <div class="setting-field">
          <div class="field-label">群内头衔</div>
          <div class="field-value">
            <el-input
              v-model="basicInfo.title"
              placeholder="例如：系统架构师、前端开发专家、测试工程师"
              @change="emitBasicInfoUpdate"
            />
          </div>
        </div>
        <div class="setting-field">
          <div class="field-label">群内职责</div>
          <div class="field-value">
            <el-input
              v-model="basicInfo.intro"
              type="textarea"
              :rows="2"
              placeholder="例如：负责系统整体架构设计、技术选型与评审，协助团队排查疑难缺陷"
              @change="emitBasicInfoUpdate"
            />
          </div>
        </div>
      </template>
      <div class="setting-field">
        <div class="field-label">会话置顶</div>
        <div class="field-value">
          <el-switch
            v-model="basicInfo.priority"
            @change="emitBasicInfoUpdate"
          />
        </div>
      </div>
    </div>

    <div v-if="activeContactorPlatform !== 'onebot'" class="group-title">
      LLM 基本配置
    </div>
    <div v-if="activeContactorPlatform !== 'onebot'" class="settings-card">
      <div class="setting-field">
        <div class="field-label">来源渠道</div>
        <div class="field-value">
          <el-select
            v-model="localLlmProvider"
            style="width: 100%"
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

      <!-- 模型选择 -->
      <div class="setting-field">
        <div class="field-label">模型</div>
        <div class="field-value">
          <el-select
            v-model="localLlmModel"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入模型"
            style="width: 100%"
            @change="handleModelChange"
          >
            <el-option
              v-for="m in currentModelsList"
              :key="m"
              :label="m"
              :value="m"
            />
          </el-select>
        </div>
      </div>

      <!-- 思考强度 -->
      <div class="setting-field">
        <div class="field-label">思考强度</div>
        <div class="field-value">
          <el-slider
            v-model="localReasoningEffort"
            :step="sliderTypes.d.step"
            :min="sliderTypes.d.min"
            :max="sliderTypes.d.max"
            :format-tooltip="sliderTypes.d.formatter"
            @change="handleReasoningEffortChange"
          />
        </div>
      </div>


      <!-- 智能模式 (一键启用 ai-plugin 核心智能工具集) -->
      <div class="setting-field">
        <div class="field-label">
          智能模式
          <el-tooltip
            placement="top"
            popper-class="mio-hint-popper"
            content="一键启用包含搜索、绘图、视觉分析、记忆和定时任务等核心智能工具集"
          >
            <el-icon class="label-hint-icon">
              <InfoFilled />
            </el-icon>
          </el-tooltip>
        </div>
        <div class="field-value">
          <el-switch
            :model-value="isAiPluginEnabled"
            @change="handleToggleAiPlugin"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from "vue";
import { config } from "@/lib/runtime.js";
import { useConfigStore } from "@/stores/configStore.js";
import { InfoFilled } from "@element-plus/icons-vue";

const configStore = useConfigStore();

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  basicInfo: {
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
  avatarPolicyList: {
    type: Array,
    required: true,
  },
  namePolicyList: {
    type: Array,
    required: true,
  },
  isGroupMember: {
    type: Boolean,
    default: false,
  },
  adapterMetadata: {
    type: Array,
    default: () => [],
  },
  allLlmToolsData: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "update:modelValue",
  "update:basicInfo",
  "provider-changed",
]);

// 智能模式 (一键启用 ai-plugin 插件组全部工具)
const isAiPluginEnabled = computed(() => {
  const currentTools = props.modelValue?.toolCallSettings?.tools || [];
  if (currentTools.length === 0) return false;

  const aiPlugin = (props.allLlmToolsData || []).find((p) =>
    p.name?.toLowerCase().includes("ai-plugin") || p.name?.toLowerCase() === "ai",
  );
  if (aiPlugin && aiPlugin.tools && aiPlugin.tools.length > 0) {
    return aiPlugin.tools.every((t) => currentTools.includes(t.name));
  }

  const aiTools = typeof config.getAiPluginToolNames === "function" ? config.getAiPluginToolNames() : [];
  if (aiTools.length > 0) {
    return aiTools.every((t) => currentTools.includes(t));
  }

  return false;
});

const handleToggleAiPlugin = (enable) => {
  const newOptions = JSON.parse(JSON.stringify(props.modelValue || {}));
  if (!newOptions.toolCallSettings) newOptions.toolCallSettings = {};
  let currentTools = [...(newOptions.toolCallSettings.tools || [])];

  const aiPlugin = (props.allLlmToolsData || []).find((p) =>
    p.name?.toLowerCase().includes("ai-plugin") || p.name?.toLowerCase() === "ai",
  );

  let targetToolNames = [];
  if (aiPlugin && aiPlugin.tools && aiPlugin.tools.length > 0) {
    targetToolNames = aiPlugin.tools.map((t) => t.name);
  } else if (typeof config.getAiPluginToolNames === "function") {
    targetToolNames = config.getAiPluginToolNames();
  }

  if (enable) {
    targetToolNames.forEach((name) => {
      if (!currentTools.includes(name)) {
        currentTools.push(name);
      }
    });
    if (!newOptions.toolCallSettings.mode || newOptions.toolCallSettings.mode === "NONE") {
      newOptions.toolCallSettings.mode = "AUTO";
    }
  } else {
    currentTools = currentTools.filter((name) => !targetToolNames.includes(name));
  }

  newOptions.toolCallSettings.tools = currentTools;
  emit("update:modelValue", newOptions);
};

// Copy basicInfo reactively
const basicInfo = reactive({ ...props.basicInfo });

const emitBasicInfoUpdate = () => {
  emit("update:basicInfo", { ...basicInfo });
};

// LLM Options States
const localLlmProvider = ref(props.modelValue?.provider || "");
const localLlmModel = ref(props.modelValue?.base?.model || "");
const localReasoningEffort = ref(props.modelValue?.chatParams?.reasoning_effort ?? -1);

const sliderTypes = {
  a: { min: 0, max: 2, step: 0.1 },
  d: {
    min: -1,
    max: 5,
    step: 1,
    formatter: (value) => {
      const map = {
        "-1": "默认",
        0: "关闭思考",
        1: "极简",
        2: "轻度",
        3: "中度",
        4: "深度",
        5: "极致",
      };
      return map[value];
    },
  },
};

// Computed models list
const currentModelsList = computed(() => {
  const provider = localLlmProvider.value;
  const modelGroups = config.getLlmModels(provider);
  if (Array.isArray(modelGroups) && modelGroups.length > 0) {
    const flatModels = modelGroups.flatMap((group) => group.models || []);
    if (flatModels.length > 0) return flatModels;
  }
  const adapterType = config.getProviderAdapterType(provider);
  const meta = (props.adapterMetadata || []).find(
    (m) => m.type === adapterType,
  );
  return meta?.models || [];
});

// Emit option updates
const emitUpdate = () => {
  const newOptions = JSON.parse(JSON.stringify(props.modelValue || {}));
  if (!newOptions.base) newOptions.base = {};
  newOptions.base.model = localLlmModel.value;

  if (!newOptions.chatParams) newOptions.chatParams = {};
  newOptions.chatParams.reasoning_effort = localReasoningEffort.value;

  newOptions.provider = localLlmProvider.value;
  emit("update:modelValue", newOptions);
};

const handleModelChange = (newModel) => {
  localLlmModel.value = newModel;
  emitUpdate();
};

const handleReasoningEffortChange = (newEffort) => {
  localReasoningEffort.value = newEffort;
  emitUpdate();
};

const handleProviderChange = (newProvider) => {
  localLlmProvider.value = newProvider;
  const defaultModel = config.getDefaultModel(newProvider);
  if (defaultModel) {
    localLlmModel.value = defaultModel;
  }
  emitUpdate();
  emit("provider-changed", newProvider);
};

// Watchers
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      const p = newVal.provider || "";
      if (localLlmProvider.value !== p) {
        localLlmProvider.value = p;
      }
      const m = newVal.base?.model || "";
      if (localLlmModel.value !== m) {
        localLlmModel.value = m;
      }
      const r = newVal.chatParams?.reasoning_effort ?? -1;
      if (localReasoningEffort.value !== r) {
        localReasoningEffort.value = r;
      }
    }
  },
  { deep: true },
);

watch(
  () => props.basicInfo,
  (newVal) => {
    if (newVal) {
      for (const k in newVal) {
        if (basicInfo[k] !== newVal[k]) {
          basicInfo[k] = newVal[k];
        }
      }
    }
  },
  { deep: true },
);
</script>

<style scoped>
.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.label-hint-icon {
  font-size: 14px;
  color: var(--mio-text-placeholder, #a8abb2);
  cursor: help;
  vertical-align: middle;
  margin-left: 4px;
  transition: color 0.15s;
}

.label-hint-icon:hover {
  color: var(--mio-color-primary, #409eff);
}

.label-hint-icon.is-supported {
  color: var(--el-color-success, #67c23a);
}
</style>
