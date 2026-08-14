<template>
  <div class="memory-manager-container">
    <!-- Group: Context Management Mode -->
    <div class="group-title">上下文管理模式</div>
    <div class="settings-card">
      <div class="setting-field">
        <div class="field-label">管理模式</div>
        <div class="field-value">
          <el-radio-group
            v-model="contextMode"
            @change="onContextModeChange"
          >
            <el-radio-button value="crystal">上下文压缩</el-radio-button>
            <el-radio-button value="window">滑动窗口</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- Sliding Window: max messages -->
      <div v-if="contextMode === 'window'" class="setting-field">
        <div class="field-label">最大历史消息数</div>
        <div class="field-value">
          <el-input-number
            v-model="localMaxMessages"
            :min="1"
            :step="1"
            size="small"
            style="width: 120px"
            @change="onMaxMessagesChange"
          />
        </div>
      </div>

      <!-- Memory Crystal: crystallization config -->
      <template v-if="contextMode === 'crystal'">
        <div class="setting-field">
          <div class="field-label">
            自动压缩
            <el-tooltip
              v-if="isForcedOn"
              placement="top"
              popper-class="mio-hint-popper"
              content="群聊消息链由全体成员共享且只增不减，关闭压缩会让每个成员的上下文无限膨胀，因此群成员强制开启，不可关闭。"
            >
              <el-icon class="label-hint-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </div>
          <div class="field-value">
            <el-switch
              :model-value="crystallizationEnabled"
              :disabled="isForcedOn"
              @update:model-value="onToggle"
            />
          </div>
        </div>

        <div v-if="crystallizationEnabled" class="setting-field">
          <div class="field-label">压缩上限</div>
          <div class="field-value">
            <el-select
              :model-value="watermarkMode"
              size="small"
              style="width: 168px"
              @update:model-value="onWatermarkModeChange"
            >
              <el-option label="自动" value="auto" />
              <el-option label="手动" value="custom" />
            </el-select>
          </div>
        </div>

        <div v-if="crystallizationEnabled" class="setting-field">
          <div class="field-label">
            上限数值
            <el-tooltip
              placement="top"
              popper-class="mio-hint-popper"
              content="自动模式下按模型规格动态计算 80% 上限，手动模式需手动指定具体 Token 数量"
            >
              <el-icon class="label-hint-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </div>
          <div class="field-value">
            <el-input-number
              :model-value="watermarkMode === 'custom' ? watermarkValue : autoWatermark"
              :disabled="watermarkMode !== 'custom'"
              :min="1000"
              :max="1000000"
              :step="5000"
              size="small"
              style="width: 150px"
              :placeholder="watermarkMode === 'auto' ? '自动' : '输入数值'"
              @change="onWatermarkChange"
            />
            <span v-if="watermarkMode === 'auto'" class="auto-watermark-tip">
              自动模式按当前模型规格计算，约
              <b>{{ formatCtx(autoWatermark) || '—' }}</b> Token
            </span>
          </div>
        </div>
      </template>
    </div>

    <!-- Group: Visual Crystallization Editor (only in crystal mode) -->
    <template v-if="contextMode === 'crystal' && crystallizationEnabled">
      <div class="group-title">分区记忆管理</div>
      <div class="settings-card editor-card">
        <div class="settings-row">
          <div class="row-left">
            <span class="last-updated" v-if="lastUpdatedTime">
              上次压缩时间: {{ lastUpdatedTime }}
            </span>
            <span class="last-updated" v-else-if="hasCrystallizationContent">
              压缩内容已保存并生效
            </span>
            <span class="last-updated" v-else> 暂无已保存的压缩内容 </span>
          </div>
          <div class="row-actions">
            <el-button size="small" type="danger" plain @click="clearSummary">
              清空压缩内容
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

    <div v-else-if="contextMode === 'crystal'" class="settings-card disabled-hint-card">
      <div class="disabled-hint-content">
        <span class="lock-icon">🔒</span>
        <span class="hint-text"
          >自动压缩功能已关闭。开启自动压缩后，长对话中将自动启用 Token
          上下文压缩控制，并在此处直观地进行用户画像、短期目标、开发约束等多分区记忆的
          CRUD 交互式管理与保存。</span
        >
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { InfoFilled } from "@element-plus/icons-vue";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { useConfigStore } from "@/stores/configStore.js";
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
  // 群成员详情页传入：压缩内容属于成员而非群，读写都要落到该成员身上
  memberId: {
    type: String,
    default: null,
  },
});

const contactorStore = useContactorsStore();
const configStore = useConfigStore();

// 压缩宿主：单聊是联系人本身，群聊是指定成员
const crystalHost = computed(() =>
  contactorStore.getCrystalHost(props.contactorId, props.memberId),
);
const crystallization = computed(
  () => crystalHost.value?.options?.crystallization,
);

// 上下文管理模式: "crystal" | "window"，默认上下文压缩
const contextMode = ref(
  crystalHost.value?.options?.base?.contextMode || "crystal",
);

// 群成员强制开启压缩：群消息链共享且只增不减
const isForcedOn = computed(() => !!props.memberId);

