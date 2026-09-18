<template>
  <div class="workspace-header">
    <!-- Left: Overview & utility icons -->
    <div class="workspace-header__left">
      <!-- Mobile Back Button (on non-docked mode) -->
      <button
        v-if="!workspaceStore.isDocked"
        class="icon-btn mobile-back-btn"
        title="返回聊天"
        @click="workspaceStore.closeWorkspace()"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <button
        class="icon-btn overview-btn"
        :class="{ 'is-active': workspaceStore.activeTabId === 'overview' }"
        title="工作区概览"
        @click="workspaceStore.openOverview()"
      >
        <!-- Document / Overview Icon -->
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M7 8h10" />
          <path d="M7 12h10" />
          <path d="M7 16h6" />
        </svg>
      </button>

      <!-- Contactor Share Button -->
      <button
        v-if="activeContactor"
        class="icon-btn share-btn"
        :class="{ 'is-loading': isSharing }"
        title="分享智能体 / 联系人"
        :disabled="isSharing"
        @click="handleShareContactor"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>
    </div>

    <!-- Center: Equal-width scrollable Tabs with Gradient Fade Mask -->
    <div class="workspace-header__tabs-wrapper">
      <div
        ref="tabsContainerRef"
        class="workspace-header__tabs"
        @wheel="handleTabsWheel"
      >
        <div
          v-for="tab in workspaceStore.tabs"
          :key="tab.id"
          class="workspace-tab"
          :class="{ 'is-active': workspaceStore.activeTabId === tab.id }"
          :title="tab.title"
          @click="workspaceStore.activeTabId = tab.id"
        >
          <span class="tab-icon">
            <!-- Icon by type -->
            <template v-if="tab.type === 'artifact'">
              <span class="md-badge">M↓</span>
            </template>
            <template v-else-if="tab.type === 'subagent'">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </template>
            <template v-else-if="tab.type === 'file'">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </template>
            <template v-else-if="tab.type === 'group'">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </template>
            <template v-else-if="tab.type === 'render'">
              <template v-if="tab.payload?.renderItem?.type === 'image'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              </template>
              <template v-else-if="tab.payload?.renderItem?.type === 'audio' || tab.payload?.renderItem?.type === 'voice'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </template>
              <template v-else-if="tab.payload?.renderItem?.type === 'video'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect width="14" height="14" x="1" y="5" rx="2" ry="2" />
                </svg>
              </template>
              <template v-else>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </template>
            </template>
            <template v-else>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 8h10" />
                <path d="M7 12h10" />
              </svg>
            </template>
          </span>
          <span class="tab-title">{{ tab.title }}</span>
          <button
            v-if="tab.closable !== false"
            class="tab-close"
            title="关闭标签"
            @click.stop="workspaceStore.closeTab(tab.id)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <!-- Right Gradient Fade Mask -->
      <div class="tabs-fade-right"></div>
    </div>

    <!-- Right: Window & Mode Controls -->
    <div class="workspace-header__right">
      <!-- Fullscreen Toggle (Only shown in desktop docked mode) -->
      <button
        v-if="workspaceStore.isDocked"
        class="icon-btn fullscreen-btn"
        :class="{ 'is-active': workspaceStore.isFullscreen }"
        :title="workspaceStore.isFullscreen ? '退出全屏' : '全屏展开'"
        @click="workspaceStore.toggleFullscreen()"
      >
        <transition name="fullscreen-icon" mode="out-in">
          <svg
            v-if="!workspaceStore.isFullscreen"
            key="expand"
            class="fullscreen-svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
          <svg
            v-else
            key="collapse"
            class="fullscreen-svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 14h6m0 0v6m0-6-7 7m17-11h-6m0 0V4m0 6 7-7" />
          </svg>
        </transition>
      </button>

      <!-- Blank slot reserved for top-right fixed workspace toggle button -->
      <div class="workspace-header-blank-slot"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useWorkspaceStore } from "@/stores/workspaceStore.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { client } from "@/lib/runtime.js";
import { shareOrCopy } from "@/utils/tools.js";
import { ElMessage } from "element-plus";

const workspaceStore = useWorkspaceStore();
const contactorsStore = useContactorsStore();
const activeContactor = computed(() => contactorsStore.activeContactor);
const isSharing = ref(false);

const handleShareContactor = async () => {
  const contactor = activeContactor.value;
  if (!contactor || !contactor.id || isSharing.value) return;
  isSharing.value = true;
  try {
    const shareResult = await client.shareContactor(contactor.id);
    if (shareResult && shareResult.shareUrl) {
      const { shareUrl } = shareResult;
      const { success, message } = await shareOrCopy({
        title: `分享智能体: ${contactor.name || "MioChat Agent"}`,
        text: shareUrl,
        url: shareUrl,
      });
      if (message) {
        if (success) {
          ElMessage.success(message);
        } else {
          ElMessage.error(message);
        }
      }
    } else {
      ElMessage.warning("获取分享链接失败，请稍后重试");
    }
  } catch (err) {
    console.error("[WorkspaceHeader] 分享联系人失败:", err);
    ElMessage.error("分享失败");
  } finally {
    isSharing.value = false;
  }
};

