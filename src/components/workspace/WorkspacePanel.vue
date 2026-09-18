<template>
  <!-- 宽屏 Docked 吸附平铺模式 -->
  <template v-if="workspaceStore.isDocked">
    <Transition name="workspace-docked-slide">
      <aside
        v-if="workspaceStore.isOpen"
        class="workspace-panel workspace-panel--docked"
        :class="{
          'is-fullscreen': workspaceStore.isFullscreen,
          'no-transition': workspaceStore.isResizing,
        }"
        :style="panelStyle"
      >
        <!-- Resizer Handle on Left Edge (Docked & not fullscreen) -->
        <div
          v-if="!workspaceStore.isFullscreen"
          class="workspace-resizer"
          @mousedown="startResize"
        ></div>

        <WorkspaceHeader />

        <main class="workspace-body">
          <component
            :is="currentTabComponent"
            v-if="workspaceStore.activeTab"
            :key="workspaceStore.activeTab.id"
            :tab="workspaceStore.activeTab"
          />
        </main>
      </aside>
    </Transition>
  </template>

  <!-- 窄屏 Drawer 抽屉模式 -->
  <template v-else>
    <Teleport to="body">
      <Transition name="workspace-drawer">
        <div v-if="workspaceStore.isOpen" class="workspace-drawer-mask" @click.self="workspaceStore.closeWorkspace">
          <aside class="workspace-panel workspace-panel--drawer">
            <WorkspaceHeader />
            <main class="workspace-body">
              <component
                :is="currentTabComponent"
                v-if="workspaceStore.activeTab"
                :key="workspaceStore.activeTab.id"
                :tab="workspaceStore.activeTab"
              />
            </main>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </template>
</template>

<script setup>
import { ref, computed } from "vue";
import { useWorkspaceStore } from "@/stores/workspaceStore.js";
import WorkspaceHeader from "./WorkspaceHeader.vue";
import WorkspaceOverviewTab from "./tabs/WorkspaceOverviewTab.vue";
import WorkspaceSubAgentTab from "./tabs/WorkspaceSubAgentTab.vue";
import WorkspaceArtifactTab from "./tabs/WorkspaceArtifactTab.vue";
import WorkspaceFileTab from "./tabs/WorkspaceFileTab.vue";
import WorkspaceGroupTab from "./tabs/WorkspaceGroupTab.vue";
import WorkspaceRenderTab from "./tabs/WorkspaceRenderTab.vue";

const workspaceStore = useWorkspaceStore();

const panelStyle = computed(() => {
  if (workspaceStore.isFullscreen) {
    return {
      width: "100%",
      "--panel-width-px": "100%",
    };
  }
  const w = `${workspaceStore.dockedWidth}px`;
  return {
    width: w,
    "--panel-width-px": w,
  };
});

const currentTabComponent = computed(() => {
  const type = workspaceStore.activeTab?.type;
  switch (type) {
    case "subagent":
      return WorkspaceSubAgentTab;
    case "artifact":
      return WorkspaceArtifactTab;
    case "file":
      return WorkspaceFileTab;
    case "group":
      return WorkspaceGroupTab;
    case "render":
      return WorkspaceRenderTab;
    case "overview":
    default:
      return WorkspaceOverviewTab;
  }
});

// Resizer logic
let startX = 0;
let startW = 0;

const startResize = (e) => {
  startX = e.clientX;
  startW = workspaceStore.dockedWidth;
  workspaceStore.isResizing = true;
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
};

const onMouseMove = (e) => {
  const delta = startX - e.clientX;
  const newWidth = Math.max(380, Math.min(window.innerWidth * 0.7, startW + delta));
  workspaceStore.dockedWidth = Math.round(newWidth);
};

const onMouseUp = () => {
  workspaceStore.isResizing = false;
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
  workspaceStore.setDockedWidth(workspaceStore.dockedWidth);
};
</script>

<style lang="scss" scoped>
.workspace-panel {
  display: flex;
  flex-direction: column;
  background: var(--mio-bg-page, #ffffff);
  overflow: hidden;
  box-sizing: border-box;

  &--docked {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    height: 100%;
    z-index: 50;
    border-left: 1px solid var(--mio-border-color-light, #e4e7ed);
    box-shadow: -2px 0 12px rgba(0, 0, 0, 0.04);
    transition: width 0.32s cubic-bezier(0.16, 1, 0.3, 1),
                border-color 0.2s ease,
                box-shadow 0.32s ease;

    &.no-transition {
      transition: none !important;
    }

    &.is-fullscreen {
      width: 100% !important;
      border-left-color: transparent;
      box-shadow: none;
      z-index: 100;
    }
  }

  &--drawer {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: min(560px, 94vw);
    height: 100%;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
    border-left: 1px solid var(--mio-border-color-light, #e4e7ed);
    z-index: 2001;
  }
}

.workspace-resizer {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
  background: transparent;

  &:hover {
    background: var(--mio-color-primary, #0099ff);
  }
}

.workspace-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 宽屏 Docked 平铺左右拉出/收起动画 */
.workspace-docked-slide-enter-active,
.workspace-docked-slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
              margin-right 0.28s cubic-bezier(0.16, 1, 0.3, 1),
              opacity 0.22s ease;
  will-change: transform, margin-right, opacity;
  overflow: hidden !important;
}

.workspace-docked-slide-enter-from,
.workspace-docked-slide-leave-to {
  transform: translateX(100%);
  margin-right: calc(-1 * var(--panel-width-px, 540px));
  opacity: 0.8;
}

/* 窄屏 Drawer 抽屉动画 */
.workspace-drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  z-index: 2000;
}

.workspace-drawer-enter-active,
.workspace-drawer-leave-active {
  transition: opacity 0.25s ease;

  .workspace-panel--drawer {
    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

.workspace-drawer-enter-from,
.workspace-drawer-leave-to {
  opacity: 0;

  .workspace-panel--drawer {
    transform: translateX(100%);
  }
}

@media (max-width: 768px) {
  .workspace-panel--drawer {
    width: 100vw !important;
    border-left: none;
    box-shadow: none;
  }

  .workspace-body {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));
  }
}
</style>
