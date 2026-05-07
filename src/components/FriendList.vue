<script setup>
import { ref, computed, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { client, config } from "@/lib/runtime.js";
import AddContactor from "@/components/AddContactor.vue";
import ContextMenu from "@/components/ContextMenu.vue";
import { shareOrCopy } from "@/utils/tools.js";
import { processAvatarWithStatusHole, getAdminAvatarUrl } from "@/utils/avatar.js";
import StatusDot from "@/components/StatusDot.vue";
import { useConnectionStore } from "@/stores/connectionStore";

// Emits
const emit = defineEmits(['open-share-code-window']);

// Route & Router
const route = useRoute();
const router = useRouter();

// Instance for $message (保持与原版 this.$message 调用一致)
const { proxy } = getCurrentInstance();

// Data
const onPhone = ref(window.innerWidth < 600);
const processedImage = ref(client.avatar || "/p/qava?q=1099834705");
const connectionStore = useConnectionStore();
const isConnected = computed(() => connectionStore.isConnected);
const contactorList = ref([]);
const showAddWindow = ref(false);
const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const selectedFriend = ref(null);
const lastClickTime = ref(0);
const swipedId = ref(null);
const touchStartX = ref(0);
const touchStartY = ref(0);
const swipeOffset = ref(0);
const isSwiping = ref(false);
const MAX_SWIPE = 140; // 两个按钮的宽度和

// Network Status
const isOnline = ref(navigator.onLine);
const connectionType = ref('WiFi'); // 默认值

const updateNetworkStatus = () => {
  isOnline.value = navigator.onLine;
  if (navigator.connection) {
    const type = navigator.connection.type;
    if (type) {
      const typeMap = {
        'wifi': 'WiFi',
        'cellular': '移动网络',
        'ethernet': '以太网',
        'bluetooth': '蓝牙',
        'none': '无网络'
      };
      connectionType.value = typeMap[type] || '在线';
    } else {
      // 在桌面端，effectiveType 经常返回 '4G' 即使是在用 WiFi
      // 如果无法确定具体物理类型（wifi/cellular），统一显示 '在线' 避免误导
      connectionType.value = '在线';
    }
  }
};

// Refs for template
const friendlists = ref(null);

// Resizing logic
let isResizing = false;
let startX = 0;
let startWidth = 0;

// Computed
const listVersion = ref(0);
const sortedList = computed(() => {
  // 增加对 listVersion 的依赖，确保手动触发更新
  void listVersion.value;
  return [...contactorList.value].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.lastUpdate - a.lastUpdate;
  });
});

// Methods
const handleResize = () => {
  onPhone.value = window.innerWidth < 600;
};

const addReactiveListener = () => {
  contactorList.value.forEach((contactor) => {
    contactor.on("updateMessageSummary", () => {
      contactor.lastMessageSummary = contactor.getLastMessageSummary();
      listVersion.value++;
    });
    contactor.on("updateMessage", () => {
      // 触发计算属性重新计算，确保 UI 同步
      contactorList.value = [...client.getContactors()];
      listVersion.value++;
    });
    contactor.on("name_updated", () => {
      contactorList.value = [...client.getContactors()];
      listVersion.value++;
    });
  });
};

const loadAvatar = async (adminId) => {
  const adminAvatar = getAdminAvatarUrl(adminId);
  try {
    processedImage.value = await processAvatarWithStatusHole(adminAvatar);
  } catch (error) {
    processedImage.value = adminAvatar;
  }
};

const initStatus = () => {
  const adminId = client.admin_qq;
  if (adminId) loadAvatar(adminId);
  // Socket 连接状态现在统一通过 Pinia Store 管理
};

const genFakeId = () => client.genFakeId();

const openAddWindow = () => {
  showAddWindow.value = true;
};

const genBotByShareCode = () => {
  showAddWindow.value = false;
  emit("open-share-code-window");
};

const showChat = (id) => {
  if (route.name == "blank" || route.name == "chat_view") {
    router.push({ name: "chat_view", params: { id } });
  } else if (route.name == "contactors" || route.name == "profile_view") {
    router.push({ name: "profile_view", params: { id } });
  } else {
    router.replace({ name: "chat_view", params: { id } });
  }
};

