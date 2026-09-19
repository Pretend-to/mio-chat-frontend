<template>
  <div class="automation-view">
    <header class="page-header">
      <div>
        <h1>定时任务</h1>
        <p>任务固定在一个 Agent 的一个 Session 中运行，渠道仅用于可选投递。</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate"
        >新建任务</el-button
      >
    </header>
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="tip"
      title="渠道离线不会跳过任务；执行结果仍会写入 Session，Web 中照常可见。"
    />
    <el-card shadow="never">
      <el-table v-loading="loading" :data="tasks" empty-text="暂无定时任务">
        <el-table-column prop="name" label="任务" min-width="150" />
        <el-table-column prop="cron" label="时间规则" width="150"
          ><template #default="{ row }"
            ><el-tag>{{ row.cron }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="执行上下文" min-width="240"
          ><template #default="{ row }"
            ><b>{{ agentName(row.agentId) }}</b
            ><span class="sub">{{ sessionName(row.sessionId) }}</span></template
          ></el-table-column
        >
        <el-table-column label="结果投递" min-width="150"
          ><template #default="{ row }">{{
            bindingName(row)
          }}</template></el-table-column
        >
        <el-table-column label="状态" width="90"
          ><template #default="{ row }"
            ><el-switch
              v-model="row.isActive"
              @change="(value) => toggle(row, value)" /></template
        ></el-table-column>
        <el-table-column prop="lastRunAt" label="最后运行" width="180"
          ><template #default="{ row }">{{
            row.lastRunAt
              ? new Date(row.lastRunAt).toLocaleString()
              : "尚未运行"
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="190" fixed="right"
          ><template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)"
              >编辑</el-button
            >
            <el-button link type="success" @click="showExecutions(row)"
              >记录</el-button
            >
            <el-button link type="danger" @click="removeTask(row)"
              >删除</el-button
            >
          </template></el-table-column
        >
      </el-table>
    </el-card>

    <el-dialog
      v-model="editorVisible"
      :title="form.id ? '编辑定时任务' : '新建定时任务'"
      width="620px"
    >
      <el-form :model="form" label-position="top">
        <div class="two-cols">
          <el-form-item label="任务名称" required
            ><el-input v-model="form.name"
          /></el-form-item>
          <el-form-item label="Cron / 相对时间" required
            ><el-input v-model="form.cron" placeholder="0 9 * * * 或 +10m"
          /></el-form-item>
        </div>
        <el-form-item label="执行 Agent" required>
          <el-select
            v-model="form.agentId"
            style="width: 100%"
            @change="agentChanged"
            ><el-option
              v-for="agent in agents"
              :key="agent.id"
              :label="agent.name"
              :value="agent.id"
          /></el-select>
        </el-form-item>
        <el-form-item label="执行 Session" required>
          <el-select
            v-model="form.sessionId"
            style="width: 100%"
            :loading="sessionsLoading"
            ><el-option
              v-for="session in sessions"
              :key="session.id"
              :label="session.title || session.id"
              :value="session.id"
          /></el-select>
        </el-form-item>
        <el-form-item label="结果投递渠道">
          <el-select
            v-model="form.deliveryMode"
            style="width: 100%"
            @change="modeChanged"
          >
            <el-option label="默认渠道（当前渠道优先）" value="default" />
            <el-option
              label="仅持久化 Session（Web 照常可见）"
              value="session_only"
            />
            <el-option label="指定渠道" value="channel" />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="form.deliveryMode === 'channel'"
          label="指定投递渠道"
        >
          <el-select
            v-model="form.deliveryChannelId"
            clearable
            style="width: 100%"
            placeholder="选择 Agent 已绑定渠道"
          >
            <el-option
              v-for="channel in deliveryChannels"
              :key="channel.channelId || channel.id"
              :label="
                channel.name || channel.channel?.name || channel.channelId
              "
              :value="channel.channelId || channel.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="执行指令"
          ><el-input v-model="form.triggerPrompt" type="textarea" :rows="5"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="editorVisible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="recordsVisible"
      :title="`${recordTaskName} · 运行记录`"
      width="900px"
    >
      <el-table v-loading="recordsLoading" :data="records">
        <el-table-column prop="round" label="#" width="60" />
        <el-table-column prop="status" label="执行" width="100"
          ><template #default="{ row }"
            ><el-tag
              :type="
                row.status === 'completed'
                  ? 'success'
                  : row.status === 'failed'
                    ? 'danger'
                    : 'warning'
              "
              >{{ row.status }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column prop="deliveryStatus" label="投递" width="130" />
        <el-table-column
          prop="sessionId"
          label="Session"
          min-width="190"
          show-overflow-tooltip
        />
        <el-table-column prop="startedAt" label="开始时间" width="180"
          ><template #default="{ row }">{{
            new Date(row.startedAt).toLocaleString()
          }}</template></el-table-column
        >
        <el-table-column
          prop="errorMessage"
          label="错误"
          min-width="180"
          show-overflow-tooltip
        />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { configAPI, taskAPI } from "@/lib/configApi.js";

const tasks = ref([]),
  agents = ref([]),
  sessions = ref([]),
  records = ref([]);
const loading = ref(false),
  saving = ref(false),
  sessionsLoading = ref(false),
  recordsLoading = ref(false);
const editorVisible = ref(false),
  recordsVisible = ref(false),
  recordTaskName = ref("");
