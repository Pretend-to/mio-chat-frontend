<template>
  <div class="workspace-artifact-tab">
    <div class="artifact-header">
      <div class="artifact-meta">
        <span class="artifact-icon">📄</span>
        <span class="artifact-title">{{ tab.title }}</span>
      </div>
      <div class="artifact-actions">
        <button class="action-btn" title="复制内容" @click="handleCopy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        </button>
      </div>
    </div>
    <div class="artifact-viewport">
      <MdRenderer
        :md="artifactContent"
        :customPlugins="customPlugins"
        :markdownItPlugins="markdownItPlugins"
        theme="github"
        themeMode="auto"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { ElMessage } from "element-plus";
import MdRenderer from "mio-previewer";
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

const customPlugins = [
  { plugin: codeBlockPlugin },
  { plugin: mermaidPlugin },
  { plugin: imageViewerPlugin },
];

const markdownItPlugins = [{ plugin: katexPlugin }];

const artifactContent = computed(() => {
  const p = props.tab.payload;
  if (!p) return "";
  if (typeof p === "string") return p;
  return p.content || p.code || p.text || "";
});

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(artifactContent.value);
    ElMessage.success("已复制到剪贴板");
  } catch (err) {
    ElMessage.error("复制失败");
  }
};
</script>

<style lang="scss" scoped>
.workspace-artifact-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--mio-bg-page, #ffffff);
}

.artifact-header {
  height: 2.25rem;
  padding: 0 1rem;
  background: var(--mio-bg-surface, #ffffff);
  border-bottom: 1px solid var(--mio-border-color-light, #e4e7ed);
  display: flex;
  align-items: center;
  justify-content: space-between;

  .artifact-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--mio-text-primary, #303133);
  }

  .artifact-actions {
    display: flex;
    align-items: center;

    .action-btn {
      background: transparent;
      border: none;
      color: var(--mio-text-secondary, #909399);
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.25rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: var(--mio-bg-hover, rgba(0, 0, 0, 0.05));
        color: var(--mio-text-primary, #303133);
      }
    }
  }
}

.artifact-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}
</style>
