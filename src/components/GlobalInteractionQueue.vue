<template>
  <div v-if="activeInteraction" class="global-approval-wrapper">
    <!-- Backdrop overlay to prevent misclicking underneath, especially on mobile -->
    <div class="approval-backdrop" @click="shakeModal"></div>

    <transition name="global-approval">
      <aside
        class="approval-panel"
        :class="{ 'is-shaking': isShaking }"
        aria-live="assertive"
        aria-label="全局审批队列"
      >
        <!-- Mobile sheet handle -->
        <div class="mobile-sheet-handle"></div>

        <header class="panel-header">
          <div class="header-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div class="header-copy">
            <span class="header-eyebrow">安全操作审批</span>
            <div class="header-title-row">
              <h2>操作授权确认</h2>
              <span v-if="interactionsQueue.length > 1" class="queue-count">{{ interactionsQueue.length }}</span>
            </div>
          </div>
          <span class="source-badge" :title="sourceLabel">
            <span class="source-dot"></span>
            {{ sourceLabel }}
          </span>
        </header>

        <!-- Queue Tabs if multiple items -->
        <nav
          v-if="interactionsQueue.length > 1"
          class="queue-tabs"
          aria-label="待处理审批"
        >
          <span class="queue-tabs-label">待审队列 ({{ interactionsQueue.length }})</span>
          <button
            v-for="(item, index) in interactionsQueue"
            :key="`${item.requestId}:${item.interactionId}`"
            :class="{
              active: item.interactionId === activeInteraction.interactionId,
            }"
            :disabled="busy"
            :aria-label="`查看第 ${index + 1} 个审批`"
            type="button"
            @click="store.selectInteraction(item.interactionId)"
          >
            #{{ index + 1 }}
          </button>
        </nav>

        <!-- Request Summary Prompt -->
        <section class="request-summary">
          <p>{{ activeInteraction.prompt || "Agent 申请执行以下敏感操作，请确认是否允许：" }}</p>
        </section>

        <!-- SHOW_SELECT_OVERLAY Mode -->
        <div
          v-if="activeInteraction.actionType === 'SHOW_SELECT_OVERLAY'"
          class="selection-options"
        >
          <button
            v-for="option in activeInteraction.options"
            :key="option.value"
            class="action-btn option-btn"
            :disabled="busy"
            type="button"
            @click="submitResponse({ selectResult: option.value })"
          >
            {{ option.label || option.value }}
          </button>
        </div>

        <!-- REQUEST_APPROVAL Mode -->
        <div
          v-else-if="activeInteraction.actionType === 'REQUEST_APPROVAL'"
          class="approval-content"
        >
          <!-- Shell Command Preview -->
          <div
            v-if="activeInteraction.meta?.commandPreview"
            class="payload-preview terminal-theme"
          >
            <div class="preview-heading">
              <div class="preview-heading-left">
                <span class="terminal-tag">BASH</span>
                <span>待执行命令</span>
              </div>
              <button
                class="copy-command-btn"
                type="button"
                title="复制命令"
                @click="copyCommand(approvalCommandPreview)"
              >
                <svg v-if="!copied" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                <span v-else class="copied-text">已复制 ✓</span>
              </button>
            </div>
            <code>{{ approvalCommandPreview }}</code>
          </div>

          <!-- Global Memory Preview -->
          <div
            v-else-if="
              activeInteraction.meta?.type === 'global_memory' ||
              activeInteraction.meta?.scope === 'global'
            "
            class="payload-preview memory-preview"
          >
            <div class="preview-heading preview-meta">
              <span>全局长期记忆变更</span>
              <span v-if="activeInteraction.meta?.category" class="sub-badge">
                {{ activeInteraction.meta.category }}
              </span>
              <span v-if="activeInteraction.meta?.action" class="sub-badge">
                {{ activeInteraction.meta.action }}
              </span>
            </div>
            <code>{{
              activeInteraction.meta.content || activeInteraction.meta.target
            }}</code>
          </div>

          <!-- Config Preview -->
          <div v-else-if="activeInteraction.meta?.config" class="payload-preview">
            <div class="preview-heading">系统配置变更</div>
            <code>{{ configPreview }}</code>
          </div>

          <!-- Actions Group -->
          <div class="decision-actions">
            <!-- Non-command or Unrememberable Action -->
            <template
              v-if="
                !activeInteraction.meta?.commandPreview ||
                activeInteraction.meta?.rememberable === false
              "
            >
              <button
                class="action-btn primary-btn"
                :disabled="busy"
                type="button"
                @click="submitResponse({ approved: true })"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{{ approveLabel }}</span>
              </button>
            </template>

            <!-- Command Actions with Explicit Whitelist Controls -->
            <template v-else>
              <!-- 1. Allow Once Button -->
              <button
                class="action-btn primary-btn"
                :disabled="busy"
                type="button"
                title="仅允许本次执行，不将命令加入白名单"
                @click="submitResponse({ approved: true })"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>仅允许本次执行</span>
              </button>

              <!-- 2. Add to Whitelist Button (rememberType: 'prefix2') -->
              <button
                class="action-btn whitelist-btn"
                :disabled="busy"
                type="button"
                :title="`执行并将「${approvalCommandPreview}」加入永久白名单，后续无需审批`"
                @click="submitResponse({ approved: true, rememberType: 'prefix2' })"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>加入白名单并执行「{{ approvalCommandPreview }}」</span>
              </button>

              <!-- 3. Whitelist Root Command (rememberType: 'prefix1') if different -->
              <button
                v-if="
                  activeInteraction.meta?.commandPrefix1 &&
                  activeInteraction.meta.commandPrefix1 !== approvalCommandPreview
                "
                class="action-btn whitelist-btn root-whitelist"
                :disabled="busy"
                type="button"
                :title="`信任所有「${activeInteraction.meta.commandPrefix1}」开头的命令`"
                @click="submitResponse({ approved: true, rememberType: 'prefix1' })"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>信任根命令「{{ activeInteraction.meta.commandPrefix1 }} *」</span>
              </button>
            </template>
          </div>

          <!-- Session YOLO Trust Card -->
          <div v-if="canTrustAgent" class="trust-card">
            <div class="trust-copy">
              <div class="trust-title-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <strong>会话免审批 (YOLO 模式)</strong>
              </div>
              <span>开启后，当前会话中的后续所有 Shell 命令将跳过审批直接执行。</span>
            </div>
            <button
              class="action-btn trust-btn"
              :disabled="busy"
              type="button"
              @click="trustAgent"
            >
              {{ trustingAgent ? "正在开启…" : "开启本会话免审批" }}
            </button>
          </div>

          <!-- Error Feedback -->
          <div v-if="visibleError" class="interaction-error" role="alert">
            {{ visibleError }}
          </div>

          <!-- Rejection Section -->
          <div class="reject-section">
            <div class="reject-row">
              <input
                id="global-approval-reason"
                v-model="rejectReasonText"
                :disabled="busy"
                placeholder="填写拒绝理由（可选，将作为反馈提示给 Agent）"
                @keyup.enter="reject"
              />
              <button
                class="action-btn reject-btn"
                :disabled="busy"
                type="button"
                @click="reject"
              >
                拒绝执行
              </button>
            </div>
          </div>
        </div>
      </aside>
    </transition>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useInteraction } from "@/composables/useInteraction.js";
