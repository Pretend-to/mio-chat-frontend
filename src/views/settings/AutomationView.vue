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
              用于指导 AI 生成会话标题的系统提示词。注意：系统会自动过滤推理内容。
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
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-switch
              v-model="row.isActive"
              @change="(val) => handleToggleTask(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="lastRunAt" label="最后运行" width="170">
          <template #default="{ row }">
            <span v-if="row.lastRunAt">{{
              new Date(row.lastRunAt).toLocaleString()
            }}</span>
            <span v-else class="text-secondary">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button size="small" @click="handleEditTask(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDeleteTask(row)">删除</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 任务编辑对话框（含执行历史） -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingTask.id ? '📋 编辑定时任务' : '📋 新建定时任务'"
      width="800px"
      top="5vh"
    >
      <div v-loading="loadingTaskDetail" class="edit-dialog-body">
        <el-form :model="editingTask" label-width="100px" label-position="left">
          <el-form-item label="任务名称">
            <el-input v-model="editingTask.name" placeholder="起个名字方便识别" />
          </el-form-item>
          <el-form-item label="Cron 周期">
            <el-input v-model="editingTask.cron" placeholder="例如: 0 9 * * * (每天上午9点)" />
            <template #extra>
              <span class="form-item-tip">标准 Cron 格式，或者输入 "+10m" 表示 10 分钟后执行一次。</span>
            </template>
          </el-form-item>
          <el-form-item label="执行预设">
            <el-select v-model="editingTask.preset" placeholder="请选择 Agent 预设" style="width: 100%">
              <el-option v-for="p in presets" :key="p.name" :label="p.name" :value="p.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="System Prompt">
            <el-input
              v-model="editingTask.systemPrompt"
              type="textarea"
              :rows="4"
              placeholder="可选。固化领域知识到系统层，如 API 文档、规则等。留空使用默认。"
            />
            <template #extra>
              <span class="form-item-tip">设置后将作为 system prompt 注入，第一轮写入后常驻 history。配合精简的 taskPrompt 使用效果最佳。</span>
            </template>
          </el-form-item>
          <el-form-item label="唤醒指令">
            <el-input
              v-model="editingTask.triggerPrompt"
              type="textarea"
              :rows="4"
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
            <template #extra>
              <span class="form-item-tip">后台定时任务在执行 shell 命令时自动匹配此白名单。</span>
            </template>
          </el-form-item>
          <el-form-item label="工具集">
            <el-input
              v-model="editingTask.toolsDisplay"
              type="textarea"
              :rows="2"
              placeholder="可选。工具 ID 列表，如 sh_mid_0e2cda, parse_mid_8c8c4a。留空则继承 Persona 全部工具。"
            />
          </el-form-item>
        </el-form>

        <!-- ── 执行历史 ── -->
        <div v-if="editingTask.id" class="detail-section" style="margin-top: 24px;">
          <h4>📜 执行历史 (共 {{ editingHistory.length }} 轮)</h4>
          <div v-if="editingHistory.length === 0" class="empty-history">尚无执行历史</div>
          <div v-for="(entry, i) in editingHistory" :key="i" class="history-entry">
            <div class="history-header">
              <span :class="['role-badge', `role-${entry.role}`]">
                {{ roleLabel(entry.role) }}
              </span>
              <span v-if="entry.time" class="history-time">{{ formatTime(entry.time) }}</span>
              <span class="history-index">#{{ i + 1 }}</span>
            </div>
            <div
              class="history-text"
              :class="{ collapsed: entry._collapsed }"
              @click="entry._collapsed = !entry._collapsed"
            >
              {{ entry._text }}
            </div>
          </div>
        </div>
        <div v-else class="form-item-tip" style="margin-top: 16px;">新建任务尚无执行历史。</div>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingTask" @click="saveTask">确定</el-button>
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
  triggerPrompt: "",
  systemPrompt: "",
  shWhitelist: "",
  toolsDisplay: "",
  status: "active",
});

// 编辑面板中执行历史
const editingHistory = ref([]);
const loadingTaskDetail = ref(false);

// 获取所有适配器列表
const allAdapters = computed(() => {
  return config.getLLMProviders().map((p) => ({
    id: p.value,
    name: p.label,
    type: p.adapterType,
  }));
});

// 加载配置与任务
const loadData = async () => {
  try {
    const systemConfig = await configStore.fetchConfigSection("system");
    formData.system_llm_channel = systemConfig.system_llm_channel || "";
    formData.system_llm_title_prompt = systemConfig.system_llm_title_prompt || "";
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
  try {
    const res = await configAPI.getConfigSection("presets") || configAPI.getConfig();
    if (Array.isArray(res?.data?.presets)) {
      presets.value = [{ name: "default" }, ...res.data.presets.map((p) => ({ name: p.name || p }))];
    }
  } catch {
    // 静默失败
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
    triggerPrompt: "",
    systemPrompt: "",
    shWhitelist: "",
    toolsDisplay: "",
    status: "active",
  });
  dialogVisible.value = true;
};

