<template>
  <div class="client-settings">
    <div class="page-header">
      <h1>客户端设置</h1>
      <p class="page-desc">管理个人资料、外观偏好与默认 Agent 配置。更改实时生效并保存到本地。</p>
    </div>

    <!-- 板块内 tabs -->
    <div class="tabs-container">
      <div class="segmented-tabs">
        <div
          :class="{ 'tab-item': true, active: activeTab === 'profile' }"
          @click="activeTab = 'profile'"
        >个人资料</div>
        <div
          :class="{ 'tab-item': true, active: activeTab === 'appearance' }"
          @click="activeTab = 'appearance'"
        >外观显示</div>
        <div
          :class="{ 'tab-item': true, active: activeTab === 'chat' }"
          @click="activeTab = 'chat'"
        >聊天设置</div>
        <div
          :class="{ 'tab-item': true, active: activeTab === 'agent' }"
          @click="activeTab = 'agent'"
        >默认 Agent</div>
      </div>
    </div>

    <div class="tab-content">
      <!-- ========== 个人资料 ========== -->
      <div v-if="activeTab === 'profile'" class="tab-pane">
        <div class="settings-card">
          <div class="setting-field">
            <span class="field-label">昵称</span>
            <div class="field-value">
              <el-input
                v-model="form.profile.name"
                placeholder="你的昵称"
                maxlength="30"
                @change="save"
              />
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">个性称号</span>
            <div class="field-value">
              <el-input
                v-model="form.profile.title"
                placeholder="显示在昵称上方的称号"
                maxlength="20"
                @change="save"
              />
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">头像</span>
            <div class="field-value">
              <div class="avatar-preview" @click="triggerAvatarUpload">
                <img
                  v-if="form.profile.avatar"
                  :src="form.profile.avatar"
                  alt="自定义头像"
                />
                <div v-else class="avatar-placeholder">
                  <el-icon :size="28"><User /></el-icon>
                </div>
                <div class="avatar-overlay">更换</div>
              </div>
              <input
                ref="avatarInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="handleAvatarSelect"
              />
              <el-button
                v-if="form.profile.avatar"
                size="small"
                text
                type="danger"
                @click="clearAvatar"
                style="margin-left: 8px"
              >清除</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 外观显示 ========== -->
      <div v-if="activeTab === 'appearance'" class="tab-pane">
        <div class="settings-card">
          <div class="setting-field">
            <span class="field-label">主题</span>
            <div class="field-value">
              <el-select v-model="form.appearance.theme" @change="save">
                <el-option label="跟随系统" value="auto" />
                <el-option label="浅色" value="light" />
                <el-option label="深色" value="dark" />
              </el-select>
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">字体大小</span>
            <div class="field-value">
              <el-select v-model="form.appearance.fontSize" @change="save">
                <el-option label="小" value="small" />
                <el-option label="标准" value="medium" />
                <el-option label="大" value="large" />
              </el-select>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 聊天设置 ========== -->
      <div v-if="activeTab === 'chat'" class="tab-pane">
        <div class="settings-card">
          <div class="setting-field">
            <span class="field-label">Enter 键行为</span>
            <div class="field-value">
              <el-switch
                v-model="form.chat.desktopEnterSend"
                active-text="发送"
                inactive-text="换行"
                @change="save"
              />
              <span class="field-hint">关闭时 Ctrl+Enter 发送</span>
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">自动朗读</span>
            <div class="field-value">
              <el-switch
                v-model="form.chat.autoReadAloud"
                active-text="开"
                inactive-text="关"
                @change="save"
              />
              <span class="field-hint">AI 回复完成后自动语音朗读</span>
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">携带时间戳</span>
            <div class="field-value">
              <el-switch
                v-model="form.chat.carryTimestamp"
                active-text="开"
                inactive-text="关"
                @change="save"
              />
              <span class="field-hint">发送消息时包裹 &lt;message time="..."&gt;</span>
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">注入用户画像</span>
            <div class="field-value">
              <el-switch
                v-model="form.chat.carryProfile"
                active-text="开"
                inactive-text="关"
                @change="save"
              />
              <span class="field-hint">首次对话时将设备和用户信息注入 prompt</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 默认 Agent ========== -->
      <div v-if="activeTab === 'agent'" class="tab-pane">
        <div class="settings-card">
          <div class="section-intro">
            选择一个本地预设作为默认 Agent。新建会话时将自动继承该预设的全部配置（模型、工具集、技能、记忆等）。
          </div>

          <div v-if="presets.length === 0" class="empty-presets">
            <el-empty description="暂无本地预设" :image-size="80">
              <span class="empty-tip">在联系人详情页中点击「保存到本地预设」来创建</span>
            </el-empty>
          </div>

          <div v-else class="preset-list">
            <div
              v-for="preset in presets"
              :key="preset.id"
              :class="{
                'preset-item': true,
                active: form.agentDefault.presetId === preset.id,
              }"
            >
              <div class="preset-radio" @click="selectPreset(preset.id)">
                <span
                  class="radio-dot"
                  :class="{
                    checked: form.agentDefault.presetId === preset.id,
                  }"
                ></span>
              </div>
              <div class="preset-info" @click="selectPreset(preset.id)">
                <div class="preset-name">{{ preset.name }}</div>
                <div class="preset-detail">
                  {{ preset.title }}
                  <span v-if="preset.options?.base?.model">
                    · {{ preset.options.base.model }}
                  </span>
                </div>
              </div>
              <el-button
                size="small"
                text
                type="danger"
                @click.stop="deletePreset(preset)"
                :disabled="presets.length <= 1 && form.agentDefault.presetId === preset.id"
              >删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { User } from "@element-plus/icons-vue";
