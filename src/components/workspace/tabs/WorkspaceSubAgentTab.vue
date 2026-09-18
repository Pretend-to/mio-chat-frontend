<template>
  <div class="workspace-subagent-tab">
    <!-- SubAgent Task Header -->
    <div class="subagent-header">
      <div class="header-main">
        <div class="task-title-row">
          <span class="task-icon">⚡</span>
          <span class="task-name">{{
            runInfo.role ||
            runInfo.subagentRole ||
            runInfo.title ||
            runInfo.subagentKey ||
            runInfo.jobKey ||
            "SubAgent"
          }}</span>
          <span class="status-pill" :class="`pill-${runInfo.status}`">
            {{ statusText(runInfo.status) }}
          </span>
        </div>
        <div
          v-if="runInfo.objective"
          class="task-objective"
          :class="{ 'is-expanded': isObjectiveExpanded }"
        >
          <div class="objective-content" :title="!isObjectiveExpanded ? runInfo.objective : undefined">
            {{ runInfo.objective }}
          </div>
          <button
            v-if="showObjectiveToggle"
            type="button"
            class="objective-toggle-btn"
            @click.stop="isObjectiveExpanded = !isObjectiveExpanded"
          >
            {{ isObjectiveExpanded ? "收起" : "展开完整目标" }}
          </button>
        </div>
      </div>
      <div class="header-meta">
        <span class="session-id"
          >Session: {{ runInfo.sessionId?.slice(0, 8) }}</span
        >
        <el-button
          v-if="canCancel"
          class="cancel-task-btn"
          link
          type="danger"
          :loading="actionLoading"
          @click="handleCancel"
        >
          取消任务
        </el-button>
      </div>
    </div>

    <!-- Messages Container -->
    <div ref="scrollContainerRef" class="subagent-messages-viewport">
      <div v-if="loading && !messageChain.length" class="loading-state">
        <span>正在加载 SubAgent 执行流...</span>
      </div>
      <div v-else-if="!messageChain.length" class="empty-state">
        <span>暂无消息记录</span>
      </div>
      <div v-else class="messages-flow">
        <MessageItem
          v-for="(item, index) of messageChain"
          :key="item.id || index"
          :item="item"
          :index="index"
          :activeContactor="subContactor"
          :hideAvatar="true"
          :mioPlugins="defaultMioPlugins"
          :katexPluginList="defaultKatexPlugins"
          :mdOptions="defaultMdOptions"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import MessageItem from "@/components/chat/MessageItem.vue";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { subagentsAPI } from "@/lib/subagentsApi.js";
import { client } from "@/lib/runtime.js";
import {
  codeBlockPlugin,
  mermaidPlugin,
  imageViewerPlugin,
} from "mio-previewer/plugins/custom";
import { katexPlugin } from "mio-previewer/plugins/markdown-it";

const props = defineProps({
  tab: {
    type: Object,
    required: true,
  },
});

const contactorsStore = useContactorsStore();
const scrollContainerRef = ref(null);
const loading = ref(false);
const actionLoading = ref(false);
const runDetail = ref(null);

const defaultMioPlugins = [
  { plugin: codeBlockPlugin },
  { plugin: mermaidPlugin },
  { plugin: imageViewerPlugin },
];
const defaultKatexPlugins = [{ plugin: katexPlugin }];
const defaultMdOptions = { html: true, linkify: true, typographer: true };

const baseRunInfo = computed(() => runDetail.value || props.tab.payload || {});

const liveSubContactor = computed(() => {
  const sessionId = baseRunInfo.value.sessionId;
  return sessionId
    ? contactorsStore.contactors[`sub_agent_${sessionId}`] || null
    : null;
});

const runInfo = computed(() => {
  const live = liveSubContactor.value;
  if (!live) return baseRunInfo.value;
  return {
    ...baseRunInfo.value,
    status: live.runStatus || baseRunInfo.value.status,
    runId: live.runId || baseRunInfo.value.runId,
    sessionId: live.sessionId || baseRunInfo.value.sessionId,
  };
});

const isObjectiveExpanded = ref(false);
const showObjectiveToggle = computed(() => {
  const obj = runInfo.value?.objective;
  return typeof obj === "string" && obj.trim().length > 60;
});

const subContactorId = computed(() => {
  const sId = runInfo.value.sessionId;
  return sId ? `sub_agent_${sId}` : null;
});

const subContactor = computed(() => {
  if (
    subContactorId.value &&
    liveSubContactor.value
  ) {
    return liveSubContactor.value;
  }
  return {
    id: subContactorId.value || "temp_subagent",
    name:
      runInfo.value.role ||
      runInfo.value.subagentRole ||
      runInfo.value.title ||
      runInfo.value.subagentKey ||
      runInfo.value.jobKey ||
      "SubAgent",
    platform: "sub_agent",
    readOnly: true,
    avatar: "/static/icons/512x512.png",
    messageChain: [],
  };
});