import { client } from "@/lib/runtime.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { useInteractionStore } from "@/stores/interactionStore.js";

const store = useInteractionStore();
const contactorsStore = useContactorsStore();
const {
  activeInteraction,
  interactionError,
  interactionSubmitting,
  submitResponse,
} = useInteraction();
const interactionsQueue = computed(() => store.interactionsQueue);
const rejectReasonText = ref("");
const trustingAgent = ref(false);
const trustError = ref("");
const copied = ref(false);
const isShaking = ref(false);

const busy = computed(() => interactionSubmitting.value || trustingAgent.value);
const visibleError = computed(() => trustError.value || interactionError.value);

const approvalCommandPreview = computed(
  () => activeInteraction.value?.meta?.commandPreview || "",
);
const configPreview = computed(() => {
  const value = activeInteraction.value?.meta?.config;
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
});
const sourceLabel = computed(() => {
  const interaction = activeInteraction.value;
  if (interaction?.meta?.approvalSource === "subagent") {
    return `子任务 · ${interaction.meta.subagentRunId || "SubAgent"}`;
  }
  return interaction?.meta?.sourceLabel || "主智能体";
});
const approveLabel = computed(() => {
  const interaction = activeInteraction.value;
  if (
    interaction?.meta?.type === "global_memory" ||
    interaction?.meta?.scope === "global"
  ) {
    return "授权写入";
  }
  return interaction?.meta?.commandPreview ? "允许本次执行" : "授权更新";
});

