<template>
  <div class="automation-view">
    <div class="page-header">
      <h1>自动化任务</h1>
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
        配置系统后台执行的自动化任务，如对话标题自动生成等。
      </template>
    </el-alert>

    <el-card>
      <div class="section-title">对话标题自动生成</div>
      <el-form
        ref="formRef"
        :model="formData"
        label-width="140px"
        label-position="left"
      >
        <el-form-item label="任务执行渠道" prop="system_llm_channel">
          <el-select
            v-model="formData.system_llm_channel"
            placeholder="默认使用第一个可用渠道"
            clearable
            style="width: 400px"
          >
            <el-option
              v-for="adapter in allAdapters"
              :key="adapter.id"
              :label="adapter.name"
              :value="adapter.id"
            >
              <span style="float: left">{{ adapter.name }}</span>
              <span style="float: right; color: #8492a6; font-size: 13px">{{ adapter.type }}</span>
            </el-option>
          </el-select>
          <template #extra>
            <span class="form-item-tip">
              指定用于执行自动化任务的 LLM 渠道。留空则自动选择。
            </span>
          </template>
        </el-form-item>

        <el-form-item label="标题生成提示词" prop="system_llm_title_prompt">
          <el-input
            v-model="formData.system_llm_title_prompt"
            type="textarea"
            :rows="4"
            placeholder="请输入提示词..."
            style="width: 600px"
          />
          <template #extra>
            <span class="form-item-tip">
              用于指导 AI 生成会话标题的系统提示词。
            </span>
          </template>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { useConfigStore } from '@/stores/configStore.js';

const configStore = useConfigStore();
const formRef = ref(null);
const saving = ref(false);

// 表单数据
const formData = reactive({
  system_llm_channel: '',
  system_llm_title_prompt: ''
});

// 原始数据（用于重置）
const originalData = reactive({});

// 获取所有适配器列表供选择
const allAdapters = computed(() => {
  const list = [];
  if (configStore.adapters) {
    Object.entries(configStore.adapters).forEach(([type, instances]) => {
      instances.forEach((inst, index) => {
        list.push({
          id: inst.instanceId || `${type}:${index}`, // 优先使用唯一 ID
          name: inst.name || `${type} #${index + 1}`,
          type: type
        });
      });
    });
  }
  return list;
});

// 加载配置
const loadConfig = async () => {
  try {
    const systemConfig = await configStore.fetchConfigSection('system');
    
    formData.system_llm_channel = systemConfig.system_llm_channel || '';
    formData.system_llm_title_prompt = systemConfig.system_llm_title_prompt || '';
    
    // 保存原始数据
    Object.assign(originalData, formData);
  } catch (error) {
    ElMessage.error('加载配置失败：' + error.message);
  }
};

// 保存配置
const handleSave = async () => {
  try {
    saving.value = true;

    await configStore.updateConfigSection('system', {
      system_llm_channel: formData.system_llm_channel,
      system_llm_title_prompt: formData.system_llm_title_prompt
    });

    ElMessage.success('配置保存成功');
    
    // 更新原始数据
    Object.assign(originalData, formData);
  } catch (error) {
    console.error('保存自动化配置失败:', error);
    ElMessage.error('自动化配置保存失败');
  } finally {
    saving.value = false;
  }
};

// 重置配置
const handleReset = () => {
  Object.assign(formData, originalData);
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
.automation-view {
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

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
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
