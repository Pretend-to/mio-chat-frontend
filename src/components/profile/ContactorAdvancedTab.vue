<template>
  <div class="tab-pane">
    <!-- Sampling Settings -->
    <div class="group-title">采样与高级参数</div>
    <div class="settings-card">
      <div class="setting-field">
        <div class="field-label">流式响应</div>
        <div class="field-value">
          <el-switch
            v-model="localStream"
            @change="updateGeneralSettings"
          />
        </div>
      </div>

      <!-- 识图传输开关 (支持 auto / true / false 覆写) -->
      <div class="setting-field">
        <div class="field-label">
          识图
          <el-tooltip
            placement="top"
            popper-class="mio-hint-popper"
            :content="visionStatusText"
          >
            <el-icon class="label-hint-icon" :class="{ 'is-supported': effectiveVisionSupport }">
              <InfoFilled />
            </el-icon>
          </el-tooltip>
        </div>
        <div class="field-value">
          <el-select
            v-model="localVisionSetting"
            style="width: 140px"
            size="small"
            @change="updateGeneralSettings"
          >
            <el-option label="自动跟随模型" value="auto" />
            <el-option label="强制开启" value="true" />
            <el-option label="强制关闭" value="false" />
          </el-select>
        </div>
      </div>

      <template v-for="(_, key) in localLlmGeneralKeys" :key="key">
        <div
          v-if="
            ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty'].includes(key)
          "
          class="setting-field"
        >
          <div class="field-label">{{ getShownKey(key) }}</div>
          <div class="field-value">
            <el-slider
              v-if="['temperature'].includes(key)"
              v-model="localLlmGeneralKeys[key]"
              :step="sliderTypes.a.step"
              :min="sliderTypes.a.min"
              :max="sliderTypes.a.max"
              @change="updateGeneralSettings"
            />
            <el-slider
              v-else-if="key === 'top_p'"
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
          </div>
        </div>
      </template>
    </div>

    <!-- Security/Authorization -->
    <div class="group-title">安全与授权设置</div>
    <div class="settings-card">
      <div class="setting-field">
        <div class="field-label">
          <span style="font-weight: bold">YOLO 模式</span>
          <el-tooltip
            content="开启后，LLM 执行 shell 命令（sh）时将跳过所有二次确认步骤。此模式极度危险，可能导致系统损坏或数据丢失！"
            placement="top"
            popper-class="mio-hint-popper"
          >
            <span class="label-hint-icon danger">⚠️</span>
          </el-tooltip>
        </div>
        <div class="field-value">
          <el-switch
            v-model="localYoloMode"
            @change="updateGeneralSettings"
            active-color="var(--mio-color-danger)"
          />
        </div>
      </div>
    </div>

    <DynamicSettingsForm
      v-if="
        currentExtraSettingsSchema &&
        Object.keys(currentExtraSettingsSchema).length > 0
      "
      :schema="currentExtraSettingsSchema"
      :values="
        extraSettingsKey
          ? localExtraSettings[extraSettingsKey] || {}
          : localExtraSettings
      "
      @update:values="handleExtraSettingsChange"
    />
    <div v-else class="settings-card no-skills" style="padding: 20px 0">
      <p>当前适配器暂无额外扩展项</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import { config } from "@/lib/runtime.js";
import { useConfigStore } from "@/stores/configStore.js";
import { InfoFilled } from "@element-plus/icons-vue";
import DynamicSettingsForm from "@/components/DynamicSettingsForm.vue";

const configStore = useConfigStore();

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  adapterMetadata: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update:modelValue"]);

const DEFAULT_ADVANCED_PARAMS = {
  temperature: 1,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
};

const getInitialAdvancedParams = (chatParams) => ({
  ...DEFAULT_ADVANCED_PARAMS,
  ...(chatParams || {}),
});

const localLlmGeneralKeys = ref(
  getInitialAdvancedParams(props.modelValue?.chatParams),
);
const localStream = ref(props.modelValue?.base?.stream ?? true);
const localYoloMode = ref(props.modelValue?.yolo || false);
const localExtraSettings = ref(
  JSON.parse(JSON.stringify(props.modelValue?.extraSettings || {})),
);

// Vision override state ('auto' | 'true' | 'false')
const getInitialVisionSetting = () => {
  const v = props.modelValue?.base?.vision;
  if (v === true || v === "true") return "true";
  if (v === false || v === "false") return "false";
  return "auto";
};
const localVisionSetting = ref(getInitialVisionSetting());

