<template>
  <div class="channel-settings-view">
    <!-- Sub tabs -->
    <div class="channel-sub-tabs">
      <div
        :class="{ 'sub-tab': true, active: activeTab === 'soul' }"
        @click="activeTab = 'soul'"
      >
        📜 灵魂与基础信息
      </div>
      <div
        :class="{ 'sub-tab': true, active: activeTab === 'model' }"
        @click="activeTab = 'model'"
      >
        🤖 模型与提供商
      </div>
      <div
        :class="{ 'sub-tab': true, active: activeTab === 'tools' }"
        @click="activeTab = 'tools'"
      >
        🛠️ 插件工具
      </div>
      <div
        :class="{ 'sub-tab': true, active: activeTab === 'skills' }"
        @click="activeTab = 'skills'"
      >
        🤹 技能库
      </div>
      <div
        :class="{ 'sub-tab': true, active: activeTab === 'memory' }"
        @click="activeTab = 'memory'"
      >
        💎 服务端记忆与结晶
      </div>
      <div
        :class="{ 'sub-tab': true, active: activeTab === 'status' }"
        @click="activeTab = 'status'"
      >
        🔌 渠道状态
      </div>
    </div>

    <!-- Tab 1: Soul & Basic Info -->
    <div v-if="activeTab === 'soul'" class="tab-pane">
      <!-- 基础信息 -->
      <div class="group-title">
        <span>基础信息</span>
        <el-button
          type="primary"
          size="small"
          :loading="savingBasic"
          @click="saveBasicInfo"
        >
          保存基础信息
        </el-button>
      </div>
      <div class="settings-card">
        <div class="setting-field">
          <div class="field-label">Agent 名称</div>
          <div class="field-value">
            <el-input v-model="basicName" placeholder="例如：微信助手" />
          </div>
        </div>
        <div class="setting-field">
          <div class="field-label">头像 URL</div>
          <div class="field-value" style="display: flex; gap: 8px; align-items: center;">
            <el-input v-model="basicAvatar" placeholder="图片地址（例如 /static/icons/512x512.png）" />
            <el-avatar :src="basicAvatar || '/static/icons/512x512.png'" :size="32" shape="square" />
          </div>
        </div>
      </div>

      <!-- 灵魂人设 -->
      <div class="group-title" style="margin-top: 8px;">
        <span>灵魂人格设定</span>
        <el-button
          type="primary"
          size="small"
          :loading="savingSoul"
          @click="saveSoul"
        >
          保存人设
        </el-button>
      </div>
      <div class="settings-card">
        <div class="card-desc">
          直接修改并持久化到后端，微信与 Web 端下一轮对话即刻生效。
        </div>
        <el-input
          v-model="soulContent"
          type="textarea"
          :rows="10"
          placeholder="请输入该 Agent 的专属人设、语气、行为准则或背景故事..."
          class="soul-textarea"
        />
      </div>
    </div>

    <!-- Tab 2: Model -->
    <div v-if="activeTab === 'model'" class="tab-pane">
      <div class="group-title">模型与提供商</div>
      <div class="settings-card">
        <div class="setting-field">
          <div class="field-label">提供商</div>
          <div class="field-value">
            <el-select
              v-model="selectedProvider"
              placeholder="默认提供商"
              clearable
              style="width: 100%"
              @change="onProviderChange"
            >
              <el-option
                v-for="p in availableProviders"
                :key="p"
                :label="p"
                :value="p"
              />
            </el-select>
          </div>
        </div>
        <div class="setting-field">
          <div class="field-label">模型</div>
          <div class="field-value">
            <el-select
              v-model="selectedModel"
              placeholder="默认模型"
              clearable
              filterable
              style="width: 100%"
              @change="saveModelConfig"
            >
              <el-option-group
                v-for="group in modelGroups"
                :key="group.label"
                :label="group.label"
              >
                <el-option
                  v-for="m in group.options"
                  :key="m"
                  :label="m"
                  :value="m"
                />
              </el-option-group>
            </el-select>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 3: Tools -->
    <div v-if="activeTab === 'tools'" class="tab-pane">
      <ContactorToolsTab
        v-model="channelToolsModel"
        :tool-call-modes-list="toolCallModesList"
        :all-llm-tools-data="allLlmToolsData"
        @update:model-value="onToolsUpdated"
      />
    </div>

    <!-- Tab 4: Skills -->
    <div v-if="activeTab === 'skills'" class="tab-pane">
      <ContactorSkillsTab />
    </div>

    <!-- Tab 5: Memory -->
    <div v-if="activeTab === 'memory'" class="tab-pane">
      <div class="group-title">分区记忆管理</div>
      <div class="settings-card editor-card">
        <div class="settings-row">
          <div class="row-left">
            <span class="card-desc" style="margin: 0;">
              当前会话核心记忆结晶（修改后微信与 Web 端实时同步生效）
            </span>
          </div>
          <div class="row-actions">
            <el-button size="small" type="danger" plain @click="clearCrystal">
              清空结晶
            </el-button>
            <el-button
              type="primary"
              size="small"
              :loading="savingCrystal"
              @click="saveCrystal"
            >
              保存修改
            </el-button>
          </div>
        </div>

        <el-tabs v-model="activeZoneTab" class="zone-tabs">
          <el-tab-pane
            v-for="zone in CRYSTAL_ZONES"
            :key="zone.key"
            :label="`${zone.icon} ${zone.label}`"
            :name="zone.key"
          >
            <el-input
              v-model="zoneContents[zone.key]"
              type="textarea"
              :autosize="{ minRows: 6, maxRows: 15 }"
              :placeholder="getZonePlaceholder(zone.key)"
              resize="vertical"
              class="zone-textarea"
            />
          </el-tab-pane>
        </el-tabs>
      </div>

      <div class="group-title" style="margin-top: 20px;">
        <span>全局长期记忆</span>
      </div>
      <div class="settings-card">
        <div v-if="Object.keys(globalMemories).length === 0" class="card-desc muted">
          暂无已落盘的全局长期记忆
        </div>
        <div
          v-for="(content, category) in globalMemories"
          :key="category"
          class="global-cat-item"
        >
          <div class="global-cat-header">
            <strong>📁 {{ category }}.md</strong>
          </div>
          <el-input
            v-model="globalMemories[category]"
            type="textarea"
            :rows="4"
            style="margin-top: 6px;"
          />
          <div style="text-align: right; margin-top: 6px;">
            <el-button size="small" @click="saveGlobalCategory(category)">保存分类</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 4: Channel Status -->
    <div v-if="activeTab === 'status'" class="tab-pane">
      <div class="group-title">
        <span>渠道运行状态</span>
        <el-button size="small" :loading="refreshingStatus" @click="refreshStatus">
          🔄 刷新状态
        </el-button>
      </div>
      <div class="settings-card">
        <div class="setting-field">
          <div class="field-label">渠道 ID</div>
          <div class="field-value">
            <code>{{ channelId }}</code>
          </div>
        </div>
        <div class="setting-field">
          <div class="field-label">归属 Agent</div>
          <div class="field-value">
            <code>{{ agentId }}</code>
          </div>
        </div>
        <div class="setting-field">
          <div class="field-label">运行状态</div>
          <div class="field-value" style="display: flex; align-items: center; gap: 12px; justify-content: flex-end;">
            <el-tag :type="channelStatus === 'running' ? 'success' : 'info'">
              {{ channelStatus === 'running' ? '● 运行中' : '○ 已停止' }}
            </el-tag>
            <el-button
              v-if="channelStatus === 'running'"
              size="small"
              type="danger"
              plain
              :loading="togglingStatus"
              @click="toggleStatus('stop')"
            >
              停止渠道
            </el-button>
            <el-button
              v-else
              size="small"
              type="success"
              :loading="togglingStatus"
              @click="toggleStatus('start')"
            >
              启动渠道
            </el-button>
          </div>
        </div>
        <div class="setting-field">
          <div class="field-label">微信服务连接</div>
          <div class="field-value" style="display: flex; align-items: center; gap: 8px; justify-content: flex-end;">
            <el-tag v-if="channelStatus === 'running' && channelConnected" type="success" effect="light">
              🟢 活跃链接已建立
            </el-tag>
            <el-tag v-else-if="channelStatus === 'running' && !channelConnected" type="danger" effect="light">
              🔴 链接断开 / 异常
            </el-tag>
            <el-tag v-else type="info" effect="plain">
              ⚪ 未建立连接
            </el-tag>
          </div>
        </div>
        <div v-if="channelStatus === 'running' && lastPollSuccess" class="setting-field">
          <div class="field-label">最近心跳探活</div>
          <div class="field-value">
            <span>{{ formatTimestamp(lastPollSuccess) }}</span>
          </div>
        </div>
        <div v-if="lastActive" class="setting-field">
          <div class="field-label">最近消息交互</div>
          <div class="field-value">
            <span>{{ formatTimestamp(lastActive) }}</span>
          </div>
        </div>
        <div v-if="lastError" class="setting-field">
          <div class="field-label">异常原因</div>
          <div class="field-value" style="color: var(--el-color-danger, #f56c6c); font-size: 12px;">
            {{ lastError }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import { client } from "@/lib/runtime.js";
import { configAPI } from "@/lib/configApi.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { debounce } from "@/utils/tools.js";
import ContactorToolsTab from "./ContactorToolsTab.vue";
import ContactorSkillsTab from "./ContactorSkillsTab.vue";
import {
  CRYSTAL_ZONES,
  parseXmlZones,
  buildXmlFromZones,
} from "@/utils/SystemPromptAssembler.js";

const props = defineProps({
  contactor: {
    type: Object,
    required: true,
  },
});

const activeTab = ref("soul");
const channelId = computed(() => props.contactor.channelId || props.contactor.id);
const agentId = computed(() => props.contactor.agentId || "wechat-master");

// Basic Info
const basicName = ref(props.contactor.name || "");
const basicAvatar = ref(props.contactor.avatar || "");
const savingBasic = ref(false);

async function saveBasicInfo() {
  savingBasic.value = true;
  try {
    await configAPI.request(`/api/channels/${channelId.value}`, {
      method: "PUT",
      body: {
        name: basicName.value,
        avatar: basicAvatar.value,
      },
    });
    const store = useContactorsStore();
    store.updateContactor(props.contactor.id, {
      name: basicName.value,
      avatar: basicAvatar.value,
    });
    props.contactor.name = basicName.value;
    props.contactor.avatar = basicAvatar.value;
    client.setLocalStorage();
    ElMessage.success("基础信息已更新！");
  } catch (err) {
    ElMessage.error(err.message || "保存基础信息失败");
  } finally {
    savingBasic.value = false;
  }
}

// Soul
const soulContent = ref("");
const savingSoul = ref(false);

const getCleanModelStr = (val) => {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    return val.models?.[0] || val.id || val.name || val.value || "";
  }
  return "";
};

