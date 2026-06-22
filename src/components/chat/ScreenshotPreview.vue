<template>
  <!-- Image Preview for Desktop -->
  <el-dialog
    v-if="!isMobileDevice"
    :model-value="modelValue"
    title="分享预览"
    :width="exportWidthMode === 'wide' ? '890px' : '540px'"
    class="desktop-preview-dialog"
    append-to-body
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
        <el-checkbox
          :model-value="showQRCode"
          style="margin-left: 20px"
          @change="onQRCodeChange"
          >显示分享二维码</el-checkbox
        >
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
    append-to-body
    @update:model-value="onClose"
  >
    <div class="mobile-preview-container">
      <!-- Unified Premium Mobile Header -->
      <div class="mobile-preview-header-wrap">
        <div class="mobile-preview-header">
          <span class="mobile-back-btn" @click="onClose">
            <i class="iconfont icon-return"></i> 返回
          </span>
          <span class="mobile-header-title">分享预览</span>
          <span style="width: 40px"></span>
        </div>

        <div class="mobile-controls-row">
          <el-radio-group
            :model-value="exportWidthMode"
            size="small"
            @change="onWidthModeChange"
            class="mobile-width-radio-group"
          >
            <el-radio-button value="narrow">竖屏窄图</el-radio-button>
            <el-radio-button value="wide">宽屏模式</el-radio-button>
          </el-radio-group>

          <div class="mobile-qr-checkbox-wrapper">
            <el-checkbox
              :model-value="showQRCode"
              size="small"
              @change="onQRCodeChange"
              >显示二维码</el-checkbox
            >
          </div>
        </div>
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
  showQRCode: {
    type: Boolean,
    default: true,
  },
  isMobileDevice: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update:modelValue",
  "update:exportWidthMode",
  "update:showQRCode",
  "width-mode-change",
  "qr-code-change",
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

const onQRCodeChange = (val) => {
  emit("update:showQRCode", val);
  emit("qr-code-change", val);
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

.mobile-preview-header-wrap {
  background: var(--mio-bg-card);
  border-bottom: 1px solid var(--mio-border-color-light);
  display: flex;
  flex-direction: column;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.mobile-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px 8px 20px;
}

.mobile-back-btn {
  font-size: 15px;
  font-weight: 500;
  color: var(--mio-text-regular);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.2s;
}

.mobile-back-btn:active {
  opacity: 0.6;
}

.mobile-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--mio-text-primary);
  letter-spacing: 0.5px;
}

.mobile-controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 20px 12px 20px;
  gap: 16px;
}

.mobile-width-radio-group {
  flex: 1;
  display: flex;
}

.mobile-width-radio-group :deep(.el-radio-button) {
  flex: 1;
}

.mobile-width-radio-group :deep(.el-radio-button__inner) {
  width: 100%;
  text-align: center;
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 8px;
}

.mobile-qr-checkbox-wrapper {
  display: flex;
  align-items: center;
}

.mobile-qr-checkbox-wrapper :deep(.el-checkbox__label) {
  font-size: 12px;
  padding-left: 6px;
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
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0px));
  background: var(--mio-bg-card);
  border-top: 1px solid var(--mio-border-color-light);
  display: flex;
  gap: 12px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.05);
}

:global(.mobile-preview-drawer) {
  height: 100vh !important;
  height: 100dvh !important;
  top: 0 !important;
  bottom: auto !important;
}

:global(.mobile-preview-drawer .el-drawer__body) {
  padding: 0 !important;
  overflow: hidden !important;
  height: 100% !important;
}
</style>
