<template>
  <!-- 移动端全屏模式 -->
  <div
    v-if="isMobile"
    class="mobile-fullscreen-overlay"
    :class="{ show: show }"
    @click="handleOverlayClick"
  >
    <div class="mobile-container" :class="{ show: show }" @click.stop>
      <div class="mobile-header">
        <button class="mobile-cancel-btn" @click="close">取消</button>
        <div class="mobile-title">添加机器人</div>
      </div>
      <div class="add-contactor-body mobile">
        <!-- 标签页导航 -->
        <div class="tabs mobile">
          <div
            v-for="(tab, index) in tabs"
            :key="index"
            class="tab-item"
            :class="{ active: activeTab === index }"
            @click="activeTab = index"
          >
            {{ tab }}
          </div>
        </div>

        <!-- 标签页内容 -->
        <div class="tab-content mobile">
          <!-- 适配器列表 -->
          <div v-show="activeTab === 0" class="adapters-view">
            <div class="search">
              <el-input
                v-model="adapterKeyword"
                placeholder="搜索适配器..."
                :prefix-icon="Search"
                clearable
              />
            </div>
            <el-scrollbar class="adapters-list">
              <div
                v-for="(provider, index) in filteredProviders"
                :key="index"
                class="adapter-item mobile"
              >
                <div
                  class="adapter-icon"
                  :style="{
                    backgroundColor: getProviderColor(provider.adapterType),
                  }"
                >
                  <img
                    :src="getAvatarByAdapterType(provider.adapterType)"
                    class="adapter-icon-img"
                    alt="适配器图标"
                  />
                </div>
                <div class="adapter-info">
                  <div class="adapter-header">
                    <el-tag
                      size="small"
                      :type="getProviderTagType(provider.adapterType)"
                      effect="plain"
                      round
                    >
                      {{ provider.adapterType }}
                    </el-tag>
                    <div class="adapter-name">{{ provider.label }}</div>
                  </div>
                  <div class="adapter-desc">
                    {{ provider.description || "大语言模型适配器" }}
                  </div>
                </div>
                <el-button
                  type="primary"
                  size="small"
                  @click="handleAddByProvider(provider)"
                  >添加</el-button
                >
              </div>
              <el-empty
                v-if="filteredProviders.length === 0"
                description="未找到相关适配器"
              />
            </el-scrollbar>
          </div>

          <!-- 预设列表 -->
          <div v-show="activeTab === 1" class="presets-view">
            <div class="search">
              <el-input
                v-model="keyWord"
                placeholder="输入搜索关键词"
                :prefix-icon="Search"
                clearable
                @input="loadSerachPresets"
              />
            </div>
            <div class="info">
              <header class="presets-types mobile">
                <div
                  :style="{ left: buttonTranslate }"
                  class="slide-button"
                ></div>
                <nav
                  v-for="(type, index) in avaliablePresetTypes"
                  :key="index"
                  :class="activeTypeIndex === index ? 'active' : ''"
                  @click="changeShownType(index)"
                >
                  {{ type }}
                </nav>
              </header>
              <el-scrollbar
                v-if="
                  shownPrestsList.length > 0 || [0, 3].includes(activeTypeIndex)
                "
                class="presets-list"
                @scroll="handleScroll"
              >
                <div
                  v-for="(preset, index) in shownPrestsList"
                  :key="index"
                  class="presets-item mobile"
                >
                  <div v-if="preset.avatar" class="preset-avatar custom">
                    <img :src="preset.avatar" alt="预设头像" />
                  </div>
                  <div v-else-if="preset.model" class="preset-avatar model">
                    <img :src="getAvatarByModel(preset.model)" alt="模型头像" />
                  </div>
                  <div v-else class="preset-avatar">
                    {{ preset.name ? preset.name.slice(0, 2) : "预设" }}
                  </div>
                  <div class="preset-info">
                    <div class="preset-name">{{ preset.name }}</div>
                    <div
                      :title="preset.opening || preset.title || ''"
                      class="preset-description"
                    >
                      {{ preset.opening || preset.title || "本地预设" }}
                    </div>
                  </div>
                  <el-button @click="addBot(preset)">添加</el-button>
                </div>
                <div v-if="showPresetsLoader" class="loading">
                  <el-icon class="is-loading">
                    <Loading />
                  </el-icon>
                  <span style="margin-left: 8px">加载中...</span>
                </div>
              </el-scrollbar>
              <div v-else class="empty-list">
                <el-empty :image-size="120" />
              </div>
            </div>
          </div>

          <!-- 创建群聊 Tab (activeTab === 2) -->
          <div v-show="activeTab === 2" class="group-create-view mobile">
            <div class="group-form">
              <div class="form-row">
                <span class="form-label">群名称</span>
                <el-input
                  v-model="groupName"
                  placeholder="例如：Mio 思考与讨论群..."
                  clearable
                />
              </div>
              <div class="form-row">
                <span class="form-label">群介绍</span>
                <el-input
                  v-model="groupIntro"
                  type="textarea"
                  :rows="2"
                  placeholder="可选：描述该群聊的角色分配与讨论目标..."
                />
              </div>
            </div>

            <div class="group-member-selector">
              <div class="selector-header">
                <span class="selector-title">选择群成员</span>
                <div class="selector-subtabs">
                  <span
                    class="subtab"
                    :class="{ active: groupMemberTab === 'recent' }"
                    @click="groupMemberTab = 'recent'"
                    >最近聊天</span
                  >
                  <span
                    class="subtab"
                    :class="{ active: groupMemberTab === 'presets' }"
                    @click="groupMemberTab = 'presets'"
                    >本地预设</span
                  >
                </div>
              </div>

              <el-scrollbar class="selector-list">
                <div
                  v-for="item in availableGroupMembers"
                  :key="item.id"
                  class="member-item"
                  @click="toggleGroupMember(item)"
                >
                  <el-checkbox
                    :model-value="isMemberSelected(item.id)"
                    @click.stop
                    @change="toggleGroupMember(item)"
                  />
                  <img :src="item.avatar" class="member-avatar" />
                  <div class="member-info">
                    <div class="member-name">{{ item.name }}</div>
                    <div class="member-desc">{{ item.title || item.opening || 'Agent' }}</div>
                  </div>
                </div>
                <el-empty
                  v-if="availableGroupMembers.length === 0"
                  description="暂无可选成员"
                  :image-size="40"
                />
              </el-scrollbar>

              <!-- 已选成员预览区 (固定在灰色卡片内底端) -->
              <div class="selected-preview-bar">
                <div class="preview-title">
                  已选成员 <span class="count-badge">({{ selectedGroupMembers.length }})</span>
                </div>
                <div class="preview-chips-container">
                  <template v-if="selectedGroupMembers.length > 0">
                    <div
                      v-for="m in selectedGroupMembers"
                      :key="m.id"
                      class="member-chip"
                    >
                      <img :src="m.avatar" class="chip-avatar" />
                      <span class="chip-name">{{ m.name }}</span>
                      <span class="chip-remove" @click.stop="toggleGroupMember(m)">×</span>
                    </div>
                  </template>
                  <div v-else class="empty-chips-hint">
                    暂未勾选成员（请在上方列表中选择）
                  </div>
                </div>
              </div>
            </div>

            <el-button
              type="primary"
              class="create-group-btn"
              :disabled="!groupName.trim() || selectedGroupMembers.length === 0"
              @click="handleCreateGroup"
            >
              创建 Agent 群聊 (已选 {{ selectedGroupMembers.length }} 人)
            </el-button>
          </div>

          <!-- 分享码 (activeTab === 3) -->
          <div v-show="activeTab === 3" class="share-code-view">
            <div class="share-input-container">
              <div class="input-label">输入分享码或分享链接</div>
              <el-input
                v-model="shareCode"
                placeholder="粘贴分享码或链接..."
                clearable
                class="share-input"
              />
              <el-button
                type="primary"
                :disabled="!shareCode.trim()"
                @click="handleAddByShareCode"
                style="width: 100%; margin-top: 16px"
              >
                加载 Bot
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 桌面端对话框模式 -->
  <el-dialog
    v-else
    :model-value="show"
    title="添加机器人"
    width="500px"
    class="add-contactor-dialog"
    @update:model-value="$emit('update:show', $event)"
    @close="$emit('close')"
  >
    <div class="add-contactor-body">
      <!-- 标签页导航 -->
      <div class="tabs">
        <div
          v-for="(tab, index) in tabs"
          :key="index"
          class="tab-item"
          :class="{ active: activeTab === index }"
          @click="activeTab = index"
        >
          {{ tab }}
        </div>
      </div>

      <!-- 标签页内容 -->
      <div class="tab-content">
        <!-- 适配器列表 -->
        <div v-show="activeTab === 0" class="adapters-view">
          <div class="search">
            <el-input
              v-model="adapterKeyword"
              placeholder="搜索适配器..."
              :prefix-icon="Search"
              clearable
            />
          </div>
          <el-scrollbar class="adapters-list">
            <div
              v-for="(provider, index) in filteredProviders"
              :key="index"
              class="adapter-item"
            >
              <div
                class="adapter-icon"
                :style="{
                  backgroundColor: getProviderColor(provider.adapterType),
                }"
              >
                <img
                  :src="getAvatarByAdapterType(provider.adapterType)"
                  class="adapter-icon-img"
                  alt="适配器图标"
                />
              </div>
              <div class="adapter-info">
                <div class="adapter-header">
                  <el-tag
                    size="small"
                    :type="getProviderTagType(provider.adapterType)"
                    effect="plain"
                    round
                  >
                    {{ provider.adapterType }}
                  </el-tag>
                  <div class="adapter-name">{{ provider.label }}</div>
                </div>
                <div class="adapter-desc">
                  {{ provider.description || "大语言模型适配器" }}
                </div>
              </div>
              <el-button
                type="primary"
                size="small"
                @click="handleAddByProvider(provider)"
                >添加</el-button
              >
            </div>
            <el-empty
              v-if="filteredProviders.length === 0"
              description="未找到相关适配器"
            />
          </el-scrollbar>
        </div>

        <!-- 预设列表 -->
        <div v-show="activeTab === 1" class="presets-view">
          <div class="search">
            <el-input
              v-model="keyWord"
              placeholder="输入搜索关键词"
              :prefix-icon="Search"
              clearable
              @input="loadSerachPresets"
            />
          </div>
          <div class="info">
            <header class="presets-types">
              <div
                :style="{ left: buttonTranslate }"
                class="slide-button"
              ></div>
              <nav
                v-for="(type, index) in avaliablePresetTypes"
                :key="index"
                :class="activeTypeIndex === index ? 'active' : ''"
                @click="changeShownType(index)"
              >
                {{ type }}
              </nav>
            </header>
            <el-scrollbar
              v-if="
                shownPrestsList.length > 0 || [0, 3].includes(activeTypeIndex)
              "
              class="presets-list"
              @scroll="handleScroll"
            >
              <div
                v-for="(preset, index) in shownPrestsList"
                :key="index"
                class="presets-item"
              >
                <div v-if="preset.avatar" class="preset-avatar custom">
                  <img :src="preset.avatar" alt="预设头像" />
                </div>
                <div v-else-if="preset.model" class="preset-avatar model">
                  <img :src="getAvatarByModel(preset.model)" alt="模型头像" />
                </div>
                <div v-else class="preset-avatar">
                  {{ preset.name ? preset.name.slice(0, 2) : "预设" }}
                </div>
                <div class="preset-info">
                  <div class="preset-name">{{ preset.name }}</div>
                  <div
                    :title="preset.opening || preset.title || ''"
                    class="preset-description"
                  >
                    {{ preset.opening || preset.title || "本地预设" }}
                  </div>
                </div>
                <el-button @click="addBot(preset)">添加</el-button>
              </div>
              <div v-if="showPresetsLoader" class="loading">
                <el-icon class="is-loading">
                  <Loading />
                </el-icon>
                <span style="margin-left: 8px">加载中...</span>
              </div>
            </el-scrollbar>
            <div v-else class="empty-list">
              <el-empty :image-size="120" />
            </div>
          </div>
        </div>

        <!-- 创建群聊 Tab (activeTab === 2) -->
        <div v-show="activeTab === 2" class="group-create-view">
          <div class="group-form">
            <div class="form-row">
              <span class="form-label">群名称</span>
              <el-input
                v-model="groupName"
                placeholder="例如：Mio 思考与讨论群..."
                clearable
              />
            </div>
            <div class="form-row">
              <span class="form-label">群介绍</span>
              <el-input
                v-model="groupIntro"
                type="textarea"
                :rows="2"
                placeholder="可选：描述该群聊的角色分配与讨论目标..."
              />
            </div>
          </div>

          <!-- 选人区 -->
          <div class="group-member-selector">
            <div class="selector-header">
              <span class="selector-title">选择群成员</span>
              <div class="selector-subtabs">
                <span
                  class="subtab"
                  :class="{ active: groupMemberTab === 'recent' }"
                  @click="groupMemberTab = 'recent'"
                  >最近聊天</span
                >
                <span
                  class="subtab"
                  :class="{ active: groupMemberTab === 'presets' }"
                  @click="groupMemberTab = 'presets'"
                  >本地预设</span
                >
              </div>
            </div>

            <el-scrollbar class="selector-list">
              <div
                v-for="item in availableGroupMembers"
                :key="item.id"
                class="member-item"
                @click="toggleGroupMember(item)"
              >
                <el-checkbox
                  :model-value="isMemberSelected(item.id)"
                  @click.stop
                  @change="toggleGroupMember(item)"
                />
                <img :src="item.avatar" class="member-avatar" />
                <div class="member-info">
                  <div class="member-name">{{ item.name }}</div>
                  <div class="member-desc">{{ item.title || item.opening || 'Agent' }}</div>
                </div>
              </div>
              <el-empty
                v-if="availableGroupMembers.length === 0"
                description="暂无可选成员"
                :image-size="40"
              />
            </el-scrollbar>

            <!-- 已选成员预览区 (固定在灰色卡片内底端) -->
            <div class="selected-preview-bar">
              <div class="preview-title">
                已选成员 <span class="count-badge">({{ selectedGroupMembers.length }})</span>
              </div>
              <div class="preview-chips-container">
                <template v-if="selectedGroupMembers.length > 0">
                  <div
                    v-for="m in selectedGroupMembers"
                    :key="m.id"
                    class="member-chip"
                  >
                    <img :src="m.avatar" class="chip-avatar" />
                    <span class="chip-name">{{ m.name }}</span>
                    <span class="chip-remove" @click.stop="toggleGroupMember(m)">×</span>
                  </div>
                </template>
                <div v-else class="empty-chips-hint">
                  暂未勾选成员（请在上方列表中选择）
                </div>
              </div>
            </div>
          </div>

          <el-button
            type="primary"
            class="create-group-btn"
            :disabled="!groupName.trim() || selectedGroupMembers.length === 0"
            @click="handleCreateGroup"
          >
            创建 Agent 群聊 (已选 {{ selectedGroupMembers.length }} 人)
          </el-button>
        </div>

        <!-- 分享码 (activeTab === 3) -->
        <div v-show="activeTab === 3" class="share-code-view">
          <div class="share-input-container">
            <div class="input-label">输入分享码或分享链接</div>
            <el-input
              v-model="shareCode"
              placeholder="粘贴分享码或链接..."
              clearable
              class="share-input"
            />
            <el-button
              type="primary"
              :disabled="!shareCode.trim()"
              @click="handleAddByShareCode"
              style="width: 100%; margin-top: 16px"
            >
              加载 Bot
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { config, client } from "@/lib/runtime.js";
import { getAvatarByAdapterType } from "@/utils/avatar.js";
import { Loading, Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { getAvatarByModel, useContactorsStore } from "@/stores/contactorsStore.js";
import { getLocalPresets } from "@/lib/clientSettings.js";

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
});