import {
  getClientSettings,
  setClientSettings,
  getLocalPresets,
  deleteLocalPreset as removePreset,
} from "@/lib/clientSettings.js";
import { client } from "@/lib/runtime.js";

const activeTab = ref("profile");
const avatarInput = ref(null);

const form = reactive({
  profile: {
    name: "user",
    title: "Mio",
    avatar: null,
  },
  appearance: {
    theme: "auto",
    fontSize: "medium",
  },
  chat: {
    desktopEnterSend: false,
    autoReadAloud: false,
    carryTimestamp: false,
    carryProfile: false,
  },
  agentDefault: {
    presetId: null,
  },
});

const presets = ref([]);

// ========== 初始化 ==========
onMounted(async () => {
  try {
    const settings = await getClientSettings();
    Object.assign(form.profile, settings.profile || {});
    Object.assign(form.appearance, settings.appearance || {});
    Object.assign(form.chat, settings.chat || {});
    form.agentDefault.presetId = settings.agentDefault?.presetId || null;
  } catch (e) {
    console.warn("加载客户端设置失败:", e);
  }

  try {
    presets.value = await getLocalPresets();
  } catch (e) {
    console.warn("加载本地预设失败:", e);
  }
});

// ========== 保存 ==========
let saveTimer = null;
const save = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const snapshot = JSON.parse(JSON.stringify(form));
      await setClientSettings(snapshot);

      // 同步缓存到 client 实例，确保所有 composable 实时读取
      client._clientSettings = snapshot;

      // 实时同步 profile 到 client 实例
      if (form.profile.name) client.name = form.profile.name;
      if (form.profile.title) client.title = form.profile.title;
      if (form.profile.avatar) client.avatar = form.profile.avatar;
    } catch (e) {
      ElMessage.error("保存失败: " + e.message);
    }
  }, 300);
};

// ========== 头像 ==========
const triggerAvatarUpload = () => {
  avatarInput.value?.click();
};

const handleAvatarSelect = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning("头像文件大小不能超过 2MB");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    form.profile.avatar = reader.result;
    save();
  };
  reader.readAsDataURL(file);
  e.target.value = "";
};

