<template>
  <el-dialog
    :model-value="visible"
    title="裁剪头像"
    width="600px"
    :before-close="handleClose"
    destroy-on-close
    class="cropper-dialog"
  >
    <div class="cropper-container">
      <div class="cropper-main">
        <!-- 裁剪区域 -->
        <div class="crop-area" ref="cropAreaRef">
          <img
            ref="imageRef"
            :src="imageSrc"
            class="crop-image"
            @load="initCropper"
          />
          <!-- 裁剪框 -->
          <div
            class="crop-box"
            :style="cropBoxStyle"
            @mousedown="startDrag"
            @touchstart.passive="startDrag"
          >
            <div class="crop-overlay"></div>
            <!-- 调整手柄 -->
            <div
              class="resize-handle nw"
              @mousedown.stop="startResize('nw')"
              @touchstart.stop.passive="startResize('nw')"
            ></div>
            <div
              class="resize-handle ne"
              @mousedown.stop="startResize('ne')"
              @touchstart.stop.passive="startResize('ne')"
            ></div>
            <div
              class="resize-handle sw"
              @mousedown.stop="startResize('sw')"
              @touchstart.stop.passive="startResize('sw')"
            ></div>
            <div
              class="resize-handle se"
              @mousedown.stop="startResize('se')"
              @touchstart.stop.passive="startResize('se')"
            ></div>
          </div>
        </div>

        <!-- 预览区域 -->
        <div class="preview-area">
          <div class="preview-title">预览</div>
          <div class="preview-container">
            <canvas
              ref="previewCanvasRef"
              class="preview-canvas"
              width="120"
              height="120"
            ></canvas>
          </div>
          <div class="preview-size">120 × 120</div>
        </div>
      </div>

      <!-- 操作提示 -->
      <div class="cropper-tips">
        <el-text type="info" size="small">
          拖拽裁剪框调整位置，拖拽四角调整大小
        </el-text>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleConfirm">确认裁剪</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  imageSrc: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['close', 'confirm']);

// 引用
const cropAreaRef = ref(null);
const imageRef = ref(null);
const previewCanvasRef = ref(null);

// 裁剪数据
const cropData = reactive({
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  containerWidth: 0,
  containerHeight: 0,
  renderedWidth: 0,
  renderedHeight: 0,
  offsetX: 0,
  offsetY: 0
});

// 拖拽状态
const dragState = reactive({
  isDragging: false,
  isResizing: false,
  resizeType: '',
  startX: 0,
  startY: 0,
  startCropX: 0,
  startCropY: 0,
  startCropWidth: 0,
  startCropHeight: 0
});

// 裁剪框样式
const cropBoxStyle = ref({
  left: '0px',
  top: '0px',
  width: '200px',
  height: '200px'
});

// 初始化裁剪器
const initCropper = () => {
  nextTick(() => {
    if (!imageRef.value || !cropAreaRef.value) return;

    const image = imageRef.value;
    const container = cropAreaRef.value;

    // 获取图片和容器尺寸
    const imageWidth = image.naturalWidth;
    const imageHeight = image.naturalHeight;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    cropData.imageWidth = imageWidth;
    cropData.imageHeight = imageHeight;
    cropData.containerWidth = containerWidth;
    cropData.containerHeight = containerHeight;

    // 计算 object-fit: contain 下图片的实际渲染尺寸和偏移
    const containerRatio = containerWidth / containerHeight;
    const imageRatio = imageWidth / imageHeight;

    if (imageRatio > containerRatio) {
      // 图片更宽，宽度撑满
      cropData.renderedWidth = containerWidth;
      cropData.renderedHeight = containerWidth / imageRatio;
      cropData.offsetX = 0;
      cropData.offsetY = (containerHeight - cropData.renderedHeight) / 2;
    } else {
      // 图片更高，高度撑满
      cropData.renderedHeight = containerHeight;
      cropData.renderedWidth = containerHeight * imageRatio;
      cropData.offsetY = 0;
      cropData.offsetX = (containerWidth - cropData.renderedWidth) / 2;
    }

    // 计算初始裁剪框大小和位置
    const minSize = Math.min(cropData.renderedWidth, cropData.renderedHeight);
    const initialSize = Math.min(minSize * 0.8, 200);

    cropData.width = initialSize;
    cropData.height = initialSize;
    cropData.x = cropData.offsetX + (cropData.renderedWidth - initialSize) / 2;
    cropData.y = cropData.offsetY + (cropData.renderedHeight - initialSize) / 2;

    updateCropBoxStyle();
    updatePreview();
  });
};