const crystallizationEnabled = computed(
  () => isForcedOn.value || crystallization.value?.enabled === true,
);

// 自动模式下的动态上限值：取自 Registry 元数据（后端按模型规格算好的 80%）
const autoWatermark = computed(() => {
  const host = crystalHost.value;
  if (!host) return null;
  const provider = host.options?.provider;
  const model = host.options?.base?.model || host.options?.model;
  if (!provider || !model) return null;
  return configStore.modelsMeta?.[provider]?.[model]?.watermark ?? null;
});

const formatCtx = (n) => {
  if (!n) return "";
  return n >= 1000000
    ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}K`
      : `${n}`;
};
// 压缩上限：'auto'（按模型规格动态计算 80%）或手动数值
const watermarkMode = ref(
  typeof crystallization.value?.tokenWatermark === 'number' ? 'custom' : 'auto',
);
const watermarkValue = ref(
  typeof crystallization.value?.tokenWatermark === 'number'
    ? crystallization.value.tokenWatermark
    : null,
);
const localMaxMessages = ref(
  crystalHost.value?.options?.base?.max_messages_num ?? 20,
);

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
    if (newVal != null) {
      watermarkMode.value = typeof newVal === 'number' ? 'custom' : 'auto';
      if (typeof newVal === 'number') watermarkValue.value = newVal;
    }
  },
);

watch(
  () => crystalHost.value?.options?.base?.max_messages_num,
  (newVal) => {
    if (newVal != null) localMaxMessages.value = newVal;
  },
);

function onContextModeChange(val) {
  contactorStore.updateContactorOption(
    props.contactorId,
    "base",
    { contextMode: val },
    props.memberId,
  );
}

function onMaxMessagesChange(val) {
  contactorStore.updateContactorOption(
    props.contactorId,
    "base",
    { max_messages_num: val },
    props.memberId,
  );
}

function onToggle(val) {
  if (isForcedOn.value) return;
  contactorStore.updateCrystallization(
    props.contactorId,
    {
      enabled: val,
      latestSummary: crystallization.value?.latestSummary ?? "",
      tokenWatermark:
        watermarkMode.value === 'auto'
          ? 'auto'
          : (watermarkValue.value ?? 'auto'),
    },
    props.memberId,
  );
}

function onWatermarkModeChange(mode) {
  watermarkMode.value = mode;
  if (mode === 'auto') {
    contactorStore.updateCrystallization(
      props.contactorId,
      { tokenWatermark: 'auto' },
      props.memberId,
    );
    return;
  }
  // 切到手动：尚无数值时给默认值并立即保存，确保 UI 与 store 同步
  const val = watermarkValue.value ?? 100000;
  watermarkValue.value = val;
  contactorStore.updateCrystallization(
    props.contactorId,
    { tokenWatermark: val },
    props.memberId,
  );
}

function onWatermarkChange(val) {
  contactorStore.updateCrystallization(
    props.contactorId,
    { tokenWatermark: val },
    props.memberId,
  );
}

function onZoneInput() {
  isDirty.value = true;
}

function saveZones() {
  const newXml = buildXmlFromZones(zoneContents.value);
  contactorStore.updateCrystallization(
    props.contactorId,
    { latestSummary: newXml, lastUpdatedAt: Date.now() },
    props.memberId,
  );
  isDirty.value = false;
}

function clearSummary() {
  const emptyZones = {};
  CRYSTAL_ZONES.forEach((z) => (emptyZones[z.key] = ""));
  zoneContents.value = emptyZones;
  contactorStore.updateCrystallization(
    props.contactorId,
    { latestSummary: "", lastUpdatedAt: Date.now() },
    props.memberId,
  );
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
  background: var(--mio-bg-card)
  border-radius: 12px
  padding: 8px 24px
  margin-bottom: 12px
  box-shadow: var(--mio-shadow-light)

.setting-field
  display: flex
  justify-content: space-between
  align-items: center
  padding: 14px 0
  border-bottom: 1px solid var(--mio-border-color-lighter)

  &:last-child
    border-bottom: none

.field-label
  font-size: 13px
  color: var(--mio-text-primary)
  font-weight: 500


.label-hint-icon
  font-size: 14px
  color: var(--mio-text-placeholder)
  cursor: help
  vertical-align: middle
  margin-left: 4px
  transition: color 0.15s

  &:hover
    color: var(--mio-color-primary)

.field-value
  display: flex
  align-items: center
  justify-content: flex-end

.auto-watermark-tip
  font-size: 12px
  color: var(--mio-text-secondary)
  margin-left: 8px
  white-space: nowrap

  b
    color: var(--mio-color-primary)
    font-weight: 600

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
      color: var(--mio-text-secondary)

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
    background: var(--mio-bg-chat-window)
    color: var(--mio-text-primary)
    border: 1px solid var(--mio-border-color-light)
    border-radius: 8px
    padding: 12px
    box-shadow: none

    &:focus
      border-color: var(--mio-color-primary)
      box-shadow: 0 0 0 2px var(--mio-bg-active)

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
    color: var(--mio-text-secondary)
    max-width: 420px
    line-height: 1.6
</style>