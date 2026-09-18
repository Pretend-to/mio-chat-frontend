<template>
  <div class="workspace-file-tab">
    <div class="file-header">
      <div class="file-meta">
        <span class="file-icon">📄</span>
        <span class="file-path">{{ filePath }}</span>
      </div>
      <div class="file-actions">
        <button class="action-btn" title="复制内容" @click="handleCopy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        </button>
      </div>
    </div>
    <div class="file-content-viewport">
      <MdRenderer
        :md="markdownCodeBlock"
        :customPlugins="customPlugins"
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
import { codeBlockPlugin } from "mio-previewer/plugins/custom";

const props = defineProps({
  tab: {
    type: Object,
    required: true,
  },
});

const customPlugins = [{ plugin: codeBlockPlugin }];

const filePath = computed(() => {
  return props.tab.payload?.path || props.tab.title || "File";
});

const fileExtension = computed(() => {
  const parts = filePath.value.split(".");
  return parts.length > 1 ? parts.pop() : "";
});

const fileRawContent = computed(() => {
  const p = props.tab.payload;
  if (!p) return "";
  if (typeof p === "string") return p;
  return p.content || p.code || p.text || "";
});

const markdownCodeBlock = computed(() => {
  const lang = fileExtension.value || "";
  return `\`\`\`${lang}\n${fileRawContent.value}\n\`\`\``;
});

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(fileRawContent.value);
    ElMessage.success("已复制到剪贴板");
  } catch (err) {
    ElMessage.error("复制失败");
  }
};
</script>

<style lang="scss" scoped>
.workspace-file-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--mio-bg-page, #ffffff);
}

.file-header {
  height: 2.25rem;
  padding: 0 1rem;
  background: var(--mio-bg-surface, #ffffff);
  border-bottom: 1px solid var(--mio-border-color-light, #e4e7ed);
  display: flex;
  align-items: center;
  justify-content: space-between;

  .file-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--mio-text-primary, #303133);
  }

  .file-actions {
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

.file-content-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}
</style>
