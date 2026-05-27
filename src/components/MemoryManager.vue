<template>
  <div class="memory-manager-container">
    <!-- Group: Memory Crystallization Config -->
    <div class="group-title">自动记忆结晶配置</div>
    <div class="settings-card">
      <div class="setting-field">
        <div class="field-label">自动结晶</div>
        <div class="field-value">
          <el-switch
            :model-value="crystallizationEnabled"
            @update:model-value="onToggle"
          />
        </div>
      </div>

      <div v-if="crystallizationEnabled" class="setting-field">
        <div class="field-label">Token 水位线</div>
        <div class="field-value">
          <el-input-number
            v-model="localWatermark"
            :min="1000"
            :max="200000"
            :step="1000"
            size="small"
            style="width: 140px"
            @change="onWatermarkChange"
          />
        </div>
      </div>
    </div>

    <!-- Group: Visual Crystallization Editor -->
    <template v-if="crystallizationEnabled">
      <div class="group-title">分区结晶事实管理</div>
      <div class="settings-card editor-card">
        <div class="settings-row">
          <div class="row-left">
            <span class="last-updated" v-if="lastUpdatedTime">
              上次结晶时间: {{ lastUpdatedTime }}
            </span>
            <span class="last-updated" v-else-if="hasCrystallizationContent">
              记忆结晶已保存并生效
            </span>
            <span class="last-updated" v-else> 暂无已保存的结晶事实 </span>
          </div>
          <div class="row-actions">
            <el-button size="small" type="danger" plain @click="clearSummary">
              清空结晶
            </el-button>
            <el-button type="primary" size="small" @click="saveZones">
              保存修改
            </el-button>
          </div>
        </div>

        <el-tabs v-model="activeTab" class="zone-tabs">
          <el-tab-pane
            v-for="zone in CRYSTAL_ZONES"
            :key="zone.key"
            :label="`${zone.icon} ${zone.label}`"
            :name="zone.key"
          >
            <el-input
              v-model="zoneContents[zone.key]"
              type="textarea"
              :autosize="{ minRows: 6, maxRows: 15 }"
              :placeholder="`在此处编辑「${zone.label}」内容...`"
              resize="vertical"
              class="zone-textarea"
              @input="onZoneInput"
            />
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>

    <div v-else class="settings-card disabled-hint-card">
      <div class="disabled-hint-content">
        <span class="lock-icon">🔒</span>
        <span class="hint-text"
          >自动结晶功能已关闭。开启自动结晶后，长对话中将自动启用 Token
          水位线控制，并在此处直观地进行用户画像、短期目标、开发约束等多分区记忆的
          CRUD 交互式管理与保存。</span
        >
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import {
  CRYSTAL_ZONES,
  parseXmlZones,
  buildXmlFromZones,
} from "@/utils/SystemPromptAssembler.js";

const props = defineProps({
  contactorId: {
    type: String,
    required: true,
  },
});

const contactorStore = useContactorsStore();

const contactor = computed(() => contactorStore.contactors[props.contactorId]);
const crystallization = computed(
  () => contactor.value?.options?.crystallization,
);

const crystallizationEnabled = computed(
  () => crystallization.value?.enabled === true,
);
const localWatermark = ref(crystallization.value?.tokenWatermark ?? 64000);

// Zone contents parsed from latestSummary
const zoneContents = ref(
  parseXmlZones(crystallization.value?.latestSummary || ""),
);

const activeTab = ref(CRYSTAL_ZONES[0]?.key || "");

const isDirty = ref(false);

// Last updated time display
const lastUpdatedTime = computed(() => {
  const ts = crystallization.value?.lastUpdatedAt;
  if (!ts) return null;
  return new Date(ts).toLocaleString();
});

const hasCrystallizationContent = computed(() => {
  const summary = crystallization.value?.latestSummary || "";
  return summary.trim().length > 0;
});

// Re-parse zones when latestSummary changes externally
watch(
  () => crystallization.value?.latestSummary,
  (newVal) => {
    if (!isDirty.value) {
      zoneContents.value = parseXmlZones(newVal || "");
    }
  },
);

watch(
  () => crystallization.value?.tokenWatermark,
  (newVal) => {
    if (newVal != null) localWatermark.value = newVal;
  },
);

function onToggle(val) {
  contactorStore.updateCrystallization(props.contactorId, {
    enabled: val,
    latestSummary: crystallization.value?.latestSummary ?? "",
    tokenWatermark: localWatermark.value,
  });
}

function onWatermarkChange(val) {
  contactorStore.updateCrystallization(props.contactorId, {
    tokenWatermark: val,
  });
}

function onZoneInput() {
  isDirty.value = true;
}

function saveZones() {
  const newXml = buildXmlFromZones(zoneContents.value);
  contactorStore.updateCrystallization(props.contactorId, {
    latestSummary: newXml,
    lastUpdatedAt: Date.now(),
  });
  isDirty.value = false;
}

function clearSummary() {
  const emptyZones = {};
  CRYSTAL_ZONES.forEach((z) => (emptyZones[z.key] = ""));
  zoneContents.value = emptyZones;
  contactorStore.updateCrystallization(props.contactorId, {
    latestSummary: "",
    lastUpdatedAt: Date.now(),
  });
  isDirty.value = false;
}
</script>

<style lang="sass" scoped>
.memory-manager-container
  display: flex
  flex-direction: column
  gap: 16px
  width: 100%
  min-height: 0
  text-align: left

.settings-card
  background: #fff
  border-radius: 12px
  padding: 8px 24px
  margin-bottom: 12px
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03)

.setting-field
  display: flex
  justify-content: space-between
  align-items: center
  padding: 14px 0
  border-bottom: 1px solid #f0f0f0

  &:last-child
    border-bottom: none

.field-label
  font-size: 13px;
  color: #333;
  font-weight: 500

.field-value
  display: flex
  align-items: center
  justify-content: flex-end

.editor-card
  padding: 20px 24px

.settings-row
  display: flex
  align-items: center
  justify-content: space-between
  margin-bottom: 16px
  flex-wrap: wrap
  gap: 12px

  .row-left
    display: flex
    align-items: center

    .last-updated
      font-size: 12px
      color: #999

  .row-actions
    display: flex
    gap: 8px

.zone-tabs
  margin-top: 8px
  :deep(.el-tabs__header)
    margin-bottom: 16px

  :deep(.el-tabs__item)
    font-size: 13px
    font-weight: 500

.zone-textarea
  width: 100%
  :deep(textarea)
    font-family: 'JetBrains Mono', 'Fira Code', monospace
    font-size: 12px
    line-height: 1.6
    background: #f8f9fa
    color: #333
    border: 1px solid #e4e7ed
    border-radius: 8px
    padding: 12px
    box-shadow: none

    &:focus
      border-color: rgb(0, 153, 255)
      box-shadow: 0 0 0 2px rgba(0, 153, 255, 0.15)

.disabled-hint-card
  padding: 24px
  text-align: center

.disabled-hint-content
  display: flex
  flex-direction: column
  align-items: center
  gap: 10px

  .lock-icon
    font-size: 24px

  .hint-text
    font-size: 12px
    color: #999
    max-width: 420px
    line-height: 1.6
</style>
