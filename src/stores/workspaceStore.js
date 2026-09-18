import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useWorkspaceStore = defineStore("workspace", () => {
  const isOpen = ref(false);
  const isFullscreen = ref(false);
  const dockedWidth = ref(540);
  const isResizing = ref(false);
  const windowWidth = ref(
    typeof window !== "undefined" ? window.innerWidth : 1440,
  );

  // 响应式判断：宽屏（>= 1200px 且非移动端）吸附平铺，否则使用抽屉浮层
  const isDocked = computed(() => {
    return windowWidth.value >= 1200;
  });

  // 基础默认标签：概览看板（不可关闭）
  const defaultOverviewTab = {
    id: "overview",
    title: "概览",
    type: "overview",
    icon: "overview",
    closable: false,
    payload: null,
  };

  const tabs = ref([defaultOverviewTab]);
  const activeTabId = ref("overview");

  const activeTab = computed(() => {
    return (
      tabs.value.find((t) => t.id === activeTabId.value) ||
      tabs.value[0] ||
      defaultOverviewTab
    );
  });

  // 监听窗口缩放更新 windowWidth
  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => {
      windowWidth.value = window.innerWidth;
    });
  }

  function openTab(tab) {
    if (!tab || !tab.id) return;
    const existingIndex = tabs.value.findIndex((t) => t.id === tab.id);
    if (existingIndex !== -1) {
      if (tab.payload) {
        tabs.value[existingIndex].payload = tab.payload;
      }
      if (tab.title) {
        tabs.value[existingIndex].title = tab.title;
      }
    } else {
      tabs.value.push({
        closable: true,
        ...tab,
      });
    }
    activeTabId.value = tab.id;
    isOpen.value = true;
  }

  function closeTab(tabId) {
    if (tabId === "overview") return;
    const index = tabs.value.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    const isCurrentActive = activeTabId.value === tabId;
    tabs.value.splice(index, 1);

    if (isCurrentActive) {
      const nextIndex = Math.max(0, index - 1);
      activeTabId.value = tabs.value[nextIndex]?.id || "overview";
    }
  }

  function openOverview() {
    activeTabId.value = "overview";
    isOpen.value = true;
  }

  function openSubAgentTab(run) {
    if (!run) return;
    const runId = run.id || run.runId;
    const sessionId = run.sessionId;
    const tabId = `subagent_${sessionId || runId}`;
    const title =
      run.role ||
      run.subagentRole ||
      run.title ||
      run.subagentKey ||
      run.jobKey ||
      "SubAgent";

    openTab({
      id: tabId,
      title,
      type: "subagent",
      icon: "subagent",
      closable: true,
      payload: {
        ...run,
        role: title,
        runId,
        sessionId,
      },
    });
  }

  function openArtifactTab(artifact) {
    if (!artifact) return;
    const id = `artifact_${artifact.id || artifact.name || Date.now()}`;
    const title = artifact.title || artifact.name || "Artifact";

    openTab({
      id,
      title,
      type: "artifact",
      icon: "artifact",
      closable: true,
      payload: artifact,
    });
  }

  function openFileTab(file) {
    if (!file) return;
    const id = `file_${file.path || file.name || Date.now()}`;
    const title = file.name || file.path?.split("/").pop() || "File";

    openTab({
      id,
      title,
      type: "file",
      icon: "file",
      closable: true,
      payload: file,
    });
  }

  function openGroupTab(group) {
    if (!group) return;
    const id = `group_${group.id || "current"}`;
    openTab({
      id,
      title: "群聊概况",
      type: "group",
      icon: "group",
      closable: true,
      payload: { group },
    });
    isOpen.value = true;
  }

  function openRenderTab(renderItem, meta = {}) {
    if (!renderItem) return;
    const type = renderItem.type || "html";
    const id =
      meta.id ||
      renderItem.id ||
      `render_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    let title =
      meta.title ||
      renderItem.title ||
      renderItem.name ||
      renderItem.fileName ||
      "";
    if (!title) {
      if (type === "html" || type === "iframe") {
        title = meta.toolTitle ? `${meta.toolTitle} UI` : "UI 卡片";
      } else if (type === "image") {
        title = meta.toolTitle ? `${meta.toolTitle} 图片` : "图片产物";
      } else if (type === "audio" || type === "voice") {
        title = meta.toolTitle ? `${meta.toolTitle} 音频` : "语音/音频";
      } else if (type === "video") {
        title = meta.toolTitle ? `${meta.toolTitle} 视频` : "视频产物";
      } else if (type === "file" || type === "document") {
        title = "文件产物";
      } else {
        title = meta.toolTitle || "渲染产物";
      }
    }

    openTab({
      id,
      title,
      type: "render",
      icon: "render",
      closable: true,
      payload: {
        renderItem,
        meta,
      },
    });
    isOpen.value = true;
  }

  function toggleWorkspace(forceState) {
    if (typeof forceState === "boolean") {
      isOpen.value = forceState;
    } else {
      isOpen.value = !isOpen.value;
    }
    if (isOpen.value && !activeTabId.value) {
      activeTabId.value = "overview";
    }
  }

  function toggleFullscreen(forceState) {
    if (typeof forceState === "boolean") {
      isFullscreen.value = forceState;
    } else {
      isFullscreen.value = !isFullscreen.value;
    }
  }

  function closeWorkspace() {
    isOpen.value = false;
    isFullscreen.value = false;
  }

  return {
    isOpen,
    isDocked,
    isFullscreen,
    dockedWidth,
    isResizing,
    tabs,
    activeTabId,
    activeTab,
    openTab,
    closeTab,
    openOverview,
    openSubAgentTab,
    openArtifactTab,
    openFileTab,
    openGroupTab,
    openRenderTab,
    toggleWorkspace,
    toggleFullscreen,
    closeWorkspace,
  };
});
