<template>
  <el-dialog
    v-model="visible"
    :fullscreen="isMobile"
    width="440px"
    class="mio-message-detail-dialog"
    destroy-on-close
    append-to-body
    :show-close="!isMobile"
  >
    <template #header>
      <div class="custom-dialog-header" :class="{ 'is-mobile': isMobile }">
        <button
          v-if="isMobile"
          class="mobile-back-btn"
          @click="visible = false"
          aria-label="返回"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="dialog-title-text">消息详情</div>
        <div v-if="isMobile" class="header-placeholder"></div>
      </div>
    </template>

    <div v-if="message" class="detail-container" :class="{ 'is-mobile': isMobile }">
      <!-- 头部：基本摘要信息 -->
      <div class="detail-header-card">
        <div class="header-avatar-name">
          <div class="role-badge" :class="roleClass">
            <i :class="roleIcon"></i>
          </div>
          <div class="header-info-texts">
            <div class="sender-name">{{ senderDisplayName }}</div>
            <div class="message-time-text">{{ formattedTime }}</div>
          </div>
        </div>
        <div class="header-tag" v-if="usageInfo?.model || message.model">
          <el-tag size="small" effect="plain" round class="model-tag">
            {{ usageInfo?.model || message.model }}
          </el-tag>
        </div>
      </div>

      <!-- 用量数据卡片 -->
      <div v-if="hasUsageData" class="detail-section">
        <div class="section-header-row">
          <div class="section-title">
            <i class="mio-icon mio-icon-flash"></i>
            <span>Token 用量</span>
          </div>
          <div v-if="rounds > 1" class="mode-segmented-control">
            <button
              class="mode-btn"
              :class="{ active: viewMode === 'total' }"
              @click="viewMode = 'total'"
            >
              整体
            </button>
            <button
              class="mode-btn"
              :class="{ active: viewMode === 'last_round' }"
              @click="viewMode = 'last_round'"
            >
              末轮
            </button>
          </div>
        </div>

        <div class="usage-grid">
          <!-- 输入 Tokens -->
          <div class="usage-stat-card">
            <div class="stat-label">输入 (Prompt)</div>
            <div class="stat-value prompt">
              {{ formatNumber(promptTokens) }}
            </div>
            <div
              v-if="cachedTokens > 0"
              class="stat-sub-text"
            >
              缓存命中: {{ formatNumber(cachedTokens) }}
            </div>
          </div>

          <!-- 思考 Tokens (如果存在) -->
          <div
            v-if="hasReasoningTokens"
            class="usage-stat-card"
          >
            <div class="stat-label">思考 (Reasoning)</div>
            <div class="stat-value reasoning">
              {{ formatNumber(reasoningTokens) }}
            </div>
          </div>

          <!-- 输出 Tokens -->
          <div class="usage-stat-card">
            <div class="stat-label">输出 (Completion)</div>
            <div class="stat-value completion">
              {{ formatNumber(completionTokens) }}
            </div>
          </div>

          <!-- 总计 Tokens -->
          <div class="usage-stat-card highlight">
            <div class="stat-label">总计 (Total)</div>
            <div class="stat-value total">
              {{ formatNumber(totalTokens) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 性能速率卡片 -->
      <div v-if="hasPerformanceData" class="detail-section">
        <div class="section-title">
          <i class="mio-icon mio-icon-timer"></i>
          <span>响应效率与性能</span>
        </div>

        <div class="perf-row">
          <div class="perf-item" v-if="formattedDuration">
            <span class="perf-label">{{ viewMode === 'last_round' ? '本轮耗时' : '整体耗时' }}</span>
            <span class="perf-value">{{ formattedDuration }}</span>
          </div>
          <div class="perf-item" v-if="formattedTtft">
            <span class="perf-label">首字延迟 (TTFT)</span>
            <span class="perf-value">{{ formattedTtft }}</span>
          </div>
          <div class="perf-item" v-if="rounds > 1">
            <span class="perf-label">交互轮次</span>
            <span class="perf-value">{{ rounds }} 轮</span>
          </div>
          <div class="perf-item" v-if="tpsRate">
            <span class="perf-label">平均速率</span>
            <span class="perf-value rate">{{ tpsRate }} tokens/s</span>
          </div>
          <div class="perf-item" v-if="usageInfo?.provider">
            <span class="perf-label">供应商</span>
            <span class="perf-value">{{ usageInfo.provider }}</span>
          </div>
        </div>
      </div>

      <!-- 历史消息兜底提示 -->
      <div v-if="!hasUsageData" class="empty-usage-notice">
        <el-empty
          description="该消息未记录详细用量数据（可能为历史旧消息或非流式生成）"
          :image-size="64"
        />
      </div>

      <!-- 消息元信息 -->
      <div class="meta-footer">
        <div class="meta-item">
          <span class="meta-label">消息 ID</span>
          <span class="meta-id-code" @click="copyId">
            {{ message.id }}
            <i class="iconfont fuzhi copy-icon" title="点击复制"></i>
          </span>
        </div>
        <div class="meta-item" v-if="charCount">
          <span class="meta-label">字数统计</span>
          <span class="meta-val">{{ charCount }} 字符</span>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  message: {
    type: Object,
    default: () => null,
  },
  contactor: {
    type: Object,
    default: () => null,
  },
});

