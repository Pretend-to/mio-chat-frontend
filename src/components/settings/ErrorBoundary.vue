<template>
  <div class="error-boundary">
    <div v-if="hasError" class="error-container">
      <el-result
        icon="error"
        :title="errorTitle"
        :sub-title="errorMessage"
      >
        <template #extra>
          <el-space>
            <el-button type="primary" @click="handleReload">
              重新加载
            </el-button>
            <el-button @click="handleGoBack">
              返回
            </el-button>
            <el-button v-if="showDetails" text @click="detailsVisible = !detailsVisible">
              {{ detailsVisible ? '隐藏' : '查看' }}详细信息
            </el-button>
          </el-space>
        </template>
      </el-result>

      <el-collapse-transition>
        <div v-show="detailsVisible && errorStack" class="error-details">
          <el-card>
            <template #header>
              <span>错误详情</span>
            </template>
            <pre>{{ errorStack }}</pre>
          </el-card>
        </div>
      </el-collapse-transition>
    </div>

    <slot v-else></slot>
  </div>
</template>

<script setup>
import { onErrorCaptured, ref } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
  fallbackTitle: {
    type: String,
    default: '出现错误'
  },
  fallbackMessage: {
    type: String,
    default: '加载此页面时发生错误，请稍后重试'
  },
  showDetails: {
    type: Boolean,
    default: true
  },
  onError: {
    type: Function,
    default: null
  }
});

const router = useRouter();

const hasError = ref(false);
const errorTitle = ref('');
const errorMessage = ref('');
const errorStack = ref('');
const detailsVisible = ref(false);

onErrorCaptured((error, instance, info) => {
  hasError.value = true;
  
  // 设置错误信息
  errorTitle.value = props.fallbackTitle;
  errorMessage.value = error.message || props.fallbackMessage;
  errorStack.value = error.stack || '';

  // 调用自定义错误处理
  if (props.onError) {
    props.onError(error, instance, info);
  }

  // 记录到控制台
  console.error('ErrorBoundary caught error:', error);
  console.error('Error info:', info);

  // 阻止错误继续向上传播
  return false;
});

const handleReload = () => {
  hasError.value = false;
  errorTitle.value = '';
  errorMessage.value = '';
  errorStack.value = '';
  detailsVisible.value = false;
  
  // 重新加载当前路由
  router.go(0);
};

const handleGoBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/settings');
  }
};
</script>

<style scoped lang="scss">
.error-boundary {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 40px 20px;
}

.error-details {
  width: 100%;
  max-width: 800px;
  margin-top: 24px;

  pre {
    margin: 0;
    padding: 16px;
    background-color: #f5f7fa;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    color: #606266;
  }
}
</style>
