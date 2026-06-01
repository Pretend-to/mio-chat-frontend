<template>
  <div class="tab-pane">
    <div class="group-title">调用模式</div>
    <div class="settings-card">
      <div class="setting-field">
        <div class="field-label">调用模式</div>
        <div class="field-value">
          <el-select
            v-model="localLlmToolCallMode"
            placeholder="AUTO"
            style="width: 100%"
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
    </div>

    <div class="group-title">插件工具</div>
    <div
      v-for="(plugin, index) in localAllLLMTools"
      :key="index"
      class="settings-card plugin-card"
    >
      <div class="plugin-header">
        <el-tooltip :content="plugin.name" placement="top" :show-after="800">
          <span class="plugin-name">{{ plugin.name }}</span>
        </el-tooltip>
        <el-switch
          v-model="plugin.isAllEnabled"
          @change="(val) => handleToggleAllTools(plugin, val)"
        />
      </div>
      <el-scrollbar max-height="200px">
        <div class="plugin-tools-grid">
          <div
            v-for="(tool, toolIndex) in plugin.tools"
            :key="toolIndex"
            class="tool-mini-item"
          >
            <div class="tool-name-wrapper">
              <el-tooltip
                :content="tool.name.split('_mid_')[0]"
                placement="top"
                :show-after="800"
              >
                <span class="tool-name">{{ tool.name.split("_mid_")[0] }}</span>
              </el-tooltip>
            </div>
            <el-switch
              v-model="tool.enabled"
              size="small"
              @change="handleToolEnableChange"
            />
          </div>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  toolCallModesList: {
    type: Array,
    required: true,
  },
  allLlmToolsData: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue"]);

const localLlmToolCallMode = ref(
  props.modelValue?.toolCallSettings?.mode || "",
);
const localAllLLMTools = ref(
  JSON.parse(JSON.stringify(props.allLlmToolsData || [])),
);

const updateEnabledTools = () => {
  const enabledTools = props.modelValue?.toolCallSettings?.tools || [];

  // Sync tools from modelValue
  localAllLLMTools.value = (localAllLLMTools.value || []).map((plugin) => {
    const updatedTools = (plugin.tools || []).map((tool) => ({
      ...tool,
      enabled: enabledTools.includes(tool.name),
    }));
    return {
      ...plugin,
      tools: updatedTools,
    };
  });

  // Check if Skill is enabled, if so, force terminal tools
  const isSkillEnabled = localAllLLMTools.value.some((plugin) =>
    plugin.tools.some(
      (tool) => tool.name.toLowerCase().startsWith("skill") && tool.enabled,
    ),
  );

  if (isSkillEnabled) {
    localAllLLMTools.value.forEach((plugin) => {
      if (plugin.name.toLowerCase().includes("terminal")) {
        plugin.tools.forEach((tool) => {
          tool.enabled = true;
        });
      }
    });
  }

  // Update plugin.isAllEnabled
  localAllLLMTools.value.forEach((plugin) => {
    plugin.isAllEnabled =
      plugin.tools.length > 0 && plugin.tools.every((t) => t.enabled);
  });
};

const emitUpdate = () => {
  const newOptions = JSON.parse(JSON.stringify(props.modelValue || {}));
  if (!newOptions.toolCallSettings) newOptions.toolCallSettings = {};
  newOptions.toolCallSettings.mode = localLlmToolCallMode.value;

  const activeTools = localAllLLMTools.value.flatMap((plugin) =>
    plugin.tools.filter((tool) => tool.enabled).map((tool) => tool.name),
  );
  newOptions.toolCallSettings.tools = activeTools;

  emit("update:modelValue", newOptions);
};

const handleToolCallModeChange = () => {
  emitUpdate();
};

const handleToolEnableChange = () => {
  // Sync skill constraints
  const isSkillEnabled = localAllLLMTools.value.some((plugin) =>
    plugin.tools.some(
      (tool) => tool.name.toLowerCase().startsWith("skill") && tool.enabled,
    ),
  );

  if (isSkillEnabled) {
    localAllLLMTools.value.forEach((plugin) => {
      if (plugin.name.toLowerCase().includes("terminal")) {
        plugin.tools.forEach((tool) => {
          tool.enabled = true;
        });
      }
    });
  }

  // Re-calculate isAllEnabled
  localAllLLMTools.value.forEach((plugin) => {
    plugin.isAllEnabled =
      plugin.tools.length > 0 && plugin.tools.every((t) => t.enabled);
  });

  emitUpdate();
};

const handleToggleAllTools = (plugin, value) => {
  plugin.tools.forEach((tool) => {
    tool.enabled = value;
  });
  handleToolEnableChange();
};

// Initial sync
updateEnabledTools();

// Watchers
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      localLlmToolCallMode.value = newVal.toolCallSettings?.mode || "";
      updateEnabledTools();
    }
  },
  { deep: true },
);

watch(
  () => props.allLlmToolsData,
  (newVal) => {
    if (newVal) {
      localAllLLMTools.value = JSON.parse(JSON.stringify(newVal));
      updateEnabledTools();
    }
  },
  { deep: true },
);
</script>

<style scoped>
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
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
  cursor: help;
}

.plugin-tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.tool-mini-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fb;
  padding: 8px 12px;
  border-radius: 8px;
  overflow: hidden;
}

.tool-name-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.tool-name {
  width: 100%;
  font-size: 13px;
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
  cursor: help;
}
</style>
