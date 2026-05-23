<template>
  <div class="automation-view">
    <div class="page-header">
      <h1>系统任务与自动化</h1>
      <div class="header-actions">
        <el-button @click="handleReset">重置配置</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存通用配置
        </el-button>
      </div>
    </div>

    <!-- 通用配置：标题生成 -->
    <el-card class="config-card">
      <div class="section-title">
        <el-icon><ChatLineRound /></el-icon>
        对话标题自动生成
      </div>
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
              <span style="float: right; color: #8492a6; font-size: 13px">{{
                adapter.type
              }}</span>
            </el-option>
          </el-select>
          <template #extra>
            <span class="form-item-tip">
              指定用于执行自动化任务的 LLM 渠道。留空则自动选择第一个可用渠道。
            </span>
          </template>
        </el-form-item>

        <el-form-item label="标题生成提示词" prop="system_llm_title_prompt">
          <el-input
            v-model="formData.system_llm_title_prompt"
            type="textarea"
            :rows="4"
            placeholder="请输入提示词..."
            style="width: 100%"
          />
          <template #extra>
            <span class="form-item-tip">
              用于指导 AI
              生成会话标题的系统提示词。注意：系统会自动过滤推理内容。
            </span>
          </template>
        </el-form-item>

        <el-form-item label="对话压缩提示词" prop="system_llm_compact_prompt">
          <el-input
            v-model="formData.system_llm_compact_prompt"
            type="textarea"
            :rows="6"
            placeholder="请输入提示词..."
            style="width: 100%"
          />
          <template #extra>
            <span class="form-item-tip">
              用于长对话压缩（总结）的提示词。当对话过长时，系统会使用此提示词提取有效信息并精简上下文。
            </span>
          </template>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 定时任务管理 -->
    <el-card class="config-card">
      <div class="section-title">
        <el-icon><AlarmClock /></el-icon>
        定时任务 (Cron Tasks)
        <el-button
          type="primary"
          size="small"
          @click="handleAddTask"
          class="add-btn"
        >
          新建任务
        </el-button>
      </div>

      <el-table :data="tasks" style="width: 100%" v-loading="loadingTasks">
        <el-table-column prop="name" label="任务名称" min-width="120" />
        <el-table-column prop="cron" label="Cron 表达式" width="150">
          <template #default="{ row }">
            <el-tag size="small">{{ row.cron }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="preset" label="执行 Agent" width="150" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.isActive"
              @change="(val) => handleToggleTask(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="lastRunAt" label="最后运行" width="180">
          <template #default="{ row }">
            <span v-if="row.lastRunAt">{{
              new Date(row.lastRunAt).toLocaleString()
            }}</span>
            <span v-else class="text-secondary">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button size="small" @click="handleEditTask(row)"
                >编辑</el-button
              >
              <el-button
                size="small"
                type="danger"
                @click="handleDeleteTask(row)"
                >删除</el-button
              >
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 任务编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingTask.id ? '编辑定时任务' : '新建定时任务'"
      width="600px"
    >
      <el-form :model="editingTask" label-width="100px" label-position="left">
        <el-form-item label="任务名称">
          <el-input v-model="editingTask.name" placeholder="起个名字方便识别" />
        </el-form-item>
        <el-form-item label="Cron 周期">
          <el-input
            v-model="editingTask.cron"
            placeholder="例如: 0 9 * * * (每天上午9点)"
          />
          <template #extra>
            <span class="form-item-tip"
              >标准 Cron 格式，或者输入 "+10m" 表示 10 分钟后执行一次。</span
            >
          </template>
        </el-form-item>
        <el-form-item label="执行预设">
          <el-select
            v-model="editingTask.preset"
            placeholder="请选择 Agent 预设"
            style="width: 100%"
          >
            <el-option
              v-for="p in presets"
              :key="p.name"
              :label="p.name"
              :value="p.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="任务指令">
          <el-input
            v-model="editingTask.prompt"
            type="textarea"
            :rows="4"
            placeholder="告诉 Agent 要做什么..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingTask" @click="saveTask"
          >确定</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ChatLineRound, AlarmClock } from "@element-plus/icons-vue";
import { useConfigStore } from "@/stores/configStore.js";
import { taskAPI, configAPI } from "@/lib/configApi.js";
import { config } from "@/lib/runtime.js";

const configStore = useConfigStore();
const formRef = ref(null);
const saving = ref(false);