const getDraftSummary = (html) => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const hasImage = doc.querySelector('img') !== null;
  const text = (doc.body.textContent || "").trim();
  const summary = text.substring(0, 50);

  if (hasImage) {
    return `[图片] ${summary}`.trim();
  }
  return summary || "";
};

const getId = (item) => {
  let currentId = route.params.id;
  if (currentId == item.id) return "active";
  return item.priority == 0 ? "important" : "";
};

const mergeOptions = (options) => {
  const defaultOptions = config.getLLMDefaultConfig();
  if (options.history) defaultOptions.presetSettings.history = options.history;
  if (options.tools?.length > 0) {
    // 预设存储的是工具短名（如 'searchInternet'），
    // 但前端 llmTools 使用的是带 hash 后缀的完整名（如 'searchInternet_mid_abc123'）。
    // 这里通过前缀匹配将短名解析为完整名。
    const resolvedTools = [];
    const allPluginTools = Object.values(config.llmTools || {});
    for (const shortName of options.tools) {
      let found = false;
      for (const pluginTools of allPluginTools) {
        if (!pluginTools || typeof pluginTools !== 'object') continue;
        const fullName = Object.keys(pluginTools).find(
          name => name === shortName || name.startsWith(shortName + '_mid_')
        );
        if (fullName) {
          resolvedTools.push(fullName);
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(`[mergeOptions] 工具 "${shortName}" 未在已加载的工具列表中找到，已跳过。`);
      }
    }
    defaultOptions.toolCallSettings.tools = resolvedTools;
  }
  if (options.opening) defaultOptions.presetSettings.opening = options.opening;
  if (options.model) {
    const availableProviders = config.getLLMProviders().map((item) => item.value);
    const provider = availableProviders.find((p) => config.isModelAvailable(p, options.model));
    if (provider) {
      defaultOptions.provider = provider;
      defaultOptions.base.model = options.model;
    } else {
      defaultOptions.base.model = options.model;
      proxy.$message({ message: "预设模型不存在, 已使用默认模型", type: "error" });
    }
  }
  return defaultOptions;
};

const addPresetContactor = async (preset) => {
  const contactor = {
    id: genFakeId(),
    namePolicy: 1,
    avatarPolicy: preset.avatar ? 1 : 0,
    avatar: preset.avatar || undefined,
    name: preset.name,
    title: preset.title,
    priority: 1,
    options: mergeOptions(preset),
  };
  await client.addConcator("openai", contactor);
  addReactiveListener();
};

const genBotByProvider = async (provider) => {
  const options = config.getLLMDefaultConfig(provider);
  const blankConfig = {
    id: genFakeId(),
    title: options.base.model,
    avatarPolicy: 0,
    namePolicy: 2,
    priority: 1,
    options: options,
  };
  await client.addConcator("openai", blankConfig);
  addReactiveListener();
};

const showFriendContextMenu = (event, friend) => {
  if (event.preventDefault) event.preventDefault();
  selectedFriend.value = friend;
  menuX.value = event.clientX;
  menuY.value = event.clientY;
  showMenu.value = true;
  const closeMenu = () => {
    showMenu.value = false;
    document.removeEventListener("click", closeMenu);
  };
  document.addEventListener("click", closeMenu);
};

const handleTouchStart = (event, item) => {
  if (!onPhone.value) return;
  // 如果点击的是已经展开的项，或者正在点击按钮，则不重置
  if (event.target.closest('.swipe-actions')) return;

  touchStartX.value = event.touches[0].clientX;
  touchStartY.value = event.touches[0].clientY;
  isSwiping.value = false;

  // 如果点击的是非当前展开项，先关闭当前展开项
  if (swipedId.value !== item.id) {
    swipedId.value = null;
    swipeOffset.value = 0;
  }
};

const handleTouchMove = (event, item) => {
  if (!onPhone.value) return;
  const touchX = event.touches[0].clientX;
  const touchY = event.touches[0].clientY;
  const deltaX = touchX - touchStartX.value;
  const deltaY = touchY - touchStartY.value;

  // 如果垂直滑动比例过大，认为是滚动，不触发侧滑
  if (Math.abs(deltaY) > Math.abs(deltaX)) return;

  if (deltaX < 0) { // 向左划
    isSwiping.value = true;
    swipeOffset.value = Math.min(Math.abs(deltaX), MAX_SWIPE);
    swipedId.value = item.id;
    // 阻止浏览器默认行为（如回退手势）
    if (Math.abs(deltaX) > 10 && event.cancelable) event.preventDefault();
  } else if (swipedId.value === item.id && deltaX > 0) { // 展开状态下向右划，收起
    swipeOffset.value = Math.max(MAX_SWIPE - deltaX, 0);
    if (swipeOffset.value === 0) swipedId.value = null;
  }
};

const handleTouchEnd = (event, item) => {
  if (!onPhone.value) return;
  if (!isSwiping.value && swipedId.value !== item.id) return;

  if (swipeOffset.value > MAX_SWIPE / 2) {
    swipeOffset.value = MAX_SWIPE;
    swipedId.value = item.id;
  } else {
    swipeOffset.value = 0;
    swipedId.value = null;
  }
  isSwiping.value = false;
};

const closeSwipe = () => {
  swipedId.value = null;
  swipeOffset.value = 0;
};

const handleFriendOption = async (option, friendOverride) => {
  const friend = friendOverride || selectedFriend.value;
  if (!friend) return;

  switch (option) {
    case "enter": showChat(friend.id); break;
    case "priority":
      friend.priority = friend.priority === 0 ? 1 : 0;
      client.setLocalStorage();
      break;
    case "share": {
      const shareResult = await client.shareContactor(friend.id);
      if (shareResult?.shareUrl) {
        const { success, message } = shareOrCopy(shareResult.shareUrl);
        proxy.$message({ message, type: success ? "success" : "error" });
      }
      break;
    }
    case "delete": {
      const index = contactorList.value.findIndex((c) => c.id === friend.id);
      if (index !== -1) {
        contactorList.value.splice(index, 1);
        client.setLocalStorage();
      }
      break;
    }
  }
  showMenu.value = false;
  closeSwipe();
};

const startResize = (event) => {
  isResizing = true;
  startX = event.clientX;
  startWidth = friendlists.value.offsetWidth;
  document.addEventListener("mousemove", resize);
  document.addEventListener("mouseup", stopResize);
};

const resize = (event) => {
  if (!isResizing) return;
  let newWidth = startWidth + (event.clientX - startX);
  const remSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const maxWidth = 20 * remSize;
  const minWidth = 12 * remSize;
  newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
  friendlists.value.style.minWidth = newWidth + "px";
  friendlists.value.style.maxWidth = newWidth + "px";
};

const stopResize = () => {
  isResizing = false;
  document.removeEventListener("mousemove", resize);
  document.removeEventListener("mouseup", stopResize);
};

// Lifecycle
onMounted(() => {
  const initList = () => {
    contactorList.value = client.getContactors();
    addReactiveListener();
  };

  if (client.getContactors().length === 0) {
    client.on("loaded", initList, false);
  } else {
    initList();
  }

  window.addEventListener('resize', handleResize);
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  if (navigator.connection) {
    navigator.connection.addEventListener('change', updateNetworkStatus);
  }
  updateNetworkStatus();

  if (client.inited) initStatus();
  else client.on("loaded", initStatus, false);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('online', updateNetworkStatus);
  window.removeEventListener('offline', updateNetworkStatus);
  if (navigator.connection) {
    navigator.connection.removeEventListener('change', updateNetworkStatus);
  }
});
</script>

<template>
  <div id="friendlists" ref="friendlists">
    <div v-if="onPhone" class="mobile-qq-header">
      <div class="header-top">
        <div class="user-info">
          <div class="user-avatar">
            <StatusDot size="14px" class="status-dot-mobile" />
            <img :src="processedImage" alt="avatar" />
          </div>
          <div class="user-detail">
            <div class="user-name">{{ client.name === 'user' ? '秋山 澪' : client.name }}</div>
            <div class="user-status">
              {{ isOnline ? connectionType : '离线' }} >
            </div>
          </div>
        </div>
        <div class="header-actions">
          <i class="iconfont add" @click="openAddWindow"></i>
        </div>
      </div>
      <div class="header-search">
        <div class="search-bar">
          <i class="iconfont sousuo"></i>
          <span>搜索</span>
        </div>
      </div>
    </div>
    <div v-else id="friends" class="upsidebar">
      <div class="search">
        <i class="iconfont sousuo listicon"></i>
        <input id="main-search" type="text" placeholder="搜索" />
      </div>
      <div class="bu-add">
        <button id="addcont" title="Add Bot" @click="openAddWindow">
          <i class="iconfont add"></i>
        </button>
      </div>
    </div>
    <div class="people" @scroll="closeSwipe">
      <div v-for="(item, index) of sortedList" :id="getId(item)" :key="index" class="lists-wrapper"
        :class="{ 'swiping': swipedId === item.id }">
        <div class="lists" @click="swipedId === item.id ? closeSwipe() : showChat(item.id)"
          @contextmenu.prevent="onPhone ? null : showFriendContextMenu($event, item)"
          @touchstart="handleTouchStart($event, item)" @touchmove="handleTouchMove($event, item)"
          @touchend="handleTouchEnd($event, item)"
          :style="swipedId === item.id ? { transform: `translateX(-${swipeOffset}px)` } : {}">
          <div class="avatar" :class="item.avatarPolicy == 1 ? 'custom' : 'model'">
            <img :src="item.avatar" :alt="item.name" />
          </div>
          <div class="info">
            <div class="name">{{ item.name }}</div>
            <div id="time" class="msginfo">{{ item.getLastTime() }}</div>
            <div id="msgctt" class="msginfo">
              <template v-if="item.draft">
                <span v-if="!onPhone" class="mio-icon mio-icon-draft"></span>
                <span v-else class="draft-text">[草稿] </span>
                <span :class="{ 'draft-text': onPhone }">{{ getDraftSummary(item.draft) }}</span>
              </template>
              <template v-else>
                {{ item.lastMessageSummary }}
              </template>
            </div>
            <div v-if="item.hasPendingTask" class="unread-badge">1</div>
          </div>
        </div>
        <div v-if="onPhone" class="swipe-actions" :style="swipedId === item.id ? { opacity: 1 } : { opacity: 0 }">
          <div class="action-btn pin" @click.stop="handleFriendOption('priority', item)">
            {{ item.priority === 0 ? '取消置顶' : '置顶' }}
          </div>
          <div class="action-btn delete" @click.stop="handleFriendOption('delete', item)">
            删除
          </div>
        </div>
      </div>
    </div>
    <div class="resizer" @mousedown="startResize"></div>
    <AddContactor v-model:show="showAddWindow" @close="showAddWindow = false" @add-bot="addPresetContactor"
      @add-by-provider="genBotByProvider" @add-by-share-code="genBotByShareCode" />
    <ContextMenu v-if="showMenu" type="friend" :message="selectedFriend" :style="{
      top: menuY + 'px',
      left: menuX + 'px'
    }" @message-option="handleFriendOption" @close="showMenu = false" />
  </div>
