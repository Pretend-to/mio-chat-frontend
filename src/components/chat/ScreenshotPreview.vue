<template>
  <!-- Image Preview for Desktop -->
  <el-dialog
    v-if="!isMobileDevice"
    :model-value="modelValue"
    title="分享预览"
    :width="exportWidthMode === 'wide' ? '890px' : '540px'"
    class="desktop-preview-dialog"
    @update:model-value="onClose"
  >
    <div class="preview-info-header">
      <div class="size-toggle-option">
        <span>图片尺寸：</span>
        <el-radio-group
          :model-value="exportWidthMode"
          size="small"
          @change="onWidthModeChange"
        >
          <el-radio-button value="narrow">竖屏窄图 (500px)</el-radio-button>
          <el-radio-button value="wide">宽屏模式 (850px)</el-radio-button>
        </el-radio-group>
      </div>
      <div class="size-toggle-hint">
        宽屏模式更适合包含长代码、表格或大图的聊天记录
      </div>
    </div>
    <div v-loading="generatingImage" class="preview-scroll-container">
      <img
        v-if="previewImageUrl"
        :src="previewImageUrl"
        class="preview-image"
        alt="图片预览"
      />
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="onClose">取消</el-button>
        <el-button
          :disabled="generatingImage || !previewImageUrl"
          @click="$emit('copy')"
          >复制到剪贴板</el-button
        >
        <el-button
          :disabled="generatingImage || !previewImageUrl"
          type="primary"
          @click="$emit('download')"
          >下载图片</el-button
        >
      </span>
    </template>
  </el-dialog>

  <!-- Image Preview for Mobile -->
  <el-drawer
    v-if="isMobileDevice"
    :model-value="modelValue"
    direction="btt"
    size="100%"
    :with-header="false"
    class="mobile-preview-drawer"
    @update:model-value="onClose"
  >
    <div class="mobile-preview-container">
      <div class="mobile-preview-header">
        <span class="mobile-back-btn" @click="onClose">
          <i class="iconfont icon-return"></i> 返回
        </span>
        <span class="mobile-header-title">分享预览</span>
        <span style="width: 40px"></span>
      </div>

      <!-- Width Mode Toggle for Mobile -->
      <div class="mobile-width-toggle">
        <el-radio-group
          :model-value="exportWidthMode"
          size="default"
          @change="onWidthModeChange"
        >
          <el-radio-button value="narrow">竖屏窄图</el-radio-button>
          <el-radio-button value="wide">宽屏模式</el-radio-button>
        </el-radio-group>
      </div>

      <div
        v-loading="generatingImage"
        class="preview-scroll-container mobile-preview-scroll-container"
      >
        <img
          v-if="previewImageUrl"
          :src="previewImageUrl"
          class="preview-image"
          alt="分享预览图"
        />
      </div>
      <div class="mobile-preview-footer">
        <el-button
          @click="$emit('share-link')"
          size="large"
          style="flex: 1; border-radius: 12px; font-weight: bold"
          >分享链接</el-button
        >
        <el-button
          :disabled="generatingImage || !previewImageUrl"
          type="primary"
          @click="$emit('download')"
          size="large"
          style="flex: 1; border-radius: 12px; font-weight: bold"
          >保存图片</el-button
        >
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  generatingImage: {
    type: Boolean,
    default: false,
  },
  previewImageUrl: {
    type: String,
    default: "",
  },
  qrUrl: {
    type: String,
    default: "",
  },
  previewShareUrl: {
    type: String,
    default: "",
  },
  exportWidthMode: {
    type: String,
    default: "narrow",
  },
  isMobileDevice: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update:modelValue",
  "update:exportWidthMode",
  "width-mode-change",
  "copy",
  "download",
  "share-link",
  "close",
]);

const onClose = (val) => {
  const isClosed = typeof val === "boolean" ? val : false;
  emit("update:modelValue", isClosed);
  if (!isClosed) {
    emit("close");
  }
};

const onWidthModeChange = (val) => {
  emit("update:exportWidthMode", val);
  emit("width-mode-change", val);
};
</script>

<style scoped>
.preview-info-header {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--mio-bg-page);
  padding: 12px 16px;
  border-radius: var(--mio-border-radius-base);
  border: 1px solid var(--mio-border-color-light);
  flex-wrap: wrap;
  gap: 8px;
}

.size-toggle-option {
  font-size: 14px;
  color: var(--mio-text-regular);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.size-toggle-hint {
  font-size: 12px;
  color: var(--mio-text-secondary);
  font-weight: 400;
}

.preview-scroll-container {
  max-height: 55vh;
  min-height: 200px;
  width: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  text-align: center;
  background: var(--mio-bg-chat-window);
  padding: 20px;
  border-radius: var(--mio-border-radius-base);
  position: relative;
}

.preview-image {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  box-shadow: var(--mio-shadow-light);
  border-radius: 12px;
}

.mobile-preview-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--mio-bg-chat-window);
}

.mobile-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: var(--mio-bg-card);
  border-bottom: 1px solid var(--mio-border-color-light);
}

.mobile-back-btn {
  font-size: 16px;
  color: var(--mio-text-regular);
  cursor: pointer;
}

.mobile-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--mio-text-primary);
}

.mobile-width-toggle {
  padding: 10px 20px;
  background-color: var(--mio-bg-card);
  border-bottom: 1px solid var(--mio-border-color-lighter);
  display: flex;
  justify-content: center;
}

.mobile-preview-scroll-container {
  flex: 1;
  max-height: none;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
  position: relative;
}

.mobile-preview-scroll-container .preview-image {
  width: 100%;
  border-radius: 12px;
  box-shadow: var(--mio-shadow-light);
}

.mobile-preview-footer {
  padding: 20px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  background: transparent;
  border: none;
  display: flex;
  gap: 12px;
}
</style>