const trustTarget = computed(() => {
  const interaction = activeInteraction.value;
  const meta = interaction?.meta || {};
  const contactor = interaction
    ? contactorsStore.contactors[interaction.contactorId]
    : null;
  const isServerAgent = ["agent", "sub_agent"].includes(contactor?.platform);
  return {
    agentId:
      meta.agentId ||
      contactor?.agentId ||
      (isServerAgent ? contactor?.id : ""),
    contactor,
    sessionId:
      meta.sourceSessionId || meta.sessionId || contactor?.sessionId || "",
  };
});

const canTrustAgent = computed(() => {
  const { agentId, contactor, sessionId } = trustTarget.value;
  return Boolean(
    activeInteraction.value?.meta?.commandPreview &&
      ((agentId && sessionId) || contactor?.platform === "openai"),
  );
});

watch(
  () => [
    activeInteraction.value?.interactionId,
    activeInteraction.value?.actionType,
    trustTarget.value.contactor?.options?.yolo,
  ],
  ([interactionId, actionType, isYolo]) => {
    rejectReasonText.value = "";
    trustError.value = "";
    if (interactionId && actionType === "REQUEST_APPROVAL" && isYolo === true) {
      // 当前审批所属联系人已开启 YOLO 模式，静默自动放行
      submitResponse({ approved: true, yolo: true });
    }
  },
  { immediate: true },
);

function copyCommand(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1800);
}

function shakeModal() {
  isShaking.value = true;
  setTimeout(() => {
    isShaking.value = false;
  }, 400);
}

function reject() {
  submitResponse({ approved: false, reason: rejectReasonText.value });
}

async function trustAgent() {
  const interactionId = activeInteraction.value?.interactionId;
  if (!interactionId || trustingAgent.value) return;

  trustingAgent.value = true;
  trustError.value = "";
  try {
    const { agentId, contactor, sessionId } = trustTarget.value;
    if (agentId && sessionId) {
      if (!client.socket) throw new Error("Socket.IO 连接未就绪，请重试。");
      const result = await client.socket.fetch(`/api/agent/yolo/${agentId}`, {
        enabled: true,
        sessionId,
      });
      if (result?.enabled !== true) {
        throw new Error("服务端未确认 YOLO 模式已开启。");
      }
    } else if (contactor?.platform === "openai") {
      contactor.options ||= {};
      contactor.options.yolo = true;
      client.setLocalStorage();
    } else {
      throw new Error("无法定位此审批所属的 Agent Session。");
    }

    if (activeInteraction.value?.interactionId !== interactionId) {
      throw new Error("审批队列已变化，请在对应审批项中重新操作。");
    }
    submitResponse({ approved: true, trustedAgent: true, yolo: true });
  } catch (error) {
    trustError.value =
      error?.message || String(error || "开启 YOLO 模式失败，请重试。");
  } finally {
    trustingAgent.value = false;
  }
}
</script>

<style scoped lang="scss">
.global-approval-wrapper {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  pointer-events: none;
}

.approval-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  pointer-events: auto;
  transition: opacity 0.2s ease;
}

