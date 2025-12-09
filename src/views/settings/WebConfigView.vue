<template>
  <div class="web-config-view">
    <div class="page-header">
      <h1>Web 配置</h1>
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
        修改 Web 配置需要重启服务才能生效
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
        <el-form-item label="网站标题" prop="title">
          <el-input
            v-model="formData.title"
            placeholder="MioChat"
            maxlength="50"
            show-word-limit
            style="width: 400px"
          />
          <template #extra>
            <span class="form-item-tip">
              显示在浏览器标签页和页面顶部的标题
            </span>
          </template>
        </el-form-item>

        <el-form-item label="备案号" prop="beian">
          <el-input
            v-model="formData.beian"
            placeholder="留空则不显示"
            maxlength="100"
            show-word-limit
            style="width: 400px"
          />
          <template #extra>
            <span class="form-item-tip">
              网站底部显示的备案信息，如：京ICP备12345678号
            </span>
          </template>
        </el-form-item>

        <el-divider />

        <el-form-item label="管理员验证码" prop="admin_code">
          <el-input
            v-model="formData.admin_code"
            :type="showAdminCode ? 'text' : 'password'"
            placeholder="用于访问配置管理"
            maxlength="50"
            show-word-limit
            style="width: 400px"
          >
            <template #append>
              <el-button
                :icon="showAdminCode ? View : Hide"
                @click="showAdminCode = !showAdminCode"
              />
            </template>
          </el-input>
          <template #extra>
            <span class="form-item-tip">
              访问配置管理页面所需的验证码，请妥善保管
            </span>
          </template>
        </el-form-item>

        <el-form-item label="访客验证码" prop="user_code">
          <el-input
            v-model="formData.user_code"
            :type="showUserCode ? 'text' : 'password'"
            placeholder="留空则不需要验证码"
            maxlength="50"
            show-word-limit
            style="width: 400px"
          >
            <template #append>
              <el-button
                :icon="showUserCode ? View : Hide"
                @click="showUserCode = !showUserCode"
              />
            </template>
          </el-input>
          <template #extra>
            <span class="form-item-tip">
              访客访问聊天功能所需的验证码，留空则无需验证
            </span>
          </template>
        </el-form-item>

        <el-divider />

        <el-form-item label="全屏模式" prop="full_screen">
          <el-switch
            v-model="formData.full_screen"
            active-text="开启"
            inactive-text="关闭"
          />
          <template #extra>
            <span class="form-item-tip">
              开启后界面将占据整个浏览器窗口
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
import { View, Hide } from '@element-plus/icons-vue';
import { useConfigStore } from '@/stores/configStore.js';

const configStore = useConfigStore();
const formRef = ref(null);
const saving = ref(false);
const showAdminCode = ref(false);
const showUserCode = ref(false);

// 表单数据
const formData = reactive({
  title: 'MioChat',
  beian: '',
  admin_code: '',
  user_code: '',
  full_screen: true
});

// 原始数据（用于重置）
const originalData = reactive({});

// 验证规则
const rules = {
  title: [
    { required: true, message: '请输入网站标题', trigger: 'blur' }
  ],
  admin_code: [
    { required: true, message: '请输入管理员验证码', trigger: 'blur' },
    { min: 6, message: '验证码长度至少为 6 位', trigger: 'blur' }
  ]
};

// 加载配置
const loadConfig = async () => {
  try {
    const webConfig = configStore.config?.web || await configStore.fetchConfigSection('web');
    
    Object.assign(formData, {
      title: webConfig.title || 'MioChat',
      beian: webConfig.beian || '',
      admin_code: webConfig.admin_code || '',
      user_code: webConfig.user_code || '',
      full_screen: webConfig.full_screen ?? true
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
      '修改 Web 配置需要重启服务才能生效，是否继续？',
      '确认保存',
      {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    saving.value = true;

    await configStore.updateConfigSection('web', {
      title: formData.title,
      beian: formData.beian,
      admin_code: formData.admin_code,
      user_code: formData.user_code,
      full_screen: formData.full_screen
    });

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
.web-config-view {
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