</template>

<style scoped>
#friendlists {
  height: 100%;
  display: flex;
  min-width: 14rem;
  max-width: 14rem;
  flex-direction: column;
  position: relative;
  background-color: #fff;
}

.resizer {
  width: 5px;
  cursor: ew-resize;
  background-color: transparent;
  /* 可视化的样式，你可以根据需求进行调整 */
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
}

.upsidebar {
  justify-content: space-between;
  display: flex;
  flex-direction: row;
  background-color: rgb(255, 255, 255);
  flex: 0 0 4rem;
  align-items: flex-end;
  -webkit-app-region: drag;
  align-items: center;
  padding: 0rem .5rem;
}

#main-search {
  width: calc(100% - 1.125rem);
  margin-top: 0.1875rem;
  padding-left: 0.3125rem;
  height: 1.125rem;
  background-color: rgb(244, 244, 244);
  border: 0rem;
}

#main-search:focus {
  outline: none;
  border: 0rem;
}

button#searchButton {
  width: 1rem;
  border: 0rem;
  border-radius: 0.3125rem;
  margin-left: 0.5rem;
  text-wrap: nowrap;
}

.search {
  flex-grow: 1;
  flex-basis: 1rem;
  border-radius: 0.3125rem;
  background: rgb(244, 244, 244);
  height: 2rem;
  display: flex;
  align-items: center;
  padding-left: .5rem;
}

