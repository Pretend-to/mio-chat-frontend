<template>
  <div class="channel-manager-view">
    <div class="page-header">
      <div class="header-title">
        <h1>渠道管理</h1>
        <div class="header-desc">
          通过 OneBots 接入微信 ClawBot 等外部平台：添加 → 绑定 → 编辑 →
          启动运行。
        </div>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="loadChannels">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openAdd"
          >添加渠道</el-button
        >
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && channels.length === 0" class="empty-state">
      <el-empty
        description="暂无渠道，点击右上角「添加渠道」"
        :image-size="100"
      />
    </div>

    <!-- 卡片骨架加载 -->
    <div v-else-if="loading" class="channel-cards">
      <div v-for="i in 3" :key="i" class="channel-card skeleton-card">
        <el-skeleton :rows="4" animated />
      </div>
    </div>

    <!-- 渠道卡片 -->
    <div v-else class="channel-cards">
      <div
        v-for="row in channels"
        :key="row.id"
        class="channel-card"
        :class="'card-' + row.status"
        :style="{
          '--platform-theme': getChannelThemeColor(row),
          '--platform-bg': getChannelBgColor(row),
        }"
      >
        <!-- 顶部：头像/平台图标 + 渠道名称与ID + 状态与平台标签 -->
        <div class="card-header">
          <div class="header-main">
            <div class="channel-avatar-wrapper">
              <img
                v-if="row.avatar"
                :src="row.avatar"
                class="channel-avatar-img"
                alt="Avatar"
              />
              <img
                v-else-if="
                  getChannelPlatformIcon(row) &&
                  !isEmojiIcon(getChannelPlatformIcon(row))
                "
                :src="getChannelPlatformIcon(row)"
                class="channel-avatar-img"
                alt="Icon"
              />
              <span v-else class="channel-avatar-emoji">{{
                getChannelPlatformIcon(row) || "💬"
              }}</span>
            </div>
            <div class="header-text">
              <div class="card-name-row">
                <span class="card-name" :title="row.name">{{ row.name }}</span>
              </div>
              <div
                class="card-id-wrapper"
                @click="copyChannelId(row.id)"
                title="点击复制渠道 ID"
              >
                <span class="card-id">{{ row.id }}</span>
                <el-icon class="copy-icon"><CopyDocument /></el-icon>
              </div>
            </div>
          </div>
          <div class="header-badges">
            <el-tag effect="plain" size="small" class="platform-tag">
              {{ getPlatformName(row) }}
            </el-tag>
            <div class="status-badge" :class="'status-' + row.status">
              <span class="status-indicator"></span>
              <span class="status-text">{{ statusText(row.status) }}</span>
            </div>
          </div>
        </div>

        <!-- 中部：Agent / 模型与配置信息聚合面板 -->
        <div class="card-body">
          <div class="info-row">
            <span class="info-label">Agent</span>
            <span class="info-value agent-badge">
              <span class="agent-icon">🤖</span>
              {{ row.agentId || "—" }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">模型</span>
            <div
              v-if="row.provider || row.model"
              class="info-value model-value"
            >
              <el-tag
                v-if="row.provider"
                size="small"
                type="info"
                effect="plain"
                class="provider-tag"
                >{{ row.provider }}</el-tag
              >
              <span class="model-name">{{ row.model || "系统默认" }}</span>
            </div>
            <span v-else class="info-value muted">系统默认</span>
          </div>
          <div v-if="row.userId" class="info-row">
            <span class="info-label">主用户</span>
            <span class="info-value user-id-val" :title="row.userId">{{
              row.userId
            }}</span>
          </div>
        </div>

        <!-- 底部：最近活跃 + 操作 -->
        <div class="card-footer">
          <div
            class="last-active"
            :title="
              row.lastActive
                ? '最后活跃时间: ' + fmtFullTime(row.lastActive)
                : ''
            "
          >
            <span v-if="row.lastActive" class="active-time">
              <span
                class="active-dot"
                :class="row.status === 'running' ? 'dot-green' : 'dot-gray'"
              ></span>
              <span class="active-text">{{
                fmtRelativeTime(row.lastActive)
              }}</span>
            </span>
            <span v-else class="active-time muted">
              <span class="active-dot dot-gray"></span>
              <span class="active-text">从未活跃</span>
            </span>
          </div>
          <div class="card-actions">
            <template v-if="isBound(row)">
              <el-button
                size="small"
                link
                type="primary"
                class="action-btn enter-btn"
                :icon="ChatDotRound"
                @click="enterChat(row)"
                >进入对话</el-button
              >
              <el-button
                size="small"
                link
                type="info"
                class="action-btn"
                @click="openEdit(row)"
                >编辑</el-button
              >
              <el-button
                v-if="row.status === 'running'"
                size="small"
                link
                type="warning"
                class="action-btn"
                @click="toggle(row, 'stop')"
                >停止</el-button
              >
              <el-button
                v-else
                size="small"
                link
                type="success"
                class="action-btn"
                @click="toggle(row, 'start')"
                >启动</el-button
              >
            </template>
            <el-button
              v-else-if="row.status === 'unbound'"
              size="small"
              link
              type="primary"
              class="action-btn"
              @click="openBind(row)"
              >扫码绑定</el-button
            >
            <el-button
              size="small"
              link
              type="danger"
              class="action-btn delete-btn"
              @click="remove(row)"
              >删除</el-button
            >
          </div>
        </div>
      </div>
    </div>

    <!-- 渠道平台选择器 -->
    <el-dialog
      v-model="selectorVisible"
      title="选择渠道平台"
      width="900px"
      destroy-on-close
      :align-center="true"
      class="channel-selector-dialog"
    >
      <div class="selector-container">
        <div class="selector-header">
          <div class="search-box">
            <el-input
              v-model="platformSearch"
              placeholder="输入关键词搜索渠道平台..."
              :prefix-icon="Search"
              clearable
            />
          </div>
        </div>

        <el-scrollbar max-height="460px" class="selector-scrollbar">
          <div v-loading="catalogLoading" class="grid-container">
            <div
              v-for="platform in filteredPlatforms"
              :key="platform.id"
              class="selector-card"
              tabindex="0"
              role="button"
              :style="{
                '--card-theme-color': getPlatformThemeColor(platform),
                '--card-bg-color': getPlatformBgColor(platform),
              }"
              @keydown.enter="selectPlatform(platform)"
              @click="selectPlatform(platform)"
            >
              <div class="card-glow"></div>
              <div class="card-icon">
                <span
                  v-if="isEmojiIcon(platform.icon)"
                  class="platform-emoji-icon"
                  >{{ platform.icon || "💬" }}</span
                >
                <img v-else :src="platform.icon" alt="Icon" />
              </div>
              <div class="card-info">
                <div class="card-title">{{ platform.name }}</div>
                <div class="card-desc">{{ platform.description }}</div>
                <div class="card-meta">
                  <el-tag size="small" effect="plain">{{
                    platform.runtime
                  }}</el-tag>
                  <el-tag size="small" type="info" effect="plain">{{
                    platform.protocol
                  }}</el-tag>
                </div>
              </div>
              <div class="card-action">
                <el-icon><Plus /></el-icon>
              </div>
            </div>
          </div>
          <el-empty
            v-if="!catalogLoading && filteredPlatforms.length === 0"
            description="没有匹配的渠道平台"
            :image-size="72"
          />
        </el-scrollbar>
      </div>
    </el-dialog>

    <!-- 添加 / 绑定 dialog -->
    <el-dialog
      v-model="bindVisible"
      :title="bound ? '绑定成功' : `添加${selectedPlatform?.name || '渠道'}`"
      width="480px"
      :close-on-click-modal="false"
    >
      <!-- 内容 1: 尚未创建渠道，填基本信息 -->
      <el-form v-if="!channelId && !bound" label-width="90px">
        <el-form-item label="名称"
          ><el-input v-model="addForm.name" placeholder="如：我的微信助手"
        /></el-form-item>
        <el-form-item label="归属 agent"
          ><el-input v-model="addForm.agentId" placeholder="默认 wechat-master"
        /></el-form-item>
        <el-form-item label="提供商">
          <el-select
            v-model="addForm.provider"
            placeholder="默认提供商"
            clearable
            @change="addForm.model = ''"
            style="width: 100%"
          >
            <el-option
              v-for="p in availableProviders"
              :key="p"
              :label="p"
              :value="p"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="模型">
          <el-select
            v-model="addForm.model"
            placeholder="默认模型"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option-group
              v-for="group in getModelGroups(addForm.provider)"
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
        </el-form-item>
        <el-form-item
          v-for="field in selectedPlatform?.configSchema || []"
          :key="field.key"
          :label="field.label"
        >
          <el-select
            v-if="field.type === 'select'"
            v-model="addConfig[field.key]"
            style="width: 100%"
          >
            <el-option
              v-for="option in field.options || []"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-switch
            v-else-if="field.type === 'boolean'"
            v-model="addConfig[field.key]"
          />
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="addConfig[field.key]"
            :min="field.min"
            :max="field.max"
            style="width: 100%"
          />
          <el-input
            v-else
            v-model="addConfig[field.key]"
            :type="field.type === 'secret' ? 'password' : 'text'"
            :placeholder="field.placeholder"
            :show-password="field.type === 'secret'"
          />
        </el-form-item>
      </el-form>
      <!-- 内容 2: 已创建，等待扫码 -->
      <div v-else-if="!bound" class="qr-box">
        <img v-if="qrSrc" :src="qrSrc" class="qr-img" alt="扫码绑定" />
        <div v-else class="qr-loading">加载二维码…</div>
        <div class="qr-hint">
          {{ selectedPlatform?.auth?.label || "扫码绑定" }}（有效期约 2 分钟）
        </div>
        <div class="qr-status" :class="'s-' + pollStatus">
          <span v-if="pollStatus === 'wait'">⏳ 等待扫码…</span>
          <span v-else-if="pollStatus === 'expired'">⏰ 二维码已过期</span>
          <span v-else-if="pollStatus === 'confirmed'">✅ 绑定成功</span>
        </div>
      </div>
      <!-- 内容 3: 绑定成功 -->
      <el-result
        v-else
        icon="success"
        :title="`${selectedPlatform?.name || '渠道'}已绑定并自动启动 🚀`"
      >
        <template #sub-title>
          <div class="bound-info">
            <div>名称：{{ current?.name }}</div>
            <div>botId：{{ current?.botId }}</div>
            <div>绑定微信：{{ current?.userId }}</div>
            <div>归属 agent：{{ current?.agentId }}</div>
            <div v-if="current?.model">
              模型：{{ current?.provider ? current.provider + "/" : ""
              }}{{ current?.model }}
            </div>
            <div
              style="
                margin-top: 8px;
                color: var(--el-color-success);
                font-weight: 500;
              "
            >
              ✨ 渠道服务已在后台自动拉起运行，现在可以直接通过该平台向 Bot
              发送消息啦！
            </div>
          </div>
        </template>
      </el-result>
      <!-- footer -->
      <template #footer>
        <template v-if="!channelId && !bound">
          <el-button @click="bindVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="creating"
            @click="createAndGetQr"
            >{{ authActionLabel }}</el-button
          >
        </template>
        <template v-else-if="!bound">
          <el-button @click="closeBind">关闭</el-button>
          <el-button
            v-if="pollStatus === 'expired'"
            type="primary"
            @click="createAndGetQr"
            >重新生成</el-button
          >
        </template>
        <el-button v-else type="primary" @click="closeBind">完成</el-button>
      </template>
    </el-dialog>

    <!-- 编辑 dialog -->
    <el-dialog
      v-model="editVisible"
      :title="`编辑渠道${current?.name ? ' - ' + current.name : ''}`"
      width="680px"
      :before-close="handleCloseEdit"
    >
      <div class="edit-dialog-layout">
        <!-- 左侧：基础配置 -->
        <div class="edit-form-pane">
          <div class="pane-subtitle">基本配置</div>
          <el-form label-width="85px" label-position="left">
            <el-form-item label="名称"
              ><el-input v-model="editForm.name"
            /></el-form-item>
            <el-form-item label="头像 URL"
              ><el-input v-model="editForm.avatar" placeholder="可选"
            /></el-form-item>
            <el-form-item label="归属 agent"
              ><el-input v-model="editForm.agentId"
            /></el-form-item>
            <el-form-item label="提供商">
              <el-select
                v-model="editForm.provider"
                placeholder="默认提供商"
                clearable
                @change="editForm.model = ''"
                style="width: 100%"
              >
                <el-option
                  v-for="p in availableProviders"
                  :key="p"
                  :label="p"
                  :value="p"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="模型">
              <el-select
                v-model="editForm.model"
                placeholder="默认模型"
                clearable
                filterable
                style="width: 100%"
              >
                <el-option-group
                  v-for="group in getModelGroups(editForm.provider)"
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
            </el-form-item>
          </el-form>
        </div>

        <!-- 右侧：微信二维码 -->
        <div v-if="isWechatPlatform(current)" class="edit-qr-pane">
          <div class="pane-subtitle">微信绑定二维码</div>
          <div class="edit-qr-card">
            <div class="edit-qr-box">
              <div v-if="editQrLoading" class="edit-qr-loading">
                <el-icon class="is-loading" :size="24"><Loading /></el-icon>
                <span>生成二维码…</span>
              </div>
              <div v-else-if="editQrSrc" class="edit-qr-wrapper">
                <img :src="editQrSrc" class="edit-qr-img" alt="微信二维码" />
                <div
                  v-if="editPollStatus === 'expired'"
                  class="edit-qr-overlay"
                >
                  <span class="expired-text">二维码已过期</span>
                  <el-button
                    size="small"
                    type="primary"
                    :icon="Refresh"
                    @click="fetchEditQr"
                    >重新获取</el-button
                  >
                </div>
              </div>
              <div v-else class="edit-qr-empty">
                <el-button
                  type="primary"
                  size="small"
                  :icon="Refresh"
                  :loading="editQrLoading"
                  @click="fetchEditQr"
                  >获取二维码</el-button
                >
              </div>
            </div>

            <div class="edit-qr-status" :class="'s-' + editPollStatus">
              <span v-if="editPollStatus === 'wait'">⏳ 等待微信扫码…</span>
              <span v-else-if="editPollStatus === 'confirmed'"
                >✅ 扫码成功，已重新绑定！</span
              >
              <span v-else-if="editPollStatus === 'expired'"
                >⏰ 二维码已过期</span
              >
            </div>

            <div class="edit-qr-desc">
              若在微信中手滑删除了 Bot，用微信重新扫码即可恢复绑定。
            </div>

            <div
              v-if="editPollStatus !== 'expired' && editQrSrc"
              class="edit-qr-action"
            >
              <el-button
                link
                type="primary"
                size="small"
                :icon="Refresh"
                :loading="editQrLoading"
                @click="fetchEditQr"
                >刷新二维码</el-button
              >
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="handleCloseEdit">关闭</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import {
  Plus,
  Refresh,
  ChatDotRound,
  Loading,
  Search,
  CopyDocument,
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import QRCode from "qrcode";
import { configAPI } from "@/lib/configApi.js";
import { useConfigStore } from "@/stores/configStore.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";

const router = useRouter();
const contactorsStore = useContactorsStore();
const configStore = useConfigStore();
const channels = ref([]);
const loading = ref(false);
const selectorVisible = ref(false);
const catalogLoading = ref(false);
const platformSearch = ref("");
const channelCatalog = ref({ version: 1, runtimes: [], adapters: [], platforms: [] });
const selectedPlatform = ref(null);
const bindVisible = ref(false);
const editVisible = ref(false);
const channelId = ref(null);
const current = ref(null);
const bound = ref(false);
const qrSrc = ref("");
const qrCode = ref("");
const addForm = ref({
  name: "",
  agentId: "wechat-master",
  provider: "",
  model: "",
});
const addConfig = ref({});
const editForm = ref({
  name: "",
  avatar: "",
  agentId: "",
  provider: "",
  model: "",
});
const creating = ref(false);
const saving = ref(false);
const pollTimer = ref(null);
const pollStatus = ref("wait");

const editQrSrc = ref("");
const editQrCode = ref("");
const editQrLoading = ref(false);
const editPollStatus = ref("wait");
const editPollTimer = ref(null);

const isWechatPlatform = (channel) => {
  const adapterId = String(channel?.adapterId || channel?.type || "").toLowerCase();
  if (adapterId === "weixin-ilink" || adapterId === "wechat") return true;
  const platform = String(channel?.platform || "").toLowerCase();
  if (platform) return platform === "wechat-clawbot";
  const type = String(channel?.type || "wechat").toLowerCase();
  return type === "wechat" || type === "onebots" || type === "onebot";
};

const catalogAdapters = computed(
  () => channelCatalog.value?.adapters || channelCatalog.value?.platforms || [],
);

const filteredPlatforms = computed(() => {
  const query = platformSearch.value.trim().toLowerCase();
  const items = catalogAdapters.value;
  if (!query) return items;
  return items.filter((platform) =>
    [platform.id, platform.name, platform.description, platform.runtime]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
});

const isEmojiIcon = (icon) => {
  if (!icon) return true;
  return (
    !/^(https?:\/\/|\/|data:image\/)/.test(icon) &&
    !/\.(png|jpe?g|svg|webp|gif)$/i.test(icon)
  );
};

const getPlatformThemeColor = (platform) => {
  const id = String(platform?.id || "").toLowerCase();
  if (id.includes("wechat") || id.includes("weixin")) return "#07c160";
  if (id.includes("qq")) return "#12b7f5";
  if (id.includes("lark") || id.includes("feishu")) return "#00d6b9";
  if (id.includes("dingtalk")) return "#007fff";
  if (id.includes("telegram")) return "#24a1de";
  if (id.includes("discord")) return "#5865f2";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 75%, 55%)`;
};

const getPlatformBgColor = (platform) => {
  const id = String(platform?.id || "").toLowerCase();
  if (id.includes("wechat") || id.includes("weixin")) return "rgba(7, 193, 96, 0.08)";
  if (id.includes("qq")) return "rgba(18, 183, 245, 0.08)";
  if (id.includes("lark") || id.includes("feishu"))
    return "rgba(0, 214, 185, 0.08)";
  if (id.includes("dingtalk")) return "rgba(0, 127, 255, 0.08)";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsla(${h}, 70%, 97%, 0.45)`;
};

const authActionLabel = computed(() =>
  selectedPlatform.value?.auth?.type === "none"
    ? "创建并启动"
    : "下一步：生成二维码",
);

const initializePlatformConfig = (platform) =>
  Object.fromEntries(
    (platform?.configSchema || []).map((field) => [
      field.key,
      field.default ?? "",
    ]),
  );

const loadChannelCatalog = async () => {
  catalogLoading.value = true;
  try {
    const response = await configAPI.request("/api/channels/catalog");
    channelCatalog.value = response.data || response;
  } catch (error) {
    ElMessage.error(`加载渠道平台失败: ${error?.message || error}`);
  } finally {
    catalogLoading.value = false;
  }
};

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
const statusText = (s) =>
  ({
    running: "运行中",
    stopped: "已停止",
    bound: "已绑定",
    unbound: "未绑定",
    expired: "已过期",
  })[s] ||
  s ||
  "—";
const statusType = (s) =>
  ({
    running: "success",
    stopped: "info",
    bound: "primary",
    unbound: "warning",
    expired: "danger",
  })[s] || "info";

const fmtRelativeTime = (t) => {
  if (!t) return "";
  const diff = Date.now() - new Date(t).getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return new Date(t).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtFullTime = (t) => {
  if (!t) return "";
  return new Date(t).toLocaleString("zh-CN", { hour12: false });
};

const copyChannelId = async (id) => {
  if (!id) return;
  try {
    await navigator.clipboard.writeText(id);
    ElMessage.success({ message: `已复制 ID: ${id}`, duration: 1500 });
  } catch {
    // 忽略剪贴板写入异常
  }
};

const findChannelPlatform = (row) =>
  catalogAdapters.value.find(
    (item) => item.id === (row.adapterId || row.type || row.platform),
  );

const getPlatformName = (row) => {
  const p = findChannelPlatform(row);
  return p?.name || row.platform || row.type || "OneBots";
};

const getChannelPlatformIcon = (row) => {
  if (row.avatar) return row.avatar;
  const p = findChannelPlatform(row);
  return p?.icon || null;
};

const getChannelThemeColor = (row) => {
  const p = findChannelPlatform(row);
  return getPlatformThemeColor(p || { id: row.platform || row.type });
};

const getChannelBgColor = (row) => {
  const p = findChannelPlatform(row);
  return getPlatformBgColor(p || { id: row.platform || row.type });
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
const openAdd = async () => {
  resetBind();
  platformSearch.value = "";
  if (!catalogAdapters.value.length) await loadChannelCatalog();
  selectorVisible.value = true;
};
const selectPlatform = (platform) => {
  selectedPlatform.value = platform;
  addConfig.value = initializePlatformConfig(platform);
  addForm.value = {
    name: platform.defaults?.name || "",
    agentId: platform.defaults?.agentId || "channel-master",
    provider: "",
    model: "",
  };
  selectorVisible.value = false;
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
    const authType = selectedPlatform.value?.auth?.type || "qrcode";
    if (!["qrcode", "none"].includes(authType)) {
      throw new Error(`暂不支持 ${authType} 认证方式`);
    }
    pollStatus.value = "wait";
    let id = channelId.value;
    let createdChannel = null;
    if (!id) {
      const res = await configAPI.request("/api/channels", {
        method: "POST",
        body: JSON.stringify({
          version: channelCatalog.value.version || 1,
          adapter: {
            id: selectedPlatform.value?.id,
            runtime: selectedPlatform.value?.runtime,
            protocol: selectedPlatform.value?.protocol,
          },
          profile: {
            name: addForm.value.name || selectedPlatform.value?.defaults?.name,
            agentId:
              addForm.value.agentId ||
              selectedPlatform.value?.defaults?.agentId,
            provider: addForm.value.provider || undefined,
            model: addForm.value.model || undefined,
          },
          config: addConfig.value,
        }),
        headers: { "Content-Type": "application/json" },
      });
      createdChannel = res.data || res;
      id = createdChannel.id;
      channelId.value = id;
    }
    if (authType === "none") {
      await configAPI.request(`/api/channels/${id}/start`, { method: "POST" });
      current.value = {
        ...(createdChannel || current.value),
        status: "running",
      };
      bound.value = true;
      return;
    }
    const qrRes = await configAPI.request(`/api/channels/${id}/qrcode`, {
      method: "POST",
    });
    const rawContent = qrRes.data?.img || qrRes.img || "";
    qrCode.value = qrRes.data?.qrcode || "";
    if (rawContent) {
      if (rawContent.startsWith("data:image")) {
        qrSrc.value = rawContent;
      } else {
        // 扫码文本/URL/base64内容通过 qrcode 库在前端本地直接转为 Canvas DataURL
        qrSrc.value = await QRCode.toDataURL(rawContent, {
          width: 200,
          margin: 2,
        });
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
        current.value = {
          ...(res.data || res),
          name: current.value?.name || addForm.value.name || "微信助手",
        };
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
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
};

const openBind = (row) => {
  resetBind();
  selectedPlatform.value = findChannelPlatform(row) || {
    id: row.adapterId || row.type || "weixin-ilink",
    name: row.adapterId || row.type || "微信 iLink",
    auth: { type: "qrcode", label: "微信扫码绑定" },
  };
  channelId.value = row.id;
  current.value = row;
  bindVisible.value = true;
  createAndGetQr();
};
const stopEditPoll = () => {
  if (editPollTimer.value) {
    clearInterval(editPollTimer.value);
    editPollTimer.value = null;
  }
};

const startEditPoll = (id, qrcode) => {
  stopEditPoll();
  if (!id) return;
  editPollTimer.value = setInterval(async () => {
    try {
      const res = await configAPI.request(`/api/channels/${id}/poll`, {
        method: "POST",
        body: JSON.stringify({ qrcode: qrcode || "" }),
        headers: { "Content-Type": "application/json" },
      });
      const st = res.data?.status || res.status;
      if (st === "confirmed") {
        editPollStatus.value = "confirmed";
        stopEditPoll();
        ElMessage.success("微信扫码绑定成功！渠道已在后台运行");
        loadChannels();
      } else if (st === "expired") {
        editPollStatus.value = "expired";
        stopEditPoll();
      } else {
        editPollStatus.value = "wait";
      }
    } catch {
      // 忽略网络重试
    }
  }, 2000);
};

const fetchEditQr = async () => {
  if (!current.value?.id) return;
  editQrLoading.value = true;
  editPollStatus.value = "wait";
  stopEditPoll();
  try {
    const qrRes = await configAPI.request(
      `/api/channels/${current.value.id}/qrcode`,
      {
        method: "POST",
        body: JSON.stringify({ force: true }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const rawContent = qrRes.data?.img || qrRes.img || "";
    editQrCode.value = qrRes.data?.qrcode || "";
    if (rawContent) {
      if (rawContent.startsWith("data:image")) {
        editQrSrc.value = rawContent;
      } else {
        // 扫码文本/URL/base64内容通过 qrcode 库在前端本地直接转为 Canvas DataURL
        editQrSrc.value = await QRCode.toDataURL(rawContent, {
          width: 180,
          margin: 2,
        });
      }
    } else {
      editQrSrc.value = "";
    }
    if (editQrSrc.value || editQrCode.value) {
      startEditPoll(current.value.id, editQrCode.value);
    }
  } catch (e) {
    ElMessage.error(`获取二维码失败: ${e?.message || e}`);
  } finally {
    editQrLoading.value = false;
  }
};

const handleCloseEdit = () => {
  stopEditPoll();
  editVisible.value = false;
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
  editQrSrc.value = "";
  editQrCode.value = "";
  editPollStatus.value = "wait";
  editVisible.value = true;
  if (isWechatPlatform(row)) {
    fetchEditQr();
  }
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
    handleCloseEdit();
    loadChannels();
  } catch (e) {
    ElMessage.error(`保存失败: ${e?.message || e}`);
  } finally {
    saving.value = false;
  }
};
const toggle = async (row, act) => {
  try {
    await configAPI.request(`/api/channels/${row.id}/${act}`, {
      method: "POST",
    });
    ElMessage.success(act === "start" ? "已启动" : "已停止");
    loadChannels();
  } catch (e) {
    ElMessage.error(`${act}失败: ${e?.message || e}`);
  }
};
const remove = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除渠道「${row.name}」？`, "删除确认", {
      type: "warning",
    });
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

const enterChat = async (row) => {
  let contactor = contactorsStore.contactors[row.id];
  if (!contactor) {
    contactor = await contactorsStore.addChannelContactor({
      id: row.id,
      channelId: row.id,
      name: row.name || "微信助手",
      avatar: row.avatar || "/static/icons/512x512.png",
      agentId: row.agentId || "wechat-master",
      model: row.model || "",
      provider: row.provider || "",
      intro: `微信渠道 Bot (${row.id})`,
    });
  }
  contactorsStore.selectContactor(contactor.id);
  router.push(`/chat/${contactor.id}`);
};

onMounted(() => {
  loadChannels();
  loadChannelCatalog();
});
onBeforeUnmount(() => {
  stopPoll();
  stopEditPoll();
});
</script>

<style scoped lang="scss">
.channel-manager-view {
  padding: 16px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.header-title h1 {
  margin: 0 0 6px;
  font-size: 20px;
}
.header-desc {
  color: var(--mio-text-secondary, #909399);
  font-size: 13px;
}

/* ── 渠道平台选择器 ── */
.channel-selector-dialog {
  :deep(.el-dialog) {
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    background: var(--mio-bg-card);
    backdrop-filter: blur(20px);
    border: 1px solid var(--mio-border-color-light);
  }

  :deep(.el-dialog__header) {
    margin-right: 0;
    padding: 20px 24px 10px;
    border-bottom: 1px solid var(--mio-border-color-light);

    .el-dialog__title {
      font-weight: 600;
      font-size: 18px;
      color: var(--mio-text-primary);
    }
  }

  :deep(.el-dialog__body) {
    padding: 16px 24px 24px;
  }
}

.selector-container {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .search-box {
    margin-bottom: 4px;

    :deep(.el-input__wrapper) {
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid var(--mio-border-color-light);
      transition: all 0.3s;

      &:hover,
      &.is-focus {
        border-color: #409eff;
        box-shadow: 0 4px 12px rgba(64, 158, 255, 0.1);
      }
    }
  }
}

.selector-scrollbar {
  max-height: 460px;
  padding-right: 4px;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding: 4px 2px 16px;
}

.selector-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 12px;
  background: var(--mio-bg-card);
  border: 1px solid var(--mio-border-color-light);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);

  .card-glow {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 12px;
    opacity: 0;
    background: var(--card-bg-color);
    transition: opacity 0.3s ease;
    z-index: 1;
  }

  .card-icon {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: var(--mio-bg-hover);
    border: 1px solid var(--mio-border-color-light);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    transition: all 0.3s;
    flex-shrink: 0;

    img {
      width: 28px;
      height: 28px;
      object-fit: contain;
    }

    .platform-emoji-icon {
      font-size: 24px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .card-info {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;

    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--mio-text-primary);
      transition: color 0.3s;
    }

    .card-desc {
      font-size: 12px;
      color: var(--mio-text-secondary);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
    }
  }

  .card-action {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--mio-bg-hover);
    color: var(--mio-text-secondary);
    font-size: 12px;
    opacity: 0;
    transform: translateX(10px);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    flex-shrink: 0;
  }

  &:hover {
    border-color: var(--card-theme-color);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.05),
      0 0 0 1px var(--card-theme-color);

    .card-glow {
      opacity: 1;
    }

    .card-icon {
      border-color: var(--card-theme-color);
      transform: scale(1.05);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.04);
    }

    .card-info .card-title {
      color: var(--card-theme-color);
    }

    .card-action {
      opacity: 1;
      transform: translateX(0);
      background: var(--card-theme-color);
      color: #ffffff;
    }
  }
}

/* ── 卡片网格 ── */
.empty-state {
  padding: 48px 0;
}
.channel-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
}

.channel-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--mio-bg-card, #ffffff);
  border: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.08));
  border-radius: 14px;
  padding: 18px 20px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;

  &:hover {
    border-color: var(--platform-theme, var(--el-color-primary));
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.06),
      0 0 0 1px var(--platform-theme, var(--el-color-primary));
  }

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: transparent;
    transition: background 0.2s;
  }

  &.card-running::before {
    background: var(--el-color-success, #67c23a);
  }
  &.card-stopped::before {
    background: var(--el-color-info-light-3, #909399);
  }
  &.card-unbound::before {
    background: var(--el-color-warning, #e6a23c);
  }
  &.card-expired::before {
    background: var(--el-color-danger, #f56c6c);
  }
}

.skeleton-card {
  min-height: 180px;
}

/* ── 卡片头部 ── */
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.channel-avatar-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--platform-bg, rgba(0, 0, 0, 0.04));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);

  .channel-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .channel-avatar-emoji {
    font-size: 22px;
    line-height: 1;
  }
}

.header-text {
  min-width: 0;
  flex: 1;
}

.card-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.card-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--mio-text-primary, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-id-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 1px 6px;
  margin-left: -6px;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: var(--mio-bg-secondary, rgba(0, 0, 0, 0.05));
    .copy-icon {
      opacity: 1;
    }
  }

  .card-id {
    font-size: 11px;
    color: var(--mio-text-secondary, #909399);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    white-space: nowrap;
  }

  .copy-icon {
    font-size: 11px;
    color: var(--mio-text-secondary, #909399);
    opacity: 0;
    transition: opacity 0.15s;
  }
}

.header-badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.platform-tag {
  font-size: 11px;
  font-family: ui-monospace, monospace;
  font-weight: 500;
  border-radius: 6px;
  padding: 0 6px;
  height: 20px;
  line-height: 18px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;

  .status-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  &.status-running {
    background: rgba(103, 194, 58, 0.12);
    color: #529b2e;
    .status-indicator {
      background: #67c23a;
      box-shadow: 0 0 0 2px rgba(103, 194, 58, 0.25);
    }
  }

  &.status-stopped {
    background: rgba(144, 147, 153, 0.12);
    color: #909399;
    .status-indicator {
      background: #909399;
    }
  }

  &.status-unbound {
    background: rgba(230, 162, 60, 0.12);
    color: #b88230;
    .status-indicator {
      background: #e6a23c;
    }
  }

  &.status-expired {
    background: rgba(245, 108, 108, 0.12);
    color: #f56c6c;
    .status-indicator {
      background: #f56c6c;
    }
  }
}

/* ── 卡片主体 ── */
.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--mio-bg-secondary, rgba(0, 0, 0, 0.025));
  border: 1px solid var(--mio-border-color-lighter, rgba(0, 0, 0, 0.04));
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  min-width: 0;
}

.info-label {
  color: var(--mio-text-secondary, #909399);
  flex-shrink: 0;
  width: 44px;
  font-weight: 500;
}

.info-value {
  color: var(--mio-text-primary, #303133);
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.agent-badge {
    font-weight: 500;
    font-family: ui-monospace, monospace;
    color: var(--mio-text-primary, #303133);

    .agent-icon {
      margin-right: 4px;
      font-size: 12px;
    }
  }
}

.model-value {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  .model-name {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.provider-tag {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  height: 18px;
  line-height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  flex-shrink: 0;
}

.user-id-val {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: var(--mio-text-secondary, #909399);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted {
  color: var(--mio-text-secondary, #909399);
}

/* ── 卡片底部 ── */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--mio-border-color-light, rgba(0, 0, 0, 0.06));
  margin-top: auto;
}

.last-active {
  font-size: 12px;
  color: var(--mio-text-secondary, #909399);
  display: flex;
  align-items: center;
  white-space: nowrap !important;
  flex-shrink: 0;
}

.active-time {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap !important;
  flex-shrink: 0;
}

.active-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-green {
  background: var(--el-color-success, #67c23a);
  box-shadow: 0 0 0 2px rgba(103, 194, 58, 0.25);
}

.dot-gray {
  background: var(--el-color-info-light-5, #c0c4cc);
}

.active-text {
  white-space: nowrap !important;
  font-weight: 500;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;

  .action-btn {
    padding: 0 6px;
    height: 26px;
    font-size: 13px;

    &.enter-btn {
      font-weight: 500;
    }
  }
}

@media (max-width: 600px) {
  .channel-cards {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .channel-card {
    padding: 14px 16px 12px;
  }
  .card-footer {
    flex-wrap: wrap;
    gap: 8px;
  }
}

/* ── 二维码弹窗 ── */
.qr-box {
  text-align: center;
  padding: 8px 0;
}
.qr-img {
  width: 200px;
  height: 200px;
  border: 1px solid #eee;
  border-radius: 8px;
}
.qr-loading {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mio-text-secondary, #909399);
}
.qr-hint {
  margin-top: 10px;
  color: var(--mio-text-secondary, #909399);
  font-size: 13px;
}
.qr-status {
  text-align: center;
  margin-top: 6px;
  font-size: 13px;
}
.s-wait {
  color: var(--mio-text-secondary, #606266);
}
.s-expired {
  color: var(--el-color-danger);
}
.bound-info {
  line-height: 1.8;
  font-size: 13px;
  color: var(--mio-text-secondary, #606266);
}

@media (max-width: 768px) {
  .channel-selector-dialog {
    :deep(.el-dialog) {
      width: 94vw !important;
      margin-top: 6vh;
      border-radius: 12px;
    }
    :deep(.el-dialog__header) {
      padding: 14px 16px 8px;
    }
    :deep(.el-dialog__body) {
      padding: 12px 16px 16px;
    }
  }
  .selector-scrollbar {
    max-height: 60vh;
  }
  .grid-container {
    grid-template-columns: 1fr;
  }
}

/* ── 编辑弹窗分栏与二维码 ── */
.edit-dialog-layout {
  display: flex;
  gap: 24px;
}
.edit-form-pane {
  flex: 1;
  min-width: 0;
}
.pane-subtitle {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 14px;
  color: var(--el-text-color-primary);
}
.edit-qr-pane {
  width: 210px;
  flex-shrink: 0;
  border-left: 1px solid var(--el-border-color-lighter);
  padding-left: 20px;
  display: flex;
  flex-direction: column;
}
.edit-qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.edit-qr-box {
  width: 180px;
  height: 180px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank, #fff);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.edit-qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--mio-text-secondary, #909399);
  font-size: 12px;
}
.edit-qr-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}
.edit-qr-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}
.edit-qr-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
}
.expired-text {
  font-size: 13px;
  font-weight: 500;
}
.edit-qr-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.edit-qr-status {
  margin-top: 10px;
  font-size: 12px;
}
.edit-qr-desc {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--mio-text-secondary, #909399);
}
.edit-qr-action {
  margin-top: 6px;
}

@media (max-width: 640px) {
  .edit-dialog-layout {
    flex-direction: column;
    gap: 16px;
  }
  .edit-qr-pane {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--el-border-color-lighter);
    padding-left: 0;
    padding-top: 16px;
  }
}
</style>