// Model
const selectedProvider = ref(props.contactor.options?.provider || "");
const selectedModel = ref(getCleanModelStr(props.contactor.options?.model));
const availableProviders = ref([]);
const modelsMeta = ref({});

// Tools & Mode
const toolCallModesList = [
  { value: "AUTO", label: "AUTO (自动)" },
  { value: "ANY", label: "ANY (强制)" },
  { value: "NONE", label: "NONE (禁用)" },
];
const channelToolsModel = ref({
  toolCallSettings: {
    mode: "AUTO",
    tools: [],
  },
});

const allLlmToolsData = computed(() => {
  const toolsObj = client.config?.llmTools || {};
  const selected = channelToolsModel.value.toolCallSettings?.tools || [];
  const res = [];
  for (const key in toolsObj) {
    const group = toolsObj[key];
    if (!group || typeof group !== "object") continue;
    const toolsList = Object.keys(group).map((toolKey) => {
      const t = group[toolKey];
      const toolName = t.name;
      return {
        enabled:
          Array.isArray(selected) &&
          (selected.includes(toolName) ||
            selected.includes(toolKey) ||
            selected.includes(toolName?.split("_mid_")[0])),
        ...t,
      };
    });
    if (toolsList.length > 0) {
      res.push({
        name: key,
        tools: toolsList,
        collapsed: true,
      });
    }
  }
  return res;
});