// Emits
const emit = defineEmits([
  "addBot",
  "close",
  "add-by-provider",
  "add-by-share-code",
  "update:show",
]);

// Router
const router = useRouter();

// Constants
const avaliablePresetTypes = ["推荐", "最近", "本地", "系统"];
const tabs = ["适配器", "预设", "创建群聊", "分享码"];

// Reactive state
const activeTab = ref(0);
const adapterKeyword = ref("");
const shareCode = ref("");
const recommendPresets = ref([]);
const recentPresets = ref([]);
const localPresets = ref([]);
const systemPresets = ref([]);
const searchPresets = ref([]);
const systemShownNum = ref(0);
const recommendShownNum = ref(0);
const keyWord = ref("");
const activeTypeIndex = ref(0);
const buttonTranslate = ref("4px");
const moreSystemPresets = ref(true);
const moreRecommendPresets = ref(true);
const isMobile = ref(false);
const availableProviders = ref([]);

// ========== 群聊创建状态 ==========
const groupName = ref("Agent 智囊团");
const groupIntro = ref("");
const groupMemberTab = ref("recent");
const selectedGroupMembers = ref([]);

const availableGroupMembers = computed(() => {
  if (groupMemberTab.value === "recent") {
    const contactorStore = useContactorsStore();
    return Object.values(contactorStore.contactors || {})
      .filter((c) => c.platform !== "group")
      // 按最近活跃时间倒序，与好友列表 sortedContactors 的口径一致
      .sort((a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0))
      .map((c) => ({
        id: c.id,
        agentId: c.id,
        name: c.name,
        avatar: c.avatar || "/static/icons/512x512.png",
        title: c.title || "联系人",
        namePolicy: c.namePolicy !== undefined ? c.namePolicy : 0,
        avatarPolicy: c.avatarPolicy !== undefined ? c.avatarPolicy : 0,
        options: c.options,
      }));
  } else {
    return localPresets.value.map((p) => ({
      id: p.id,
      agentId: p.id,
      name: p.name,
      avatar: p.avatar || getAvatarByModel(p.model) || "/static/icons/512x512.png",
      title: p.title || "本地预设",
      namePolicy: p.namePolicy !== undefined ? p.namePolicy : 0,
      avatarPolicy:
        p.avatarPolicy !== undefined ? p.avatarPolicy : p.avatar ? 1 : 0,
      options: {
        base: { model: p.model || "gpt-4o", stream: true },
        presetSettings: { opening: p.opening || "", history: p.history || [] },
        toolCallSettings: { mode: "auto", tools: p.tools || [] },
      },
    }));
  }
});