// 更新裁剪框样式
const updateCropBoxStyle = () => {
  cropBoxStyle.value = {
    left: cropData.x + 'px',
    top: cropData.y + 'px',
    width: cropData.width + 'px',
    height: cropData.height + 'px'
  };
};

// 更新预览
const updatePreview = () => {
  if (!imageRef.value || !previewCanvasRef.value) return;

  const canvas = previewCanvasRef.value;
  const ctx = canvas.getContext('2d');
  const image = imageRef.value;

  // 计算裁剪区域在原图中的位置
  const scale = cropData.imageWidth / cropData.renderedWidth;

  const sourceX = (cropData.x - cropData.offsetX) * scale;
  const sourceY = (cropData.y - cropData.offsetY) * scale;
  const sourceWidth = cropData.width * scale;
  const sourceHeight = cropData.height * scale;

  // 清空画布
  ctx.clearRect(0, 0, 120, 120);

  // 绘制圆形裁剪路径
  ctx.save();
  ctx.beginPath();
  ctx.arc(60, 60, 60, 0, Math.PI * 2);
  ctx.clip();

  // 绘制裁剪后的图片
  ctx.drawImage(
    image,
    sourceX, sourceY, sourceWidth, sourceHeight,
    0, 0, 120, 120
  );

  ctx.restore();
};

// 获取事件坐标
const getEventPos = (e) => {
  if (e.touches && e.touches.length > 0) {
    return {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }
  return {
    x: e.clientX,
    y: e.clientY
  };
};

// 开始拖拽
const startDrag = (e) => {
  if (dragState.isResizing) return;

  dragState.isDragging = true;
  const pos = getEventPos(e);
  dragState.startX = pos.x;
  dragState.startY = pos.y;
  dragState.startCropX = cropData.x;
  dragState.startCropY = cropData.y;

  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchmove', handleDrag, { passive: false });
  document.addEventListener('touchend', stopDrag);

  if (e.type === 'mousedown') {
    e.preventDefault();
  }
};

// 处理拖拽
const handleDrag = (e) => {
  if (!dragState.isDragging) return;

  // 阻止移动端滚动
  if (e.type === 'touchmove') {
    e.preventDefault();
  }

  const pos = getEventPos(e);
  const deltaX = pos.x - dragState.startX;
  const deltaY = pos.y - dragState.startY;

  let newX = dragState.startCropX + deltaX;
  let newY = dragState.startCropY + deltaY;

  // 边界限制
  newX = Math.max(cropData.offsetX, Math.min(newX, cropData.offsetX + cropData.renderedWidth - cropData.width));
  newY = Math.max(cropData.offsetY, Math.min(newY, cropData.offsetY + cropData.renderedHeight - cropData.height));

  cropData.x = newX;
  cropData.y = newY;

  updateCropBoxStyle();
  updatePreview();
};

// 停止拖拽
const stopDrag = () => {
  dragState.isDragging = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', handleDrag);
  document.removeEventListener('touchend', stopDrag);
};

// 开始调整大小
const startResize = (type) => {
  const e = event;
  dragState.isResizing = true;
  dragState.resizeType = type;
  const pos = getEventPos(e);
  dragState.startX = pos.x;
  dragState.startY = pos.y;
  dragState.startCropX = cropData.x;
  dragState.startCropY = cropData.y;
  dragState.startCropWidth = cropData.width;
  dragState.startCropHeight = cropData.height;

  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  document.addEventListener('touchmove', handleResize, { passive: false });
  document.addEventListener('touchend', stopResize);

  if (e.type === 'mousedown') {
    e.preventDefault();
  }
};

// 处理调整大小
const handleResize = (e) => {
  if (!dragState.isResizing) return;

  // 阻止移动端滚动
  if (e.type === 'touchmove') {
    e.preventDefault();
  }

  const pos = getEventPos(e);
  const deltaX = pos.x - dragState.startX;
  const deltaY = pos.y - dragState.startY;

  let newX = dragState.startCropX;
  let newY = dragState.startCropY;
  let newWidth = dragState.startCropWidth;
  let newHeight = dragState.startCropHeight;

  // 根据调整类型计算新的位置和大小
  switch (dragState.resizeType) {
    case 'nw': // 左上角
      newX = dragState.startCropX + deltaX;
      newY = dragState.startCropY + deltaY;
      newWidth = dragState.startCropWidth - deltaX;
      newHeight = dragState.startCropHeight - deltaY;
      break;
    case 'ne': // 右上角
      newY = dragState.startCropY + deltaY;
      newWidth = dragState.startCropWidth + deltaX;
      newHeight = dragState.startCropHeight - deltaY;
      break;
    case 'sw': // 左下角
      newX = dragState.startCropX + deltaX;
      newWidth = dragState.startCropWidth - deltaX;
      newHeight = dragState.startCropHeight + deltaY;
      break;
    case 'se': // 右下角
      newWidth = dragState.startCropWidth + deltaX;
      newHeight = dragState.startCropHeight + deltaY;
      break;
  }

  // 保持正方形比例
  const size = Math.min(newWidth, newHeight);
  newWidth = size;
  newHeight = size;

  // 最小尺寸限制
  const minSize = 50;
  if (newWidth < minSize || newHeight < minSize) return;

  // 边界限制
  if (newX < cropData.offsetX) {
    newWidth += (newX - cropData.offsetX);
    newHeight = newWidth;
    newX = cropData.offsetX;
  }
  if (newY < cropData.offsetY) {
    newHeight += (newY - cropData.offsetY);
    newWidth = newHeight;
    newY = cropData.offsetY;
  }
  if (newX + newWidth > cropData.offsetX + cropData.renderedWidth) {
    newWidth = cropData.offsetX + cropData.renderedWidth - newX;
    newHeight = newWidth;
  }
  if (newY + newHeight > cropData.offsetY + cropData.renderedHeight) {
    newHeight = cropData.offsetY + cropData.renderedHeight - newY;
    newWidth = newHeight;
  }

  cropData.x = newX;
  cropData.y = newY;
  cropData.width = newWidth;
  cropData.height = newHeight;

  updateCropBoxStyle();
  updatePreview();
};

// 停止调整大小
const stopResize = () => {
  dragState.isResizing = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.removeEventListener('touchmove', handleResize);
  document.removeEventListener('touchend', stopResize);
};

// 生成裁剪后的图片
const getCroppedImage = () => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const image = imageRef.value;

    // 设置输出尺寸
    const outputSize = 200;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // 计算裁剪区域在原图中的位置
    const scale = cropData.imageWidth / cropData.renderedWidth;

    const sourceX = (cropData.x - cropData.offsetX) * scale;
    const sourceY = (cropData.y - cropData.offsetY) * scale;
    const sourceWidth = cropData.width * scale;
    const sourceHeight = cropData.height * scale;

    // 绘制裁剪后的图片
    ctx.drawImage(
      image,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, outputSize, outputSize
    );

    // 转换为 Blob
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.9);
  });
};

