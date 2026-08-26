<template>
  <div class="channel-manager-view">
    <div class="page-header">
      <div class="header-title">
        <h1>渠道管理</h1>
        <div class="header-desc">接入微信 ClawBot / iLink 等外部渠道：添加 → 扫码绑定 → 编辑基本信息 → 启动运行。</div>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="loadChannels">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openAdd">添加渠道</el-button>
      </div>
    </div>

    <el-card shadow="never" class="table-card">
      <el-table :data="channels" v-loading="loading" style="width: 100%" empty-text="暂无渠道，点击右上角「添加渠道」">
        <el-table-column label="名称" min-width="140">
          <template #default="{ row }">
            <div class="cell-main">{{ row.name }}</div>
            <div class="cell-sub">{{ row.id }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="110">
          <template #default="{ row }"><el-tag effect="plain" size="small">{{ row.type }}</el-tag></template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="dark" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="agentId" label="归属 agent" min-width="150" />
        <el-table-column label="活跃" width="150">
          <template #default="{ row }">
            <span v-if="row.lastActive" class="cell-sub">{{ fmtTime(row.lastActive) }}</span>
            <span v-else class="cell-sub">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" align="right">
          <template #default="{ row }">
            <template v-if="isBound(row)">
              <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="row.status === 'running'" size="small" link @click="toggle(row, 'stop')">停止</el-button>
              <el-button v-else size="small" link type="success" @click="toggle(row, 'start')">启动</el-button>
            </template>
            <el-button v-else-if="row.status === 'unbound'" size="small" link type="warning" @click="openBind(row)">扫码绑定</el-button>
            <el-button size="small" link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加 / 绑定 -->
    <el-dialog v-model="bindVisible" :title="bound ? '绑定成功' : '添加微信渠道'" width="440px" :close-on-click-modal="false">
      <!-- 内容 1: 尚未创建渠道，填基本信息 -->
      <el-form v-if="!channelId && !bound" label-width="90px">
        <el-form-item label="名称"><el-input v-model="addForm.name" placeholder="如：我的微信助手" /></el-form-item>
        <el-form-item label="归属 agent"><el-input v-model="addForm.agentId" placeholder="默认 wechat-master" /></el-form-item>
      </el-form>
      <!-- 内容 2: 已创建，等待扫码 -->
      <div v-else-if="!bound" class="qr-box">
        <img v-if="qrSrc" :src="qrSrc" class="qr-img" alt="扫码绑定" />
        <div v-else class="qr-loading">加载二维码…</div>
        <div class="qr-hint">用要绑定的微信扫码并确认（有效期约 2 分钟）</div>
        <div class="qr-status" :class="'s-' + pollStatus">
          <span v-if="pollStatus === 'wait'">⏳ 等待扫码…</span>
          <span v-else-if="pollStatus === 'expired'">⏰ 二维码已过期</span>
          <span v-else-if="pollStatus === 'confirmed'">✅ 绑定成功</span>
        </div>
      </div>
      <!-- 内容 3: 绑定成功 -->
      <el-result v-else icon="success" title="微信渠道已绑定">
        <template #sub-title>
          <div class="bound-info">
            <div>名称：{{ current?.name }}</div>
            <div>botId：{{ current?.botId }}</div>
            <div>绑定微信：{{ current?.userId }}</div>
            <div>归属 agent：{{ current?.agentId }}</div>
          </div>
        </template>
      </el-result>

      <!-- footer 统一：按状态条件渲染 -->
      <template #footer>
        <template v-if="!channelId && !bound">
          <el-button @click="bindVisible = false">取消</el-button>
          <el-button type="primary" :loading="creating" @click="createAndGetQr">下一步：生成二维码</el-button>
        </template>
        <template v-else-if="!bound">
          <el-button @click="closeBind">关闭</el-button>
          <el-button v-if="pollStatus === 'expired'" type="primary" @click="createAndGetQr">重新生成</el-button>
        </template>
        <el-button v-else type="primary" @click="closeBind">完成</el-button>
      </template>
    </el-dialog>

    <!-- 编辑基本信息 -->
    <el-dialog v-model="editVisible" title="编辑渠道" width="420px">
      <el-form label-width="90px">
        <el-form-item label="名称"><el-input v-model="editForm.name" /></el-form-item>
        <el-form-item label="头像 URL"><el-input v-model="editForm.avatar" placeholder="可选" /></el-form-item>
        <el-form-item label="归属 agent"><el-input v-model="editForm.agentId" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { Plus, Refresh } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { configAPI } from "@/lib/configApi.js";

const channels = ref([]);
const loading = ref(false);
const bindVisible = ref(false);
const editVisible = ref(false);
const channelId = ref(null);
const current = ref(null);
const bound = ref(false);
const qrImg = ref("");
const qrCode = ref("");
const addForm = ref({ name: "", agentId: "wechat-master" });
const editForm = ref({ name: "", avatar: "", agentId: "" });
const creating = ref(false);
const saving = ref(false);
const pollTimer = ref(null);
const pollStatus = ref("wait");

const qrSrc = computed(() =>
  qrImg.value ? (qrImg.value.startsWith("data:") ? qrImg.value : `data:image/png;base64,${qrImg.value}`) : ""
);

const isBound = (row) => !!row.userId && row.status !== "unbound";
const statusText = (s) => ({ running: "运行中", stopped: "已停止", bound: "已绑定", unbound: "未绑定", expired: "已过期" }[s] || s || "—");
const statusType = (s) => ({ running: "success", stopped: "info", bound: "primary", unbound: "warning", expired: "danger" }[s] || "info");
const fmtTime = (t) => (t ? new Date(t).toLocaleString("zh-CN") : "");

const loadChannels = async () => {
  loading.value = true;
  try {
    const res = await configAPI.request("/api/channels");
    const data = res.data || res;
    channels.value = data?.channels || [];
  } catch (e) {
    ElMessage.error(`加载失败: ${e?.message || e}`);
  } finally {
    loading.value = false;
  }
};

const resetBind = () => {
  channelId.value = null;
  current.value = null;
  bound.value = false;
  qrImg.value = "";
  qrCode.value = "";
  pollStatus.value = "wait";
};
const openAdd = () => {
  resetBind();
  addForm.value = { name: "", agentId: "wechat-master" };
  bindVisible.value = true;
};
const closeBind = () => {
  stopPoll();
  bindVisible.value = false;
  loadChannels();
};

const createAndGetQr = async () => {
  creating.value = true;
  try {
    pollStatus.value = "wait";
    let id = channelId.value;
    if (!id) {
      const res = await configAPI.request("/api/channels", {
        method: "POST",
        body: JSON.stringify({ name: addForm.value.name || "微信助手", type: "wechat" }),
        headers: { "Content-Type": "application/json" },
      });
      id = res.data?.id || res.id;
      channelId.value = id;
      await configAPI.request(`/api/channels/${id}`, {
        method: "PUT",
        body: JSON.stringify({ agentId: addForm.value.agentId || "wechat-master" }),
        headers: { "Content-Type": "application/json" },
      });
    }
    const qrRes = await configAPI.request(`/api/channels/${id}/qrcode`, { method: "POST" });
    qrImg.value = qrRes.data?.img || qrRes.img || "";
    qrCode.value = qrRes.data?.qrcode || "";
    startPoll(id, qrCode.value);
  } catch (e) {
    ElMessage.error(`生成二维码失败: ${e?.message || e}`);
  } finally {
    creating.value = false;
  }
};

const startPoll = (id, qrcode) => {
  stopPoll();
  pollTimer.value = setInterval(async () => {
    try {
      const res = await configAPI.request(`/api/channels/${id}/poll`, {
        method: "POST",
        body: JSON.stringify({ qrcode: qrcode || "" }),
        headers: { "Content-Type": "application/json" },
      });
      const st = res.data?.status || res.status;
      if (st === "confirmed") {
        pollStatus.value = "confirmed";
        bound.value = true;
        stopPoll();
        current.value = { ...(res.data || res), name: current.value?.name || addForm.value.name || "微信助手" };
        loadChannels();
      } else if (st === "expired") {
        pollStatus.value = "expired";
        stopPoll();
      } else {
        pollStatus.value = "wait";
      }
    } catch (e) {
      // 网络抖动，下一轮继续
    }
  }, 2000);
};
const stopPoll = () => {
  if (pollTimer.value) { clearInterval(pollTimer.value); pollTimer.value = null; }
};

const openBind = (row) => {
  resetBind();
  channelId.value = row.id;
  current.value = row;
  bindVisible.value = true;
  createAndGetQr();
};
const openEdit = (row) => {
  editForm.value = { name: row.name, avatar: row.avatar, agentId: row.agentId };
  current.value = row;
  editVisible.value = true;
};
const saveEdit = async () => {
  saving.value = true;
  try {
    await configAPI.request(`/api/channels/${current.value.id}`, {
      method: "PUT",
      body: JSON.stringify(editForm.value),
      headers: { "Content-Type": "application/json" },
    });
    ElMessage.success("已保存");
    editVisible.value = false;
    loadChannels();
  } catch (e) {
    ElMessage.error(`保存失败: ${e?.message || e}`);
  } finally {
    saving.value = false;
  }
};
const toggle = async (row, act) => {
  try {
    await configAPI.request(`/api/channels/${row.id}/${act}`, { method: "POST" });
    ElMessage.success(act === "start" ? "已启动" : "已停止");
    loadChannels();
  } catch (e) {
    ElMessage.error(`${act}失败: ${e?.message || e}`);
  }
};
const remove = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除渠道「${row.name}」？`, "删除确认", { type: "warning" });
  } catch {
    return;
  }
  try {
    await configAPI.request(`/api/channels/${row.id}`, { method: "DELETE" });
    ElMessage.success("已删除");
    loadChannels();
  } catch (e) {
    ElMessage.error(`删除失败: ${e?.message || e}`);
  }
};

onMounted(loadChannels);
onBeforeUnmount(stopPoll);
</script>

<style scoped>
.channel-manager-view { padding: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.header-title h1 { margin: 0 0 6px; font-size: 20px; }
.header-desc { color: var(--mio-text-secondary, #909399); font-size: 13px; }
.table-card { border-radius: 8px; }
.cell-main { font-weight: 500; }
.cell-sub { color: var(--mio-text-secondary, #909399); font-size: 12px; font-family: ui-monospace, monospace; }
.qr-box { text-align: center; padding: 8px 0; }
.qr-img { width: 200px; height: 200px; border: 1px solid #eee; border-radius: 8px; }
.qr-hint { margin-top: 10px; color: var(--mio-text-secondary, #909399); font-size: 13px; }
.qr-status { text-align: center; margin-top: 6px; font-size: 13px; }
.s-wait { color: var(--mio-text-secondary, #606266); }
.s-expired { color: var(--mio-color-danger, #f56c6c); }
.bound-info { line-height: 1.8; font-size: 13px; color: var(--mio-text-secondary, #606266); }
</style>