<template>
  <el-drawer
    :model-value="modelValue"
    class="subagent-drawer"
    direction="rtl"
    size="min(560px, 94vw)"
    title="SubAgent 工作区"
    @close="$emit('update:modelValue', false)"
  >
    <div class="drawer-toolbar">
      <div>
        <b>异步任务</b>
        <span>child Session 隔离上下文，结果回到当前主 Session</span>
      </div>
      <el-button :loading="loading" circle @click="load">
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <el-skeleton v-if="loading && !groups.length" :rows="5" animated />
    <el-empty
      v-else-if="!groups.length"
      description="当前会话还没有派发 SubAgent"
    />
    <div v-else class="group-list">
      <section v-for="group in groups" :key="group.id" class="group-card">
        <header>
          <div>
            <span class="group-id">{{ shortId(group.id) }}</span>
            <small>{{ formatTime(group.createdAt) }}</small>
          </div>
          <el-tag :type="groupTag(group.status)" effect="light">
            {{ statusText(group.status) }}
          </el-tag>
        </header>

        <div class="runs">
          <article v-for="run in group.runs" :key="run.id" class="run-row">
            <button class="run-main" type="button" @click="openRun(run.id)">
              <span class="run-state" :data-state="run.status"></span>
              <span class="run-copy">
                <b>{{ run.jobKey }}</b>
                <small>
                  {{ statusText(run.status) }}
                </small>
              </span>
            </button>
            <el-button
              v-if="canCancel(run.status)"
              link
              type="danger"
              @click="cancelRun(run)"
            >
              停止
            </el-button>
          </article>
        </div>

        <footer>
          <span>{{ group.runs.length }} 个 Run</span>
          <el-button
            v-if="group.runs.some((run) => canCancel(run.status))"
            link
            type="danger"
            @click="cancelGroup(group)"
          >
            全部停止
          </el-button>
        </footer>
      </section>
    </div>

    <el-dialog
      v-model="detailVisible"
      append-to-body
      title="SubAgent Run"
      width="min(680px, 92vw)"
    >
      <el-skeleton v-if="detailLoading" :rows="5" animated />
      <template v-else-if="selectedRun">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="任务">{{
            selectedRun.objective
          }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            {{ statusText(selectedRun.status) }}
          </el-descriptions-item>
          <el-descriptions-item label="Child Session">
            <code>{{ selectedRun.sessionId }}</code>
          </el-descriptions-item>
        </el-descriptions>
        <div class="result-block">
          <h4>交付结果</h4>
          <pre>{{
            selectedRun.resultText || errorText(selectedRun) || "尚未产出结果"
          }}</pre>
        </div>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup>
import { Refresh } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, ref, watch } from "vue";
import { subagentsAPI } from "@/lib/subagentsApi.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { mergeSubAgentGroups } from "./subAgentGroups.js";

const props = defineProps({
  agentId: { type: String, default: "" },
  modelValue: { type: Boolean, default: false },
  sessionId: { type: String, default: "" },
});
defineEmits(["update:modelValue"]);

const contactorsStore = useContactorsStore();
const snapshotGroups = ref([]);
const loading = ref(false);
const detailVisible = ref(false);
const detailLoading = ref(false);
const selectedRun = ref(null);

const activeStatuses = new Set([
  "queued",
  "running",
  "waiting_tool",
  "interrupted",
]);
const canCancel = (status) => activeStatuses.has(status);
const shortId = (value) =>
  String(value || "")
    .replace("run_group_", "")
    .slice(0, 8);
const formatTime = (value) => (value ? new Date(value).toLocaleString() : "");
const statusText = (status) =>
  ({
    blocked: "已阻塞",
    cancelled: "已停止",
    completed: "已完成",
    dispatched: "已派发",
    failed: "失败",
    planning: "规划中",
    queued: "排队中",
    result_ready: "结果已就绪",
    running: "执行中",
    waiting_children: "等待子任务",
    waiting_tool: "等待工具",
  })[status] ||
  status ||
  "未知";
const groupTag = (status) =>
  ({
    cancelled: "info",
    completed: "success",
    failed: "danger",
  })[status] || "primary";