.bu-add {
  flex-basis: 2rem;
  font-size: 1rem;
  margin-left: 0.5rem;
  height: 2rem;
  position: relative;
}

.listicon {
  padding-top: 0.0625rem;
  width: 1rem;
  height: 1rem;
}

button#addcont {
  border-radius: 0.3125rem;
  width: 100%;
  height: 100%;
  border: none;
  background-color: rgb(244, 244, 244);
}

.lists {
  align-items: center;
  min-width: 10rem;
  display: flex;
  padding: 0.25rem 0.5rem;
  height: 3.75rem;
  max-height: 3.75rem;
  min-height: 3.75rem;
  -webkit-touch-callout: none;
  /* border: .0625rem solid pink; */
}

.lists-wrapper#important {
  background-color: rgb(240, 240, 240);
}

.lists:hover {
  background-color: rgb(240, 240, 240);
  /* border: .0625rem solid pink; */
}

.lists-wrapper#important:hover {
  background-color: rgb(231, 231, 231);
  /* border: .0625rem solid pink; */
}

.lists-wrapper#active .lists {
  background-color: rgb(0, 153, 255);
}

.lists>.avatar {
  flex-basis: 2.65rem;
  min-width: 2.65rem;
  height: 2.65rem;
  border-radius: 50%;
  overflow: hidden;
  background-color: white;
}