const clearAvatar = () => {
  form.profile.avatar = null;
  client.avatar = null;
  save();
};

// ========== 预设管理 ==========
const selectPreset = async (id) => {
  form.agentDefault.presetId = id;
  try {
    const snapshot = JSON.parse(JSON.stringify(form));
    await setClientSettings(snapshot);
    client._clientSettings = snapshot;
    ElMessage.success("默认 Agent 已更新");
  } catch (e) {
    ElMessage.error("保存失败: " + e.message);
  }
};

const deletePreset = async (preset) => {
  try {
    await ElMessageBox.confirm(
      `确定删除预设「${preset.name}」？`,
      "删除确认",
      {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    await removePreset(preset.id);
    presets.value = presets.value.filter((p) => p.id !== preset.id);

    // 如果删除的是默认预设，自动清空
    if (form.agentDefault.presetId === preset.id) {
      form.agentDefault.presetId = null;
      const snapshot = JSON.parse(JSON.stringify(form));
      await setClientSettings(snapshot);
      client._clientSettings = snapshot;
    }

    ElMessage.success("预设已删除");
  } catch (e) {
    if (e !== "cancel") {
      ElMessage.error("删除失败: " + e.message);
    }
  }
};
</script>

<style scoped>
.client-settings {
  padding: 24px;
  max-width: 640px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
}

.page-desc {
  margin: 0;
  font-size: 13px;
  color: var(--mio-text-secondary);
}

/* Tabs */
.tabs-container {
  margin-bottom: 20px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}

.segmented-tabs {
  display: flex;
  background: var(--mio-bg-page);
  padding: 3px;
  border-radius: 10px;
  width: fit-content;
  white-space: nowrap;
}

.tab-item {
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--mio-text-regular);
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.tab-item.active {
  background: var(--mio-bg-card);
  color: var(--mio-text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* Cards */
.settings-card {
  background: var(--mio-bg-card);
  border-radius: 12px;
  padding: 8px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.setting-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--mio-border-color-lighter);
}

.setting-field:last-child {
  border-bottom: none;
}

.field-label {
  font-size: 13px;
  color: var(--mio-text-primary);
  flex-shrink: 0;
  width: 110px;
}

.field-value {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.field-hint {
  font-size: 12px;
  color: var(--mio-text-placeholder);
}

/* Avatar */
.avatar-preview {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  border: 1px solid var(--mio-border-color-light);
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: var(--mio-bg-page);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mio-text-placeholder);
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-preview:hover .avatar-overlay {
  opacity: 1;
}

/* Presets list */
.section-intro {
  font-size: 13px;
  color: var(--mio-text-secondary);
  padding: 16px 0 8px;
  line-height: 1.6;
}

.empty-presets {
  padding: 24px 0 8px;
}

.empty-tip {
  font-size: 12px;
  color: var(--mio-text-placeholder);
}

.preset-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--mio-border-color-lighter);
  cursor: pointer;
  transition: background 0.15s;
}

.preset-item:last-child {
  border-bottom: none;
}

.preset-item.active {
  background: var(--mio-bg-active);
  margin: 0 -12px;
  padding: 12px;
  border-radius: 8px;
  border: none;
}

.preset-radio {
  flex-shrink: 0;
  margin-right: 12px;
}

.radio-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--mio-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.radio-dot.checked {
  border-color: var(--mio-color-primary);
  background: var(--mio-color-primary);
}

.radio-dot.checked::after {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
}

.preset-info {
  flex: 1;
  min-width: 0;
}

.preset-name {
  font-size: 14px;
  font-weight: 500;
}

.preset-detail {
  font-size: 12px;
  color: var(--mio-text-secondary);
  margin-top: 2px;
}

/* Tab animation */
.tab-pane {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Mobile */
@media (max-width: 768px) {
  .client-settings {
    padding: 16px;
    max-width: none;
  }

  .settings-card {
    padding: 4px 16px;
    border-radius: 12px;
  }

  .setting-field {
    padding: 12px 0;
  }
}
</style>