// The REST response is only the initial snapshot. Once the drawer is open,
// stream frames update the read-only SubAgent contactors in the normal
// Socket.IO message path. Derive the displayed runs from both sources so a
// newly started run or a terminal status is visible without another timer.
const liveRuns = computed(() =>
  Object.values(contactorsStore.contactors)
    .filter(
      (contactor) =>
        contactor?.platform === "sub_agent" &&
        String(contactor.agentId || "") === String(props.agentId || "") &&
        String(contactor.parentSessionId || "") === String(props.sessionId || ""),
    )
    .map((contactor) => ({
      id: contactor.runId,
      runId: contactor.runId,
      sessionId: contactor.sessionId,
      groupId: contactor.groupId,
      agentId: contactor.agentId,
      jobKey: contactor.name,
      objective: contactor.intro,
      status: contactor.runStatus,
      updatedAt: contactor.lastUpdate,
    }))
    .filter((run) => run.id),
);

const groups = computed(() => {
  return mergeSubAgentGroups(snapshotGroups.value, liveRuns.value);
});

const load = async () => {
  if (!props.agentId || !props.sessionId) return;
  loading.value = true;
  try {
    const response = await subagentsAPI.listGroups(
      props.agentId,
      props.sessionId,
    );
    snapshotGroups.value = response.data?.groups || [];
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.value = false;
  }
};

const openRun = async (runId) => {
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const response = await subagentsAPI.getRun(runId);
    selectedRun.value = response.data;
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    detailLoading.value = false;
  }
};

const cancelRun = async (run) => {
  try {
    await ElMessageBox.confirm(
      `停止 SubAgent 任务「${run.jobKey}」？已执行的内容将保留，可随时继续或调整。`,
      "停止任务",
      {
        type: "warning",
      },
    );
    await subagentsAPI.cancelRun(run.id, "stopped_from_web");
    await load();
  } catch (error) {
    if (error !== "cancel") ElMessage.error(error.message);
  }
};

const cancelGroup = async (group) => {
  try {
    await ElMessageBox.confirm(
      "停止这个 RunGroup 中所有尚未完成的任务？已执行的内容将保留。",
      "全部停止",
      {
        type: "warning",
      },
    );
    await subagentsAPI.cancelGroup(group.id, "stopped_from_web");
    await load();
  } catch (error) {
    if (error !== "cancel") ElMessage.error(error.message);
  }
};

const errorText = (run) => {
  try {
    return JSON.parse(run?.errorJson || "null")?.message || "";
  } catch {
    return run?.errorJson || "";
  }
};

watch(
  () => [props.modelValue, props.agentId, props.sessionId],
  ([visible]) => {
    if (visible) load();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.drawer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  b,
  span {
    display: block;
  }
  span {
    margin-top: 4px;
    font-size: 12px;
    color: var(--mio-text-secondary);
  }
}
.group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.group-card {
  border: 1px solid var(--mio-border-color-light);
  border-radius: 12px;
  padding: 14px;
  background: var(--mio-bg-primary);
  header,
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  small {
    display: block;
    color: var(--mio-text-secondary);
    margin-top: 3px;
  }
  footer {
    font-size: 12px;
    color: var(--mio-text-secondary);
  }
}
.group-id {
  font-family: monospace;
  font-weight: 700;
}
.runs {
  margin: 12px 0;
  border-top: 1px solid var(--mio-border-color-light);
}
.run-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--mio-border-color-light);
  padding: 9px 0;
}
.run-main {
  border: 0;
  background: none;
  color: inherit;
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  flex: 1;
  text-align: left;
  cursor: pointer;
}
.run-copy {
  min-width: 0;
  b {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.run-state {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #909399;
  flex: none;
}
.run-state[data-state="running"] {
  background: #409eff;
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.12);
}
.run-state[data-state="result_ready"] {
  background: #e6a23c;
}
.run-state[data-state="failed"] {
  background: #f56c6c;
}
.run-state[data-state="cancelled"] {
  background: #909399;
}
.result-block {
  margin-top: 18px;
}
pre {
  white-space: pre-wrap;
  max-height: 42vh;
  overflow: auto;
  padding: 12px;
  border-radius: 8px;
  background: var(--mio-bg-secondary);
  font:
    13px/1.6 ui-monospace,
    monospace;
}
</style>
