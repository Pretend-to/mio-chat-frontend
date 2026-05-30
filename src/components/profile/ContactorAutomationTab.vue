<template>
  <div class="tab-pane">

    <div class="settings-card" v-loading="loadingTasks" style="padding: 12px 16px;">
      <!-- 桌面端表格展示 -->
      <div class="desktop-tasks-table">
        <el-table :data="tasks" style="width: 100%" size="small">
          <el-table-column prop="name" label="任务名称" min-width="120" />
          <el-table-column prop="cron" label="Cron 表达式" width="130">
            <template #default="{ row }">
              <el-tag size="small" type="info" effect="plain">{{ row.cron }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-switch
                v-model="row.isActive"
                size="small"
                @change="(val) => handleToggleTask(row, val)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button-group>
                <el-button size="small" link type="primary" @click="handleEditTask(row)">编辑</el-button>
                <el-button size="small" link type="danger" @click="handleDeleteTask(row)">删除</el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <!-- 移动端列表展示 -->
      <div class="mobile-tasks-list">
        <div v-if="tasks.length === 0" class="no-tasks-tip">暂无定时任务</div>
        <div v-for="row in tasks" :key="row.id" class="mobile-task-card">
          <div class="task-card-header">
            <span class="task-card-title">{{ row.name }}</span>
            <el-switch
              v-model="row.isActive"
              size="small"
              @change="(val) => handleToggleTask(row, val)"
            />
          </div>
          <div class="task-card-body">
            <span class="task-card-cron">📋 {{ row.cron }}</span>
            <div class="task-card-actions">
              <el-button size="small" link type="primary" @click="handleEditTask(row)">编辑</el-button>
              <el-button size="small" link type="danger" @click="handleDeleteTask(row)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 任务编辑对话框 -->
    <el-dialog
      v-model="taskDialogVisible"
      :title="editingTask.id ? '📋 编辑定时任务' : '📋 新建定时任务'"
      :width="isMobile ? '92%' : '600px'"
      append-to-body
    >
      <div v-loading="loadingTaskDetail">
        <el-form :model="editingTask" label-width="100px" label-position="left" size="small">
          <el-form-item label="任务名称">
            <el-input v-model="editingTask.name" placeholder="起个名字方便识别" />
          </el-form-item>
          <el-form-item label="Cron 周期">
            <el-input v-model="editingTask.cron" placeholder="例如: 0 9 * * * 或 +10m" />
          </el-form-item>
          <el-form-item label="执行预设">
            <el-input :model-value="name" disabled />
          </el-form-item>
          <el-form-item label="System Prompt">
            <el-input
              v-model="editingTask.systemPrompt"
              type="textarea"
              :rows="3"
              placeholder="可选。固化领域知识到系统层。留空使用默认。"
            />
          </el-form-item>
          <el-form-item label="唤醒指令">
            <el-input
              v-model="editingTask.triggerPrompt"
              type="textarea"
              :rows="3"
              placeholder="可选。任务触发时唤醒 Agent 的消息，留空时使用默认提示词。"
            />
          </el-form-item>
          <el-form-item label="Shell 白名单">
            <el-input
              v-model="editingTask.shWhitelist"
              type="textarea"
              :rows="2"
              placeholder="例如: curl,cat,node (多个用逗号分隔)"
            />
          </el-form-item>
          <el-form-item label="工具集">
            <el-input
              v-model="editingTask.toolsDisplay"
              type="textarea"
              :rows="2"
              placeholder="可选。工具 ID 列表。留空则继承 Persona 全部工具。"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button size="small" @click="taskDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="savingTask" @click="saveTask">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { taskAPI } from "@/lib/configApi.js";
import { ElMessage, ElMessageBox } from "element-plus";

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  contactorId: {
    type: String,
    required: true,
  },
  isMobile: {
    type: Boolean,
    default: false,
  },
});

const tasks = ref([]);
const loadingTasks = ref(false);
const taskDialogVisible = ref(false);
const savingTask = ref(false);
const loadingTaskDetail = ref(false);

