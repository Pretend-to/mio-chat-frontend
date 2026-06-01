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

      <template v-for="(_, key) in localLlmGeneralKeys" :key="key">
        <div
          v-if="
            [
              'model',
              'max_messages_num',
              'stream',
              'temperature',
              'reasoning_effort',
            ].includes(key)
          "
          class="setting-field"
        >
          <div class="field-label">{{ getShownKey(key) }}</div>
          <div class="field-value">
            <el-select
              v-if="key === 'model'"
              v-model="localLlmGeneralKeys[key]"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入模型"
              style="width: 100%"
              @change="updateGeneralSettings"
            >
              <el-option
                v-for="m in currentModelsList"
                :key="m"
                :label="m"
                :value="m"
              />
            </el-select>
            <el-input-number
              v-else-if="key === 'max_messages_num'"
              v-model="localLlmGeneralKeys[key]"
              :min="1"
              :step="1"
              style="width: 100%"
              @change="updateGeneralSettings"
            />
            <el-switch
              v-else-if="['stream'].includes(key)"
              v-model="localLlmGeneralKeys[key]"
              @change="updateGeneralSettings"
            />
            <el-slider
              v-else-if="['temperature'].includes(key)"
              v-model="localLlmGeneralKeys[key]"
              :step="sliderTypes.a.step"
              :min="sliderTypes.a.min"
              :max="sliderTypes.a.max"
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
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from "vue";
import { config } from "@/lib/runtime.js";

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
  adapterMetadata: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "update:modelValue",
  "update:basicInfo",
  "provider-changed",
]);

// Copy basicInfo reactively
const basicInfo = reactive({ ...props.basicInfo });

const emitBasicInfoUpdate = () => {
  emit("update:basicInfo", { ...basicInfo });
};

// LLM Options States
const localLlmProvider = ref(props.modelValue?.provider || "");
const localLlmGeneralKeys = ref({
  ...(props.modelValue?.base || {}),
  ...(props.modelValue?.chatParams || {}),
});

const sliderTypes = {
  a: { min: 0, max: 2, step: 0.1 },
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

const getShownKey = (key) => {
  const shownNameMap = {
    model: "模型",
    max_messages_num: "最大历史消息数",
    stream: "流式响应",
    reasoning_effort: "思考强度",
    temperature: "温度",
  };
  return shownNameMap[key] || key;
};

// Emit option updates
const emitUpdate = () => {
  const newOptions = JSON.parse(JSON.stringify(props.modelValue || {}));
  const { model, stream, max_messages_num, temperature, reasoning_effort } =
    localLlmGeneralKeys.value;

  newOptions.base = {
    ...newOptions.base,
    model,
    max_messages_num,
    stream,
  };
  if (!newOptions.chatParams) newOptions.chatParams = {};
  Object.assign(newOptions.chatParams, {
    temperature,
    reasoning_effort,
  });

  newOptions.provider = localLlmProvider.value;
  emit("update:modelValue", newOptions);
};

const updateGeneralSettings = () => {
  emitUpdate();
};

const handleProviderChange = (newProvider) => {
  localLlmProvider.value = newProvider;
  const defaultModel = config.getDefaultModel(newProvider);
  if (defaultModel) {
    localLlmGeneralKeys.value.model = defaultModel;
  }
  emitUpdate();
  emit("provider-changed", newProvider);
};

// Watchers
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      localLlmProvider.value = newVal.provider || "";
      localLlmGeneralKeys.value = {
        ...(newVal.base || {}),
        ...(newVal.chatParams || {}),
      };
    }
  },
  { deep: true },
);

watch(
  () => props.basicInfo,
  (newVal) => {
    if (newVal) {
      Object.assign(basicInfo, newVal);
    }
  },
  { deep: true },
);
</script>