const handleEditTask = async (row) => {
  // 列表返回的是摘要，需要取完整数据填充
  loadingTaskDetail.value = true;
  editingHistory.value = [];
  dialogVisible.value = true;

  try {
    const res = await taskAPI.getTaskDetail(row.id);
    const task = res.data;

    // 填充编辑表单
    const tools = task.tools
      ? (typeof task.tools === "string" ? JSON.parse(task.tools) : task.tools)
      : [];
    Object.assign(editingTask, {
      id: task.id,
      name: task.name || "",
      cron: task.cron || "",
      preset: task.preset || "",
      triggerPrompt: task.triggerPrompt || "",
      systemPrompt: task.systemPrompt || "",
      shWhitelist: task.shWhitelist || "",
      toolsDisplay: Array.isArray(tools) ? tools.join(", ") : "",
      status: task.status || "active",
    });

    // 解析执行历史
    const hist = task.history;
    let rawHistory = [];
    if (Array.isArray(hist)) {
      rawHistory = hist;
    } else if (typeof hist === "string" && hist.trim().startsWith("[")) {
      rawHistory = JSON.parse(hist);
    }
    editingHistory.value = rawHistory.map((h) => {
      let text = "";
      if (Array.isArray(h.content)) {
        text = h.content
          .map((c) => c.data?.text || c.text || "")
          .filter(Boolean)
          .join(" ");
      } else if (typeof h.content === "string") {
        text = h.content;
      }
      return {
        ...h,
        _text: text,
        _collapsed: text.length > 200,
      };
    });
  } catch (error) {
    ElMessage.error("加载任务数据失败: " + error.message);
  } finally {
    loadingTaskDetail.value = false;
  }
};

const saveTask = async () => {
  if (!editingTask.name || !editingTask.cron || !editingTask.preset) {
    return ElMessage.warning("请填写任务名称、执行周期和执行预设");
  }
  try {
    savingTask.value = true;
    // 如果 toolsDisplay 有内容，解析成数组
    const toolsArr = editingTask.toolsDisplay
      ? editingTask.toolsDisplay.split(/[,，\s]+/).filter(Boolean)
      : undefined;
    await taskAPI.upsertTask({
      ...editingTask,
      tools: toolsArr,
    });
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
    row.isActive = !val;
    ElMessage.error("操作失败");
  }
};



const toolsDisplay = (tools) => {
  if (!tools) return "(无 — 继承 Persona 全部工具)";
  try {
    const arr = typeof tools === "string" ? JSON.parse(tools) : tools;
    return Array.isArray(arr) && arr.length > 0 ? JSON.stringify(arr, null, 2) : "(无 — 继承 Persona 全部工具)";
  } catch {
    return String(tools);
  }
};

const roleLabel = (role) => {
  const map = { system: "系统", user: "用户", assistant: "助手", developer: "开发" };
  return map[role?.toLowerCase()] || role || "未知";
};

const formatTime = (ts) => {
  if (!ts) return "";
  return new Date(ts).toLocaleString("zh-CN");
};

onMounted(async () => {
  if (!configStore.config) await configStore.fetchConfig();
  await loadData();
});
</script>

<style scoped lang="scss">
.automation-view {
  padding: 24px;
  max-width: 1200px;
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

/* ── 编辑对话框内滚动 ── */
.edit-dialog-body {
  max-height: 60vh;
  overflow-y: auto;
  padding: 1px 0;
}

/* ── 详情面板样式 ── */
.detail-body {
  max-height: 70vh;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 24px;

  h4 {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #f0f0f0;
  }

  .kv-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
  }

  .kv-item {
    display: flex;
    flex-direction: column;
    padding: 8px 12px;
    background: #f8f9fc;
    border-radius: 6px;

    .k {
      font-size: 11px;
      color: #909399;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .v {
      font-size: 14px;
      font-weight: 500;
      margin-top: 2px;
      word-break: break-all;
    }
  }

  .code-block {
    background: #f5f7fa;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;
    max-height: 250px;
    overflow-y: auto;
    font-family: "SF Mono", "Fira Code", "Menlo", monospace;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
  }
}

.history-entry {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }
}

.history-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.role-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;

  &.role-system {
    background: #eef2ff;
    color: #4a6cf7;
  }
  &.role-user {
    background: #e8f8ef;
    color: #27ae60;
  }
  &.role-assistant {
    background: #fef3e7;
    color: #e67e22;
  }
  &.role-developer {
    background: #e8e8ff;
    color: #6366f1;
  }
}

.history-time {
  font-size: 11px;
  color: #909399;
}

.history-index {
  font-size: 11px;
  color: #c0c4cc;
  margin-left: auto;
}

.history-text {
  font-size: 13px;
  line-height: 1.5;
  color: #606266;
  white-space: pre-wrap;
  word-break: break-all;
  margin-left: 4px;
  cursor: pointer;

  &.collapsed {
    max-height: 60px;
    overflow: hidden;
    position: relative;

    &::after {
      content: "... (点击展开)";
      position: absolute;
      bottom: 0;
      right: 0;
      background: linear-gradient(to left, #fff, transparent);
      padding-left: 20px;
      color: #409eff;
      font-size: 12px;
    }
  }
}

.empty-history {
  color: #909399;
  font-size: 13px;
  padding: 8px 0;
}
</style>