const debounceSaveTools = debounce(async (modelVal) => {
  try {
    const tools = modelVal?.toolCallSettings?.tools || [];
    const mode = modelVal?.toolCallSettings?.mode || "AUTO";
    await configAPI.request(`/api/channels/${channelId.value}`, {
      method: "PUT",
      body: {
        tools,
        toolCallMode: mode,
      },
    });
    ElMessage.success("工具配置已自动保存！");
  } catch (err) {
    ElMessage.error(err.message || "保存工具配置失败");
  }
}, 500);

function onToolsUpdated(newVal) {
  channelToolsModel.value = newVal;
  debounceSaveTools(newVal);
}

// Memory
const zoneContents = ref(parseXmlZones(""));
const activeZoneTab = ref(CRYSTAL_ZONES[0]?.key || "long_term_profile");
const globalMemories = ref({});
const savingCrystal = ref(false);

function getZonePlaceholder(key) {
  const map = {
    long_term_profile: "在此处编辑「用户画像」内容（如技术栈偏好、称谓、工作习惯等长期事实）...",
    behavioral_guidelines: "在此处编辑「行为准则」内容（如交互规范、操作边界、禁止事项等长效偏好）...",
    short_term_goals: "在此处编辑「短期目标」内容（如当前会话核心任务、期望达成的结果）...",
    current_plan: "在此处编辑「运行计划」内容（如具体执行步骤、阶段性任务进度）...",
    file_architecture_delta: "在此处编辑「文件变更」内容（如关键文件路径与功能摘要）...",
    constraints: "在此处编辑「开发约束」内容（如技术限制条件、已知未解决的 bug 等）...",
  };
  return map[key] || "在此处编辑内容...";
}

