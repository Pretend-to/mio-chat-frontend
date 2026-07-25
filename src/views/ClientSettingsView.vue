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
            <div class="field-value avatar-field-value">
              <div class="profile-avatar-display" @click="openAvatarDialog">
                <img
                  :src="getAdminAvatarUrl(form.profile.avatar)"
                  alt="个人头像"
                  class="profile-avatar-img"
                />
              </div>
              <el-button type="primary" plain size="small" @click="openAvatarDialog">
                修改头像
              </el-button>
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
              <el-select v-model="form.appearance.theme" @change="onAppearanceChange">
                <el-option label="跟随系统" value="auto" />
                <el-option label="浅色" value="light" />
                <el-option label="深色" value="dark" />
              </el-select>
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">字体大小</span>
            <div class="field-value">
              <el-select v-model="form.appearance.fontSize" @change="onAppearanceChange">
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
            <span class="field-label">
              Enter 键行为
              <el-tooltip content="关闭时 Ctrl+Enter 发送消息" placement="top">
                <el-icon class="label-hint-icon"><InfoFilled /></el-icon>
              </el-tooltip>
            </span>
            <div class="field-value">
              <el-switch
                v-model="form.chat.desktopEnterSend"
                active-text="发送"
                inactive-text="换行"
                @change="save"
              />
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">
              自动朗读
              <el-tooltip content="AI 回复完成后自动进行语音朗读" placement="top">
                <el-icon class="label-hint-icon"><InfoFilled /></el-icon>
              </el-tooltip>
            </span>
            <div class="field-value">
              <el-switch
                v-model="form.chat.autoReadAloud"
                active-text="开"
                inactive-text="关"
                @change="save"
              />
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">
              朗读音色
              <el-tooltip content="选择语音朗读使用的系统音色" placement="top">
                <el-icon class="label-hint-icon"><InfoFilled /></el-icon>
              </el-tooltip>
            </span>
            <div class="field-value">
              <el-select
                v-model="form.chat.readAloudVoice"
                style="width: 220px"
                @change="save"
              >
                <el-option label="自动选择 (默认中文)" value="auto" />
                <el-option
                  v-for="voice in availableVoices"
                  :key="voice.voiceURI"
                  :label="`${voice.name} (${voice.lang})`"
                  :value="voice.voiceURI"
                />
              </el-select>
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">
              携带时间戳
              <el-tooltip content="发送消息时自动包合时间戳标签 <message time='...'>" placement="top">
                <el-icon class="label-hint-icon"><InfoFilled /></el-icon>
              </el-tooltip>
            </span>
            <div class="field-value">
              <el-switch
                v-model="form.chat.carryTimestamp"
                active-text="开"
                inactive-text="关"
                @change="save"
              />
            </div>
          </div>
          <div class="setting-field">
            <span class="field-label">
              注入用户画像
              <el-tooltip content="首次对话时将设备与用户信息自动注入 Prompt" placement="top">
                <el-icon class="label-hint-icon"><InfoFilled /></el-icon>
              </el-tooltip>
            </span>
            <div class="field-value">
              <el-switch
                v-model="form.chat.carryProfile"
                active-text="开"
                inactive-text="关"
                @change="save"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 默认 Agent ========== -->
      <div v-if="activeTab === 'agent'" class="tab-pane">
        <div class="settings-card">
          <div class="section-intro">
            选择一个预设作为默认 Agent。新建会话时将自动继承该预设的全部配置（模型、工具集、技能、记忆等）。
          </div>

          <div class="preset-list">
            <!-- 默认空白 Agent (系统内置，不可删除) -->
            <div
              :class="{
                'preset-item': true,
                active: !form.agentDefault.presetId,
              }"
              @click="selectPreset(null)"
            >
              <div class="preset-radio">
                <span
                  class="radio-dot"
                  :class="{
                    checked: !form.agentDefault.presetId,
                  }"
                ></span>
              </div>
              <div class="preset-info">
                <div class="preset-name">默认空白 Agent</div>
                <div class="preset-detail">
                  系统内置基础预设 · 使用全局默认模型与工具配置
                </div>
              </div>
              <el-tag size="small" type="info" effect="plain" class="system-tag">内置</el-tag>
            </div>

            <!-- 用户本地创建的预设 -->
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
                  {{ preset.title || '本地预设' }}
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
              >删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 头像设置对话框 ========== -->
    <el-dialog
      v-model="avatarDialogVisible"
      title="修改头像"
      width="460px"
      class="avatar-setting-dialog"
      append-to-body
    >
      <div class="avatar-dialog-body">
        <!-- 1. 头像策略选择 -->
        <div class="dialog-section">
          <div class="dialog-section-label">头像策略</div>
          <el-radio-group v-model="tempPolicy" size="default" class="policy-radio-group">
            <el-radio-button value="system">跟随系统</el-radio-button>
            <el-radio-button value="qq">自定义 QQ</el-radio-button>
            <el-radio-button value="url">自定义 URL</el-radio-button>
            <el-radio-button value="upload">上传图片</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 2. 动态输入/操作区 -->
        <div class="dialog-section policy-content-section">
          <div v-if="tempPolicy === 'system'" class="policy-hint">
            使用系统默认 QQ 头像（1099834705）
          </div>

          <div v-else-if="tempPolicy === 'qq'" class="policy-input-box">
            <el-input
              v-model="tempQq"
              placeholder="请输入 QQ 号码（如：1099834705）"
              clearable
            />
          </div>

          <div v-else-if="tempPolicy === 'url'" class="policy-input-box">
            <el-input
              v-model="tempUrl"
              placeholder="请输入图片 URL（https://...）"
              clearable
            />
          </div>

          <div v-else-if="tempPolicy === 'upload'" class="policy-upload-box">
            <el-button type="primary" plain @click="triggerCropFileSelect">
              <el-icon style="margin-right: 4px"><Picture /></el-icon>
              选择图片并裁切
            </el-button>
            <span v-if="tempUploadedAvatar" class="upload-status-tag">已选择裁切图片</span>
            <input
              ref="cropFileInputRef"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleCropFileSelected"
            />
          </div>
        </div>

        <!-- 3. 头像预览区 -->
        <div class="dialog-section preview-section">
          <div class="dialog-section-label">头像预览</div>
          <div class="avatar-preview-box">
            <img
              :src="dialogPreviewUrl"
              alt="头像预览"
              class="dialog-preview-img"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="avatarDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmAvatarChange">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 图片裁剪二次弹窗 -->
    <ImageCropper
      :visible="cropperVisible"
      :image-src="selectedImageSrc"
      @close="cropperVisible = false"
      @confirm="handleCropperConfirm"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Picture, InfoFilled } from "@element-plus/icons-vue";