const tabsContainerRef = ref(null);

const handleTabsWheel = (e) => {
  if (!tabsContainerRef.value) return;
  // If trackpad horizontal gesture (deltaX), let native inertia scroll do it with full momentum
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    return;
  }
  // If vertical wheel scrolling on mouse, convert deltaY to horizontal scroll smoothly
  if (e.deltaY !== 0) {
    e.preventDefault();
    tabsContainerRef.value.scrollBy({
      left: e.deltaY,
      behavior: "smooth",
    });
  }
};

watch(
  () => workspaceStore.activeTabId,
  () => {
    nextTick(() => {
      const activeEl = tabsContainerRef.value?.querySelector(".workspace-tab.is-active");
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    });
  },
);
</script>

<style lang="scss" scoped>
.workspace-header {
  height: 2.75rem;
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--mio-bg-surface, #ffffff);
  border-bottom: 1px solid var(--mio-border-color-light, #e4e7ed);
  padding: 0 0.5rem;
  user-select: none;
  box-sizing: border-box;
  gap: 0.5rem;
}

.workspace-header__left,
.workspace-header__right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.icon-btn {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--mio-text-secondary, #909399);
  transition: all 0.2s ease;

  &:hover {
    background: var(--mio-bg-hover, rgba(0, 0, 0, 0.05));
    color: var(--mio-text-primary, #303133);
  }

  &.is-active {
    background: var(--mio-bg-primary-light, rgba(0, 153, 255, 0.12));
    color: var(--mio-color-primary, #0099ff);
  }
}

.share-btn {
  &:hover {
    background: var(--mio-bg-hover, rgba(0, 0, 0, 0.06));
    color: var(--mio-color-primary, #0099ff);
  }

  &.is-loading,
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.fullscreen-btn {
  position: relative;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: var(--mio-bg-hover, rgba(0, 0, 0, 0.06));
    color: var(--mio-color-primary, #0099ff);
    transform: translateY(-1px);
  }

  &:active {
    transform: scale(0.9);
  }

  &.is-active {
    background: var(--mio-bg-primary-light, rgba(0, 153, 255, 0.14));
    color: var(--mio-color-primary, #0099ff);
  }
}

.fullscreen-svg {
  display: block;
  flex-shrink: 0;
}

.fullscreen-icon-enter-active,
.fullscreen-icon-leave-active {
  transition: opacity 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
              transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fullscreen-icon-enter-from {
  opacity: 0;
  transform: scale(0.6) rotate(-35deg);
}

.fullscreen-icon-leave-to {
  opacity: 0;
  transform: scale(0.6) rotate(35deg);
}

.workspace-header-blank-slot {
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
}

.workspace-header__tabs-wrapper {
  flex: 1;
  position: relative;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.workspace-header__tabs {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  gap: 0.35rem;
  padding: 0.2rem 2.5rem 0.2rem 0;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;

  &::-webkit-scrollbar {
    display: none;
  }
}

.tabs-fade-right {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 2.5rem;
  pointer-events: none;
  background: linear-gradient(
    to right,
    transparent 0%,
    var(--mio-bg-surface, #ffffff) 100%
  );
  z-index: 5;
}

.workspace-tab {
  flex: 0 0 auto;
  min-width: 120px;
  max-width: 180px;
  height: 2.05rem;
  border-radius: 0.45rem;
  background: transparent;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  padding: 0 0.6rem;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  color: var(--mio-text-secondary, #909399);
  font-size: 0.8125rem;
  box-sizing: border-box;

  &:hover {
    background: var(--mio-bg-hover, rgba(0, 0, 0, 0.04));
    color: var(--mio-text-primary, #303133);
  }

  &.is-active {
    background: var(--mio-bg-active, rgba(0, 153, 255, 0.1));
    color: var(--mio-color-primary, #0099ff);
    font-weight: 500;
    border-color: transparent;
  }

  .tab-icon {
    margin-right: 0.35rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .md-badge {
      font-size: 0.65rem;
      font-weight: bold;
      color: var(--mio-color-primary, #0099ff);
      letter-spacing: -0.05em;
    }
  }

  .tab-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .tab-close {
    width: 1rem;
    height: 1rem;
    border-radius: 0.2rem;
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--mio-text-secondary, #909399);
    opacity: 0.5;
    margin-left: 0.25rem;
    flex-shrink: 0;
    transition: all 0.15s ease;

    &:hover {
      opacity: 1;
      background: var(--mio-bg-hover, rgba(0, 0, 0, 0.08));
      color: var(--mio-text-primary, #303133);
    }
  }

  &.is-active .tab-close {
    opacity: 0.75;
  }
}

@media (max-width: 768px) {
  .workspace-header {
    height: calc(2.75rem + env(safe-area-inset-top, 0px));
    min-height: calc(2.75rem + env(safe-area-inset-top, 0px));
    padding-top: env(safe-area-inset-top, 0px);
  }
}
</style>