const isMemberSelected = (id) => {
  return selectedGroupMembers.value.some((m) => m.id === id);
};

const toggleGroupMember = (item) => {
  const idx = selectedGroupMembers.value.findIndex((m) => m.id === item.id);
  if (idx !== -1) {
    selectedGroupMembers.value.splice(idx, 1);
  } else {
    selectedGroupMembers.value.push(item);
  }
};

const handleCreateGroup = async () => {
  if (!groupName.value.trim() || selectedGroupMembers.value.length === 0) return;
  const contactorStore = useContactorsStore();
  try {
    const newGroup = await contactorStore.addGroupContactor({
      name: groupName.value.trim(),
      intro: groupIntro.value.trim(),
      members: selectedGroupMembers.value,
      avatarPolicy: "composite",
    });
    ElMessage.success(`群聊「${newGroup.name}」创建成功`);
    close();
    contactorStore.selectContactor(newGroup.id);
  } catch (e) {
    ElMessage.error("创建群聊失败: " + e.message);
  }
};

// Computed
const showPresetsLoader = computed(() => {
  return activeTypeIndex.value === 3
    ? moreSystemPresets.value
    : activeTypeIndex.value === 0
      ? moreRecommendPresets.value
      : false;
});

const shownPrestsList = computed(() => {
  if (keyWord.value) {
    return searchPresets.value;
  }
  return activeTypeIndex.value === 2
    ? localPresets.value
    : activeTypeIndex.value === 1
      ? recentPresets.value
      : activeTypeIndex.value === 0
        ? recommendPresets.value
        : activeTypeIndex.value === 3
          ? systemPresets.value
          : [];
});

