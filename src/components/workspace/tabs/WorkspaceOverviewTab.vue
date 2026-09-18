<template>
  <div class="workspace-overview">
    <!-- Group Overview Section (When current contactor is a group) -->
    <div v-if="activeContactor?.platform === 'group'" class="overview-section">
      <div class="section-header">
        <div class="header-title">
          <span>群聊概况</span>
          <span class="count-badge"
            >{{ (activeContactor.members?.length || 0) + 1 }} 人</span
          >
        </div>
      </div>

      <div class="section-content">
        <div
          class="group-overview-card"
          @click="workspaceStore.openGroupTab(activeContactor)"
        >
          <div class="card-left">
            <div class="group-avatar-box">
              <GroupAvatar :contactor="activeContactor" :size="34" />
            </div>
            <div class="card-info">
              <div class="card-title">
                {{ activeContactor.name }}
              </div>
              <div class="card-subtitle">
                {{
                  activeContactor.notice ||
                  "点击查看与编辑群公告、管理 Agent 成员"
                }}
              </div>
            </div>
          </div>
          <div class="card-right">
            <span class="open-pill">打开群聊概况</span>
            <span class="open-arrow">›</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SubAgents Section -->
    <div class="overview-section">
      <div
        class="section-header"
        @click="subagentsCollapsed = !subagentsCollapsed"
      >
        <div class="header-title">
          <span>子智能体</span>
          <span class="count-badge">{{ subagentRuns.length }}</span>
        </div>
        <svg
          class="collapse-icon"
          :class="{ 'is-collapsed': subagentsCollapsed }"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <div v-show="!subagentsCollapsed" class="section-content">
        <div v-if="loading" class="empty-hint">加载中...</div>
        <div v-else-if="!subagentRuns.length" class="empty-hint">
          当前会话暂未派发子智能体任务
        </div>
        <div v-else class="subagent-list">
          <div
            v-for="run in subagentRuns"
            :key="run.id"
            class="subagent-card"
            @click="workspaceStore.openSubAgentTab(run)"
          >
            <div class="card-left">
              <span
                class="status-indicator"
                :class="`status-${run.status}`"
              ></span>
              <div class="card-info">
                <div class="card-title">
                  {{
                    run.role ||
                    run.subagentRole ||
                    run.title ||
                    run.subagentKey ||
                    run.jobKey ||
                    "子智能体"
                  }}
                </div>
                <div class="card-subtitle">
                  {{ run.objective || statusText(run.status) }}
                </div>
              </div>
            </div>
            <div class="card-right">
              <span class="status-pill" :class="`pill-${run.status}`">
                {{ statusText(run.status) }}
              </span>
              <span class="open-arrow">›</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Artifacts / Renders Section -->
    <div class="overview-section">
      <div class="section-header" @click="filesCollapsed = !filesCollapsed">
        <div class="header-title">
          <span>渲染产物与资产</span>
          <span class="count-badge">{{ rendersAndArtifactsList.length }}</span>
        </div>
        <svg
          class="collapse-icon"
          :class="{ 'is-collapsed': filesCollapsed }"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <div v-show="!filesCollapsed" class="section-content">
        <div v-if="!rendersAndArtifactsList.length" class="empty-hint">
          当前会话暂无渲染产物或 UI 卡片
        </div>
        <div v-else class="file-list">
          <div
            v-for="entry in rendersAndArtifactsList"
            :key="entry.id"
            class="file-item"
            @click="openItem(entry)"
          >
            <span class="file-icon">
              <template v-if="entry.type === 'office'">
                <span class="tag-badge badge-office">DOC</span>
              </template>
              <template v-else-if="entry.type === 'pdf'">
                <span class="tag-badge badge-pdf">PDF</span>
              </template>
              <template v-else-if="entry.type === 'markdown'">
                <span class="tag-badge badge-markdown">MD</span>
              </template>
              <template v-else-if="entry.type === 'html' || entry.type === 'iframe' || entry.type === 'web'">
                <span class="tag-badge badge-html">&lt;/&gt;</span>
              </template>
              <template v-else-if="entry.type === 'image'">
                <span class="tag-badge badge-image">IMG</span>
              </template>
              <template
                v-else-if="entry.type === 'audio' || entry.type === 'voice'"
              >
                <span class="tag-badge badge-audio">AUD</span>
              </template>
              <template v-else-if="entry.type === 'video'">
                <span class="tag-badge badge-video">VID</span>
              </template>
              <template v-else-if="entry.title?.endsWith('.json')">
                <span class="tag-badge badge-json">{ }</span>
              </template>
              <template v-else>
                <span class="tag-badge badge-doc">📄</span>
              </template>
            </span>
            <div class="item-text-info">
              <span class="file-name">{{ entry.title }}</span>
              <span v-if="entry.subtitle" class="file-subtitle">{{
                entry.subtitle
              }}</span>
            </div>
            <span v-if="entry.toolTitle" class="item-tool-tag">{{
              entry.toolTitle
            }}</span>
            <span class="open-arrow">›</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useWorkspaceStore } from "@/stores/workspaceStore.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { subagentsAPI } from "@/lib/subagentsApi.js";
