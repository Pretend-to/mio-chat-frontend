<template>
  <div class="agent-manager">
    <header class="page-header">
      <div>
        <h1>Agent 与渠道</h1>
        <p>先创建 Agent，再为它连接一个或多个通信渠道。Web 会自动连接。</p>
      </div>
      <div class="actions">
        <el-button :icon="Refresh" @click="loadAll">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">创建 Agent</el-button>
      </div>
    </header>

    <el-alert type="info" :closable="false" show-icon class="concept-tip">
      <template #title>Channel 只是消息入口，不拥有 Agent 或聊天记录</template>
      删除或解绑渠道不会删除会话；删除 Agent 会永久删除它的所有 Session、消息、定时任务和哨兵。
    </el-alert>

    <div v-loading="loading" class="agent-grid">
      <el-empty v-if="!loading && !agents.length" description="还没有 Agent" />
      <el-card v-for="agent in agents" :key="agent.id" class="agent-card" shadow="hover">
        <div class="agent-head">
          <el-avatar :src="agent.avatar" :size="48">{{ agent.name?.slice(0, 1) }}</el-avatar>
          <div class="identity">
            <strong>{{ agent.name }}</strong>
            <span>{{ agent.description || "未填写简介" }}</span>
          </div>
          <el-tag :type="agent.status === 'active' ? 'success' : 'info'">
            {{ agent.status === "active" ? "运行中" : "已停用" }}
          </el-tag>
        </div>

        <div class="model-line">
          <span>模型</span>
          <b>{{ [agent.provider, agent.model].filter(Boolean).join(" / ") || "系统默认" }}</b>
        </div>
        <div class="binding-block">
          <div class="section-label">已连接渠道</div>
          <div class="binding-list">
            <el-tag v-for="binding in agent.bindings" :key="binding.id" closable
              :disable-transitions="true" @close="unbind(agent, binding)">
              {{ binding.channel?.name || binding.channelId }}
            </el-tag>
            <span v-if="!agent.bindings?.length" class="muted">无</span>
          </div>
        </div>
        <div class="stats">
          <span>{{ agent.counts?.sessions || 0 }} 个会话</span>
          <span>{{ agent.counts?.tasks || 0 }} 个任务</span>
          <span>{{ agent.counts?.triggers || 0 }} 个哨兵</span>
        </div>
        <footer>
          <el-button link type="primary" @click="openEdit(agent)">配置</el-button>
          <el-button link type="primary" @click="openBind(agent)">绑定渠道</el-button>
          <el-button link type="danger" @click="removeAgent(agent)">删除 Agent</el-button>
        </footer>
      </el-card>
    </div>

    <el-card class="connections" shadow="never">
      <template #header>
        <div class="connections-title">
          <div><b>通信连接</b><span>连接可被多个 Agent 共享</span></div>
          <el-button type="primary" plain :icon="Plus" @click="openChannelCreate">添加渠道</el-button>
        </div>
      </template>
      <el-table :data="channels" empty-text="暂无可用渠道连接">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="type" label="类型" />
        <el-table-column prop="status" label="连接状态" width="130">
          <template #default="{ row }"><el-tag size="small">{{ row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column label="管理员认证" width="140">
          <template #default="{ row }">
            <el-tag :type="row.adminIdentity?.adminCount ? 'success' : 'warning'" size="small">
              {{ row.adminIdentity?.adminCount ? `已认证 ${row.adminIdentity.adminCount} 个` : "待认证" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="使用它的 Agent" min-width="220">
          <template #default="{ row }">{{ channelAgentNames(row.id) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="350" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.id !== 'web-default'" link type="primary" @click="openAdminClaim(row)">管理员认证</el-button>
            <el-button v-if="row.id !== 'web-default'" link type="primary" @click="openChannelAuth(row)">
              {{ row.userId || row.botId ? "重新扫码" : "扫码连接" }}
            </el-button>
            <el-button v-if="row.id !== 'web-default' && row.status === 'running'" link @click="setChannelRunning(row, false)">停止</el-button>
            <el-button v-else-if="row.id !== 'web-default'" link type="success" @click="setChannelRunning(row, true)">启动</el-button>
            <el-button v-if="row.id !== 'web-default'" link type="danger" @click="removeChannel(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="editorVisible" :title="editingId ? '配置 Agent' : '创建 Agent'" width="560px">
      <el-form :model="form" label-position="top">
        <el-form-item label="名称" required><el-input v-model="form.name" placeholder="例如：工作助理" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="form.description" /></el-form-item>
        <el-form-item label="头像 URL"><el-input v-model="form.avatar" /></el-form-item>
        <div class="two-cols">
          <el-form-item label="模型提供商">
            <el-select v-model="form.provider" clearable filterable style="width:100%" placeholder="系统默认" @change="handleProviderChange">
              <el-option v-for="provider in providerOptions" :key="provider" :label="provider" :value="provider" />
            </el-select>
          </el-form-item>
          <el-form-item label="模型">
            <el-select v-model="form.model" clearable filterable style="width:100%" :disabled="!form.provider"
              :placeholder="form.provider ? '选择模型' : '先选择模型提供商'">
              <el-option-group v-for="group in modelGroups" :key="group.label" :label="group.label">
                <el-option v-for="model in group.options" :key="model" :label="model" :value="model" />
              </el-option-group>
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="Agent 指令"><el-input v-model="form.soul" type="textarea" :rows="5" placeholder="描述角色、边界和工作方式" /></el-form-item>
        <el-form-item label="通信渠道">
          <el-select v-model="form.channelIds" multiple collapse-tags collapse-tags-tooltip style="width:100%" placeholder="可选；Web 会自动连接">
            <el-option v-for="channel in selectableChannels" :key="channel.id"
              :label="`${channel.name || channel.id} · ${channel.type}`" :value="channel.id" />
          </el-select>
          <div class="field-help">这里直接管理 Agent 与现有 Channel 的绑定；Web 入口由系统自动保留。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAgent">{{ editingId ? "保存" : "创建 Agent" }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="bindVisible" title="绑定通信渠道" width="480px">
      <p class="dialog-tip">一个 Agent 可以同时连接 Web、微信等多个渠道。</p>
      <el-checkbox-group v-model="selectedChannelIds" class="channel-options">
        <el-checkbox v-for="channel in bindableChannels" :key="channel.id" :value="channel.id" border>
          {{ channel.name || channel.id }} · {{ channel.type }}
        </el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="bindVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!selectedChannelIds.length" :loading="saving" @click="bindSelected">绑定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="channelCreateVisible" title="添加通信渠道" width="520px">
      <el-form :model="channelForm" label-position="top">
        <el-form-item label="渠道类型" required>
          <el-select v-model="channelForm.adapterId" style="width:100%">
            <el-option v-for="adapter in adapters" :key="adapter.id" :label="`${adapter.icon || '🔌'} ${adapter.name}`" :value="adapter.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="连接名称" required>
          <el-input v-model="channelForm.name" placeholder="例如：我的微信" />
        </el-form-item>
        <el-form-item label="绑定 Agent">
          <el-select v-model="channelForm.agentIds" multiple style="width:100%" placeholder="可稍后绑定">
            <el-option v-for="agent in agents" :key="agent.id" :label="agent.name" :value="agent.id" />
          </el-select>
          <div class="field-help">扫码成功后 Channel 独立保持在线；未绑定时收到消息会提示未关联 Agent。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelCreateVisible = false">取消</el-button>
        <el-button type="primary" :loading="channelCreating" @click="createChannel">创建并扫码</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="channelAuthVisible" title="连接微信" width="430px" @closed="stopChannelPoll">
      <div class="qr-panel">
        <div v-if="qrLoading" class="qr-placeholder">正在生成二维码…</div>
        <img v-else-if="qrSrc" :src="qrSrc" class="qr-image" alt="微信扫码二维码" />
        <div v-else class="qr-placeholder">二维码生成失败</div>
        <strong>{{ activeChannel?.name || "微信" }}</strong>
        <span v-if="qrStatus === 'wait'">请使用微信扫码确认</span>
        <span v-else-if="qrStatus === 'confirmed'" class="success-text">连接成功</span>
        <span v-else-if="qrStatus === 'expired'" class="warning-text">二维码已过期，请刷新</span>
        <span v-else-if="qrStatus === 'error'" class="warning-text">连接检查失败</span>
        <el-button v-if="qrStatus !== 'confirmed'" :loading="qrLoading" @click="requestChannelQr(activeChannel)">刷新二维码</el-button>
      </div>
    </el-dialog>

    <el-dialog v-model="adminClaimVisible" title="认证渠道管理员" width="520px">
      <div class="claim-panel">
        <el-alert type="warning" :closable="false" show-icon>
          认领成功后，该渠道账号将拥有与 Web 系统管理员相同的权限。请只在与机器人的私聊中发送命令。
        </el-alert>
        <template v-if="adminClaim.code">
          <div class="claim-code">{{ adminClaim.code }}</div>
          <div class="claim-command">/admin claim {{ adminClaim.code }}</div>
          <div class="field-help">认领码一次性有效，将于 {{ formatClaimExpiry(adminClaim.expiresAt) }} 过期。</div>
          <el-button type="primary" @click="copyClaimCommand">复制认领命令</el-button>
        </template>
        <template v-else>
          <p class="dialog-tip">
            {{ activeClaimChannel?.adminIdentity?.adminCount ? "当前已有管理员。如需认证另一个渠道账号，请生成新的认领码。" : "尚未生成可显示的认领码。" }}
          </p>
          <el-button type="primary" :loading="claimLoading" @click="regenerateAdminClaim">生成一次性认领码</el-button>
        </template>
      </div>
      <template #footer>
        <el-button v-if="adminClaim.code" :loading="claimLoading" @click="regenerateAdminClaim">重新生成</el-button>
        <el-button @click="adminClaimVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { Plus, Refresh } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import QRCode from "qrcode";
import { configAPI } from "@/lib/configApi.js";
import { client, config } from "@/lib/runtime.js";
import { useConfigStore } from "@/stores/configStore.js";

const configStore = useConfigStore();

const agents = ref([]);
const channels = ref([]);
const loading = ref(false);
const saving = ref(false);
const editorVisible = ref(false);
const bindVisible = ref(false);
const channelCreateVisible = ref(false);
const channelAuthVisible = ref(false);
const adminClaimVisible = ref(false);
const channelCreating = ref(false);
const claimLoading = ref(false);
const catalog = ref({ version: 1, adapters: [] });
const activeChannel = ref(null);
const activeClaimChannel = ref(null);
const adminClaim = reactive({ code: "", expiresAt: "" });
const qrSrc = ref("");
const qrCode = ref("");
const qrStatus = ref("wait");
const qrLoading = ref(false);
let pollTimer = null;
const editingId = ref("");
const bindingAgent = ref(null);
const selectedChannelIds = ref([]);
const form = reactive({ name: "", description: "", avatar: "", provider: "", model: "", soul: "", channelIds: [] });
const channelForm = reactive({ adapterId: "", name: "", agentIds: [] });
const adapters = computed(() => catalog.value.adapters || []);
const providerOptions = computed(() => {
  const providers = new Set(Object.keys(configStore.models || {}));
  for (const provider of config.getLLMProviders?.() || []) providers.add(provider.value);
  return [...providers].filter(Boolean).toSorted((a, b) => a.localeCompare(b));
});
const normalizeModel = (model) => {
  if (typeof model === "string") return model;
  return model?.id || model?.name || model?.value || "";
};
const modelGroups = computed(() => {
  if (!form.provider) return [];
  const raw = configStore.models?.[form.provider] || config.getLlmModels?.(form.provider) || [];
  if (!Array.isArray(raw)) {
    return [{ label: form.provider, options: Object.keys(raw || {}).filter(Boolean).toSorted() }];
  }
  return raw.map((group) => {
    const source = Array.isArray(group) ? group : Array.isArray(group?.models) ? group.models : [group];
    return {
      label: group?.owner || group?.label || form.provider,
      options: [...new Set(source.map(normalizeModel).filter(Boolean))].toSorted(),
    };
  }).filter((group) => group.options.length);
});

const selectableChannels = computed(() => channels.value.filter((channel) => channel.id !== "web-default"));
const bindableChannels = computed(() => {
  const bound = new Set(bindingAgent.value?.bindings?.map((item) => item.channelId) || []);
  return selectableChannels.value.filter((channel) => !bound.has(channel.id));
});

const loadAll = async () => {
  loading.value = true;
  try {
    const configRequest = Object.keys(configStore.models || {}).length
      ? Promise.resolve()
      : configStore.fetchConfig().catch((error) => console.warn("加载模型目录失败:", error));
    const [agentRes, channelRes, catalogRes] = await Promise.all([
      configAPI.request("/api/agents"),
      configAPI.request("/api/channels"),
      configAPI.request("/api/channels/catalog"),
      configRequest,
    ]);
    agents.value = agentRes.data?.agents || [];
    channels.value = channelRes.data?.channels || [];
    catalog.value = catalogRes.data || { version: 1, adapters: [] };
  } catch (error) {
    ElMessage.error(`加载失败：${error.message}`);
  } finally { loading.value = false; }
};

const resetForm = () => Object.assign(form, { name: "", description: "", avatar: "", provider: "", model: "", soul: "", channelIds: [] });
const openCreate = () => { editingId.value = ""; resetForm(); editorVisible.value = true; };
const openEdit = (agent) => {
  editingId.value = agent.id;
  Object.assign(form, {
    name: agent.name,
    description: agent.description,
    avatar: agent.avatar,
    provider: agent.provider || "",
    model: agent.model || "",
    soul: agent.soul,
    channelIds: (agent.bindings || []).filter((binding) => binding.channelId !== "web-default").map((binding) => binding.channelId),
  });
  editorVisible.value = true;
};
const handleProviderChange = (provider) => {
  if (!provider) {
    form.model = "";
    return;
  }
  const available = modelGroups.value.flatMap((group) => group.options);
  const preferred = config.getDefaultModel?.(provider);
  form.model = available.includes(preferred) ? preferred : available[0] || "";
};
const saveAgent = async () => {
  if (!form.name.trim()) return ElMessage.warning("请填写 Agent 名称");
  saving.value = true;
  try {
    const body = { name: form.name, description: form.description, avatar: form.avatar, provider: form.provider, model: form.model, soul: form.soul };
    if (editingId.value) {
      const current = agents.value.find((agent) => agent.id === editingId.value);
      const currentIds = new Set((current?.bindings || []).filter((binding) => binding.channelId !== "web-default").map((binding) => binding.channelId));
      const desiredIds = new Set(form.channelIds);
      await configAPI.request(`/api/agents/${editingId.value}`, { method: "PATCH", body });
      await Promise.all([
        ...[...desiredIds].filter((channelId) => !currentIds.has(channelId)).map((channelId) =>
          configAPI.request(`/api/agents/${editingId.value}/channels/${channelId}`, { method: "POST" })),
        ...[...currentIds].filter((channelId) => !desiredIds.has(channelId)).map((channelId) =>
          configAPI.request(`/api/agents/${editingId.value}/channels/${channelId}`, { method: "DELETE" })),
      ]);
    } else {
      await configAPI.request("/api/agents", { method: "POST", body: { ...body, channelIds: form.channelIds } });
    }
    ElMessage.success(editingId.value ? "Agent 已更新" : "Agent 与初始会话已创建");
    editorVisible.value = false;
    await loadAll();
    await client.syncChannelBots();
  } catch (error) { ElMessage.error(error.message); } finally { saving.value = false; }
};
const openBind = (agent) => { bindingAgent.value = agent; selectedChannelIds.value = []; bindVisible.value = true; };
const bindSelected = async () => {
  saving.value = true;
  try {
    await Promise.all(selectedChannelIds.value.map((channelId) => configAPI.request(`/api/agents/${bindingAgent.value.id}/channels/${channelId}`, { method: "POST" })));
    ElMessage.success("渠道已绑定"); bindVisible.value = false; await loadAll();
  } catch (error) { ElMessage.error(error.message); } finally { saving.value = false; }
};
const unbind = async (agent, binding) => {
  if (binding.channelId === "web-default") return ElMessage.info("Web 是 Agent 的基础入口，不能解绑");
  try {
    await ElMessageBox.confirm(`解绑「${binding.channel?.name || binding.channelId}」？聊天记录会保留。`, "解绑渠道", { type: "warning" });
    await configAPI.request(`/api/agents/${agent.id}/channels/${binding.channelId}`, { method: "DELETE" });
    await loadAll();
  } catch (error) { if (error !== "cancel") ElMessage.error(error.message); }
};
const removeAgent = async (agent) => {
  try {
    const preview = await configAPI.request(`/api/agents/${agent.id}/delete-preview`);
    const counts = preview.data || {};
    await ElMessageBox.confirm(`将永久删除「${agent.name}」以及 ${counts.sessions || 0} 个会话、${counts.messages || 0} 条消息、${counts.tasks || 0} 个任务和 ${counts.triggers || 0} 个哨兵。共享渠道连接不会删除。`, "永久删除 Agent", { type: "error", confirmButtonText: "永久删除" });
    await configAPI.request(`/api/agents/${agent.id}`, { method: "DELETE" });
    ElMessage.success("Agent 及其聊天记录已永久删除"); await loadAll(); await client.syncChannelBots();
  } catch (error) { if (error !== "cancel") ElMessage.error(error.message); }
};
const channelAgentNames = (channelId) => agents.value.filter((agent) => agent.bindings?.some((binding) => binding.channelId === channelId)).map((agent) => agent.name).join("、") || "尚未绑定";

const openChannelCreate = () => {
  const first = adapters.value[0];
  Object.assign(channelForm, {
    adapterId: first?.id || "weixin-ilink",
    name: first?.defaults?.name || first?.name || "微信",
    agentIds: [],
  });
  channelCreateVisible.value = true;
};

const createChannel = async () => {
  if (!channelForm.name.trim()) return ElMessage.warning("请填写连接名称");
  const adapter = adapters.value.find((item) => item.id === channelForm.adapterId);
  if (!adapter) return ElMessage.error("请选择有效的渠道类型");
  channelCreating.value = true;
  try {
    const response = await configAPI.request("/api/channels", {
      method: "POST",
      body: {
        version: catalog.value.version || 1,
        adapter: { id: adapter.id, runtime: adapter.runtime, protocol: adapter.protocol },
        profile: { name: channelForm.name.trim() },
        config: {},
      },
    });
    const channel = response.data;
    if (channel.adminClaim) Object.assign(adminClaim, channel.adminClaim);
    await Promise.all(channelForm.agentIds.map((agentId) =>
      configAPI.request(`/api/agents/${agentId}/channels/${channel.id}`, { method: "POST" }),
    ));
    channelCreateVisible.value = false;
    await loadAll();
    await openChannelAuth(channel);
  } catch (error) {
    ElMessage.error(`创建渠道失败：${error.message}`);
  } finally {
    channelCreating.value = false;
  }
};

const openChannelAuth = async (channel) => {
  activeChannel.value = channel;
  channelAuthVisible.value = true;
  await requestChannelQr(channel);
};

const requestChannelQr = async (channel) => {
  if (!channel?.id) return;
  stopChannelPoll();
  qrLoading.value = true;
  qrStatus.value = "wait";
  qrSrc.value = "";
  try {
    const response = await configAPI.request(`/api/channels/${channel.id}/qrcode`, {
      method: "POST",
      body: { force: true },
    });
    const raw = response.data?.img || "";
    qrCode.value = response.data?.qrcode || "";
    qrSrc.value = raw.startsWith("data:image")
      ? raw
      : await QRCode.toDataURL(raw || qrCode.value, { width: 240, margin: 2 });
    scheduleChannelPoll();
  } catch (error) {
    qrStatus.value = "error";
    ElMessage.error(`获取二维码失败：${error.message}`);
  } finally {
    qrLoading.value = false;
  }
};

const scheduleChannelPoll = () => {
  stopChannelPoll();
  pollTimer = window.setTimeout(pollChannelStatus, 1200);
};

const pollChannelStatus = async () => {
  const channel = activeChannel.value;
  if (!channelAuthVisible.value || !channel?.id) return;
  try {
    const response = await configAPI.request(`/api/channels/${channel.id}/poll`, {
      method: "POST",
      body: { qrcode: qrCode.value },
    });
    const status = response.data?.status || "wait";
    qrStatus.value = status;
    if (status === "confirmed") {
      stopChannelPoll();
      ElMessage.success("微信连接成功");
      await loadAll();
      channelAuthVisible.value = false;
      openAdminClaim(channel, { preserveClaim: true });
      return;
    }
    if (status === "expired") return stopChannelPoll();
    scheduleChannelPoll();
  } catch (error) {
    qrStatus.value = "error";
    stopChannelPoll();
    ElMessage.error(`检查扫码状态失败：${error.message}`);
  }
};

const openAdminClaim = (channel, { preserveClaim = false } = {}) => {
  activeClaimChannel.value = channel;
  if (!preserveClaim) Object.assign(adminClaim, channel.adminClaim || { code: "", expiresAt: "" });
  adminClaimVisible.value = true;
};

const regenerateAdminClaim = async () => {
  if (!activeClaimChannel.value?.id) return;
  claimLoading.value = true;
  try {
    const response = await configAPI.request(`/api/channels/${activeClaimChannel.value.id}/admin-claim`, { method: "POST" });
    Object.assign(adminClaim, response.data?.adminClaim || { code: "", expiresAt: "" });
    ElMessage.success("一次性管理员认领码已生成");
  } catch (error) {
    ElMessage.error(`生成认领码失败：${error.message}`);
  } finally {
    claimLoading.value = false;
  }
};

const copyClaimCommand = async () => {
  const command = `/admin claim ${adminClaim.code}`;
  try {
    await navigator.clipboard.writeText(command);
    ElMessage.success("认领命令已复制");
  } catch {
    ElMessage.warning(`请手动复制：${command}`);
  }
};

const formatClaimExpiry = (value) => value
  ? new Date(value).toLocaleString("zh-CN", { hour12: false })
  : "未知时间";

const stopChannelPoll = () => {
  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = null;
};

const setChannelRunning = async (channel, running) => {
  try {
    await configAPI.request(`/api/channels/${channel.id}/${running ? "start" : "stop"}`, { method: "POST" });
    ElMessage.success(running ? "渠道已启动" : "渠道已停止");
    await loadAll();
  } catch (error) { ElMessage.error(error.message); }
};

const removeChannel = async (channel) => {
  try {
    await ElMessageBox.confirm(`删除通信连接「${channel.name || channel.id}」？关联绑定会删除，但 Agent、Session 和聊天记录都会保留。`, "删除渠道", { type: "warning" });
    await configAPI.request(`/api/channels/${channel.id}`, { method: "DELETE" });
    ElMessage.success("渠道连接已删除，Agent 与聊天记录已保留");
    await loadAll();
  } catch (error) { if (error !== "cancel") ElMessage.error(error.message); }
};

onMounted(loadAll);
onBeforeUnmount(stopChannelPoll);
</script>

<style scoped lang="scss">
.agent-manager { max-width: 1180px; margin: 0 auto; padding: 24px; }
.page-header { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:18px; h1{margin:0 0 6px;font-size:26px} p{margin:0;color:var(--mio-text-secondary)} }
.actions { display:flex; gap:10px; }
.concept-tip { margin-bottom:20px; }
.agent-grid { min-height:160px; display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px; }
.agent-card { border-radius:14px; }
.agent-head { display:flex; align-items:center; gap:12px; .identity{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px}.identity strong{font-size:18px}.identity span,.muted{color:var(--mio-text-secondary);font-size:13px} }
.model-line,.stats { display:flex; justify-content:space-between; gap:12px; padding:14px 0; border-bottom:1px solid var(--el-border-color-lighter); color:var(--mio-text-secondary); }
.model-line b { color:var(--mio-text-primary); font-weight:500; }
.binding-block { padding:14px 0 6px; }.section-label{font-size:12px;color:var(--mio-text-secondary);margin-bottom:8px}.binding-list{display:flex;gap:8px;flex-wrap:wrap}.stats{font-size:12px;border:0;justify-content:flex-start}footer{display:flex;justify-content:flex-end;border-top:1px solid var(--el-border-color-lighter);padding-top:10px}
.connections { margin-top:22px; border-radius:14px; }.connections-title{display:flex;align-items:center;justify-content:space-between;gap:16px}.connections-title>div{display:flex;flex-direction:column;gap:4px}.connections-title span,.dialog-tip,.field-help{color:var(--mio-text-secondary);font-size:13px}.field-help{margin-top:7px;line-height:1.5}.two-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.channel-options{display:flex;flex-direction:column;gap:10px}.channel-options .el-checkbox{margin:0;width:100%}.qr-panel{display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0 18px}.qr-image,.qr-placeholder{width:240px;height:240px;border-radius:12px}.qr-image{display:block}.qr-placeholder{display:grid;place-items:center;background:var(--el-fill-color-light);color:var(--mio-text-secondary)}.success-text{color:var(--el-color-success)}.warning-text{color:var(--el-color-warning)}
.claim-panel{display:flex;flex-direction:column;align-items:stretch;gap:16px}.claim-code{font:700 26px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:2px;text-align:center}.claim-command{padding:12px 14px;border-radius:10px;background:var(--el-fill-color-light);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
@media(max-width:700px){.agent-manager{padding:16px}.page-header{align-items:flex-start;flex-direction:column}.agent-grid{grid-template-columns:1fr}.two-cols{grid-template-columns:1fr}}
</style>
