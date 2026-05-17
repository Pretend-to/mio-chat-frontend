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
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 24px;"
    >
      <template #title>
        提示：修改服务器端口或绑定主机将触发系统自动重启；切换调试模式可实时热生效，无需重启。
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
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus';
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
    
    // 检查是否修改了需要重启的物理服务器参数（端口或绑定主机）
    const needsRestart = formData.port !== originalData.port || formData.host !== originalData.host;
    
    if (needsRestart) {
      await ElMessageBox.confirm(
        '修改服务器端口或绑定主机将触发服务器自动重启以绑定新端口，重启期间服务将暂时不可用。是否继续？',
        '确认保存并重启',
        {
          confirmButtonText: '保存并自动重启',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );
    }

    saving.value = true;
 
    // 更新 server 配置节点
    await configStore.updateConfigSection('server', {
      port: formData.port,
      host: formData.host,
      max_rate_pre_min: formData.max_rate_pre_min
    });

    // 更新 debug 配置节点，将其封装为对象以符合 Express body-parser strict 规范
    await configStore.updateConfigSection('debug', { debug: formData.debug });

    if (needsRestart) {
      ElMessageBox.alert(
        `配置已成功保存！后端服务正在自动重启并绑定到新地址 <strong>${formData.host}:${formData.port}</strong>。<br/><br/>` +
        `⚠️ <strong>物理端口/主机已更改，请注意：</strong><br/>` +
        `1. <strong>如果是本地开发：</strong>你需要同步更新前端代码的 <code>vite.config.js</code> 或环境变量中的代理端口（Proxy Port）并重启前端 dev 服务，否则无法继续发起 API 请求。<br/>` +
        `2. <strong>如果是生产环境：</strong>请确保你的反向代理服务（如 Nginx、Caddy）已同步更新配置指向新端口。<br/><br/>` +
        `请在调整完相关代理/代理配置后，手动刷新页面访问。`,
        '服务已发起重启',
        {
          confirmButtonText: '我知道了',
          dangerouslyUseHTMLString: true,
          type: 'success'
        }
      );
    } else {
      ElMessage.success('配置保存成功！调试模式已实时生效，无需重启服务');
    }
    
    // 更新原始数据
    Object.assign(originalData, formData);
  } catch (error) {
    if (error !== 'cancel') {
      console.error('保存服务器配置失败:', error);
      ElMessage.error('服务器配置保存失败，请查看控制台详情');
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