// 通用配置数据
const formData = reactive({
  system_llm_channel: "",
  system_llm_title_prompt: "",
  system_llm_compact_prompt: "",
});
const originalData = reactive({});

// 定时任务数据
const tasks = ref([]);
const loadingTasks = ref(false);
const dialogVisible = ref(false);
const savingTask = ref(false);
const presets = ref([]);
const editingTask = reactive({
  id: "",
  name: "",
  cron: "",
  preset: "",
  prompt: "",
  status: "active",
});

// 获取所有适配器列表 (渠道)
const allAdapters = computed(() => {
  // 与 AddContactor.vue 逻辑保持一致，使用 config 提供的标准列表
  return config.getLLMProviders().map((p) => ({
    id: p.value, // 唯一标识 (displayName/instanceId)
    name: p.label, // 显示名称
    type: p.adapterType,
  }));
});

// 加载配置与任务
const loadData = async () => {
  try {
    const systemConfig = await configStore.fetchConfigSection("system");
    formData.system_llm_channel = systemConfig.system_llm_channel || "";
    formData.system_llm_title_prompt =
      systemConfig.system_llm_title_prompt || "";
    formData.system_llm_compact_prompt =
      systemConfig.system_llm_compact_prompt || "";
    Object.assign(originalData, formData);

    await fetchTasks();
    await fetchPresets();
  } catch (error) {
    ElMessage.error("加载数据失败：" + error.message);
  }
};

const fetchTasks = async () => {
  loadingTasks.value = true;
  try {
    const res = await taskAPI.getTasks();
    tasks.value = res.data.map((t) => ({
      ...t,
      isActive: t.status === "active",
    }));
  } finally {
    loadingTasks.value = false;
  }
};

const fetchPresets = async () => {
  // 获取第一页预设（默认 50 个，对大多数系统够用了）
  const res = await configAPI.getConfigSection("presets");
  presets.value = res.data.presets || [];
};

// 通用配置保存
const handleSave = async () => {
  try {
    saving.value = true;
    await configStore.updateConfigSection("system", { ...formData });
    ElMessage.success("系统配置保存成功");
    Object.assign(originalData, formData);
  } catch (error) {
    ElMessage.error("保存失败");
  } finally {
    saving.value = false;
  }
};

const handleReset = () => {
  Object.assign(formData, originalData);
  ElMessage.info("已重置");
};

// 任务操作
const handleAddTask = () => {
  Object.assign(editingTask, {
    id: "",
    name: "",
    cron: "",
    preset: "",
    prompt: "",
    status: "active",
  });
  dialogVisible.value = true;
};

const handleEditTask = (row) => {
  Object.assign(editingTask, { ...row });
  dialogVisible.value = true;
};

const saveTask = async () => {
  if (
    !editingTask.name ||
    !editingTask.cron ||
    !editingTask.preset ||
    !editingTask.prompt
  ) {
    return ElMessage.warning("请填写完整任务信息");
  }
  try {
    savingTask.value = true;
    await taskAPI.upsertTask({ ...editingTask });
    ElMessage.success("任务保存成功");
    dialogVisible.value = false;
    await fetchTasks();
  } catch (error) {
    ElMessage.error("保存任务失败: " + error.message);
  } finally {
    savingTask.value = false;
  }
};

const handleDeleteTask = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除任务 "${row.name}" 吗？`, "警告", {
      type: "warning",
    });
    await taskAPI.deleteTask(row.id);
    ElMessage.success("已删除");
    await fetchTasks();
  } catch (e) {
    if (e !== "cancel") ElMessage.error("删除失败");
  }
};

const handleToggleTask = async (row, val) => {
  try {
    await taskAPI.toggleTask(row.id, val);
    ElMessage.success(val ? "任务已启用" : "任务已禁用");
  } catch (error) {
    row.isActive = !val; // 恢复 UI 状态
    ElMessage.error("操作失败");
  }
};

onMounted(async () => {
  if (!configStore.config) await configStore.fetchConfig();
  await loadData();
});
</script>

<style scoped lang="scss">
.automation-view {
  padding: 24px;
  max-width: 1000px;
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
}

.config-card {
  margin-bottom: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  .section-title {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #ebeef5;
    display: flex;
    align-items: center;
    gap: 10px;

    .el-icon {
      color: #409eff;
    }

    .add-btn {
      margin-left: auto;
    }
  }
}

.form-item-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

.text-secondary {
  color: #909399;
}

:deep(.el-form-item) {
  margin-bottom: 24px;
}
</style>
