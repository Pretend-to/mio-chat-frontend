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
    <div
      style="
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: #f8fafc;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        flex-wrap: wrap;
        gap: 8px;
      "
    >
      <div
        style="
          font-size: 14px;
          color: #475569;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
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
      <div style="font-size: 12px; color: #94a3b8; font-weight: 400">
        宽屏模式更适合包含长代码、表格或大图的聊天记录
      </div>
    </div>
    <div
      v-loading="generatingImage"
      class="preview-scroll-container"
      style="
        max-height: 55vh;
        min-height: 200px;
        width: 100%;
        box-sizing: border-box;
        overflow-y: auto;
        text-align: center;
        background: #f2f2f2;
        padding: 20px;
        border-radius: 8px;
        position: relative;
      "
    >
      <img
        v-if="previewImageUrl"
        :src="previewImageUrl"
        class="preview-image"
        alt="图片预览"
        style="
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border-radius: 12px;
        "
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
    <div
      style="
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #f2f2f2;
      "
    >
      <div
        class="mobile-preview-header"
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background-color: #fff;
          border-bottom: 1px solid #ebeef5;
        "
      >
        <span
          @click="onClose"
          style="font-size: 16px; color: #606266; cursor: pointer"
          ><i class="iconfont icon-return"></i> 返回</span
        >
        <span class="title" style="font-size: 16px; font-weight: 600"
          >分享预览</span
        >
        <span style="width: 40px"></span>
      </div>

      <!-- Width Mode Toggle for Mobile -->
      <div
        style="
          padding: 10px 20px;
          background-color: #fff;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: center;
        "
      >
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
        class="preview-scroll-container"
        style="
          flex: 1;
          max-height: none;
          padding: 20px;
          box-sizing: border-box;
          overflow-y: auto;
          position: relative;
        "
      >
        <img
          v-if="previewImageUrl"
          :src="previewImageUrl"
          class="preview-image"
          alt="分享预览图"
          style="
            width: 100%;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          "
        />
      </div>
      <div
        class="mobile-preview-footer"
        style="
          padding: 20px;
          background: transparent;
          border: none;
          display: flex;
          gap: 12px;
        "
      >
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