const emit = defineEmits(["update:modelValue"]);

const isMobile = ref(typeof window !== "undefined" && window.innerWidth < 768);
const onResize = () => {
  if (typeof window !== "undefined") {
    isMobile.value = window.innerWidth < 768;
  }
};

onMounted(() => {
  window.addEventListener("resize", onResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", onResize);
});

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const viewMode = ref("total"); // 'total' | 'last_round'

const usageInfo = computed(() => {
  return props.message?.usage || null;
});

const currentUsage = computed(() => {
  if (viewMode.value === "last_round" && usageInfo.value?.last_round) {
    return usageInfo.value.last_round;
  }
  return usageInfo.value;
});

const promptTokens = computed(() => currentUsage.value?.prompt_tokens || 0);
const completionTokens = computed(() => currentUsage.value?.completion_tokens || 0);
const totalTokens = computed(
  () =>
    currentUsage.value?.total_tokens ||
    promptTokens.value + completionTokens.value,
);
const reasoningTokens = computed(() => currentUsage.value?.reasoning_tokens || 0);
const cachedTokens = computed(() => currentUsage.value?.cached_tokens || 0);
const rounds = computed(() => usageInfo.value?.rounds || 1);

const hasReasoningTokens = computed(() => reasoningTokens.value > 0);

const hasUsageData = computed(() => {
  if (!currentUsage.value) return false;
  return (
    typeof currentUsage.value.prompt_tokens === "number" ||
    typeof currentUsage.value.total_tokens === "number" ||
    typeof currentUsage.value.completion_tokens === "number"
  );
});

const durationMs = computed(() => {
  return currentUsage.value?.duration || 0;
});

const hasPerformanceData = computed(() => {
  return (
    durationMs.value > 0 ||
    tpsRate.value !== null ||
    Boolean(usageInfo.value?.provider)
  );
});

const formattedDuration = computed(() => {
  const dur = durationMs.value;
  if (!dur || dur <= 0) return null;
  if (dur < 1000) return `${dur} ms`;
  return `${(dur / 1000).toFixed(2)} s`;
});

const formattedTtft = computed(() => {
  const t = currentUsage.value?.ttft;
  if (!t || t <= 0) return null;
  if (t < 1000) return `${t} ms`;
  return `${(t / 1000).toFixed(2)} s`;
});

const tpsRate = computed(() => {
  const comp = completionTokens.value;
  const dur = durationMs.value;
  if (typeof comp === "number" && typeof dur === "number" && dur > 0 && comp > 0) {
    return (comp / (dur / 1000)).toFixed(1);
  }
  return null;
});

const roleClass = computed(() => {
  if (props.message?.role === "user") return "is-user";
  if (props.message?.role === "mio_system") return "is-system";
  return "is-assistant";
});

const roleIcon = computed(() => {
  if (props.message?.role === "user") return "mio-icon-user";
  if (props.message?.role === "mio_system") return "mio-icon-setting";
  return "mio-icon-bot";
});

const senderDisplayName = computed(() => {
  if (props.message?.role === "user") return "我";
  if (props.message?.role === "mio_system") return "系统通知";
  return (
    props.message?.senderName ||
    props.message?.sender_name ||
    props.contactor?.name ||
    "AI 助手"
  );
});

const formattedTime = computed(() => {
  const t = props.message?.time;
  if (!t) return "未知时间";
  try {
    const d = new Date(t);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (e) {
    return String(t);
  }
});

const charCount = computed(() => {
  if (!props.message?.content || !Array.isArray(props.message.content)) return 0;
  return props.message.content.reduce((sum, elm) => {
    if (elm.type === "text") return sum + (elm.data?.text || "").length;
    if (elm.type === "reason") return sum + (elm.data?.text || "").length;
    return sum;
  }, 0);
});

const formatNumber = (val) => {
  if (val === undefined || val === null) return "0";
  return Number(val).toLocaleString();
};

const copyId = () => {
  if (props.message?.id) {
    navigator.clipboard.writeText(props.message.id);
    ElMessage.success("消息 ID 已复制到剪贴板");
  }
};
</script>

<style lang="sass">
.el-dialog.mio-message-detail-dialog
  border-radius: 16px !important
  overflow: hidden
  background-color: var(--mio-bg-card) !important
  background: var(--mio-bg-card) !important
  border: 1px solid var(--mio-border-color-light)
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12)
  color: var(--mio-text-primary) !important

  &.is-fullscreen
    border-radius: 0 !important
    border: none !important
    box-shadow: none !important
    background-color: var(--mio-bg-card) !important
    background: var(--mio-bg-card) !important
    display: flex
    flex-direction: column

    .el-dialog__header
      padding: max(env(safe-area-inset-top, 0px), 12px) 16px 12px !important

    .el-dialog__body
      flex: 1
      overflow-y: auto
      -webkit-overflow-scrolling: touch
      padding: 16px !important

  .el-dialog__header
    margin-right: 0
    padding: 16px 20px 12px !important
    background: var(--mio-bg-card) !important
    background-color: var(--mio-bg-card) !important
    border-bottom: 1px solid var(--mio-border-color-lighter)
    color: var(--mio-text-primary) !important

    .el-dialog__headerbtn
      top: 16px
      right: 16px
      .el-dialog__close
        color: var(--mio-text-secondary)
        font-size: 16px
        &:hover
          color: var(--mio-text-primary)

  .el-dialog__body
    padding: 16px 20px 20px !important
    background: var(--mio-bg-card) !important
    background-color: var(--mio-bg-card) !important
    color: var(--mio-text-primary) !important

.custom-dialog-header
  display: flex
  align-items: center
  justify-content: flex-start
  width: 100%

  &.is-mobile
    justify-content: space-between
    height: 32px

  .mobile-back-btn
    background: transparent
    border: none
    color: var(--mio-text-primary)
    cursor: pointer
    padding: 4px
    margin-left: -4px
    display: flex
    align-items: center
    justify-content: center
    border-radius: 6px
    transition: background 0.15s

    &:active
      background: var(--mio-bg-hover)

  .dialog-title-text
    font-size: 16px
    font-weight: 600
    color: var(--mio-text-primary)

  .header-placeholder
    width: 26px
    height: 22px

.detail-container
  display: flex
  flex-direction: column
  gap: 16px

.detail-header-card
  display: flex
  align-items: center
  justify-content: space-between
  padding: 12px 14px
  background: var(--mio-bg-hover)
  border-radius: 12px

.header-avatar-name
  display: flex
  align-items: center
  gap: 10px

.role-badge
  width: 34px
  height: 34px
  border-radius: 50%
  display: flex
  align-items: center
  justify-content: center
  font-size: 16px
  flex-shrink: 0

  &.is-user
    background: rgba(9, 168, 255, 0.15)
    color: var(--mio-color-primary)

  &.is-assistant
    background: rgba(103, 194, 58, 0.15)
    color: #67c23a

  &.is-system
    background: rgba(230, 162, 60, 0.15)
    color: #e6a23c

.header-info-texts
  display: flex
  flex-direction: column
  gap: 2px

.sender-name
  font-size: 14px
  font-weight: 600
  color: var(--mio-text-primary)

.message-time-text
  font-size: 11px
  color: var(--mio-text-secondary)

.model-tag
  border: 1px solid var(--mio-border-color)
  background-color: var(--mio-bg-card)
  color: var(--mio-text-regular)
  font-family: monospace

.detail-section
  display: flex
  flex-direction: column
  gap: 8px

.section-header-row
  display: flex
  align-items: center
  justify-content: space-between

.mode-segmented-control
  display: flex
  align-items: center
  background: var(--mio-bg-hover)
  padding: 2px
  border-radius: 6px
  border: 1px solid var(--mio-border-color-lighter)

  .mode-btn
    border: none
    background: transparent
    font-size: 11px
    padding: 2px 8px
    border-radius: 4px
    color: var(--mio-text-secondary)
    cursor: pointer
    transition: all 0.15s ease

    &.active
      background: var(--mio-bg-card)
      color: var(--mio-color-primary)
      font-weight: 600
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08)

    &:hover:not(.active)
      color: var(--mio-text-primary)