function clearCrystal() {
  const emptyZones = {};
  CRYSTAL_ZONES.forEach((z) => (emptyZones[z.key] = ""));
  zoneContents.value = emptyZones;
}

// Status
const channelStatus = ref("stopped");
const channelConnected = ref(false);
const lastPollSuccess = ref(null);
const lastActive = ref(null);
const lastError = ref(null);
const togglingStatus = ref(false);
const refreshingStatus = ref(false);

function formatTimestamp(ts) {
  if (!ts) return "暂无";
  return new Date(ts).toLocaleString();
}

async function refreshStatus() {
  refreshingStatus.value = true;
  try {
    await loadData();
    ElMessage.success("状态已刷新");
  } finally {
    refreshingStatus.value = false;
  }
}

const modelGroups = computed(() => {
  const result = [];
  const allModels = modelsMeta.value || {};

  // 如果指定了提供商，优先只展示该提供商下的分组；未指定则按各提供商分组展示
  const targetProviders = selectedProvider.value
    ? [selectedProvider.value]
    : Object.keys(allModels);

  for (const p of targetProviders) {
    const rawGroups = allModels[p];
    if (!rawGroups) continue;

    if (Array.isArray(rawGroups)) {
      rawGroups.forEach((group) => {
        let groupLabel = p;
        if (group.owner) {
          groupLabel = selectedProvider.value ? group.owner : `${p} / ${group.owner}`;
        } else if (group.label) {
          groupLabel = selectedProvider.value ? group.label : `${p} / ${group.label}`;
        }

        let modelList = [];
        if (Array.isArray(group.models)) {
          modelList = group.models;
        } else if (Array.isArray(group)) {
          modelList = group;
        } else if (typeof group === "string") {
          modelList = [group];
        }

        if (modelList.length > 0) {
          result.push({
            label: groupLabel,
            options: modelList,
          });
        }
      });
    } else if (typeof rawGroups === "object") {
      const flatList = Object.keys(rawGroups);
      if (flatList.length > 0) {
        result.push({
          label: p,
          options: flatList,
        });
      }
    }
  }

  return result;
});