import ImageCropper from "@/components/settings/ImageCropper.vue";
import { useConfigStore } from "@/stores/configStore.js";
import { applyAppearanceSettings } from "@/utils/appearance.js";
import {
  getClientSettings,
  setClientSettings,
  getLocalPresets,
  deleteLocalPreset as removePreset,
} from "@/lib/clientSettings.js";
import { client } from "@/lib/runtime.js";
import { getAdminAvatarUrl } from "@/utils/avatar.js";

const configStore = useConfigStore();
const activeTab = ref("profile");

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
    readAloudVoice: "auto",
    carryTimestamp: true,
    carryProfile: false,
  },
  agentDefault: {
    presetId: null,
  },
});

const presets = ref([]);

// ========== 头像对话框状态 ==========
const avatarDialogVisible = ref(false);
const tempPolicy = ref("system");
const tempQq = ref("");
const tempUrl = ref("");
const tempUploadedAvatar = ref("");

// 裁切弹窗状态
const cropperVisible = ref(false);
const selectedImageSrc = ref("");
const cropFileInputRef = ref(null);

// 打开头像修改对话框
const openAvatarDialog = () => {
  const currentAvatar = form.profile.avatar || "";
  const qqMatch = currentAvatar.match(/q=(\d+)/) || currentAvatar.match(/^(\d+)$/);
  if (!currentAvatar) {
    tempPolicy.value = "system";
    tempQq.value = "";
    tempUrl.value = "";
    tempUploadedAvatar.value = "";
  } else if (qqMatch) {
    tempPolicy.value = "qq";
    tempQq.value = qqMatch[1];
    tempUrl.value = "";
    tempUploadedAvatar.value = "";
  } else if (currentAvatar.startsWith("data:image/")) {
    tempPolicy.value = "upload";
    tempUploadedAvatar.value = currentAvatar;
    tempQq.value = "";
    tempUrl.value = "";
  } else {
    tempPolicy.value = "url";
    tempUrl.value = currentAvatar;
    tempQq.value = "";
    tempUploadedAvatar.value = "";
  }
  avatarDialogVisible.value = true;
};

// 计算对话框内实时的头像预览地址
const dialogPreviewUrl = computed(() => {
  if (tempPolicy.value === "system") {
    return getAdminAvatarUrl(null);
  } else if (tempPolicy.value === "qq") {
    return tempQq.value.trim()
      ? getAdminAvatarUrl(tempQq.value.trim())
      : getAdminAvatarUrl(null);
  } else if (tempPolicy.value === "url") {
    return tempUrl.value.trim() ? tempUrl.value.trim() : getAdminAvatarUrl(null);
  } else if (tempPolicy.value === "upload") {
    return tempUploadedAvatar.value
      ? tempUploadedAvatar.value
      : getAdminAvatarUrl(null);
  }
  return getAdminAvatarUrl(null);
});