.section-title
  display: flex
  align-items: center
  gap: 6px
  font-size: 13px
  font-weight: 600
  color: var(--mio-text-regular)

  i
    font-size: 14px
    color: var(--mio-color-primary)

.usage-grid
  display: grid
  grid-template-columns: repeat(2, 1fr)
  gap: 8px

.usage-stat-card
  padding: 10px 12px
  background: var(--mio-bg-item)
  border: 1px solid var(--mio-border-color-lighter)
  border-radius: 10px
  display: flex
  flex-direction: column
  gap: 4px

  &.highlight
    background: rgba(9, 168, 255, 0.05)
    border-color: rgba(9, 168, 255, 0.25)

  .stat-label
    font-size: 11px
    color: var(--mio-text-secondary)

  .stat-value
    font-size: 18px
    font-weight: 700
    font-family: monospace
    color: var(--mio-text-primary)

    &.prompt
      color: #409eff

    &.reasoning
      color: #9065b0

    &.completion
      color: #67c23a

    &.total
      color: var(--mio-color-primary)

  .stat-sub-text
    font-size: 10px
    color: var(--mio-text-placeholder)

.perf-row
  display: flex
  align-items: center
  justify-content: space-between
  padding: 10px 14px
  background: var(--mio-bg-item)
  border: 1px solid var(--mio-border-color-lighter)
  border-radius: 10px

.perf-item
  display: flex
  flex-direction: column
  gap: 2px

  .perf-label
    font-size: 11px
    color: var(--mio-text-secondary)

  .perf-value
    font-size: 13px
    font-weight: 600
    color: var(--mio-text-primary)
    font-family: monospace

    &.rate
      color: #67c23a

.empty-usage-notice
  padding: 12px 0

.meta-footer
  display: flex
  align-items: center
  justify-content: space-between
  padding-top: 10px
  border-top: 1px solid var(--mio-border-color-lighter)
  font-size: 12px

.meta-item
  display: flex
  align-items: center
  gap: 6px

.meta-label
  color: var(--mio-text-secondary)

.meta-val
  color: var(--mio-text-regular)

.meta-id-code
  font-family: monospace
  color: var(--mio-text-regular)
  background: var(--mio-bg-hover)
  padding: 2px 6px
  border-radius: 4px
  cursor: pointer
  display: inline-flex
  align-items: center
  gap: 4px
  transition: color 0.15s

  &:hover
    color: var(--mio-color-primary)

  .copy-icon
    font-size: 11px
</style>