const messageChain = computed(() => {
  return subContactor.value?.messageChain || [];
});

const activeStatuses = new Set([
  "queued",
  "running",
  "waiting_tool",
  "interrupted",
]);
const canCancel = computed(() => activeStatuses.has(runInfo.value.status));

const fetchRunDetail = async () => {
  const runId = runInfo.value.runId || runInfo.value.id;
  if (!runId) return;
  try {
    const res = await subagentsAPI.getRun(runId);
    if (res.data) {
      runDetail.value = res.data;
    }
  } catch (err) {
    console.warn("[WorkspaceSubAgentTab] getRun failed:", err);
  }
};

const fetchHistory = async () => {
  const contactor = subContactor.value;
  const agentId = runInfo.value.agentId || contactor.agentId;
  const sessionId = runInfo.value.sessionId || contactor.sessionId;
  if (!agentId || !sessionId || !client.socket) return;

  loading.value = true;
  try {
    const res = await client.socket.fetch(`/api/agent/history/${agentId}`, {
      limit: 200,
      sessionId,
    });
    if (Array.isArray(res?.messages)) {
      contactorsStore.applyMessageEvent({
        type: "history.reconcile",
        contactorId: contactor.id,
        messages: res.messages,
        mode: "replace",
      });
    }
  } catch (err) {
    console.warn("[WorkspaceSubAgentTab] fetch history failed:", err);
  } finally {
    loading.value = false;
    scrollToBottom();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTop =
        scrollContainerRef.value.scrollHeight;
    }
  });
};

onMounted(() => {
  fetchRunDetail();
  fetchHistory();
});

watch(
  () => props.tab.payload?.sessionId,
  () => {
    fetchRunDetail();
    fetchHistory();
  },
);

const handleCancel = async () => {
  const runId = runInfo.value.runId || runInfo.value.id;
  if (!runId) return;
  try {
    await ElMessageBox.confirm("确定要取消此 SubAgent 任务吗？", "取消任务", {
      type: "warning",
    });
    actionLoading.value = true;
    await subagentsAPI.cancelRun(runId, "cancelled_from_workspace");
    ElMessage.success("任务已取消");
    await fetchRunDetail();
  } catch (err) {
    if (err !== "cancel") ElMessage.error(err.message || "取消失败");
  } finally {
    actionLoading.value = false;
  }
};

const statusText = (status) => {
  const map = {
    running: "执行中",
    completed: "已完成",
    result_ready: "已完成",
    failed: "失败",
    cancelled: "已取消",
    queued: "排队中",
  };
  return map[status] || status || "未知";
};
</script>

<style lang="scss" scoped>
.workspace-subagent-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--mio-bg-page, #ffffff);
}

.subagent-header {
  padding: 0.65rem 0.85rem;
  background: var(--mio-bg-surface, #ffffff);
  border-bottom: 1px solid var(--mio-border-color-light, #e4e7ed);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;

  .header-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    .task-title-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .task-icon {
        color: #f59e0b;
        font-size: 0.875rem;
      }

      .task-name {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--mio-text-primary, #303133);
      }

      .status-pill {
        font-size: 0.6875rem;
        padding: 0.1rem 0.4rem;
        border-radius: 0.25rem;
        font-weight: 500;

        &.pill-running {
          background: rgba(0, 153, 255, 0.14);
          color: var(--mio-color-primary, #0099ff);
        }
        &.pill-result_ready,
        &.pill-completed {
          background: rgba(16, 185, 129, 0.16);
          color: #10b981;
        }
        &.pill-queued {
          background: rgba(245, 158, 11, 0.16);
          color: #f59e0b;
        }
        &.pill-failed {
          background: rgba(239, 68, 68, 0.16);
          color: #ef4444;
        }
        &.pill-cancelled {
          background: rgba(107, 114, 128, 0.16);
          color: #9ca3af;
        }
      }
    }

    .task-objective {
      font-size: 0.75rem;
      color: var(--mio-text-secondary, #606266);
      line-height: 1.45;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;

      .objective-content {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        word-break: break-word;
        transition: all 0.2s ease;
      }

      &.is-expanded .objective-content {
        -webkit-line-clamp: unset;
        max-height: 220px;
        overflow-y: auto;
      }

      .objective-toggle-btn {
        align-self: flex-start;
        padding: 0;
        margin: 0;
        border: none;
        background: transparent;
        color: var(--mio-color-primary, #0099ff);
        font-size: 0.7rem;
        cursor: pointer;
        line-height: 1;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }

  .header-meta {
    font-size: 0.6875rem;
    color: var(--mio-text-placeholder, #909399);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .cancel-task-btn {
      min-height: 1.5rem;
      padding: 0 0.2rem;
      font-size: 0.6875rem;
    }
  }
}

.subagent-messages-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 0.8125rem;
  color: var(--mio-text-secondary, #909399);
}

.messages-flow {
  display: flex;
  flex-direction: column;
}
</style>