async function loadData() {
  if (!client.socket || !client.isConnected) return;

  // 1. 获取模型元数据
  try {
    const models = client.config?.getLlmModels?.() || {};
    modelsMeta.value = models;
    availableProviders.value = Object.keys(models);
  } catch {}

  // 2. 获取 Soul
  try {
    const res = await client.socket.fetch(`/api/channel/get_soul/${channelId.value}`, {});
    soulContent.value = res?.soul || "";
  } catch (err) {
    console.error("加载 soul 失败:", err);
  }

  // 3. 获取 Memory
  try {
    const res = await client.socket.fetch(`/api/channel/get_memory/${channelId.value}`, {});
    zoneContents.value = parseXmlZones(res?.crystal || "");
    globalMemories.value = res?.globals || {};
  } catch (err) {
    console.error("加载 memory 失败:", err);
  }

  // 4. 获取渠道真实运行状态、基础信息与工具配置
  try {
    const res = await configAPI.request(`/api/channels/${channelId.value}`);
    if (res?.data) {
      channelStatus.value = res.data.status || (res.data.isRunning ? "running" : "stopped");
      channelConnected.value = !!res.data.connected;
      lastPollSuccess.value = res.data.lastPollSuccess || null;
      lastActive.value = res.data.lastActive || null;
      lastError.value = res.data.lastError || null;
      if (res.data.name) basicName.value = res.data.name;
      if (res.data.avatar) basicAvatar.value = res.data.avatar;
      if (res.data.provider) selectedProvider.value = res.data.provider;
      if (res.data.model) selectedModel.value = getCleanModelStr(res.data.model);

      const savedTools = Array.isArray(res.data.tools) ? res.data.tools : [];
      const mode = res.data.toolCallMode || "AUTO";
      channelToolsModel.value = {
        toolCallSettings: {
          mode,
          tools: savedTools,
        },
      };
    }
  } catch {}
}

async function saveSoul() {
  savingSoul.value = true;
  try {
    await client.socket.fetch(`/api/channel/save_soul/${channelId.value}`, {
      soul: soulContent.value,
    });
    ElMessage.success("灵魂人格设定已保存并落盘！");
  } catch (err) {
    ElMessage.error(err.message || "保存 soul 失败");
  } finally {
    savingSoul.value = false;
  }
}

async function saveCrystal() {
  savingCrystal.value = true;
  try {
    const xml = buildXmlFromZones(zoneContents.value);
    await client.socket.fetch(`/api/channel/save_crystal/${channelId.value}`, {
      crystal: xml,
    });
    ElMessage.success("会话结晶已保存！");
  } catch (err) {
    ElMessage.error(err.message || "保存结晶失败");
  } finally {
    savingCrystal.value = false;
  }
}

async function saveGlobalCategory(category) {
  try {
    await client.socket.fetch(`/api/channel/save_global/${channelId.value}`, {
      category,
      content: globalMemories.value[category] || "",
    });
    ElMessage.success(`长期记忆 [${category}] 已更新！`);
  } catch (err) {
    ElMessage.error(err.message || "保存长期记忆失败");
  }
}

async function onProviderChange(newProvider) {
  if (newProvider) {
    const defaultModel = client.config?.getDefaultModel?.(newProvider);
    if (defaultModel) {
      selectedModel.value = getCleanModelStr(defaultModel);
    } else {
      const groups = modelGroups.value;
      if (groups.length > 0 && groups[0].options.length > 0) {
        selectedModel.value = getCleanModelStr(groups[0].options[0]);
      } else {
        selectedModel.value = "";
      }
    }
  } else {
    selectedModel.value = "";
  }
  await saveModelConfig();
}

