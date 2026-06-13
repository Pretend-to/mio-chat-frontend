<template>
  <div class="tab-pane">
    <div
      class="settings-card"
      v-loading="loadingTasks"
      style="padding: 12px 16px"
    >
      <!-- 桌面端表格展示 -->
      <div class="desktop-tasks-table">
        <el-table :data="tasks" style="width: 100%" size="small">
          <el-table-column prop="name" label="任务名称" min-width="120" />
          <el-table-column prop="cron" label="Cron 表达式" width="130">
            <template #default="{ row }">
              <el-tag size="small" type="info" effect="plain">{{
                row.cron
              }}</el-tag>
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
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button
                size="small"
                link
                type="primary"
                @click="handleEditTask(row)"
                >编辑</el-button
              >
              <el-button
                size="small"
                link
                type="success"
                @click="handleShowExecutions(row)"
                >记录</el-button
              >
              <el-button
                size="small"
                link
                type="danger"
                @click="handleDeleteTask(row)"
                >删除</el-button
              >
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
              <el-button
                size="small"
                link
                type="primary"
                @click="handleEditTask(row)"
                >编辑</el-button
              >
              <el-button
                size="small"
                link
                type="success"
                @click="handleShowExecutions(row)"
                >记录</el-button
              >
              <el-button
                size="small"
                link
                type="danger"
                @click="handleDeleteTask(row)"
                >删除</el-button
              >
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
        <el-form
          :model="editingTask"
          label-width="100px"
          label-position="left"
          size="small"
        >
          <el-form-item label="任务名称">
            <el-input
              v-model="editingTask.name"
              placeholder="起个名字方便识别"
            />
          </el-form-item>
          <el-form-item label="Cron 周期">
            <el-input
              v-model="editingTask.cron"
              placeholder="例如: 0 9 * * * 或 +10m"
            />
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
        <el-button size="small" @click="taskDialogVisible = false"
          >取消</el-button
        >
        <el-button
          size="small"
          type="primary"
          :loading="savingTask"
          @click="saveTask"
          >确定</el-button
        >
      </template>
    </el-dialog>

    <!-- 任务执行记录对话框 -->
    <el-dialog
      v-model="executionsDialogVisible"
      :title="`📊 运行记录 - ${currentTaskName}`"
      width="900px"
      top="8vh"
      append-to-body
    >
      <div v-loading="loadingExecutions" style="min-height: 200px">
        <el-table
          :data="executionsList"
          style="width: 100%"
          size="small"
          border
        >
          <!-- 展开显示详细 Input/Output -->
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="execution-expand-details">
                <el-form label-position="top" size="small">
                  <el-form-item
                    v-slot:label
                    v-if="row.triggerPrompt"
                    label="唤醒指令 (Trigger Prompt)"
                  >
                    <span>唤醒指令 (Trigger Prompt)</span>
                  </el-form-item>
                  <el-input
                    v-if="row.triggerPrompt"
                    type="textarea"
                    :rows="2"
                    readonly
                    :model-value="row.triggerPrompt"
                    style="margin-bottom: 12px"
                  />

                  <el-form-item
                    v-slot:label
                    v-if="row.errorMessage"
                    label="错误信息 (Error Message)"
                  >
                    <span>错误信息 (Error Message)</span>
                  </el-form-item>
                  <el-alert
                    v-if="row.errorMessage"
                    :title="row.errorMessage"
                    type="error"
                    :closable="false"
                    show-icon
                    style="margin-bottom: 12px"
                  />

                  <el-row :gutter="20">
                    <el-col :span="12">
                      <el-form-item
                        v-slot:label
                        label="输入消息历史 (Input Messages)"
                      >
                        <span>输入消息历史 (Input Messages)</span>
                      </el-form-item>
                      <div class="json-box">
                        <pre>{{ formatJson(row.inputMessages) }}</pre>
                      </div>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item
                        v-slot:label
                        label="最终回复/流块 (Output Assistant Message / Chunks)"
                      >
                        <span
                          >最终回复/流块 (Output Assistant Message /
                          Chunks)</span
                        >
                      </el-form-item>
                      <div class="json-box">
                        <pre v-if="row.finalAssistantMsg">{{
                          formatJson(row.finalAssistantMsg)
                        }}</pre>
                        <pre v-else-if="row.outputChunks">{{
                          formatJson(row.outputChunks)
                        }}</pre>
                        <span v-else class="text-secondary">无输出</span>
                      </div>
                    </el-col>
                  </el-row>
                </el-form>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            prop="round"
            label="轮次"
            width="60"
            align="center"
          />

          <el-table-column prop="status" label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="provider" label="渠道" width="130">
            <template #default="{ row }">
              <el-tag v-if="row.provider" size="small" type="info">{{
                row.provider
              }}</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>

          <el-table-column
            prop="model"
            label="模型"
            min-width="140"
            show-overflow-tooltip
          />

          <el-table-column prop="startedAt" label="执行时间" width="170">
            <template #default="{ row }">
              <span>{{ new Date(row.startedAt).toLocaleString() }}</span>
            </template>
          </el-table-column>

          <el-table-column label="耗时" width="80" align="center">
            <template #default="{ row }">
              <span>{{ formatDuration(row) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="executionsList.length === 0" class="empty-executions">
          暂无运行记录
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from "vue";
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

// 执行记录相关状态和方法
const executionsDialogVisible = ref(false);

const loadingExecutions = ref(false);
const executionsList = ref([]);
const currentTaskName = ref("");

const formatDuration = (row) => {
  if (!row.startedAt) return "-";
  const start = new Date(row.startedAt).getTime();
  const end = row.finishedAt ? new Date(row.finishedAt).getTime() : Date.now();
  const diff = end - start;
  if (diff < 1000) return `${diff}ms`;
  return `${(diff / 1000).toFixed(1)}s`;
};

const getStatusType = (status) => {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "running":
      return "warning";
    default:
      return "info";
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case "completed":
      return "成功";
    case "failed":
      return "失败";
    case "running":
      return "运行中";
    default:
      return status;
  }
};

const formatJson = (val) => {
  if (!val) return "";
  if (typeof val === "string") {
    try {
      return JSON.stringify(JSON.parse(val), null, 2);
    } catch {
      return val;
    }
  }
  return JSON.stringify(val, null, 2);
};

const handleShowExecutions = async (row) => {
  currentTaskName.value = row.name || row.id;
  executionsDialogVisible.value = true;
  loadingExecutions.value = true;
  executionsList.value = [];
  try {
    const res = await taskAPI.getTaskExecutions(row.id);
    executionsList.value = res.data || [];
  } catch (error) {
    ElMessage.error("获取执行记录失败: " + error.message);
  } finally {
    loadingExecutions.value = false;
  }
};

const fetchTasks = async () => {
  loadingTasks.value = true;
  try {
    const res = await taskAPI.getTasks();
    tasks.value = (res.data || [])
      .filter(
        (t) =>
          t.preset === props.name ||
          t.preset === props.contactorId ||
          t.contactorId === props.contactorId,
      )
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
      ? typeof task.tools === "string"
        ? JSON.parse(task.tools)
        : task.tools
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
watch(
  () => [props.name, props.contactorId],
  () => {
    fetchTasks();
  },
);
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
  color: var(--mio-text-placeholder);
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
    background: var(--mio-bg-page);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid var(--mio-border-color-lighter);
  }
  .task-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .task-card-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--mio-text-primary);
  }
  .task-card-body {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
  }
  .task-card-cron {
    font-size: 12px;
    color: var(--mio-color-primary);
    background: var(--mio-bg-active);
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }
  .task-card-actions {
    display: flex;
    gap: 12px;
  }
}

.json-box {
  background: var(--mio-bg-chat-window);
  border: 1px solid var(--mio-border-color-light);
  border-radius: 4px;
  padding: 8px 12px;
  max-height: 250px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--mio-text-regular);
}
.execution-expand-details {
  padding: 15px 24px;
  background-color: var(--mio-bg-page);
  border-radius: 4px;
}
.empty-executions {
  text-align: center;
  color: var(--mio-text-secondary);
  padding: 40px 0;
  font-size: 13px;
}
</style>