const editingTask = reactive({
  id: "",
  name: "",
  cron: "",
  preset: "",
  triggerPrompt: "",
  systemPrompt: "",
  shWhitelist: "",
  toolsDisplay: "",
  status: "active",
});

const fetchTasks = async () => {
  loadingTasks.value = true;
  try {
    const res = await taskAPI.getTasks();
    tasks.value = (res.data || [])
      .filter((t) => t.preset === props.name || t.preset === props.contactorId || t.contactorId === props.contactorId)
      .map((t) => ({
        ...t,
        isActive: t.status === "active",
      }));
  } catch (err) {
    console.error("获取定时任务失败:", err);
  } finally {
    loadingTasks.value = false;
  }
};

const handleAddTask = () => {
  Object.assign(editingTask, {
    id: "",
    name: "",
    cron: "",
    preset: props.name,
    triggerPrompt: "",
    systemPrompt: "",
    shWhitelist: "",
    toolsDisplay: "",
    status: "active",
  });
  taskDialogVisible.value = true;
};

const handleEditTask = async (row) => {
  loadingTaskDetail.value = true;
  taskDialogVisible.value = true;
  try {
    const res = await taskAPI.getTaskDetail(row.id);
    const task = res.data;
    const tools = task.tools
      ? (typeof task.tools === "string" ? JSON.parse(task.tools) : task.tools)
      : [];
    Object.assign(editingTask, {
      id: task.id,
      name: task.name || "",
      cron: task.cron || "",
      preset: props.name,
      triggerPrompt: task.triggerPrompt || "",
      systemPrompt: task.systemPrompt || "",
      shWhitelist: task.shWhitelist || "",
      toolsDisplay: Array.isArray(tools) ? tools.join(", ") : "",
      status: task.status || "active",
    });
  } catch (error) {
    ElMessage.error("加载任务详情失败: " + error.message);
  } finally {
    loadingTaskDetail.value = false;
  }
};

const saveTask = async () => {
  if (!editingTask.name || !editingTask.cron) {
    ElMessage.warning("请填写任务名称和执行周期");
    return;
  }
  try {
    savingTask.value = true;
    const toolsArr = editingTask.toolsDisplay
      ? editingTask.toolsDisplay.split(/[,，\s]+/).filter(Boolean)
      : undefined;
    await taskAPI.upsertTask({
      ...editingTask,
      preset: props.name,
      contactorId: props.contactorId,
      tools: toolsArr,
    });
    ElMessage.success("定时任务保存成功");
    taskDialogVisible.value = false;
    await fetchTasks();
  } catch (error) {
    ElMessage.error("保存任务失败: " + error.message);
  } finally {
    savingTask.value = false;
  }
};

const handleDeleteTask = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除定时任务 "${row.name}" 吗？`, "警告", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });
    await taskAPI.deleteTask(row.id);
    ElMessage.success("删除定时任务成功");
    await fetchTasks();
  } catch (e) {
    if (e !== "cancel") ElMessage.error("删除任务失败");
  }
};

const handleToggleTask = async (row, val) => {
  try {
    await taskAPI.toggleTask(row.id, val);
    ElMessage.success(val ? "定时任务已启用" : "定时任务已禁用");
  } catch (error) {
    row.isActive = !val;
    ElMessage.error("切换任务状态失败");
  }
};

onMounted(() => {
  fetchTasks();
});

// Watch contactor/preset name and ID updates
watch(() => [props.name, props.contactorId], () => {
  fetchTasks();
});
</script>

<style scoped>
.desktop-tasks-table {
  display: block;
}
.mobile-tasks-list {
  display: none;
}
.no-tasks-tip {
  text-align: center;
  color: #c0c4cc;
  font-size: 13px;
  padding: 24px 0;
}

@media (max-width: 768px) {
  .desktop-tasks-table {
    display: none;
  }
  .mobile-tasks-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 0;
  }
  .mobile-task-card {
    background: #f8f9fb;
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid #f0f2f5;
  }
  .task-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .task-card-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }
  .task-card-body {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
  }
  .task-card-cron {
    font-size: 12px;
    color: #409eff;
    background: #ecf5ff;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }
  .task-card-actions {
    display: flex;
    gap: 12px;
  }
}
</style>

