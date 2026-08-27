<template>
  <div class="channel-manager-view">
    <div class="page-header">
      <div class="header-title">
        <h1>渠道管理</h1>
        <div class="header-desc">接入微信 ClawBot / iLink 等外部渠道：添加 → 扫码绑定 → 编辑 → 启动运行。</div>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="loadChannels">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openAdd">添加渠道</el-button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && channels.length === 0" class="empty-state">
      <el-empty description="暂无渠道，点击右上角「添加渠道」" :image-size="100" />
    </div>

    <!-- 卡片骨架加载 -->
    <div v-else-if="loading" class="channel-cards">
      <el-card v-for="i in 3" :key="i" class="channel-card skeleton-card" shadow="hover">
        <el-skeleton :rows="4" animated />
      </el-card>
    </div>

    <!-- 渠道卡片 -->
    <div v-else class="channel-cards">
      <el-card
        v-for="row in channels"
        :key="row.id"
        class="channel-card"
        shadow="hover"
        :class="'card-' + row.status"
      >
        <!-- 顶部：名称 + 类型tag + 状态tag -->
        <div class="card-header">
          <div class="card-title-row">
            <span class="card-name">{{ row.name }}</span>
            <div class="card-tags">
              <el-tag effect="plain" size="small" class="type-tag">{{ row.type || 'wechat' }}</el-tag>
              <el-tag :type="statusType(row.status)" effect="dark" size="small">{{ statusText(row.status) }}</el-tag>
            </div>
          </div>
          <div class="card-id">{{ row.id }}</div>
        </div>

        <!-- 中部：Agent / 模型信息 -->
        <div class="card-body">
          <div class="info-row">
            <span class="info-label">Agent</span>
            <span class="info-value">{{ row.agentId || '—' }}</span>
          </div>
          <div v-if="row.provider || row.model" class="info-row">
            <span class="info-label">模型</span>
            <span class="info-value model-value">
              <el-tag v-if="row.provider" size="small" type="info" effect="plain" class="provider-tag">{{ row.provider }}</el-tag>
              {{ row.model || '系统默认' }}
            </span>
          </div>
          <div v-else class="info-row">
            <span class="info-label">模型</span>
            <span class="info-value muted">系统默认</span>
          </div>
        </div>

        <!-- 底部：最近活跃 + 操作 -->
        <div class="card-footer">
          <div class="last-active">
            <span v-if="row.lastActive" class="active-time">
              <span class="active-dot" :class="row.status === 'running' ? 'dot-green' : 'dot-gray'"></span>
              {{ fmtRelativeTime(row.lastActive) }}
            </span>
            <span v-else class="muted">从未活跃</span>
          </div>
          <div class="card-actions">
            <template v-if="isBound(row)">
              <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="row.status === 'running'" size="small" link type="warning" @click="toggle(row, 'stop')">停止</el-button>
              <el-button v-else size="small" link type="success" @click="toggle(row, 'start')">启动</el-button>
            </template>
            <el-button v-else-if="row.status === 'unbound'" size="small" link type="primary" @click="openBind(row)">扫码绑定</el-button>
            <el-button size="small" link type="danger" @click="remove(row)">删除</el-button>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 添加 / 绑定 dialog -->
    <el-dialog v-model="bindVisible" :title="bound ? '绑定成功' : '添加微信渠道'" width="480px" :close-on-click-modal="false">
      <!-- 内容 1: 尚未创建渠道，填基本信息 -->
      <el-form v-if="!channelId && !bound" label-width="90px">
        <el-form-item label="名称"><el-input v-model="addForm.name" placeholder="如：我的微信助手" /></el-form-item>
        <el-form-item label="归属 agent"><el-input v-model="addForm.agentId" placeholder="默认 wechat-master" /></el-form-item>
        <el-form-item label="提供商">
          <el-select v-model="addForm.provider" placeholder="默认提供商" clearable @change="addForm.model = ''" style="width: 100%">
            <el-option v-for="p in availableProviders" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型">
          <el-select v-model="addForm.model" placeholder="默认模型" clearable filterable style="width: 100%">
            <el-option-group v-for="group in getModelGroups(addForm.provider)" :key="group.label" :label="group.label">
              <el-option v-for="m in group.options" :key="m" :label="m" :value="m" />
            </el-option-group>
          </el-select>
        </el-form-item>
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
            <div v-if="current?.model">模型：{{ current?.provider ? current.provider + '/' : '' }}{{ current?.model }}</div>
          </div>
        </template>
      </el-result>
      <!-- footer -->
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

    <!-- 编辑 dialog -->
    <el-dialog v-model="editVisible" title="编辑渠道" width="480px">
      <el-form label-width="90px">
        <el-form-item label="名称"><el-input v-model="editForm.name" /></el-form-item>
        <el-form-item label="头像 URL"><el-input v-model="editForm.avatar" placeholder="可选" /></el-form-item>
        <el-form-item label="归属 agent"><el-input v-model="editForm.agentId" /></el-form-item>
        <el-form-item label="提供商">
          <el-select v-model="editForm.provider" placeholder="默认提供商" clearable @change="editForm.model = ''" style="width: 100%">
            <el-option v-for="p in availableProviders" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型">
          <el-select v-model="editForm.model" placeholder="默认模型" clearable filterable style="width: 100%">
            <el-option-group v-for="group in getModelGroups(editForm.provider)" :key="group.label" :label="group.label">
              <el-option v-for="m in group.options" :key="m" :label="m" :value="m" />
            </el-option-group>
          </el-select>
        </el-form-item>
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
import QRCode from "qrcode";
import { configAPI } from "@/lib/configApi.js";
import { useConfigStore } from "@/stores/configStore.js";