async function saveModelConfig() {
  const modelStr = getCleanModelStr(selectedModel.value);
  selectedModel.value = modelStr;

  try {
    await configAPI.request(`/api/channels/${channelId.value}`, {
      method: "PUT",
      body: {
        provider: selectedProvider.value || "",
        model: modelStr,
      },
    });
    if (props.contactor.options) {
      props.contactor.options.provider = selectedProvider.value || "";
      props.contactor.options.model = modelStr;
    }
    client.setLocalStorage();
    ElMessage.success("模型配置已更新！");
  } catch (err) {
    ElMessage.error(err.message || "更新模型配置失败");
  }
}

async function toggleStatus(action) {
  togglingStatus.value = true;
  try {
    const res = await configAPI.request(`/api/channels/${channelId.value}/${action}`, {
      method: "POST",
    });
    if (res?.data) {
      channelStatus.value = res.data.status || (action === "start" ? "running" : "stopped");
      channelConnected.value = !!res.data.connected;
    } else {
      channelStatus.value = action === "start" ? "running" : "stopped";
      channelConnected.value = action === "start";
    }
    ElMessage.success(action === "start" ? "渠道已启动！" : "渠道已停止");
    setTimeout(() => {
      loadData();
    }, 600);
  } catch (err) {
    ElMessage.error(err.message || "操作失败");
  } finally {
    togglingStatus.value = false;
  }
}

onMounted(() => {
  loadData();
});

watch(() => props.contactor.id, () => {
  loadData();
});
</script>

<style lang="scss" scoped>
.channel-settings-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.channel-sub-tabs {
  display: flex;
  gap: 8px;
  background: var(--mio-bg-sidebar, rgba(0, 0, 0, 0.03));
  padding: 4px;
  border-radius: 10px;
  overflow-x: auto;

  .sub-tab {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s ease;
    white-space: nowrap;
    color: var(--mio-text-secondary, #666);

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    &.active {
      background: var(--mio-bg-card, #fff);
      color: var(--mio-primary, #409eff);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      font-weight: 600;
    }
  }
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--mio-text-primary, #333);
}

.settings-card {
  background: var(--mio-bg-card, #fff);
  border: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.06));
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-desc {
  font-size: 12px;
  color: var(--mio-text-secondary, #888);
  line-height: 1.6;

  code {
    background: rgba(0, 0, 0, 0.05);
    padding: 2px 6px;
    border-radius: 4px;
  }
}

.setting-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.04));

  &:last-child {
    border-bottom: none;
  }

  .field-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--mio-text-primary, #333);
  }

  .field-value {
    width: 60%;
    text-align: right;
  }
}

.global-cat-item {
  border-top: 1px dashed var(--mio-border-color-light, rgba(0, 0, 0, 0.08));
  padding-top: 12px;
  margin-top: 8px;

  &:first-child {
    border-top: none;
    padding-top: 0;
    margin-top: 0;
  }
}

.editor-card {
  padding: 16px 20px;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;

  .row-left {
    display: flex;
    align-items: center;
  }

  .row-actions {
    display: flex;
    gap: 8px;
  }
}

.zone-tabs {
  margin-top: 4px;
  :deep(.el-tabs__header) {
    margin-bottom: 12px;
  }

  :deep(.el-tabs__item) {
    font-size: 13px;
    font-weight: 500;
  }
}

.zone-textarea {
  width: 100%;
  :deep(textarea) {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.6;
    background: var(--mio-bg-chat-window, rgba(0, 0, 0, 0.02));
    color: var(--mio-text-primary);
    border: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.1));
    border-radius: 8px;
    padding: 10px 12px;
    box-shadow: none;

    &:focus {
      border-color: var(--mio-color-primary, #409eff);
      box-shadow: 0 0 0 2px var(--mio-bg-active, rgba(64, 158, 255, 0.1));
    }
  }
}

.muted {
  color: #999;
}
</style>