const form = reactive({
  id: "",
  name: "",
  cron: "",
  agentId: "",
  sessionId: "",
  deliveryMode: "default",
  deliveryChannelId: "",
  deliveryBindingId: "",
  triggerPrompt: "",
  status: "active",
});
const selectedAgent = computed(() =>
  agents.value.find((agent) => agent.id === form.agentId),
);
const deliveryChannels = computed(() => {
  const channels =
    selectedAgent.value?.deliveryChannels ||
    selectedAgent.value?.bindings ||
    [];
  return channels.filter(
    (channel) =>
      channel.channelId !== "web-default" &&
      channel.id !== "web-default" &&
      channel.type !== "web" &&
      channel.channel?.type !== "web",
  );
});
const agentName = (id) =>
  agents.value.find((agent) => agent.id === id)?.name || id;
const sessionName = (id) =>
  sessions.value.find((session) => session.id === id)?.title || id;
const bindingName = (task) => {
  if (task.deliveryMode === "session_only")
    return "仅持久化 Session（Web 照常可见）";
  if (task.deliveryMode === "default" || !task.deliveryBindingId)
    return "默认渠道";
  const agent = agents.value.find((item) => item.id === task.agentId);
  return (
    agent?.deliveryChannels?.find(
      (item) => item.channelId === task.deliveryChannelId,
    )?.name ||
    agent?.bindings?.find((item) => item.id === task.deliveryBindingId)?.channel
      ?.name ||
    "已指定渠道"
  );
};
const load = async () => {
  loading.value = true;
  try {
    const [taskRes, agentRes] = await Promise.all([
      taskAPI.getTasks(),
      configAPI.request("/api/agents"),
    ]);
    tasks.value = (taskRes.data || []).map((item) => ({
      ...item,
      isActive: item.status === "active",
    }));
    agents.value = agentRes.data?.agents || [];
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.value = false;
  }
};
const loadSessions = async (agentId) => {
  sessionsLoading.value = true;
  try {
    const res = await configAPI.request(`/api/agents/${agentId}/sessions`);
    sessions.value = res.data?.sessions || [];
  } finally {
    sessionsLoading.value = false;
  }
};
const reset = () =>
  Object.assign(form, {
    id: "",
    name: "",
    cron: "",
    agentId: "",
    sessionId: "",
    deliveryMode: "default",
    deliveryChannelId: "",
    deliveryBindingId: "",
    triggerPrompt: "",
    status: "active",
  });
const openCreate = () => {
  reset();
  sessions.value = [];
  editorVisible.value = true;
};
const openEdit = async (row) => {
  Object.assign(form, row, {
    deliveryMode:
      row.deliveryMode || (row.deliveryBindingId ? "channel" : "default"),
    deliveryChannelId: row.deliveryChannelId || "",
    deliveryBindingId: row.deliveryBindingId || "",
  });
  await loadSessions(row.agentId);
  editorVisible.value = true;
};
const agentChanged = async (id) => {
  form.sessionId = "";
  form.deliveryChannelId = "";
  form.deliveryBindingId = "";
  await loadSessions(id);
  if (sessions.value.length === 1) form.sessionId = sessions.value[0].id;
};
const modeChanged = (mode) => {
  if (mode !== "channel") form.deliveryChannelId = "";
};
const save = async () => {
  if (!form.name || !form.cron || !form.agentId || !form.sessionId)
    return ElMessage.warning("请完整选择任务名称、时间、Agent 和 Session");
  saving.value = true;
  try {
    await taskAPI.upsertTask({
      ...form,
      id: form.id || `task_${Date.now()}`,
      deliveryMode: form.deliveryMode,
      deliveryChannelId:
        form.deliveryMode === "channel" ? form.deliveryChannelId : null,
      deliveryBindingId: null,
    });
    ElMessage.success("任务已保存");
    editorVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    saving.value = false;
  }
};
const toggle = async (row, value) => {
  try {
    await taskAPI.toggleTask(row.id, value);
  } catch (error) {
    row.isActive = !value;
    ElMessage.error(error.message);
  }
};
const removeTask = async (row) => {
  try {
    await ElMessageBox.confirm(
      `永久删除任务「${row.name}」及其运行记录？`,
      "删除任务",
      { type: "warning" },
    );
    await taskAPI.deleteTask(row.id);
    await load();
  } catch (error) {
    if (error !== "cancel") ElMessage.error(error.message);
  }
};
const showExecutions = async (row) => {
  recordsVisible.value = true;
  recordTaskName.value = row.name || row.id;
  recordsLoading.value = true;
  try {
    const res = await taskAPI.getTaskExecutions(row.id);
    records.value = res.data || [];
  } finally {
    recordsLoading.value = false;
  }
};
onMounted(load);
</script>

<style scoped lang="scss">
.automation-view {
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  h1 {
    margin: 0 0 6px;
    font-size: 26px;
  }
  p {
    margin: 0;
    color: var(--mio-text-secondary);
  }
}
.tip {
  margin-bottom: 18px;
}
.sub {
  display: block;
  font-size: 12px;
  color: var(--mio-text-secondary);
  margin-top: 4px;
}
.two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 700px) {
  .automation-view {
    padding: 16px;
  }
  .page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
  .two-cols {
    grid-template-columns: 1fr;
  }
}
</style>