.approval-panel {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 5001;
  width: min(540px, calc(100vw - 48px));
  max-height: min(84vh, 760px);
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 1.25rem 1.25rem 1.5rem;
  border: 1px solid var(--mio-border-color-light, #e4e7ed);
  border-radius: 16px;
  background: var(--mio-bg-surface, #ffffff);
  color: var(--mio-text-primary, #303133);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.04);
  pointer-events: auto;

  &.is-shaking {
    animation: panel-shake 0.38s ease-in-out;
  }
}

@keyframes panel-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

.mobile-sheet-handle {
  display: none;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-mark {
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: rgba(0, 153, 255, 0.08);
  color: var(--mio-color-primary, #0099ff);
  border: 1px solid rgba(0, 153, 255, 0.18);
}

.header-copy {
  min-width: 0;
}

.header-eyebrow {
  display: block;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--mio-text-secondary, #909399);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.15rem;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--mio-text-primary, #303133);
    line-height: 1.25;
  }
}

.queue-count {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--mio-color-primary, #0099ff);
  color: #ffffff;
}

.source-badge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.725rem;
  font-weight: 500;
  background: var(--mio-bg-page, #f5f7fa);
  color: var(--mio-text-secondary, #606266);
  border: 1px solid var(--mio-border-color-light, #e4e7ed);
}

.source-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #e6a23c;
}

/* Queue Tabs */
.queue-tabs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.85rem;
  padding: 0.4rem 0.6rem;
  border-radius: 0.5rem;
  background: var(--mio-bg-page, #f5f7fa);
  border: 1px solid var(--mio-border-color-light, #e4e7ed);

  button {
    padding: 0.2rem 0.6rem;
    border-radius: 0.35rem;
    border: 1px solid var(--mio-border-color-light, #e4e7ed);
    background: var(--mio-bg-surface, #ffffff);
    color: var(--mio-text-regular, #606266);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;

    &.active {
      border-color: var(--mio-color-primary, #0099ff);
      background: var(--mio-color-primary, #0099ff);
      color: #ffffff;
      font-weight: 600;
    }
  }
}

.queue-tabs-label {
  font-size: 0.725rem;
  color: var(--mio-text-secondary, #909399);
  margin-right: 0.25rem;
}

/* Summary Prompt */
.request-summary {
  margin: 0.85rem 0;
  padding: 0.65rem 0.85rem;
  border-radius: 0.5rem;
  background: var(--mio-bg-page, #f5f7fa);
  border-left: 3px solid var(--mio-color-primary, #0099ff);

  p {
    margin: 0;
    font-size: 0.825rem;
    line-height: 1.5;
    color: var(--mio-text-regular, #606266);
  }
}

/* Previews */
.approval-content {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.payload-preview {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid var(--mio-border-color-light, #e4e7ed);
  background: #18191c;
  color: #e2e8f0;
  overflow: hidden;
  box-sizing: border-box;

  code {
    display: block;
    padding: 0.75rem 0.85rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.775rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
  }
}

.preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  font-size: 0.725rem;
  color: #94a3b8;
}

.preview-heading-left {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.terminal-tag {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.05rem 0.35rem;
  border-radius: 0.2rem;
  background: rgba(0, 153, 255, 0.2);
  color: #38bdf8;
}

.copy-command-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  display: flex;
  align-items: center;
  padding: 0.2rem;
  border-radius: 0.25rem;

  &:hover {
    color: #f8fafc;
    background: rgba(255, 255, 255, 0.1);
  }
}

.copied-text {
  font-size: 0.7rem;
  color: #4ade80;
}

.memory-preview {
  background: #0f172a;
  border-color: rgba(59, 130, 246, 0.3);
}

.sub-badge {
  font-size: 0.65rem;
  padding: 0.05rem 0.35rem;
  border-radius: 0.2rem;
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}

/* Decision Action Buttons */
.decision-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.action-btn {
  width: 100%;
  min-height: 2.35rem;
  padding: 0.5rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.825rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  cursor: pointer;
  transition: all 0.16s ease;
  box-sizing: border-box;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.primary-btn {
  background: var(--mio-color-primary, #0099ff);
  color: #ffffff;
  border: 1px solid var(--mio-color-primary, #0099ff);

  &:hover:not(:disabled) {
    background: #0088e6;
    box-shadow: 0 4px 12px rgba(0, 153, 255, 0.24);
  }
}

.whitelist-btn {
  background: rgba(0, 153, 255, 0.05);
  color: var(--mio-color-primary, #0099ff);
  border: 1px solid rgba(0, 153, 255, 0.3);

  &:hover:not(:disabled) {
    background: rgba(0, 153, 255, 0.12);
    border-color: var(--mio-color-primary, #0099ff);
  }

  &.root-whitelist {
    color: var(--mio-text-regular, #606266);
    border-color: var(--mio-border-color-light, #e4e7ed);
    background: transparent;

    &:hover:not(:disabled) {
      background: var(--mio-bg-hover, rgba(0, 0, 0, 0.04));
      color: var(--mio-text-primary, #303133);
      border-color: var(--mio-border-color-base, #dcdfe6);
    }
  }
}

/* Trust Card / YOLO */
.trust-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: 0.5rem;
  background: var(--mio-bg-page, #f5f7fa);
  border: 1px solid var(--mio-border-color-light, #e4e7ed);
}

.trust-copy {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  span {
    font-size: 0.7rem;
    color: var(--mio-text-secondary, #909399);
    line-height: 1.35;
  }
}

.trust-title-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #e6a23c;
  font-size: 0.775rem;

  strong {
    color: var(--mio-text-primary, #303133);
    font-weight: 600;
  }
}

.trust-btn {
  flex: 0 0 auto;
  width: auto;
  min-height: 1.85rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.725rem;
  border-radius: 0.35rem;
  background: transparent;
  color: #e6a23c;
  border: 1px solid rgba(230, 162, 60, 0.4);

  &:hover:not(:disabled) {
    background: rgba(230, 162, 60, 0.1);
    border-color: #e6a23c;
  }
}

/* Error */
.interaction-error {
  padding: 0.5rem 0.75rem;
  border-radius: 0.35rem;
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
  font-size: 0.75rem;
  border: 1px solid rgba(245, 108, 108, 0.2);
}

/* Reject */
.reject-section {
  padding-top: 0.5rem;
  border-top: 1px solid var(--mio-border-color-light, #e4e7ed);
}

.reject-row {
  display: flex;
  gap: 0.5rem;

  input {
    flex: 1;
    min-height: 2.15rem;
    padding: 0.35rem 0.75rem;
    border-radius: 0.45rem;
    border: 1px solid var(--mio-border-color-light, #e4e7ed);
    background: var(--mio-bg-page, #f5f7fa);
    color: var(--mio-text-primary, #303133);
    font-size: 0.775rem;
    outline: none;
    transition: all 0.15s ease;

    &:focus {
      border-color: #f56c6c;
      background: var(--mio-bg-surface, #ffffff);
    }
  }
}

.reject-btn {
  flex: 0 0 auto;
  width: auto;
  min-height: 2.15rem;
  padding: 0.35rem 0.85rem;
  background: transparent;
  color: #f56c6c;
  border: 1px solid rgba(245, 108, 108, 0.3);

  &:hover:not(:disabled) {
    background: rgba(245, 108, 108, 0.1);
    border-color: #f56c6c;
  }
}

.option-btn {
  text-align: left;
  justify-content: flex-start;
  background: var(--mio-bg-page, #f5f7fa);
  color: var(--mio-text-primary, #303133);
  border: 1px solid var(--mio-border-color-light, #e4e7ed);

  &:hover:not(:disabled) {
    border-color: var(--mio-color-primary, #0099ff);
    color: var(--mio-color-primary, #0099ff);
  }
}

/* Animations */
.global-approval-enter-active,
.global-approval-leave-active {
  transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.global-approval-enter-from,
.global-approval-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .approval-panel {
    right: 0;
    bottom: 0;
    left: 0;
    width: 100vw;
    max-width: 100vw;
    max-height: 85vh;
    padding: 0.75rem 1rem max(1rem, env(safe-area-inset-bottom, 0px));
    border-radius: 18px 18px 0 0;
    border-left: none;
    border-right: none;
    border-bottom: none;
  }

  .mobile-sheet-handle {
    display: block;
    width: 38px;
    height: 4px;
    border-radius: 2px;
    background: var(--mio-border-color-light, #dcdfe6);
    margin: 0.15rem auto 0.85rem;
  }

  .global-approval-enter-from,
  .global-approval-leave-to {
    opacity: 0;
    transform: translateY(100%);
  }

  .trust-card {
    flex-direction: column;
    align-items: stretch;
  }

  .trust-btn {
    width: 100%;
  }

  .reject-row {
    flex-direction: column;
  }

  .reject-btn {
    width: 100%;
  }
}
</style>
