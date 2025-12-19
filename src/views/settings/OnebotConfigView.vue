<template>
  <div class="onebot-config-view">
    <div class="page-header">
      <h1>OneBot 配置</h1>
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



    <el-card>
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="160px"
        label-position="left"
      >
        <el-form-item label="启用 OneBot" prop="enable">
          <el-switch
            v-model="formData.enable"
            active-text="启用"
            inactive-text="禁用"
          />
          <template #extra>
            <span class="form-item-tip">
              是否启用 OneBot 协议支持（QQ 机器人）
            </span>
          </template>
        </el-form-item>

        <el-divider content-position="left">连接配置</el-divider>

        <el-form-item label="反向 WebSocket URL" prop="reverse_ws_url">
          <el-input
            v-model="formData.reverse_ws_url"
            placeholder="ws://localhost:8080/onebot/v11/ws"
            style="width: 500px"
            :disabled="!formData.enable"
          />
          <template #extra>
            <span class="form-item-tip">
              OneBot 实现端的反向 WebSocket 地址（如 go-cqhttp）
            </span>
          </template>
        </el-form-item>

        <el-form-item label="Access Token" prop="token">
          <el-input
            v-model="formData.token"
            :type="showToken ? 'text' : 'password'"
            placeholder="留空则不使用 token 验证"
            maxlength="100"
            show-word-limit
            style="width: 500px"
            :disabled="!formData.enable"
          >
            <template #append>
              <el-button
                :icon="showToken ? View : Hide"
                @click="showToken = !showToken"
              />
            </template>
          </el-input>
          <template #extra>
            <span class="form-item-tip">
              与 OneBot 实现端配置的 access_token 保持一致
            </span>
          </template>
        </el-form-item>

        <el-divider content-position="left">机器人配置</el-divider>

        <el-form-item label="机器人 QQ 号" prop="bot_qq">
          <el-input
            v-model="formData.bot_qq"
            placeholder="2698788044"
            maxlength="20"
            style="width: 300px"
            :disabled="!formData.enable"
          />
          <template #extra>
            <span class="form-item-tip">
              接入的 QQ 机器人账号
            </span>
          </template>
        </el-form-item>

        <el-form-item label="管理员 QQ 号" prop="admin_qq">
          <el-input
            v-model="formData.admin_qq"
            placeholder="1099834705"
            maxlength="20"
            style="width: 300px"
            :disabled="!formData.enable"
          />
          <template #extra>
            <span class="form-item-tip">
              机器人管理员的 QQ 号，拥有特殊权限
            </span>
          </template>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 连接状态 -->
    <el-card style="margin-top: 16px;">
      <template #header>
        <div class="card-header">
          <span>连接状态</span>
        </div>
      </template>
      <el-alert
        :type="formData.enable ? 'info' : 'warning'"
        :closable="false"
        show-icon
      >
        <template #title>
          {{ formData.enable ? '连接状态监控功能需要后端支持，暂未实现' : 'OneBot 协议已禁用' }}
        </template>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup>
import { useConfigStore } from '@/stores/configStore.js';
import { Hide, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';

const configStore = useConfigStore();
const formRef = ref(null);
const saving = ref(false);
const showToken = ref(false);

// 表单数据
const formData = reactive({
  enable: false,
  reverse_ws_url: '',
  token: '',
  bot_qq: '',
  admin_qq: ''
});

// 原始数据（用于重置）
const originalData = reactive({});

// 验证规则
const rules = {
  reverse_ws_url: [
    {
      validator: (rule, value, callback) => {
        if (formData.enable && !value) {
          callback(new Error('启用 OneBot 时必须输入反向 WebSocket URL'));
        } else if (value && !value.startsWith('ws://') && !value.startsWith('wss://')) {
          callback(new Error('URL 必须以 ws:// 或 wss:// 开头'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ],
  bot_qq: [
    {
      validator: (rule, value, callback) => {
        if (formData.enable && !value) {
          callback(new Error('启用 OneBot 时必须输入机器人 QQ 号'));
        } else if (value && !/^\d+$/.test(value)) {
          callback(new Error('QQ 号必须为纯数字'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ],
  admin_qq: [
    {
      validator: (rule, value, callback) => {
        if (value && !/^\d+$/.test(value)) {
          callback(new Error('QQ 号必须为纯数字'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
};

// 加载配置
const loadConfig = async () => {
  try {
    // 使用新的 OneBot API 接口获取配置
    const onebotConfig = configStore.config?.onebot || await configStore.fetchConfigSection('onebot');
    
    Object.assign(formData, {
      enable: onebotConfig.enable ?? false,
      reverse_ws_url: onebotConfig.reverse_ws_url || '',
      token: onebotConfig.token || '',
      bot_qq: onebotConfig.bot_qq || '',
      admin_qq: onebotConfig.admin_qq || ''
    });
    
    // 保存原始数据
    Object.assign(originalData, formData);
  } catch (error) {
    ElMessage.error('加载 OneBot 配置失败：' + error.message);
  }
};

// 保存配置
const handleSave = async () => {
  try {
    await formRef.value.validate();
    


    saving.value = true;

    await configStore.updateConfigSection('onebot', {
      enable: formData.enable,
      reverse_ws_url: formData.reverse_ws_url,
      token: formData.token,
      bot_qq: formData.bot_qq,
      admin_qq: formData.admin_qq
    });

    ElMessage.success('OneBot 配置保存成功');
    
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
.onebot-config-view {
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

.card-header {
  font-weight: 600;
  color: #303133;
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

:deep(.el-divider) {
  margin: 24px 0 16px 0;
}

:deep(.el-divider__text) {
  font-weight: 600;
  color: #606266;
}

// 禁用状态的输入框样式
:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: #f5f7fa;
  border-color: #e4e7ed;
  color: #c0c4cc;
}

:deep(.el-input.is-disabled .el-input__inner) {
  color: #c0c4cc;
  cursor: not-allowed;
}
</style>
