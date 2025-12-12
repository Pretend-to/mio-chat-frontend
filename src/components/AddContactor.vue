<template>
  <!-- 移动端全屏模式 -->
  <div v-if="isMobile" class="mobile-fullscreen-overlay" :class="{ show: show }" @click="handleOverlayClick">
    <div class="mobile-container" :class="{ show: show }" @click.stop>
      <div class="mobile-header">
        <div class="mobile-title">添加机器人</div>
        <button class="mobile-close-btn" @click="close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
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
                <div class="adapter-icon" :style="{ backgroundColor: getProviderColor(provider.adapterType) }">
                  <img :src="getAvatarByAdapterType(provider.adapterType)" class="adapter-icon-img" />
                </div>
                <div class="adapter-info">
                  <div class="adapter-header">
                    <el-tag size="small" :type="getProviderTagType(provider.adapterType)" effect="plain" round>
                      {{ provider.adapterType }}
                    </el-tag>
                    <div class="adapter-name">{{ provider.label }}</div>
                  </div>
                  <div class="adapter-desc">{{ getProviderDesc(provider.adapterType) }}</div>
                </div>
                <el-button type="primary" size="small" @click="handleAddByProvider(provider)">添加</el-button>
              </div>
              <el-empty v-if="filteredProviders.length === 0" description="未找到相关适配器" />
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
                <div :style="{ left: buttonTranslate }" class="slide-button"></div>
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
                v-if="shownPrestsList.length > 0 || [0, 3].includes(activeTypeIndex)"
                class="presets-list"
                @scroll="handleScroll"
              >
                <div
                  v-for="(preset, index) in shownPrestsList"
                  :key="index"
                  class="presets-item mobile"
                >
                  <div v-if="preset.avatar" class="preset-avatar custom">
                    <img :src="preset.avatar" />
                  </div>
                  <div v-else-if="preset.model" class="preset-avatar model">
                    <img :src="Contactor.getAvatarByModel(preset.model)" />
                  </div>
                  <div v-else class="preset-avatar">
                    {{ preset.name.slice(0, 2) }}
                  </div>
                  <div class="preset-info">
                    <div class="preset-name">{{ preset.name }}</div>
                    <div :title="preset.opening" class="preset-description">
                      {{ preset.opening }}
                    </div>
                  </div>
                  <el-button @click="addBot(preset)">添加</el-button>
                </div>
                <div v-if="showPresetsLoader" class="loading">
                  <el-icon class="is-loading">
                    <Loading />
                  </el-icon>
                  <span style="margin-left: 8px;">加载中...</span>
                </div>
              </el-scrollbar>
              <div v-else class="empty-list">
                <el-empty :image-size="120" />
              </div>
            </div>
          </div>

          <!-- 分享码 -->
          <div v-show="activeTab === 2" class="share-code-view">
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
                style="width: 100%; margin-top: 16px;"
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
              <div class="adapter-icon" :style="{ backgroundColor: getProviderColor(provider.adapterType) }">
                <img :src="getAvatarByAdapterType(provider.adapterType)" class="adapter-icon-img" />
              </div>
              <div class="adapter-info">
                <div class="adapter-header">
                  <el-tag size="small" :type="getProviderTagType(provider.adapterType)" effect="plain" round>
                    {{ provider.adapterType }}
                  </el-tag>
                  <div class="adapter-name">{{ provider.label }}</div>
                </div>
                <div class="adapter-desc">{{ getProviderDesc(provider.adapterType) }}</div>
              </div>
              <el-button type="primary" size="small" @click="handleAddByProvider(provider)">添加</el-button>
            </div>
            <el-empty v-if="filteredProviders.length === 0" description="未找到相关适配器" />
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
              <div :style="{ left: buttonTranslate }" class="slide-button"></div>
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
              v-if="shownPrestsList.length > 0 || [0, 3].includes(activeTypeIndex)"
              class="presets-list"
              @scroll="handleScroll"
            >
              <div
                v-for="(preset, index) in shownPrestsList"
                :key="index"
                class="presets-item"
              >
                <div v-if="preset.avatar" class="preset-avatar custom">
                  <img :src="preset.avatar" />
                </div>
                <div v-else-if="preset.model" class="preset-avatar model">
                  <img :src="Contactor.getAvatarByModel(preset.model)" />
                </div>
                <div v-else class="preset-avatar">
                  {{ preset.name.slice(0, 2) }}
                </div>
                <div class="preset-info">
                  <div class="preset-name">{{ preset.name }}</div>
                  <div :title="preset.opening" class="preset-description">
                    {{ preset.opening }}
                  </div>
                </div>
                <el-button @click="addBot(preset)">添加</el-button>
              </div>
              <div v-if="showPresetsLoader" class="loading">
                <el-icon class="is-loading">
                  <Loading />
                </el-icon>
                <span style="margin-left: 8px;">加载中...</span>
              </div>
            </el-scrollbar>
            <div v-else class="empty-list">
              <el-empty :image-size="120" />
            </div>
          </div>
        </div>

        <!-- 分享码 -->
        <div v-show="activeTab === 2" class="share-code-view">
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
              style="width: 100%; margin-top: 16px;"
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
import { config } from "@/lib/runtime.js";
import { getAvatarByAdapterType } from "@/utils/avatar.js";
import { Loading, Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Contactor from "../lib/contactor";

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
});

// Emits
const emit = defineEmits(["addBot", "close", "add-by-provider", "add-by-share-code", "update:show"]);