.avatar>img {
  width: 100%;
  height: 100%;
}

.avatar.model>img {
  scale: 0.9;
}

.unread-badge {
  position: absolute;
  right: 0rem;
  bottom: 0.6rem;
  background-color: #ff4d4f;
  color: white;
  font-size: 0.55rem;
  font-weight: bold;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.avatar {
  position: relative;
}

.info {
  height: 100%;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex: 0 0 calc(100% - 2.65rem);
  max-width: calc(100% - 2.65rem);
  flex-wrap: wrap;
  position: relative;
}

.lists-wrapper#active .lists * {
  color: #f0f8ff;
}

.lists .name {
  flex-basis: 4rem;
  flex-grow: 1;
  margin-top: 0.75rem;
  font-size: 0.875rem;
  margin-left: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info #time {
  font-size: 0.625rem;
  flex-grow: 1;
  text-align: right;
}

.info #msgctt {
  flex-basis: 100%;
  padding-right: 1rem;
  font-size: 0.625rem;
  margin-left: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.people {
  overflow-y: auto;
}

@media screen and (max-width: 600px) {
  #friendlists {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: none;
    background-color: #fff;
  }

  .mobile-qq-header {
    padding: 0.75rem 1rem 0.5rem 1rem;
    background-color: #F1F4FE;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    /* overflow: hidden; */
    /* 移除 hidden 允许状态点溢出显示 */
    position: relative;
    background-color: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .user-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .status-dot-mobile {
    position: absolute;
    right: -1px;
    bottom: -1px;
    z-index: 2;
  }

  .user-detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .user-name {
    font-size: 1.05rem;
    font-weight: 600;
    color: #1a1a1a;
    line-height: 1.2;
  }

  .user-status {
    font-size: 0.75rem;
    color: #8e8e8e;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-actions .add {
    font-size: 1.3rem;
    color: #333;
    cursor: pointer;
  }

  .header-search {
    padding: 2px 0;
  }

  .search-bar {
    height: 36px;
    background-color: #fff;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #999;
    font-size: 0.95rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  }

  .search-bar .sousuo {
    font-size: 1rem;
  }

  .people {
    background-color: #fff;
    /* 移除圆角和阴影，保持连贯性 */
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    padding-top: 0;
    flex-grow: 1;
    box-shadow: none;
    overflow-x: hidden;
  }

  .lists-wrapper {
    position: relative;
    width: 100%;
    overflow: hidden;
    background-color: #fff;
  }

  .lists {
    position: relative;
    z-index: 2;
    background-color: inherit;
    transition: transform 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
  }

  .lists-wrapper.swiping .lists {
    transition: none;
    /* 滑动时禁用过渡 */
  }

  .swipe-actions {
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    width: 140px;
    display: flex;
    z-index: 1;
    transition: opacity 0.2s;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .action-btn.pin {
    background-color: #0099ff;
  }

  .action-btn.delete {
    background-color: #ff4d4f;
  }

  .lists-wrapper#important {
    background-color: #F1F4FE;
  }

  .lists:hover,
  .lists-wrapper#important:hover {
    background-color: inherit;
  }
}
</style>