const configStore = useConfigStore();
const channels = ref([]);
const loading = ref(false);
const bindVisible = ref(false);
const editVisible = ref(false);
const channelId = ref(null);
const current = ref(null);
const bound = ref(false);
const qrSrc = ref("");
const qrCode = ref("");
const addForm = ref({ name: "", agentId: "wechat-master", provider: "", model: "" });
const editForm = ref({ name: "", avatar: "", agentId: "", provider: "", model: "" });
const creating = ref(false);
const saving = ref(false);
const pollTimer = ref(null);
const pollStatus = ref("wait");

// 可用提供商列表
const availableProviders = computed(() => {
  return Object.keys(configStore.models || {});
});

// 根据 provider 获取分组模型列表
const getModelGroups = (provider) => {
  if (!provider) {
    // 未选 provider 时，列出所有 provider 下的模型
    const res = [];
    for (const [p, groups] of Object.entries(configStore.models || {})) {
      const allPModels = [];
      if (Array.isArray(groups)) {
        for (const g of groups) {
          if (Array.isArray(g.models)) allPModels.push(...g.models);
          else if (typeof g === "string") allPModels.push(g);
        }
      }
      if (allPModels.length > 0) {
        res.push({ label: p, options: allPModels });
      }
    }
    return res;
  }
  const groups = configStore.models[provider] || [];
  if (!Array.isArray(groups)) return [];
  return groups.map((g) => ({
    label: g.owner || g.group || provider,
    options: Array.isArray(g.models) ? g.models : [g],
  }));
};

const isBound = (row) => !!row.userId && row.status !== "unbound";
const statusText = (s) => ({ running: "运行中", stopped: "已停止", bound: "已绑定", unbound: "未绑定", expired: "已过期" }[s] || s || "—");
const statusType = (s) => ({ running: "success", stopped: "info", bound: "primary", unbound: "warning", expired: "danger" }[s] || "info");