import GroupAvatar from "@/components/GroupAvatar.vue";

const workspaceStore = useWorkspaceStore();
const contactorsStore = useContactorsStore();

const subagentsCollapsed = ref(false);
const filesCollapsed = ref(false);
const loading = ref(false);
const groups = ref([]);

const activeContactor = computed(() => contactorsStore.activeContactor);

const loadSubAgents = async () => {
  const contactor = activeContactor.value;
  if (!contactor || !contactor.agentId || !contactor.sessionId) {
    groups.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await subagentsAPI.listGroups(
      contactor.agentId,
      contactor.sessionId,
    );
    groups.value = res.data?.groups || [];
  } catch (err) {
    console.warn("[WorkspaceOverviewTab] load subagents failed:", err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadSubAgents();
});

watch(
  () => [activeContactor.value?.agentId, activeContactor.value?.sessionId],
  () => {
    loadSubAgents();
  },
);

const subagentRuns = computed(() => {
  const runs = [];
  const liveByRunId = new Map(
    Object.values(contactorsStore.contactors)
      .filter(
        (contactor) =>
          contactor?.platform === "sub_agent" &&
          String(contactor.agentId || "") ===
            String(activeContactor.value?.agentId || "") &&
          String(contactor.parentSessionId || "") ===
            String(activeContactor.value?.sessionId || ""),
      )
      .map((contactor) => [String(contactor.runId), contactor]),
  );

  groups.value.forEach((group) => {
    (group.runs || []).forEach((run) => {
      const live = liveByRunId.get(String(run.id || run.runId));
      runs.push({
        ...run,
        ...(live
          ? {
              status: live.runStatus || run.status,
              sessionId: live.sessionId || run.sessionId,
              runId: live.runId || run.runId,
            }
          : {}),
        role:
          run.role ||
          run.subagentRole ||
          run.session?.subagentRole ||
          run.session?.title ||
          run.subagentKey ||
          run.jobKey,
        groupId: group.id,
        agentId: activeContactor.value?.agentId,
      });
    });
  });

  // A stream event can arrive after the initial group snapshot (or create a
  // run while this tab is already open). Include those contacts immediately;
  // the regular Socket.IO message path is the source of truth for status.
  for (const live of liveByRunId.values()) {
    if (runs.some((run) => String(run.id || run.runId) === String(live.runId))) {
      continue;
    }
    runs.push({
      id: live.runId,
      runId: live.runId,
      sessionId: live.sessionId,
      status: live.runStatus,
      objective: live.intro,
      role: live.name,
      groupId: live.groupId,
      agentId: live.agentId,
    });
  }
  return runs;
});

function getFileExtension(urlOrPath = "") {
  try {
    const clean = String(urlOrPath).split("?")[0].split("#")[0];
    const dotIndex = clean.lastIndexOf(".");
    if (dotIndex === -1) return "";
    return clean.slice(dotIndex + 1).toLowerCase();
  } catch {
    return "";
  }
}

// 从当前会话消息链中提取产生过的渲染产物 (ExtraRender) 与 Artifacts
const rendersAndArtifactsList = computed(() => {
  const list = [];
  const chain = activeContactor.value?.messageChain || [];

  chain.forEach((msg, msgIndex) => {
    // 1. 扫描 msg.artifacts
    if (msg.artifacts && Array.isArray(msg.artifacts)) {
      msg.artifacts.forEach((art, artIndex) => {
        list.push({
          id: art.id || `art_${msg.id || msgIndex}_${artIndex}`,
          isArtifact: true,
          type: "artifact",
          title: art.title || art.name || "产物文件",
          subtitle:
            art.path || (art.content ? `${art.content.length} 字符` : ""),
          item: art,
          timestamp: msg.time || msg.timestamp,
        });
      });
    }

    // 2. 扫描 msg 级直接挂载的 extraRender
    const directExtras = Array.isArray(msg.extraRender)
      ? msg.extraRender
      : msg.extraRender
        ? [msg.extraRender]
        : [];
    directExtras.forEach((r, rIndex) => {
      if (!r) return;
      const ext = getFileExtension(r.url || r.src || r.fileName || r.title || r.name);
      let rType = (r.type || "html").toLowerCase();
      if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) {
        rType = "office";
      } else if (ext === "pdf") {
        rType = "pdf";
      } else if (ext === "md" || ext === "markdown") {
        rType = "markdown";
      } else if (ext === "html" || ext === "htm") {
        rType = "html";
      }

      let title = r.title || r.fileName || r.name || "";
      if (!title) {
        if (rType === "office") title = "Office 文档";
        else if (rType === "pdf") title = "PDF 文档";
        else if (rType === "markdown") title = "Markdown 文档";
        else if (rType === "html" || rType === "iframe") title = "UI 卡片";
        else if (rType === "image") title = "图片";
        else if (rType === "audio" || rType === "voice") title = "音频";
        else if (rType === "video") title = "视频";
        else title = "渲染项";
      }

      let subtitle = r.description || r.url || "";
      if (!subtitle && (rType === "html" || rType === "iframe")) {
        subtitle = `${r.html?.length || 0} 字符 (Shadow DOM)`;
      }

      list.push({
        id: `render_direct_${msg.id || msgIndex}_${rIndex}`,
        isArtifact: false,
        type: rType,
        title,
        subtitle,
        toolTitle: "消息产物",
        toolName: "",
        item: r,
        timestamp: msg.time || msg.timestamp,
      });
    });

    // 3. 扫描 msg.content 中的 tool_call 元素与 extraRender 元素
    const contents = Array.isArray(msg.content) ? msg.content : [];
    contents.forEach((el, elIndex) => {
      let extra = [];
      let toolTitle = "工具";
      let toolName = "";

      if (el.type === "tool_call" && el.data) {
        const toolData = el.data;
        toolTitle = toolData.displayName || toolData.name || "工具";
        toolName = toolData.name;
        if (Array.isArray(toolData.extraRender)) {
          extra = toolData.extraRender;
        } else if (toolData.extraRender) {
          extra = [toolData.extraRender];
        }
      } else if (el.type === "extraRender" && el.data) {
        extra = Array.isArray(el.data) ? el.data : [el.data];
      } else if (el.extraRender) {
        extra = Array.isArray(el.extraRender) ? el.extraRender : [el.extraRender];
      }

      extra.forEach((r, rIndex) => {
        if (!r) return;
        const ext = getFileExtension(r.url || r.src || r.fileName || r.title || r.name);
        let rType = (r.type || "html").toLowerCase();
        if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) {
          rType = "office";
        } else if (ext === "pdf") {
          rType = "pdf";
        } else if (ext === "md" || ext === "markdown") {
          rType = "markdown";
        } else if (ext === "html" || ext === "htm") {
          rType = "html";
        }

        let title = r.title || r.fileName || r.name || "";
        if (!title) {
          if (rType === "office") title = `${toolTitle} Office 文档`;
          else if (rType === "pdf") title = `${toolTitle} PDF 文档`;
          else if (rType === "markdown") title = `${toolTitle} Markdown 文档`;
          else if (rType === "html" || rType === "iframe") title = `${toolTitle} UI 卡片`;
          else if (rType === "image") title = `${toolTitle} 图片`;
          else if (rType === "audio" || rType === "voice") title = `${toolTitle} 音频`;
          else if (rType === "video") title = `${toolTitle} 视频`;
          else if (rType === "file" || rType === "document") title = `${toolTitle} 文件`;
          else title = `${toolTitle} 渲染项`;
        }

        let subtitle = r.description || r.url || "";
        if (!subtitle && (rType === "html" || rType === "iframe")) {
          subtitle = `${r.html?.length || 0} 字符 (Shadow DOM)`;
        }

        list.push({
          id: `render_${msg.id || msgIndex}_${elIndex}_${rIndex}`,
          isArtifact: false,
          type: rType,
          title,
          subtitle,
          toolTitle,
          toolName,
          item: r,
          timestamp: msg.time || msg.timestamp || el.data?.startTime,
        });
      });
    });
  });

  return list;
});