// 监听图片源变化
watch(() => props.imageSrc, () => {
  if (props.visible && props.imageSrc) {
    nextTick(() => {
      initCropper();
    });
  }
});

// 处理关闭
const handleClose = () => {
  emit('close');
};

// 处理确认
const handleConfirm = async () => {
  const croppedBlob = await getCroppedImage();
  emit('confirm', croppedBlob);
};
</script>

<style scoped lang="scss">
.cropper-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cropper-main {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.crop-area {
  position: relative;
  width: 400px;
  height: 300px;
  max-width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #f5f7fa;
  touch-action: none;

  .crop-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .crop-box {
    position: absolute;
    border: 2px solid #409eff;
    cursor: move;
    user-select: none;

    .crop-overlay {
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      border: 2px dashed rgba(64, 158, 255, 0.5);
      background: rgba(64, 158, 255, 0.1);
    }

    .resize-handle {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #409eff;
      border: 1px solid #fff;
      border-radius: 50%;

      &.nw {
        top: -4px;
        left: -4px;
        cursor: nw-resize;
      }

      &.ne {
        top: -4px;
        right: -4px;
        cursor: ne-resize;
      }

      &.sw {
        bottom: -4px;
        left: -4px;
        cursor: sw-resize;
      }

      &.se {
        bottom: -4px;
        right: -4px;
        cursor: se-resize;
      }
    }
  }
}

.preview-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  .preview-title {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
  }

  .preview-container {
    width: 120px;
    height: 120px;
    border: 2px solid #dcdfe6;
    border-radius: 50%;
    overflow: hidden;
    background: #f5f7fa;

    .preview-canvas {
      display: block;
      border-radius: 50%;
    }
  }

  .preview-size {
    font-size: 12px;
    color: #909399;
  }
}

.cropper-tips {
  text-align: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

// 防止图片拖拽
.crop-image {
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
}
// 移动端适配
@media screen and (max-width: 768px) {
  .cropper-dialog {
    :deep(.el-dialog) {
      width: 95% !important;
      margin: 10px auto !important;
    }
  }

  .cropper-main {
    flex-direction: column;
    align-items: center;
  }

  .crop-area {
    width: 100%;
    height: 240px;
  }

  .preview-area {
    margin-top: 10px;
  }
}
</style>