// 触发图片选择
const triggerCropFileSelect = () => {
  if (cropFileInputRef.value) {
    cropFileInputRef.value.value = "";
    cropFileInputRef.value.click();
  }
};

// 选择图片后加载为 base64 并弹出 ImageCropper
const handleCropFileSelected = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    ElMessage.error("请选择有效的图片文件");
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    selectedImageSrc.value = event.target.result;
    cropperVisible.value = true;
  };
  reader.readAsDataURL(file);
};

// 裁剪完成后回调
const handleCropperConfirm = (croppedBase64) => {
  tempUploadedAvatar.value = croppedBase64;
  cropperVisible.value = false;
  tempPolicy.value = "upload";
};

// 确定提交头像设置
const confirmAvatarChange = async () => {
  let targetAvatar = null;
  if (tempPolicy.value === "system") {
    targetAvatar = null;
  } else if (tempPolicy.value === "qq") {
    if (!tempQq.value.trim()) {
      ElMessage.warning("请输入 QQ 号码");
      return;
    }
    targetAvatar = getAdminAvatarUrl(tempQq.value.trim());
  } else if (tempPolicy.value === "url") {
    if (!tempUrl.value.trim()) {
      ElMessage.warning("请输入图片 URL");
      return;
    }
    targetAvatar = tempUrl.value.trim();
  } else if (tempPolicy.value === "upload") {
    if (!tempUploadedAvatar.value) {
      ElMessage.warning("请先上传并裁切图片");
      return;
    }
    targetAvatar = tempUploadedAvatar.value;
  }

  form.profile.avatar = targetAvatar;
  avatarDialogVisible.value = false;
  await saveNow();
  ElMessage.success("头像更新成功");
};

// ========== 语音音色加载 ==========
const availableVoices = ref([]);
const loadVoices = () => {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      availableVoices.value = [...voices].sort((a, b) => {
        const aZh = a.lang.includes("zh") ? 0 : 1;
        const bZh = b.lang.includes("zh") ? 0 : 1;
        return aZh - bZh;
      });
    }
  }
};

// ========== 初始化 ==========
onMounted(async () => {
  loadVoices();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  try {
    const settings = await getClientSettings();
    Object.assign(form.profile, settings.profile || {});
    Object.assign(form.appearance, settings.appearance || {});
    Object.assign(form.chat, settings.chat || {});
    form.agentDefault.presetId = settings.agentDefault?.presetId || null;
    applyAppearanceSettings(form.appearance);
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
const onAppearanceChange = () => {
  applyAppearanceSettings(form.appearance);
  save();
};

const saveNow = async () => {
  if (saveTimer) clearTimeout(saveTimer);
  try {
    const snapshot = JSON.parse(JSON.stringify(form));
    await setClientSettings(snapshot);
    applyAppearanceSettings(form.appearance);

    // 同步 Pinia configStore 中的 userProfile 响应式数据
    configStore.updateUserProfile({
      name: form.profile.name,
      title: form.profile.title,
      avatar: form.profile.avatar,
    });

    client._clientSettings = snapshot;
    client.emit("avatar_updated", form.profile.avatar);
  } catch (e) {
    ElMessage.error("保存失败: " + e.message);
  }
};

let saveTimer = null;
const save = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveNow();
  }, 300);
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
  min-width: 110px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.label-hint-icon {
  font-size: 14px;
  color: var(--mio-text-placeholder);
  cursor: help;
  transition: color 0.15s;
}

.label-hint-icon:hover {
  color: var(--mio-color-primary);
}

.field-value {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.avatar-field-value {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-avatar-display {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--mio-border-color-light);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s;
}

.profile-avatar-display:hover {
  transform: scale(1.06);
}

.profile-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.field-hint {
  font-size: 12px;
  color: var(--mio-text-placeholder);
}

/* Avatar Dialog Styles */
.avatar-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 4px 0;
}

.dialog-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dialog-section-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--mio-text-secondary);
}

.policy-radio-group {
  width: 100%;
  display: flex;
}

.policy-radio-group :deep(.el-radio-button) {
  flex: 1;
}

.policy-radio-group :deep(.el-radio-button__inner) {
  width: 100%;
  padding: 8px 0;
  font-size: 13px;
}

.policy-hint {
  font-size: 12px;
  color: var(--mio-text-placeholder);
  background: var(--mio-bg-page);
  padding: 10px 12px;
  border-radius: 8px;
}

.policy-upload-box {
  display: flex;
  align-items: center;
  gap: 12px;
}

.upload-status-tag {
  font-size: 12px;
  color: var(--el-color-success);
}

.preview-section {
  align-items: center;
}

.avatar-preview-box {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--mio-border-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mio-bg-page);
}

.dialog-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.system-tag {
  flex-shrink: 0;
  margin-left: 8px;
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