// Router
const router = useRouter();

// Constants
const avaliablePresetTypes = ["推荐", "最近", "本地", "系统"];
const tabs = ["适配器", "预设", "分享码"];

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

const availableProviders = computed(() => {
  return config.getLLMProviders();
});

const filteredProviders = computed(() => {
  if (!adapterKeyword.value.trim()) {
    return availableProviders.value;
  }
  const keyword = adapterKeyword.value.toLowerCase();
  return availableProviders.value.filter(provider => 
    provider.value.toLowerCase().includes(keyword) ||
    provider.label.toLowerCase().includes(keyword) ||
    provider.adapterType.toLowerCase().includes(keyword)
  );
});

// Methods
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

const handleOverlayClick = () => {
  close();
};

const close = () => {
  emit('close');
};

const handleAddByProvider = (provider) => {
  emit("add-by-provider", provider.value);
  ElMessage.success(`正在创建 ${provider.label} Bot...`);
  close();
};

const getProviderDesc = (provider) => {
  const descMap = {
    'openai': 'OpenAI GPT 系列模型',
    'gemini': 'Google Gemini 模型',
    'vertex': 'Google Vertex AI 平台',
    'onebot': 'OneBot 协议 (QQ, etc.)',
  };
  return descMap[provider] || '大语言模型适配器';
};

const getProviderTagType = (provider) => {
  const typeMap = {
    'openai': 'primary',
    'gemini': 'success',
    'vertex': 'warning',
    'onebot': 'info',
  };
  return typeMap[provider] || 'info';
};

const getProviderColor = (provider) => {
  const colorMap = {
    'openai': '#f0f9ff',  // 浅蓝色背景
    'gemini': '#f0f7ff',  // 浅蓝色背景
    'vertex': '#fffbeb',  // 浅黄色背景
    'onebot': '#f0f4ff',  // 浅紫蓝色背景
  };
  return colorMap[provider] || '#f5f5f5'; // 默认浅灰色
};

const handleAddByShareCode = () => {
  if (!shareCode.value.trim()) {
    ElMessage.warning('请输入分享码');
    return;
  }
  
  const code = shareCode.value.trim();
  
  // 判断是否为纯数字
  if (/^\d+$/.test(code)) {
    router.push(`/s/${code}`);
    close();
    return;
  }
  
  // 判断是否为链接
  try {
    const url = new URL(code);
    const currentHost = window.location.host;
    
    if (url.host === currentHost) {
      const match = url.pathname.match(/^\/s\/(\d+)$/);
      if (match) {
        router.push(url.pathname);
        close();
        return;
      } else {
        ElMessage.error('链接格式不正确，应为 /s/数字');
        return;
      }
    } else {
      ElMessage.error('链接域名与当前网站不一致');
      return;
    }
  } catch (e) {
    ElMessage.error('请输入有效的分享码或分享链接');
    return;
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

const getAddHistory = () => {
  const recent = localStorage.getItem("recent-presets");
  if (recent) {
    recentPresets.value = JSON.parse(recent);
  }
  const local = localStorage.getItem("local-presets");
  if (local) {
    localPresets.value = JSON.parse(local);
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
  loadSpecificType();
};

// 处理滚动事件，实现无限滚动
const handleScroll = ({ scrollTop }) => {
  const scrollbar = document.querySelector('.presets-list .el-scrollbar__wrap');
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
  window.addEventListener('resize', checkMobile);
  getAddHistory();
  await loadSpecificType();
});

// 清理事件监听器
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
  position: sticky;
  top: 0;
  z-index: 10;
}

.mobile-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.mobile-close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: var(--el-text-color-regular);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }
}

.add-contactor-body {
  height: 60vh;
  display: flex;
  flex-direction: column;

  &.mobile {
    height: calc(100vh - 65px);
    flex: 1;
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
    content: '';
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
  padding: 0 20px;
  display: flex;
  flex-direction: column;

  &.mobile {
    padding: 0 16px;
    flex: 1;
  }
}

.search {
  padding: 16px 0;
  flex-shrink: 0;
}

.adapters-view, .presets-view, .share-code-view {
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
  background-color: var(--el-bg-color-page);
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
    color: var(--el-text-color-regular);
    font-size: 14px;

    &.active {
      color: var(--el-color-primary);
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
  background-color: var(--el-color-white);
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
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

// 移动端响应式样式
@media (max-width: 768px) {
  .add-contactor-dialog {
    display: none !important;
  }

  .search {
    padding: 12px 0 !important;
  }

  .adapter-icon {
    width: 44px !important;
    height: 44px !important;
    margin-right: 16px !important;
  }

  .adapter-name {
    font-size: 16px !important;
  }

  .adapter-desc {
    font-size: 13px !important;
  }

  .el-button {
    padding: 8px 16px !important;
  }

  .share-code-view {
    padding-top: 20px !important;
  }

  .input-label {
    font-size: 15px !important;
    margin-bottom: 12px !important;
  }

  .el-input {
    font-size: 16px !important;
  }

  .loading {
    padding: 24px !important;
    font-size: 15px !important;
  }
}

// 平板适配
@media (min-width: 769px) and (max-width: 1024px) {
  .mobile-fullscreen-overlay {
    display: none !important;
  }
}

// 确保桌面端不显示移动端组件
@media (min-width: 769px) {
  .mobile-fullscreen-overlay {
    display: none !important;
  }
}