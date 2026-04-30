<template>
  <div class="storage-config-view">
    <div class="page-header">
      <h1>存储配置</h1>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button
          :loading="testing"
          @click="handleTest"
        >
          测试连接
        </el-button>
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
      type="success"
      :closable="false"
      show-icon
      style="margin-bottom: 24px;"
    >
      <template #title>
        存储配置支持热更新，修改后立即生效
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
        <el-form-item label="存储类型" prop="type">
          <el-radio-group v-model="formData.type">
            <el-radio-button value="local">本地存储</el-radio-button>
            <el-radio-button value="s3">S3 兼容存储</el-radio-button>
          </el-radio-group>
          <template #extra>
            <span class="form-item-tip">
              选择文件和图片的存储方式。S3 兼容存储支持 AWS S3, Cloudflare R2, MinIO 等。
            </span>
          </template>
        </el-form-item>

        <template v-if="formData.type !== 'local'">
          <el-divider>云存储配置</el-divider>

          <el-form-item label="存储桶名称" prop="bucket">
            <el-input
              v-model="formData.bucket"
              placeholder="my-bucket-name"
            />
            <template #extra>
              <span class="form-item-tip">
                S3 或 R2 的 Bucket 名称
              </span>
            </template>
          </el-form-item>

          <el-form-item label="终端节点 (Endpoint)" prop="endpoint">
            <el-input
              v-model="formData.endpoint"
              placeholder="https://s3.amazonaws.com 或 https://<account-id>.r2.cloudflarestorage.com"
            />
            <template #extra>
              <span class="form-item-tip">
                存储服务的 API 终端地址 (Endpoint)
              </span>
            </template>
          </el-form-item>

          <el-form-item label="Access Key ID" prop="accessKeyId">
            <el-input
              v-model="formData.accessKeyId"
              placeholder="你的 Access Key ID"
            />
          </el-form-item>

          <el-form-item label="Secret Access Key" prop="secretAccessKey">
            <el-input
              v-model="formData.secretAccessKey"
              type="password"
              show-password
              placeholder="你的 Secret Access Key"
            />
            <template #extra>
              <span class="form-item-tip">
                请输入存储服务的 Secret Access Key。该密钥将以明文形式在管理界面显示，请注意环境安全。
              </span>
            </template>
          </el-form-item>

          <el-form-item label="公共访问 URL" prop="baseUrl">
            <el-input
              v-model="formData.baseUrl"
              placeholder="https://your-bucket.s3.amazonaws.com 或 https://pub-xxx.r2.dev"
            />
            <template #extra>
              <span class="form-item-tip">
                可选。用于生成对外访问的文件链接。如果不填，将使用默认规则生成。
              </span>
            </template>
          </el-form-item>

          <el-form-item label="区域 (Region)" prop="region">
            <el-input
              v-model="formData.region"
              placeholder="auto"
            />
            <template #extra>
              <span class="form-item-tip">
                可选。S3 区域，例如 us-east-1。R2 或 MinIO 通常填 auto。
              </span>
            </template>
          </el-form-item>
        </template>

        <template v-else>
          <el-empty description="本地存储无需额外配置" :image-size="100" />
        </template>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useConfigStore } from '@/stores/configStore.js';

const configStore = useConfigStore();
const formRef = ref(null);
const saving = ref(false);
const testing = ref(false);

// 表单数据
const formData = reactive({
  type: 'local',
  bucket: '',
  endpoint: '',
  accessKeyId: '',
  secretAccessKey: '',
  baseUrl: '',
  region: 'auto'
});

// 原始数据（用于重置）
const originalData = reactive({});

// 验证规则
const rules = {
  type: [
    { required: true, message: '请选择存储类型', trigger: 'change' }
  ],
  bucket: [
    { required: true, message: '请输入存储桶名称', trigger: 'blur' }
  ],
  endpoint: [
    { required: true, message: '请输入终端节点', trigger: 'blur' }
  ],
  accessKeyId: [
    { required: true, message: '请输入 Access Key ID', trigger: 'blur' }
  ],
  secretAccessKey: [
    { required: true, message: '请输入 Secret Access Key', trigger: 'blur' }
  ]
};

// 加载配置
const loadConfig = async () => {
  try {
    const storageConfig = await configStore.fetchStorageConfig();
    
    let storageType = storageConfig.type || 'local';
    // 兼容旧的 r2 类型，统一映射为 s3
    if (storageType === 'r2') storageType = 's3';

    Object.assign(formData, {
      type: storageType,
      bucket: storageConfig.bucket || '',
      endpoint: storageConfig.endpoint || '',
      accessKeyId: storageConfig.accessKeyId || '',
      secretAccessKey: storageConfig.secretAccessKey || '',
      baseUrl: storageConfig.baseUrl || '',
      region: storageConfig.region || 'auto'
    });
    
    // 保存原始数据
    Object.assign(originalData, formData);
  } catch (error) {
    ElMessage.error('加载存储配置失败：' + error.message);
  }
};

// 测试配置
const handleTest = async () => {
  try {
    if (formData.type !== 'local') {
      await formRef.value.validate();
    } else {
      ElMessage.success('本地存储无需测试');
      return;
    }
    
    testing.value = true;

    const payload = {
      type: formData.type,
      bucket: formData.bucket,
      endpoint: formData.endpoint,
      accessKeyId: formData.accessKeyId,
      secretAccessKey: formData.secretAccessKey,
      baseUrl: formData.baseUrl,
      region: formData.region
    };

    const result = await configStore.testStorageConfig(payload);
    
    if (result.success) {
      ElMessage.success('存储配置测试成功');
    } else {
      console.error('存储测试失败详情:', result.message);
      ElMessage.error('存储配置测试失败，请检查配置或查看控制台详情');
    }
  } catch (error) {
    if (error !== false) {
      console.error('测试执行出错:', error);
      ElMessage.error('测试执行出错，请查看控制台详情');
    }
  } finally {
    testing.value = false;
  }
};

// 保存配置
const handleSave = async () => {
  try {
    if (formData.type !== 'local') {
      await formRef.value.validate();
    }
    
    saving.value = true;

    const payload = {
      type: formData.type
    };

    if (formData.type !== 'local') {
      Object.assign(payload, {
        bucket: formData.bucket,
        endpoint: formData.endpoint,
        accessKeyId: formData.accessKeyId,
        secretAccessKey: formData.secretAccessKey,
        baseUrl: formData.baseUrl,
        region: formData.region
      });
    }

    await configStore.updateStorageConfig(payload);

    ElMessage.success({
      message: '存储配置更新成功。部分更改可能需要刷新页面才能完全生效。',
      duration: 5000,
      showClose: true
    });
    
    // 更新原始数据
    Object.assign(originalData, formData);
  } catch (error) {
    if (error !== false) { // validate() 返回 false 表示验证失败
      console.error('保存存储配置失败:', error);
      ElMessage.error('存储配置保存失败，请查看控制台详情');
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
  await loadConfig();
});
</script>

<style scoped lang="scss">
.storage-config-view {
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

.el-divider {
  margin: 40px 0 24px;
}
</style>