const filteredProviders = computed(() => {
  if (!adapterKeyword.value.trim()) {
    return availableProviders.value;
  }
  const keyword = adapterKeyword.value.toLowerCase();
  return availableProviders.value.filter(
    (provider) =>
      provider.value.toLowerCase().includes(keyword) ||
      provider.label.toLowerCase().includes(keyword) ||
      provider.adapterType.toLowerCase().includes(keyword),
  );
});

// Methods
const refreshProviders = () => {
  availableProviders.value = config.getLLMProviders();
};
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

const handleOverlayClick = () => {
  close();
};

const close = () => {
  emit("close");
};

const handleAddByProvider = (provider) => {
  emit("add-by-provider", provider.value);
  ElMessage.success(`成功创建 ${provider.label} Bot`);
  close();
};

const getProviderTagType = (provider) => {
  if (!provider) return "info";
  const name = provider.toLowerCase();

  // 动态哈希一个合法的 tag 类型，避免任何硬编码
  const tags = ["primary", "success", "warning", "danger", "info"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return tags[Math.abs(hash) % tags.length];
};

const getProviderColor = (provider) => {
  if (!provider) return "var(--mio-bg-page)";
  const name = provider.toLowerCase();

  // 根据名称哈希产生一个好看的、高饱和度的柔和淡色背景，彻底免除后续硬编码
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsla(${h}, 70%, var(--mio-tag-lightness), 0.5)`;
};

const handleAddByShareCode = async () => {
  if (!shareCode.value.trim()) {
    ElMessage.warning("请输入分享码");
    return;
  }

  const code = shareCode.value.trim();
  let shareId = code;

  // 判断是否为链接并提取 shareId
  if (!/^\d+$/.test(code)) {
    try {
      const url = new URL(code);
      const currentHost = window.location.host;

      if (url.host === currentHost) {
        const match = url.pathname.match(/^\/s\/(\d+)$/);
        if (match) {
          shareId = match[1];
        } else {
          ElMessage.error("链接格式不正确，应为 /s/数字");
          return;
        }
      } else {
        ElMessage.error("链接域名与当前网站不一致");
        return;
      }
    } catch (e) {
      ElMessage.error("请输入有效的分享码或分享链接");
      return;
    }
  }

  // 直接在组件内完成加载逻辑，不依赖 router 传递状态
  ElMessage.info("正在获取远程 Agent 信息...");
  const contactorId = await client.loadOriginalContactors(shareId);
  if (contactorId) {
    ElMessage.success("成功加载远程 Agent");
    router.push(`/chat/${contactorId}`);
    close();
  } else {
    ElMessage.error("加载失败，分享码可能无效");
  }
};

const addBot = (preset) => {
  strogeAddHistory(preset);
  emit("addBot", preset);
  ElMessage.success("添加成功");
};

const strogeAddHistory = (preset) => {
  const existingItem = recentPresets.value.find(
    (item) => item.name === preset.name,
  );
  if (existingItem) {
    recentPresets.value.splice(recentPresets.value.indexOf(existingItem), 1);
  }
  recentPresets.value.unshift(preset);
  if (recentPresets.value.length > 20) {
    recentPresets.value.pop();
  }
  localStorage.setItem("recent-presets", JSON.stringify(recentPresets.value));
};

const getAddHistory = async () => {
  const recent = localStorage.getItem("recent-presets");
  if (recent) {
    recentPresets.value = JSON.parse(recent);
  }
  // 改用 localforage 读取（与 clientSettings.js 统一存储层）
  try {
    localPresets.value = await getLocalPresets();
  } catch (e) {
    console.warn("加载本地预设失败:", e);
    localPresets.value = [];
  }
};

const loadSerachPresets = async () => {
  if (keyWord.value) {
    activeTypeIndex.value = -1;
    const res = await fetch(
      `/api/openai/presets?type=search&keyword=${keyWord.value}`,
    ).then((res) => res.json());
    searchPresets.value = res.data || [];
  } else {
    activeTypeIndex.value = 0;
    changeShownType(0);
  }
};

const loadSpecificType = async () => {
  if (activeTypeIndex.value === 3 && systemPresets.value.length === 0) {
    const res = await fetch(
      `/api/openai/presets?type=system&start=${systemShownNum.value}&limit=20`,
    ).then((res) => res.json());
    systemPresets.value = res.data || [];
    systemShownNum.value += systemPresets.value.length;
    if (!res.data || res.data.length < 20) {
      moreSystemPresets.value = false;
    }
  } else if (
    activeTypeIndex.value === 0 &&
    recommendPresets.value.length === 0
  ) {
    const res = await fetch(
      `/api/openai/presets?type=recommended&start=${recommendShownNum.value}&limit=20`,
    ).then((res) => res.json());
    recommendPresets.value = res.data || [];
    recommendShownNum.value += recommendPresets.value.length;
    if (!res.data || res.data.length < 20) {
      moreRecommendPresets.value = false;
    }
  }
};

const loadMoreData = async () => {
  if (activeTypeIndex.value === 3 && moreSystemPresets.value) {
    const res = await fetch(
      `/api/openai/presets?type=system&start=${systemShownNum.value}&limit=20`,
    ).then((res) => res.json());
    const newPresets = res.data || [];
    if (newPresets.length > 0) {
      systemPresets.value = [...systemPresets.value, ...newPresets];
      systemShownNum.value += newPresets.length;
    }
    if (newPresets.length < 20) {
      moreSystemPresets.value = false;
    }
  } else if (activeTypeIndex.value === 0 && moreRecommendPresets.value) {
    const res = await fetch(
      `/api/openai/presets?type=recommended&start=${recommendShownNum.value}&limit=20`,
    ).then((res) => res.json());
    const newPresets = res.data || [];
    if (newPresets.length > 0) {
      recommendPresets.value = [...recommendPresets.value, ...newPresets];
      recommendShownNum.value += newPresets.length;
    }
    if (newPresets.length < 20) {
      moreRecommendPresets.value = false;
    }
  }
};

const changeShownType = (index) => {
  activeTypeIndex.value = index;
  buttonTranslate.value = `calc(${index * 25}% + 4px)`;
  if (index === 2 || index === 1) {
    getAddHistory();
  }
  loadSpecificType();
};

watch(
  () => props.show,
  (val) => {
    if (val) {
      getAddHistory();
      refreshProviders();
    }
  },
);

watch(activeTab, (newTab) => {
  if (newTab === 1) {
    getAddHistory();
  }
});

// 处理滚动事件，实现无限滚动
const handleScroll = ({ scrollTop }) => {
  const scrollbar = document.querySelector(".presets-list .el-scrollbar__wrap");
  if (!scrollbar || !showPresetsLoader.value) return;

  const scrollHeight = scrollbar.scrollHeight;
  const clientHeight = scrollbar.clientHeight;
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;

  // 当距离底部小于 100px 时提前加载更多，提升用户体验
  if (distanceToBottom < 100) {
    loadMoreData();
  }
};

// Lifecycle
onMounted(async () => {
  checkMobile();
  window.addEventListener("resize", checkMobile);
  getAddHistory();
  refreshProviders();
  client.on("models_updated", refreshProviders);
  await loadSpecificType();
});

// 清理事件监听器
onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
  client.off("models_updated", refreshProviders);
});
</script>

<style lang="scss" scoped>
// 移动端全屏样式
.mobile-fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  /* 移动端浏览器的 100vh 是「地址栏收起后」的大视口高度，地址栏可见时
     实际可视区比它矮，底部内容会被压到屏幕外，而 fixed 定位又滚不到。
     dvh 跟随可视区变化，不支持的浏览器会忽略这行回退到上面的 100vh。 */
  height: 100dvh;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;

  &.show {
    opacity: 1;
    visibility: visible;
  }
}

.mobile-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--el-bg-color);
  transform: translateY(-100%);
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  display: flex;
  flex-direction: column;

  &.show {
    transform: translateY(0);
  }
}

.mobile-header {
  display: grid;
  /* 三列而非 space-between：左右两列等宽，标题独占中间列，
     这样标题是相对整个 header 居中的，不会被左侧「取消」的宽度推偏。 */
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
  position: sticky;
  top: 0;
  z-index: 10;
}

.mobile-title {
  grid-column: 2;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  text-align: center;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-cancel-btn {
  grid-column: 1;
  justify-self: start;
  border: none;
  background: none;
  /* 纵向 padding 撑出足够的点按面积，视觉上仍是一行文字 */
  padding: 6px 4px;
  font-size: 15px;
  line-height: 1.2;
  color: var(--el-color-primary);
  cursor: pointer;
  border-radius: 6px;
  transition: opacity 0.15s;

  &:active {
    opacity: 0.6;
  }
}

.add-contactor-body {
  height: 60vh;
  display: flex;
  flex-direction: column;

  /* 移动端不要再算 calc(100vh - 65px)：65 是照着当时的 header 高度写死的，
     header 一改就错位，且同样带着 100vh 的坑。作为 .mobile-container 的
     flex 子项，交给 flex 自己算即可。min-height: 0 允许内部滚动区收缩。 */
  &.mobile {
    height: auto;
    flex: 1;
    min-height: 0;
  }
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
  padding: 0 20px;

  &.mobile {
    padding: 0 16px;
    background-color: var(--el-bg-color);
  }
}

.tab-item {
  padding: 10px 16px;
  cursor: pointer;
  position: relative;
  color: var(--el-text-color-secondary);
  transition: color 0.3s;

  &.active {
    color: var(--el-color-primary);
  }

  &.active::after {
    content: "";
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: var(--el-color-primary);
  }
}

.tab-content {
  flex-grow: 1;
  overflow: hidden;
  padding: 0 20px 16px 20px;
  display: flex;
  flex-direction: column;

  &.mobile {
    /* 补回被漏掉的底部内边距，并让开 iPhone 的 home indicator */
    padding: 0 16px calc(12px + env(safe-area-inset-bottom)) 16px;
    flex: 1;
    min-height: 0;
  }
}

.search {
  padding: 16px 0;
  flex-shrink: 0;
}

.adapters-view,
.presets-view,
.share-code-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.adapters-list {
  flex-grow: 1;
  overflow-y: auto;
}

.adapter-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  transition: background-color 0.2s;
  margin-bottom: 8px;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  &.mobile {
    padding: 16px 12px;
    margin-bottom: 12px;
  }
}

.adapter-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  color: white;
  font-size: 20px;
  overflow: hidden;
  flex-shrink: 0;
}

.adapter-icon-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.adapter-info {
  flex-grow: 1;
  min-width: 0;
}

.adapter-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.adapter-item .el-button {
  margin-left: 8px;
  flex-shrink: 0;
}

.adapter-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.adapter-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.presets-view {
  .info {
    flex-grow: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .presets-list {
    flex-grow: 1;
    overflow-y: auto;
  }
}

.presets-types {
  display: flex;
  position: relative;
  width: 100%;
  background-color: var(--mio-bg-page, var(--el-bg-color-page));
  border-radius: 8px;
  padding: 4px;
  box-sizing: border-box;
  margin-bottom: 16px;
  height: 40px;

  &.mobile {
    height: 44px;
    padding: 6px;
  }

  nav {
    width: 25%;
    text-align: center;
    padding: 6px 0;
    cursor: pointer;
    position: relative;
    z-index: 2;
    transition: color 0.3s;
    color: var(--mio-text-regular, var(--el-text-color-regular));
    font-size: 14px;

    &.active {
      color: var(--mio-color-primary, var(--el-color-primary));
    }

    @media (max-width: 768px) {
      font-size: 13px;
      padding: 8px 0;
    }
  }
}

.slide-button {
  position: absolute;
  width: calc(25% - 8px);
  height: calc(100% - 8px);
  top: 4px;
  left: 4px;
  background-color: var(--mio-bg-card, var(--el-color-white));
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  transition: left 0.3s;
  z-index: 1;
}

.presets-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &.mobile {
    padding: 16px 0;
  }

  .preset-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: var(--el-color-primary-light-8);
    color: var(--el-color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    margin-right: 12px;
    overflow: hidden;
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    @media (max-width: 768px) {
      width: 44px;
      height: 44px;
      margin-right: 16px;
    }
  }

  .preset-info {
    flex-grow: 1;
    overflow: hidden;
  }

  .preset-name {
    font-weight: 500;

    @media (max-width: 768px) {
      font-size: 16px;
    }
  }

  .preset-description {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    @media (max-width: 768px) {
      font-size: 13px;
      margin-top: 4px;
    }
  }
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.empty-list {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-code-view {
  padding-top: 16px;
}

.input-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.group-create-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0 0 0;

  .group-form {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .form-row {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .form-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--el-text-color-regular);
      }
    }
  }

  .group-member-selector {
    flex: 1;
    min-height: 0;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 10px;
    background-color: var(--el-fill-color-light);
    display: flex;
    flex-direction: column;
    gap: 6px;

    .selector-header {
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .selector-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }

      .selector-subtabs {
        display: flex;
        gap: 6px;

        .subtab {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
          color: var(--el-text-color-secondary);
          background: var(--el-bg-color-overlay);
          border: 1px solid var(--el-border-color-lighter);

          &.active {
            color: #fff;
            background: var(--el-color-primary);
            border-color: var(--el-color-primary);
          }
        }
      }
    }

    .selector-list {
      flex: 1;
      min-height: 0;
      border-radius: 6px;
      background: var(--el-bg-color-overlay);
      border: 1px solid var(--el-border-color-lighter);

      .member-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.15s;

        &:hover {
          background-color: var(--el-fill-color-light);
        }

        .member-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
        }

        .member-info {
          flex: 1;
          min-width: 0;

          .member-name {
            font-size: 12px;
            font-weight: 500;
            color: var(--el-text-color-primary);
          }

          .member-desc {
            font-size: 10px;
            color: var(--el-text-color-placeholder);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }

    .selected-preview-bar {
      margin-top: 2px;
      padding-top: 6px;
      border-top: 1px dashed var(--el-border-color);

      .preview-title {
        font-size: 11px;
        font-weight: 500;
        color: var(--el-text-color-secondary);
        margin-bottom: 4px;

        .count-badge {
          color: var(--el-color-primary);
          font-weight: 600;
        }
      }

      .preview-chips-container {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        overflow-x: auto;
        overflow-y: hidden;

        .empty-chips-hint {
          font-size: 11px;
          color: var(--el-text-color-placeholder);
        }

        .member-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px 2px 4px;
          background: var(--el-color-primary-light-9);
          border: 1px solid var(--el-color-primary-light-7);
          border-radius: 12px;
          font-size: 11px;
          color: var(--el-color-primary);
          white-space: nowrap;
          flex-shrink: 0;

          .chip-avatar {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            object-fit: cover;
          }

          .chip-remove {
            margin-left: 2px;
            cursor: pointer;
            font-weight: bold;
            font-size: 13px;

            &:hover {
              color: var(--el-color-danger);
            }
          }
        }
      }
    }
  }

  .create-group-btn {
    width: 100%;
    margin-top: 6px;
    /* 空间不足时应当由上方的成员列表让位，按钮本身绝不能被压缩 */
    flex-shrink: 0;
  }
}
</style>

<style lang="scss">
.add-contactor-dialog {
  .el-dialog__header {
    border-bottom: 1px solid var(--el-border-color-light);
    margin-right: 0;
  }

  .el-dialog__body {
    padding: 0;
  }
}
</style>

// 移动端响应式样式 @media (max-width: 768px) { .add-contactor-dialog { display:
none !important; } .search { padding: 12px 0 !important; } .adapter-icon {
width: 44px !important; height: 44px !important; margin-right: 16px !important;
} .adapter-name { font-size: 16px !important; } .adapter-desc { font-size: 13px
!important; } .el-button { padding: 8px 16px !important; } .share-code-view {
padding-top: 20px !important; } .input-label { font-size: 15px !important;
margin-bottom: 12px !important; } .el-input { font-size: 16px !important; }
.loading { padding: 24px !important; font-size: 15px !important; } } // 平板适配
@media (min-width: 769px) and (max-width: 1024px) { .mobile-fullscreen-overlay {
display: none !important; } } // 确保桌面端不显示移动端组件 @media (min-width:
769px) { .mobile-fullscreen-overlay { display: none !important; } }
