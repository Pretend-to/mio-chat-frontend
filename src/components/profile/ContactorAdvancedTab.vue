<template>
  <div class="tab-pane">
    <!-- Sampling Settings -->
    <div class="group-title">采样与高级参数</div>
    <div class="settings-card">
      <template v-for="(_, key) in localLlmGeneralKeys" :key="key">
        <div
          v-if="
            ['top_p', 'frequency_penalty', 'presence_penalty'].includes(key)
          "
          class="setting-field"
        >
          <div class="field-label">{{ getShownKey(key) }}</div>
          <div class="field-value">
            <el-slider
              v-if="key === 'top_p'"
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
          >
            <span
              style="
                color: var(--mio-color-warning);
                margin-left: 4px;
                cursor: help;
              "
              >⚠️</span
            >
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
import DynamicSettingsForm from "@/components/DynamicSettingsForm.vue";

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

const localLlmGeneralKeys = ref({
  ...(props.modelValue?.chatParams || {}),
});
const localYoloMode = ref(props.modelValue?.yolo || false);
const localExtraSettings = ref(
  JSON.parse(JSON.stringify(props.modelValue?.extraSettings || {})),
);

const sliderTypes = {
  b: { min: 0, max: 1, step: 0.1 },
  c: { min: -2, max: 2, step: 0.1 },
};

const getShownKey = (key) => {
  const shownNameMap = {
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
  if (!newOptions.chatParams) newOptions.chatParams = {};

  const { top_p, frequency_penalty, presence_penalty } =
    localLlmGeneralKeys.value;
  Object.assign(newOptions.chatParams, {
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
      localLlmGeneralKeys.value = {
        ...(newVal.chatParams || {}),
      };
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
.no-skills {
  padding: 40px;
  text-align: center;
  color: var(--mio-text-placeholder);
  font-size: 13px;
}
</style>
