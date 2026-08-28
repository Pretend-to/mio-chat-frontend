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
        <div
          :class="{ 'tab-item': true, active: activeTab === 'memory' }"
          @click="activeTab = 'memory'"
        >全局记忆</div>
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

      <!-- ========== 全局长期记忆 ========== -->
      <div v-if="activeTab === 'memory'" class="tab-pane">
        <div class="settings-card memory-manage-card">
          <div class="memory-header-bar">
            <div class="memory-intro">
              <span class="memory-title">跨会话事实库</span>
              <p class="memory-desc">
                记录在所有 Agent 和群聊中共享的核心用户事实与偏好。系统会自动将以下事实条目以
                <code>&lt;global_long_term_memory&gt;</code> 注入 System 提示词。
              </p>
            </div>
            <div class="memory-actions">
              <el-button
                type="primary"
                size="small"
                @click="openAddMemoryDialog"
              >
                + 添加事实条目
              </el-button>
              <el-button
                v-if="globalMemories.length > 0"
                type="danger"
                plain
                size="small"
                @click="handleClearAllMemories"
              >
                清空全部
              </el-button>
            </div>
          </div>

          <!-- 搜索与筛选工具栏 -->
          <div v-if="globalMemories.length > 0" class="memory-filter-row">
            <el-input
              v-model="memorySearchKey"
              placeholder="搜索记忆事实内容或 ID..."
              clearable
              size="small"
              style="width: 260px"
            />
            <div class="memory-stats">
              共 <strong>{{ filteredMemories.length }}</strong> 条事实条目
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="globalMemories.length === 0" class="memory-empty-state">
            <el-empty description="暂无全局长期记忆条目" :image-size="80">
              <template #description>
                <p style="font-size: 13px; color: var(--mio-text-secondary); margin-bottom: 10px;">
                  你可以手动添加如“用户操作系统”、“开发技术栈”、“沟通偏好”等跨 Agent 通用事实，或者由开启智能模式的 Agent 在对话中自发沉淀。
                </p>
                <el-button type="primary" size="small" @click="openAddMemoryDialog">
                  立即添加第一条
                </el-button>
              </template>
            </el-empty>
          </div>

          <!-- 事实条目列表 -->
          <div v-else class="memory-items-list">
            <div
              v-for="item in filteredMemories"
              :key="item.id"
              class="memory-item-card"
            >
              <div class="memory-item-header">
                <div class="item-meta-wrap">
                  <span class="memory-id-badge">#{{ item.id }}</span>
                  <el-tag size="small" effect="plain" class="category-tag">
                    {{ getCategoryLabel(item.category) }}
                  </el-tag>
                  <span class="memory-time">{{ formatMemoryTime(item.updatedAt || item.createdAt) }}</span>
                </div>
                <div class="item-actions">
                  <el-button
                    v-if="editingMemoryId !== item.id"
                    size="small"
                    text
                    type="primary"
                    @click="startEditMemory(item)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    size="small"
                    text
                    type="danger"
                    @click="handleDeleteMemory(item.id)"
                  >
                    删除
                  </el-button>
                </div>
              </div>

              <div class="memory-item-body">
                <div v-if="editingMemoryId === item.id" class="inline-edit-box">
                  <el-input
                    v-model="editForm.content"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    placeholder="请输入事实内容..."
                  />
                  <div class="inline-edit-footer">
                    <el-select v-model="editForm.category" size="small" style="width: 140px">
                      <el-option label="通用事实" value="general" />
                      <el-option label="用户画像" value="user_profile" />
                      <el-option label="行为准则" value="behavioral_guidelines" />
                      <el-option label="技术栈/偏好" value="tech_stack" />
                      <el-option label="项目规范" value="project_fact" />
                    </el-select>
                    <div style="display: flex; gap: 8px">
                      <el-button size="small" @click="editingMemoryId = null">取消</el-button>
                      <el-button size="small" type="primary" @click="saveEditMemory(item.id)">保存</el-button>
                    </div>
                  </div>
                </div>
                <div v-else class="memory-content-text">
                  {{ item.content }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 添加全局记忆条目对话框 ========== -->
    <el-dialog
      v-model="addMemoryDialogVisible"
      title="添加全局长期事实条目"
      width="480px"
      append-to-body
    >
      <div class="add-memory-dialog-form">
        <div class="setting-field" style="flex-direction: column; align-items: stretch; gap: 6px;">
          <span class="field-label" style="font-weight: 600;">分类标签</span>
          <el-select v-model="newMemoryForm.category" style="width: 100%">
            <el-option label="通用事实 (General)" value="general" />
            <el-option label="用户画像 (User Profile)" value="user_profile" />
            <el-option label="行为准则 (Behavioral Guidelines)" value="behavioral_guidelines" />
            <el-option label="技术栈/开发偏好 (Tech Stack)" value="tech_stack" />
            <el-option label="项目与环境规范 (Project Fact)" value="project_fact" />
          </el-select>
        </div>

        <div class="setting-field" style="flex-direction: column; align-items: stretch; gap: 6px; margin-top: 14px;">
          <span class="field-label" style="font-weight: 600;">事实内容</span>
          <el-input
            v-model="newMemoryForm.content"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 8 }"
            placeholder="例如：用户偏好使用 Vue 3 Composition API 与 Sass；项目默认路径位于 /Users/krumio/Code..."
          />
        </div>
      </div>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <el-button @click="addMemoryDialogVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!newMemoryForm.content.trim()" @click="confirmAddMemory">
            保存条目
          </el-button>
        </div>
      </template>
    </el-dialog>

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
  addGlobalMemoryItem,
  updateGlobalMemoryItem,
  deleteGlobalMemoryItem,
  clearGlobalMemory,
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

  await loadGlobalMemories();
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