// 计算当前模型通过 Registry 判断的默认视觉能力
const modelDefaultVision = computed(() => {
  const provider = props.modelValue?.provider;
  const model = props.modelValue?.base?.model;
  if (!provider || !model) return false;

  const meta = configStore.modelsMeta?.[provider]?.[model];
  if (meta && typeof meta.vision === "boolean") {
    return meta.vision;
  }

  const lower = String(model).toLowerCase();
  return /vision|[-_]vl\b|[-_]vl[-_]|gemini|claude-(3|4)|gpt-4o|o1|o3/i.test(lower);
});

// 当前最终生效的视觉能力
const effectiveVisionSupport = computed(() => {
  if (localVisionSetting.value === "true") return true;
  if (localVisionSetting.value === "false") return false;
  return modelDefaultVision.value;
});

// 提示说明文案
const visionStatusText = computed(() => {
  const modelName = props.modelValue?.base?.model || "当前模型";
  if (localVisionSetting.value === "true") {
    return "已强制开启视觉支持（向模型发送图片）";
  }
  if (localVisionSetting.value === "false") {
    return "已强制关闭视觉支持（自动忽略图片消息）";
  }
  return modelDefaultVision.value
    ? `当前模型 [${modelName}] 支持多模态识图`
    : `当前模型 [${modelName}] 未识别到视觉能力（将忽略图片）`;
});

const sliderTypes = {
  a: { min: 0, max: 2, step: 0.1 },
  b: { min: 0, max: 1, step: 0.1 },
  c: { min: -2, max: 2, step: 0.1 },
};

const getShownKey = (key) => {
  const shownNameMap = {
    temperature: "温度",
    top_p: "核采样",
    frequency_penalty: "重复惩罚度",
    presence_penalty: "话题新鲜度",
  };
  return shownNameMap[key] || key;
};

const extraSettingsKey = computed(() => {
  const provider = props.modelValue?.provider;
  if (!provider) return null;
  const adapterType = config.getProviderAdapterType(provider);
  const meta = props.adapterMetadata.find((m) => m.type === adapterType);
  const schemaWrap = meta?.extraSettingsSchema || {};
  const keys = Object.keys(schemaWrap);
  return keys.length > 0 ? keys[0] : null;
});

const currentExtraSettingsSchema = computed(() => {
  const provider = props.modelValue?.provider;
  if (!provider) return {};
  const adapterType = config.getProviderAdapterType(provider);
  const meta = props.adapterMetadata.find((m) => m.type === adapterType);
  const schemaWrap = meta?.extraSettingsSchema || {};
  const key = extraSettingsKey.value;
  return key ? schemaWrap[key] : {};
});

const emitUpdate = () => {
  const newOptions = JSON.parse(JSON.stringify(props.modelValue || {}));
  if (!newOptions.base) newOptions.base = {};
  newOptions.base.stream = localStream.value;

  // vision 转换
  let visionVal = undefined;
  if (localVisionSetting.value === "true") visionVal = true;
  else if (localVisionSetting.value === "false") visionVal = false;
  newOptions.base.vision = visionVal;

  if (!newOptions.chatParams) newOptions.chatParams = {};

  const { temperature, top_p, frequency_penalty, presence_penalty } =
    localLlmGeneralKeys.value;
  Object.assign(newOptions.chatParams, {
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
  });

  newOptions.yolo = localYoloMode.value;
  newOptions.extraSettings = JSON.parse(
    JSON.stringify(localExtraSettings.value),
  );

  emit("update:modelValue", newOptions);
};

const updateGeneralSettings = () => {
  emitUpdate();
};

const handleExtraSettingsChange = (newValues) => {
  if (extraSettingsKey.value) {
    localExtraSettings.value[extraSettingsKey.value] = newValues;
  } else {
    localExtraSettings.value = newValues;
  }
  emitUpdate();
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      localLlmGeneralKeys.value = getInitialAdvancedParams(newVal.chatParams);
      localStream.value = newVal.base?.stream ?? true;
      localVisionSetting.value = getInitialVisionSetting();
      localYoloMode.value = newVal.yolo || false;
      localExtraSettings.value = JSON.parse(
        JSON.stringify(newVal.extraSettings || {}),
      );
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

.label-hint-icon.danger {
  color: var(--mio-color-danger, #f56c6c);
}

.no-skills {
  padding: 40px;
  text-align: center;
  color: var(--mio-text-placeholder);
  font-size: 13px;
}
</style>