const openItem = (entry) => {
  if (entry.isArtifact) {
    workspaceStore.openArtifactTab(entry.item);
  } else {
    workspaceStore.openRenderTab(entry.item, {
      id: entry.id,
      title: entry.title,
      toolTitle: entry.toolTitle,
      toolName: entry.toolName,
    });
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
.workspace-overview {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.overview-section {
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  cursor: pointer;
  user-select: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--mio-text-primary, #303133);

  &:hover {
    color: var(--mio-color-primary, #0099ff);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .count-badge {
      background: var(--mio-bg-hover, rgba(0, 0, 0, 0.06));
      padding: 0.1rem 0.45rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      color: var(--mio-text-secondary, #909399);
      font-weight: normal;
    }
  }

  .collapse-icon {
    transition: transform 0.2s ease;
    &.is-collapsed {
      transform: rotate(-90deg);
    }
  }
}

.empty-hint {
  font-size: 0.8125rem;
  color: var(--mio-text-secondary, #909399);
  padding: 0.75rem 0.5rem;
  font-style: italic;
}

.group-overview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--mio-bg-card, #ffffff);
  border: 1px solid var(--mio-border-color-light, #e4e7ed);
  border-radius: 0.5rem;
  padding: 0.75rem 0.85rem;
  cursor: pointer;
  margin-top: 0.35rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;

  &:hover {
    background: var(--mio-bg-hover, rgba(0, 0, 0, 0.02));
    border-color: var(--mio-color-primary, #0099ff);
    transform: translateY(-1px);
  }

  .card-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    overflow: hidden;
    min-width: 0;
  }

  .group-avatar-box {
    width: 34px;
    height: 34px;
    min-width: 34px;
    min-height: 34px;
    max-width: 34px;
    max-height: 34px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;

    .card-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--mio-text-primary, #303133);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-subtitle {
      font-size: 0.75rem;
      color: var(--mio-text-secondary, #909399);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 0.2rem;
    }
  }

  .card-right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;

    .open-pill {
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 0.35rem;
      background: var(--mio-bg-primary-light, rgba(0, 153, 255, 0.12));
      color: var(--mio-color-primary, #0099ff);
      font-weight: 500;
    }

    .open-arrow {
      font-size: 1.1rem;
      color: var(--mio-text-secondary, #909399);
    }
  }
}

.subagent-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.subagent-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--mio-bg-card, #ffffff);
  border: 1px solid var(--mio-border-color-light, #e4e7ed);
  border-radius: 0.5rem;
  padding: 0.65rem 0.75rem;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;

  &:hover {
    background: var(--mio-bg-hover, rgba(0, 0, 0, 0.02));
    border-color: var(--mio-color-primary, #0099ff);
    transform: translateY(-1px);
  }

  .card-left {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    overflow: hidden;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;

    &.status-running {
      background: #0099ff;
      box-shadow: 0 0 6px rgba(0, 153, 255, 0.6);
    }
    &.status-result_ready,
    &.status-completed {
      background: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
    }
    &.status-queued {
      background: #f59e0b;
      box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
    }
    &.status-failed {
      background: #ef4444;
    }
    &.status-cancelled {
      background: #6b7280;
    }
  }

  .card-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .card-title {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--mio-text-primary, #303133);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-subtitle {
      font-size: 0.75rem;
      color: var(--mio-text-secondary, #909399);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 0.15rem;
    }
  }

  .card-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;

    .status-pill {
      font-size: 0.6875rem;
      padding: 0.15rem 0.45rem;
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

    .open-arrow {
      color: var(--mio-text-secondary, #909399);
      font-size: 1rem;
    }
  }
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.6rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.8125rem;
  color: var(--mio-text-primary, #303133);

  &:hover {
    background: var(--mio-bg-hover, rgba(0, 0, 0, 0.04));
    color: var(--mio-color-primary, #0099ff);
  }

  .file-icon {
    font-size: 0.875rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;

    .tag-badge {
      font-size: 0.625rem;
      padding: 0.1rem 0.35rem;
      border-radius: 0.25rem;
      font-weight: 700;
      letter-spacing: 0.02em;

      &.badge-html {
        background: rgba(0, 153, 255, 0.14);
        color: var(--mio-color-primary, #0099ff);
      }
      &.badge-image {
        background: rgba(16, 185, 129, 0.16);
        color: #10b981;
      }
      &.badge-audio {
        background: rgba(245, 158, 11, 0.16);
        color: #f59e0b;
      }
      &.badge-video {
        background: rgba(239, 68, 68, 0.16);
        color: #ef4444;
      }
      &.badge-office {
        background: rgba(37, 99, 235, 0.16);
        color: #2563eb;
      }
      &.badge-pdf {
        background: rgba(239, 68, 68, 0.16);
        color: #ef4444;
      }
      &.badge-markdown {
        background: rgba(8, 145, 178, 0.16);
        color: #0891b2;
      }
      &.badge-json {
        background: rgba(245, 158, 11, 0.16);
        color: #f59e0b;
      }
      &.badge-doc {
        font-size: 0.8rem;
      }
    }
  }

  .item-text-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    flex: 1;

    .file-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-subtitle {
      font-size: 0.72rem;
      color: var(--mio-text-secondary, #909399);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 0.15rem;
    }
  }

  .item-tool-tag {
    font-size: 0.6875rem;
    color: var(--mio-text-secondary, #909399);
    background: var(--mio-bg-hover, rgba(0, 0, 0, 0.05));
    padding: 0.08rem 0.35rem;
    border-radius: 0.2rem;
    white-space: nowrap;
    margin-left: 0.5rem;
  }

  .open-arrow {
    color: var(--mio-text-secondary, #909399);
    font-size: 1rem;
    margin-left: 0.35rem;
    flex-shrink: 0;
  }
}
</style>
