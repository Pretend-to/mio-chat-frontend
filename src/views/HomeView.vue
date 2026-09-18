<template>
  <div v-if="!onPhone" class="mio-main-layout">
    <friendlist></friendlist>
    <div class="mio-chat-workspace-container">
      <div
        class="mio-chat-pane"
        :class="{
          'is-covered-by-fullscreen': isChatCoveredByFullscreen,
          'no-transition': workspaceStore.isResizing,
        }"
        :style="chatPaneStyle"
      >
        <router-view v-if="loaded"></router-view>
        <blankView v-else></blankView>
      </div>
      <WorkspacePanel />
    </div>
  </div>
  <div
    v-else-if="pagePath === '/'"
    class="mio-main-layout mio-main-layout--mobile"
  >
    <friendlist v-if="loaded"></friendlist>
    <blankView v-else></blankView>
  </div>
  <div
    v-else
    class="mio-main-layout mio-main-layout--mobile mio-main-layout--mobile-chat"
  >
    <div class="mio-chat-workspace-container">
      <div
        class="mio-chat-pane"
        :class="{
          'is-covered-by-fullscreen': isChatCoveredByFullscreen,
          'no-transition': workspaceStore.isResizing,
        }"
        :style="chatPaneStyle"
      >
        <router-view v-if="loaded"></router-view>
        <blankView v-else></blankView>
      </div>
      <WorkspacePanel />
    </div>
  </div>

  <!-- Keep the independent control outside app stacking contexts. -->
  <Teleport to="body">
    <button
      v-if="!onPhone || pagePath !== '/'"
      class="workspace-fixed-toggle-btn"
      :class="{ 'is-active': workspaceStore.isOpen }"
      :title="workspaceStore.isOpen ? '收起工作区' : '展开工作区'"
      @click="workspaceStore.toggleWorkspace()"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M15 3v18" />
      </svg>
    </button>
  </Teleport>
</template>

<script>
import friendlist from "@/components/FriendList.vue";
import { client } from "@/lib/runtime.js";
import blankView from "@/views/BlankView.vue";
import WorkspacePanel from "@/components/workspace/WorkspacePanel.vue";
import { useWorkspaceStore } from "@/stores/workspaceStore.js";

export default {
  components: {
    friendlist,
    blankView,
    WorkspacePanel,
  },
  data() {
    const onPhone = window.innerWidth < 768;
    return {
      onPhone,
      pagePath: this.$route.path,
      loaded: false,
    };
  },
  computed: {
    workspaceStore() {
      return useWorkspaceStore();
    },
    isChatCoveredByFullscreen() {
      return (
        this.workspaceStore.isOpen &&
        this.workspaceStore.isDocked &&
        this.workspaceStore.isFullscreen
      );
    },
    chatPaneStyle() {
      if (this.workspaceStore.isOpen && this.workspaceStore.isDocked) {
        return {
          marginRight: `${this.workspaceStore.dockedWidth}px`,
        };
      }
      return {
        marginRight: "0px",
      };
    },
  },
  watch: {
    $route: function (newVal) {
      this.pagePath = newVal.path;
    },
  },
  mounted() {
    if (client.inited) {
      this.loaded = true;
    } else {
      client.on(
        "loaded",
        () => {
          this.loaded = true;
        },
        false,
      );
    }
    this.resizeHandler = () => {
      this.onPhone = window.innerWidth < 768;
    };
    window.addEventListener("resize", this.resizeHandler);
  },
  beforeUnmount() {
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }
  },
};
</script>

<style>
.mio-main-layout {
  flex-grow: 1;
  display: flex;
  width: calc(100% - 4.5rem);
  background-color: transparent;
}

.mio-main-layout--mobile {
  width: 100%;
  height: calc(100% - 4.2rem - env(safe-area-inset-bottom, 0px));
  flex-grow: 1;
  flex-shrink: 1;
  min-height: 0;
  display: flex;
}

.mio-main-layout--mobile.mio-main-layout--mobile-chat {
  height: 100%;
}

.mio-chat-workspace-container {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  position: relative;
  overflow: hidden;
}

.mio-chat-pane {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  position: relative;
  overflow: hidden;
  transition: margin-right 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.mio-chat-pane.no-transition {
  transition: none !important;
}

.mio-chat-pane.is-covered-by-fullscreen {
  pointer-events: none;
}

.workspace-fixed-toggle-btn {
  position: fixed;
  top: 0.5rem;
  right: 0.5rem;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 4100;
  transition: all 0.15s ease;
  padding: 0;
  box-sizing: border-box;
  -webkit-app-region: no-drag;

  background: transparent;
  border: none;
  box-shadow: none;
  color: var(--mio-text-secondary, #909399);
}

.workspace-fixed-toggle-btn:hover {
  background: var(--mio-bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--mio-text-primary, #303133);
}

.workspace-fixed-toggle-btn.is-active {
  background: transparent;
  color: var(--mio-color-primary, #0099ff);
}

.workspace-fixed-toggle-btn.is-active:hover {
  background: var(--mio-bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--mio-color-primary, #0099ff);
}

@media (max-width: 768px) {
  .workspace-fixed-toggle-btn {
    top: calc(0.5rem + env(safe-area-inset-top, 0px));
  }
}
</style>
