<template>
  <div class="server-config-view">
    <div class="page-header">
      <h1>服务器配置</h1>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="handleSave"
        >
          保存配置
        </el-button>
      </div>
    </div>

    <el-alert
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 24px;"
    >
      <template #title>
        修改服务器配置需要重启服务才能生效
      </template>
    </el-alert>

    <el-card>
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="140px"
        label-position="left"
      >
        <el-form-item label="服务器端口" prop="port">
          <el-input-number
            v-model="formData.port"
            :min="1"
            :max="65535"
            :step="1"
            controls-position="right"
            style="width: 200px"
          />
          <template #extra>
            <span class="form-item-tip">
              服务器监听端口，范围：1-65535，默认 3080
            </span>
          </template>
        </el-form-item>

        <el-form-item label="服务器主机" prop="host">
          <el-input
            v-model="formData.host"
            placeholder="0.0.0.0"
            style="width: 300px"
          />
          <template #extra>
            <span class="form-item-tip">
              服务器绑定的主机地址，0.0.0.0 表示监听所有网卡
            </span>
          </template>
        </el-form-item>

        <el-form-item label="最大请求频率" prop="max_rate_pre_min">
          <el-input-number
            v-model="formData.max_rate_pre_min"
            :min="1"
            :max="10000"
            :step="10"
            controls-position="right"
            style="width: 200px"
          />
          <span style="margin-left: 12px; color: #909399;">次/分钟</span>
          <template #extra>
            <span class="form-item-tip">
              每个客户端每分钟允许的最大请求次数，用于限流保护
            </span>
          </template>
        </el-form-item>

        <el-divider />

        <el-form-item label="调试模式" prop="debug">
          <el-switch
            v-model="formData.debug"
            active-text="开启"
            inactive-text="关闭"
          />
          <template #extra>
            <span class="form-item-tip">
              开启后将输出详细的调试信息，生产环境建议关闭
            </span>
          </template>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useConfigStore } from '@/stores/configStore.js';

const configStore = useConfigStore();
const formRef = ref(null);
const saving = ref(false);

// 表单数据
const formData = reactive({
  port: 3080,
  host: '0.0.0.0',
  max_rate_pre_min: 100,
  debug: false
});

// 原始数据（用于重置）
const originalData = reactive({});

// 验证规则
const rules = {
  port: [
    { required: true, message: '请输入服务器端口', trigger: 'blur' },
    {
      type: 'number',
      min: 1,
      max: 65535,
      message: '端口范围必须在 1-65535 之间',
      trigger: 'blur'
    }
  ],
  host: [
    { required: true, message: '请输入服务器主机', trigger: 'blur' }
  ],
  max_rate_pre_min: [
    { required: true, message: '请输入最大请求频率', trigger: 'blur' },
    {
      type: 'number',
      min: 1,
      message: '最大请求频率必须大于 0',
      trigger: 'blur'
    }
  ]
};

// 加载配置
const loadConfig = async () => {
  try {
    const serverConfig = configStore.config?.server || await configStore.fetchConfigSection('server');
    const debugConfig = configStore.config?.debug ?? false;
    
    Object.assign(formData, {
      port: serverConfig.port || 3080,
      host: serverConfig.host || '0.0.0.0',
      max_rate_pre_min: serverConfig.max_rate_pre_min || 100,
      debug: debugConfig
    });
    
    // 保存原始数据
    Object.assign(originalData, formData);
  } catch (error) {
    ElMessage.error('加载配置失败：' + error.message);
  }
};

// 保存配置
const handleSave = async () => {
  try {
    await formRef.value.validate();
    
    await ElMessageBox.confirm(
      '修改服务器配置需要重启服务才能生效，是否继续？',
      '确认保存',
      {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    saving.value = true;

    // 更新 server 配置节点
    await configStore.updateConfigSection('server', {
      port: formData.port,
      host: formData.host,
      max_rate_pre_min: formData.max_rate_pre_min
    });

    // 更新 debug 配置（在根节点）
    if (configStore.config) {
      configStore.config.debug = formData.debug;
    }

    ElMessage.success('配置保存成功，请重启服务使配置生效');
    
    // 更新原始数据
    Object.assign(originalData, formData);
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('保存失败：' + error.message);
    }
  } finally {
    saving.value = false;
  }
};

// 重置配置
const handleReset = () => {
  Object.assign(formData, originalData);
  formRef.value?.clearValidate();
  ElMessage.info('已重置为当前保存的配置');
};

// 初始化
onMounted(async () => {
  if (!configStore.config) {
    await configStore.fetchConfig();
  }
  await loadConfig();
});
</script>

<style scoped lang="scss">
.server-config-view {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #303133;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.form-item-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

:deep(.el-form-item) {
  margin-bottom: 28px;
}

:deep(.el-form-item__extra) {
  margin-top: 4px;
}
</style>