// ========== 全局长期记忆管理 ==========
const globalMemories = ref([]);
const memorySearchKey = ref("");
const addMemoryDialogVisible = ref(false);
const editingMemoryId = ref(null);

const newMemoryForm = reactive({
  category: "general",
  content: "",
});

const editForm = reactive({
  category: "general",
  content: "",
});

const loadGlobalMemories = async () => {
  try {
    const settings = await getClientSettings();
    globalMemories.value = Array.isArray(settings.globalMemory)
      ? settings.globalMemory
      : [];
  } catch (e) {
    console.warn("加载全局记忆失败:", e);
  }
};

const filteredMemories = computed(() => {
  const kw = (memorySearchKey.value || "").trim().toLowerCase();
  if (!kw) return globalMemories.value;
  return globalMemories.value.filter(
    (m) =>
      (m.content && m.content.toLowerCase().includes(kw)) ||
      (m.id && m.id.toLowerCase().includes(kw)) ||
      (m.category && m.category.toLowerCase().includes(kw)),
  );
});

const getCategoryLabel = (category) => {
  const map = {
    general: "通用事实",
    user_profile: "用户画像",
    behavioral_guidelines: "行为准则",
    tech_stack: "技术栈偏好",
    project_fact: "项目规范",
  };
  return map[category] || category || "通用";
};

const formatMemoryTime = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

const openAddMemoryDialog = () => {
  newMemoryForm.category = "general";
  newMemoryForm.content = "";
  addMemoryDialogVisible.value = true;
};

const confirmAddMemory = async () => {
  if (!newMemoryForm.content.trim()) return;
  try {
    const updated = await addGlobalMemoryItem({
      content: newMemoryForm.content,
      category: newMemoryForm.category,
    });
    globalMemories.value = updated;
    if (client._clientSettings) client._clientSettings.globalMemory = updated;
    addMemoryDialogVisible.value = false;
    ElMessage.success("事实条目已添加");
  } catch (e) {
    ElMessage.error("添加失败: " + e.message);
  }
};

const startEditMemory = (item) => {
  editingMemoryId.value = item.id;
  editForm.category = item.category || "general";
  editForm.content = item.content || "";
};

const saveEditMemory = async (id) => {
  if (!editForm.content.trim()) {
    ElMessage.warning("事实内容不能为空");
    return;
  }
  try {
    const updated = await updateGlobalMemoryItem(id, {
      content: editForm.content,
      category: editForm.category,
    });
    globalMemories.value = updated;
    if (client._clientSettings) client._clientSettings.globalMemory = updated;
    editingMemoryId.value = null;
    ElMessage.success("事实条目已修改");
  } catch (e) {
    ElMessage.error("保存失败: " + e.message);
  }
};

const handleDeleteMemory = async (id) => {
  try {
    await ElMessageBox.confirm("确定删除此条记忆事实？", "删除确认", {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning",
    });
    const updated = await deleteGlobalMemoryItem(id);
    globalMemories.value = updated;
    if (client._clientSettings) client._clientSettings.globalMemory = updated;
    ElMessage.success("已删除该条记忆");
  } catch (e) {}
};

const handleClearAllMemories = async () => {
  try {
    await ElMessageBox.confirm(
      "确定清空所有全局长期记忆条目吗？此操作不可逆！",
      "危险操作",
      {
        confirmButtonText: "清空",
        cancelButtonText: "取消",
        type: "danger",
      },
    );
    const updated = await clearGlobalMemory();
    globalMemories.value = updated;
    if (client._clientSettings) client._clientSettings.globalMemory = updated;
    ElMessage.success("全局长期记忆已清空");
  } catch (e) {}
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

/* Global Memory Card Styles */
.memory-manage-card {
  padding: 16px !important;
}

.memory-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 14px;
}

.memory-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--mio-text-primary);
}

.memory-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--mio-text-secondary);
  line-height: 1.45;
}

.memory-desc code {
  background: var(--mio-bg-page);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

.memory-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.memory-filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--mio-border-color-lighter);
}

.memory-stats {
  font-size: 12px;
  color: var(--mio-text-secondary);
}

.memory-empty-state {
  padding: 16px 0;
}

.memory-items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.memory-item-card {
  background: var(--mio-bg-page);
  border-radius: 8px;
  border: 1px solid var(--mio-border-color-lighter);
  padding: 10px 12px;
  transition: all 0.2s;
}

.memory-item-card:hover {
  border-color: var(--mio-border-color);
  box-shadow: var(--mio-shadow-light);
}

.memory-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.item-meta-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.memory-id-badge {
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--mio-text-placeholder);
}

.category-tag {
  font-size: 11px;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
}

.memory-time {
  font-size: 11px;
  color: var(--mio-text-placeholder);
}

.memory-content-text {
  font-size: 13px;
  color: var(--mio-text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.inline-edit-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inline-edit-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