const fmtRelativeTime = (t) => {
  if (!t) return "";
  const diff = Date.now() - new Date(t).getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return new Date(t).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

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
  qrSrc.value = "";
  qrCode.value = "";
  pollStatus.value = "wait";
};
const openAdd = () => {
  resetBind();
  addForm.value = { name: "", agentId: "wechat-master", provider: "", model: "" };
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
        body: JSON.stringify({ 
          name: addForm.value.name || "微信助手", 
          type: "wechat",
          provider: addForm.value.provider || undefined,
          model: addForm.value.model || undefined,
        }),
        headers: { "Content-Type": "application/json" },
      });
      id = res.data?.id || res.id;
      channelId.value = id;
      await configAPI.request(`/api/channels/${id}`, {
        method: "PUT",
        body: JSON.stringify({ 
          agentId: addForm.value.agentId || "wechat-master",
          provider: addForm.value.provider || undefined,
          model: addForm.value.model || undefined,
        }),
        headers: { "Content-Type": "application/json" },
      });
    }
    const qrRes = await configAPI.request(`/api/channels/${id}/qrcode`, { method: "POST" });
    const rawContent = qrRes.data?.img || qrRes.img || "";
    qrCode.value = qrRes.data?.qrcode || "";
    if (rawContent) {
      if (rawContent.startsWith("data:image")) {
        qrSrc.value = rawContent;
      } else {
        // 扫码文本/URL/base64内容通过 qrcode 库在前端本地直接转为 Canvas DataURL
        qrSrc.value = await QRCode.toDataURL(rawContent, { width: 200, margin: 2 });
      }
    } else {
      qrSrc.value = "";
    }
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
  editForm.value = { 
    name: row.name, 
    avatar: row.avatar, 
    agentId: row.agentId,
    provider: row.provider || "",
    model: row.model || "",
  };
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
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.header-title h1 { margin: 0 0 6px; font-size: 20px; }
.header-desc { color: var(--mio-text-secondary, #909399); font-size: 13px; }

/* ── 卡片网格 ── */
.empty-state { padding: 48px 0; }
.channel-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.channel-card {
  border-radius: 10px;
  transition: box-shadow 0.2s;
  border-top: 3px solid transparent;
}
.channel-card.card-running  { border-top-color: var(--el-color-success); }
.channel-card.card-stopped  { border-top-color: var(--el-color-info); }
.channel-card.card-unbound  { border-top-color: var(--el-color-warning); }
.channel-card.card-expired  { border-top-color: var(--el-color-danger); }
.skeleton-card { min-height: 160px; }

/* ── 卡片头部 ── */
.card-header { margin-bottom: 12px; }
.card-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.card-name { font-weight: 600; font-size: 15px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-tags { display: flex; gap: 4px; flex-shrink: 0; }
.type-tag { font-family: ui-monospace, monospace; }
.card-id { font-size: 11px; color: var(--mio-text-secondary, #909399); font-family: ui-monospace, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── 卡片主体 ── */
.card-body { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.info-row { display: flex; align-items: baseline; gap: 8px; font-size: 13px; }
.info-label { color: var(--mio-text-secondary, #909399); flex-shrink: 0; min-width: 36px; }
.info-value { color: var(--el-text-color-primary); word-break: break-all; }
.model-value { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.provider-tag { font-family: ui-monospace, monospace; font-size: 11px; }
.muted { color: var(--mio-text-secondary, #909399); }

/* ── 卡片底部 ── */
.card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 10px; border-top: 1px solid var(--el-border-color-lighter); }
.last-active { font-size: 12px; color: var(--mio-text-secondary, #909399); display: flex; align-items: center; gap: 5px; }
.active-time { display: flex; align-items: center; gap: 5px; }
.active-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot-green { background: var(--el-color-success); box-shadow: 0 0 0 2px rgba(103, 194, 58, 0.25); }
.dot-gray  { background: var(--el-color-info-light-5); }
.card-actions { display: flex; gap: 2px; flex-shrink: 0; }

/* ── 二维码弹窗 ── */
.qr-box { text-align: center; padding: 8px 0; }
.qr-img { width: 200px; height: 200px; border: 1px solid #eee; border-radius: 8px; }
.qr-loading { height: 200px; display: flex; align-items: center; justify-content: center; color: var(--mio-text-secondary, #909399); }
.qr-hint { margin-top: 10px; color: var(--mio-text-secondary, #909399); font-size: 13px; }
.qr-status { text-align: center; margin-top: 6px; font-size: 13px; }
.s-wait { color: var(--mio-text-secondary, #606266); }
.s-expired { color: var(--el-color-danger); }
.bound-info { line-height: 1.8; font-size: 13px; color: var(--mio-text-secondary, #606266); }
</style>