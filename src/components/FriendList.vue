<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  getCurrentInstance,
  nextTick,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { client, config } from "@/lib/runtime.js";
import {
  useContactorsStore,
  getContactorLastTime,
} from "@/stores/contactorsStore.js";
import AddContactor from "@/components/AddContactor.vue";
import ContextMenu from "@/components/ContextMenu.vue";
import { shareOrCopy } from "@/utils/tools.js";
import {
  processAvatarWithStatusHole,
  getAdminAvatarUrl,
} from "@/utils/avatar.js";
import StatusDot from "@/components/StatusDot.vue";
import { useConnectionStore } from "@/stores/connectionStore";
import Fuse from "fuse.js";

// Emits
const emit = defineEmits(["open-share-code-window"]);

// Route & Router
const route = useRoute();
const router = useRouter();

// Instance for $message (保持与原版 this.$message 调用一致)
const { proxy } = getCurrentInstance();

// Data
const onPhone = ref(window.innerWidth < 768);
const processedImage = ref(client.avatar || "/p/qava?q=1099834705");
const rawAdminAvatar = ref(client.avatar || "/p/qava?q=1099834705");
const connectionStore = useConnectionStore();
const contactorsStore = useContactorsStore();
const isConnected = computed(() => connectionStore.isConnected);
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

// Search States
const searchQuery = ref("");
const isSearchingMobile = ref(false);
const mobileSearchInput = ref(null);
const isSearchFocused = ref(false);
const searchHistory = ref([]);

const loadSearchHistory = () => {
  try {
    const stored = localStorage.getItem("mio_chat_search_history");
    searchHistory.value = stored ? JSON.parse(stored) : [];
  } catch (e) {
    searchHistory.value = [];
  }
};

const saveSearchHistory = (query) => {
  const trimmed = query.trim();
  if (!trimmed) return;
  searchHistory.value = searchHistory.value.filter((h) => h !== trimmed);
  searchHistory.value.unshift(trimmed);
  if (searchHistory.value.length > 5) {
    searchHistory.value = searchHistory.value.slice(0, 5);
  }
  localStorage.setItem("mio_chat_search_history", JSON.stringify(searchHistory.value));
};

const removeHistoryItem = (item) => {
  searchHistory.value = searchHistory.value.filter((h) => h !== item);
  localStorage.setItem("mio_chat_search_history", JSON.stringify(searchHistory.value));
};

const selectHistoryItem = (item) => {
  searchQuery.value = item;
};

const triggerSearchEnter = () => {
  const q = searchQuery.value.trim();
  if (q) {
    saveSearchHistory(q);
  }
};

const startMobileSearch = () => {
  isSearchingMobile.value = true;
  nextTick(() => {
    mobileSearchInput.value?.focus();
  });
};

const handleSearchBlur = () => {
  setTimeout(() => {
    isSearchFocused.value = false;
  }, 200);
};

const handleMobileSearchBlur = () => {
  setTimeout(() => {
    isSearchFocused.value = false;
    if (!searchQuery.value) {
      isSearchingMobile.value = false;
    }
  }, 200);
};

const clearSearch = () => {
  searchQuery.value = "";
  isSearchingMobile.value = false;
};

const selectAndCloseSearch = (contactId) => {
  const q = searchQuery.value.trim();
  if (q) saveSearchHistory(q);
  showChat(contactId);
  clearSearch();
};

const jumpToMessage = (contactId, messageId) => {
  const q = searchQuery.value.trim();
  if (q) saveSearchHistory(q);
  if (String(contactId) === String(contactorsStore.activeContactorId)) {
    client.emit("scroll_to_message", messageId);
  } else {
    router.push({
      name: "chat_view",
      params: { id: contactId },
      query: { scrollTo: messageId, t: Date.now() },
    });
  }
  clearSearch();
};

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hours}:${minutes}`;
};

const highlight = (text, query) => {
  if (!text) return "";
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    text.substring(0, idx) +
    `<mark class="search-highlight">${text.substring(idx, idx + query.length)}</mark>` +
    text.substring(idx + query.length)
  );
};

// Robust function to extract text content from any message item content representation
const extractTextFromContent = (content) => {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(item => extractTextFromContent(item)).join(" ");
  }
  if (typeof content === "object") {
    if (content.type === "file") {
      return content.data?.name || "";
    }
    if (content.data) {
      if (typeof content.data === "string") return content.data;
      if (typeof content.data.text === "string") return content.data.text;
    }
    if (typeof content.text === "string") return content.text;
    if (typeof content.content === "string") return content.content;
  }
  return "";
};

// Search results computed property
const searchResults = computed(() => {
  const query = searchQuery.value.trim();
  if (!query) {
    return { contacts: [], messages: [] };
  }

  const contactList = Object.values(contactorsStore.contactors);

  // 1. Search Contacts (by name only)
  const contactFuse = new Fuse(contactList, {
    keys: ["name"],
    threshold: 0.4,
  });
  const contactMatches = contactFuse.search(query).map(res => res.item);

  // 2. Search Messages
  const allMessages = [];
  contactList.forEach((c) => {
    c.messageChain.forEach((msg) => {
      const textContent = extractTextFromContent(msg.content);
      if (textContent.trim()) {
        allMessages.push({
          contactorId: c.id,
          contactorName: c.name,
          contactorAvatar: c.avatar,
          message: msg,
          textContent: textContent.trim(),
        });
      }
    });
  });

  const messageFuse = new Fuse(allMessages, {
    keys: ["textContent"],
    threshold: 0.5,
    includeMatches: true,
  });

  const messageMatches = messageFuse.search(query).map((res) => {
    const matches = res.matches?.[0];
    const text = res.item.textContent;
    
    let matchStart = -1;
    let matchEnd = -1;
    
    if (matches && matches.indices && matches.indices.length > 0) {
      matchStart = matches.indices[0][0];
      matchEnd = matches.indices[0][1];
    } else {
      const idx = text.toLowerCase().indexOf(query.toLowerCase());
      if (idx !== -1) {
        matchStart = idx;
        matchEnd = idx + query.length - 1;
      }
    }
    
    // Position match center around 6th char of preview.
    // If cropped prefix starts with "..." (3 chars) and leaves 2 context chars, match starts at 6th character (index 5)
    let start = 0;
    if (matchStart !== -1 && matchEnd !== -1) {
      if (matchStart > 5) {
        start = matchStart - 2;
      } else {
        start = 0;
      }
    }
    
    // Suffix limit to 100 characters so browser doesn't struggle, and CSS ellipsis handles the visual cut-off
    let end = text.length;
    if (matchStart !== -1) {
      end = Math.min(text.length, matchStart + 100);
    }
    
    const croppedText = text.substring(start, end);
    let highlightedText = croppedText;
    
    if (matches && matches.indices && matches.indices.length > 0) {
      // Shift indices by start offset and filter out-of-bound ranges
      const shiftedIndices = matches.indices
        .map(([s, e]) => [s - start, e - start])
        .filter(([s, e]) => s >= 0 && e < croppedText.length);
        
      const sortedIndices = [...shiftedIndices].sort((a, b) => b[0] - a[0]);
      let html = croppedText;
      sortedIndices.forEach(([s, e]) => {
        html =
          html.substring(0, s) +
          `<mark class="search-highlight">${html.substring(s, e + 1)}</mark>` +
          html.substring(e + 1);
      });
      highlightedText = html;
    } else {
      const idx = croppedText.toLowerCase().indexOf(query.toLowerCase());
      if (idx !== -1) {
        highlightedText =
          croppedText.substring(0, idx) +
          `<mark class="search-highlight">${croppedText.substring(idx, idx + query.length)}</mark>` +
          croppedText.substring(idx + query.length);
      }
    }
    
    if (start > 0) {
      highlightedText = "..." + highlightedText;
    }
    if (end < text.length) {
      highlightedText = highlightedText + "...";
    }

    return {
      ...res.item,
      highlightedText,
    };
  });

  return {
    contacts: contactMatches,
    messages: messageMatches,
  };
});

// Network Status
const isOnline = ref(navigator.onLine);
const connectionType = ref("WiFi"); // 默认值

const updateNetworkStatus = () => {
  isOnline.value = navigator.onLine;
  if (navigator.connection) {
    const type = navigator.connection.type;
    if (type) {
      const typeMap = {
        wifi: "WiFi",
        cellular: "移动网络",
        ethernet: "以太网",
        bluetooth: "蓝牙",
        none: "无网络",
      };
      connectionType.value = typeMap[type] || "在线";
    } else {
      // 在桌面端，effectiveType 经常返回 '4G' 即使是在用 WiFi
      // 如果无法确定具体物理类型（wifi/cellular），统一显示 '在线' 避免误导
      connectionType.value = "在线";
    }
  }
};

// Refs for template
const friendlists = ref(null);

// Resizing logic
let isResizing = false;
let startX = 0;
let startWidth = 0;

// Computed — directly wired to Pinia reactive state, no local copy needed
const sortedList = computed(() => contactorsStore.sortedContactors);

const getMenuStyle = computed(() => {
  const estimatedHeight = 160;
  const isUp = menuY.value + estimatedHeight > window.innerHeight;
  const style = {
    left: menuX.value + "px",
  };
  if (isUp) {
    style.bottom = window.innerHeight - menuY.value + "px";
  } else {
    style.top = menuY.value + "px";
  }
  return style;
});

// Methods
const handleResize = () => {
  onPhone.value = window.innerWidth < 768;
};

// No longer needed — Pinia store is reactive, Vue 3 updates the template automatically

const loadAvatar = async (adminId) => {
  const adminAvatar = getAdminAvatarUrl(adminId);
  rawAdminAvatar.value = adminAvatar;
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
  const doc = new DOMParser().parseFromString(html, "text/html");
  const hasImage = doc.querySelector("img") !== null;
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
        if (!pluginTools || typeof pluginTools !== "object") continue;
        const fullName = Object.keys(pluginTools).find(
          (name) => name === shortName || name.startsWith(shortName + "_mid_"),
        );
        if (fullName) {
          resolvedTools.push(fullName);
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(
          `[mergeOptions] 工具 "${shortName}" 未在已加载的工具列表中找到，已跳过。`,
        );
      }
    }
    defaultOptions.toolCallSettings.tools = resolvedTools;
  }
  if (options.opening) defaultOptions.presetSettings.opening = options.opening;
  if (options.model) {
    const availableProviders = config
      .getLLMProviders()
      .map((item) => item.value);
    const provider = availableProviders.find((p) =>
      config.isModelAvailable(p, options.model),
    );
    if (provider) {
      defaultOptions.provider = provider;
      defaultOptions.base.model = options.model;
    } else {
      defaultOptions.base.model = options.model;
      proxy.$message({
        message: "预设模型不存在, 已使用默认模型",
        type: "error",
      });
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
  if (event.target.closest(".swipe-actions")) return;

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

  if (deltaX < 0) {
    // 向左划
    isSwiping.value = true;
    swipeOffset.value = Math.min(Math.abs(deltaX), MAX_SWIPE);
    swipedId.value = item.id;
    // 阻止浏览器默认行为（如回退手势）
    if (Math.abs(deltaX) > 10 && event.cancelable) event.preventDefault();
  } else if (swipedId.value === item.id && deltaX > 0) {
    // 展开状态下向右划，收起
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
    case "enter":
      showChat(friend.id);
      break;
    case "priority":
      contactorsStore.setPriority(friend.id, friend.priority === 0 ? 1 : 0);
      break;
    case "share": {
      const shareResult = await client.shareContactor(friend.id);
      if (shareResult?.shareUrl) {
        const { success, message } = shareOrCopy(shareResult.shareUrl);
        proxy.$message({ message, type: success ? "success" : "error" });
      }
      break;
    }
    case "delete":
      client.rmContactor(friend.id);
      break;
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
  const remSize =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
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
  window.addEventListener("resize", handleResize);
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  if (navigator.connection) {
    navigator.connection.addEventListener("change", updateNetworkStatus);
  }
  updateNetworkStatus();
  loadSearchHistory();

  if (client.inited) initStatus();
  else client.on("loaded", initStatus, false);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  window.removeEventListener("online", updateNetworkStatus);
  window.removeEventListener("offline", updateNetworkStatus);
  if (navigator.connection) {
    navigator.connection.removeEventListener("change", updateNetworkStatus);
  }
});
</script>

<template>
  <div id="friendlists" ref="friendlists">
    <div v-if="onPhone" class="mobile-qq-header">
      <div class="header-top">
        <div class="user-info">
          <div class="user-avatar">
            <img :src="rawAdminAvatar" alt="avatar" />
          </div>
          <div class="user-detail">
            <div class="user-name">
              {{ client.name === "user" ? "秋山 澪" : client.name }}
            </div>
            <div class="user-status">
              <StatusDot size="8px" />
              {{ isOnline ? connectionType : "离线" }} >
            </div>
          </div>
        </div>
        <div class="header-actions">
          <i class="iconfont add" @click="openAddWindow"></i>
        </div>
      </div>
      <div class="header-search">
        <div class="search-bar" :class="{ 'is-active': isSearchingMobile }">
          <i class="iconfont sousuo"></i>
          <input
            v-if="isSearchingMobile"
            ref="mobileSearchInput"
            v-model="searchQuery"
            type="text"
            placeholder="搜索联系人、聊天记录"
            class="mobile-search-input"
            @focus="isSearchFocused = true"
            @blur="handleMobileSearchBlur"
            @keydown.esc="clearSearch"
            @keydown.enter="triggerSearchEnter"
          />
          <span v-else class="search-placeholder" @click="startMobileSearch">搜索</span>
          <i v-if="isSearchingMobile && searchQuery" class="clear-btn-mobile" @click.stop="clearSearch"></i>
        </div>
      </div>
    </div>
    <div v-else id="friends" class="upsidebar">
      <div class="search">
        <i class="iconfont sousuo listicon"></i>
        <input
          id="main-search"
          v-model="searchQuery"
          type="text"
          placeholder="搜索"
          @focus="isSearchFocused = true"
          @blur="handleSearchBlur"
          @keydown.esc="clearSearch"
          @keydown.enter="triggerSearchEnter"
        />
        <i v-if="searchQuery" class="clear-btn" @click="clearSearch"></i>
      </div>
      <div class="bu-add">
        <button id="addcont" title="Add Bot" @click="openAddWindow">
          <i class="iconfont add"></i>
        </button>
      </div>
    </div>

    <!-- Normal contact list -->
    <div class="people" @scroll="closeSwipe">
      <div
        v-for="(item, index) of sortedList"
        :id="getId(item)"
        :key="index"
        class="lists-wrapper"
        :class="{ swiping: swipedId === item.id }"
      >
        <div
          class="lists"
          @click="swipedId === item.id ? closeSwipe() : showChat(item.id)"
          @contextmenu.prevent="
            onPhone ? null : showFriendContextMenu($event, item)
          "
          @touchstart="handleTouchStart($event, item)"
          @touchmove="handleTouchMove($event, item)"
          @touchend="handleTouchEnd($event, item)"
          :style="
            swipedId === item.id
              ? { transform: `translateX(-${swipeOffset}px)` }
              : {}
          "
        >
          <div
            class="avatar"
            :class="item.avatarPolicy == 1 ? 'custom' : 'model'"
          >
            <img :src="item.avatar" :alt="item.name" />
          </div>
          <div class="info">
            <div class="name">{{ item.name }}</div>
            <div id="time" class="msginfo">
              {{ getContactorLastTime(item.messageChain) }}
            </div>
            <div id="msgctt" class="msginfo">
              <template v-if="item.draft">
                <span v-if="!onPhone" class="mio-icon mio-icon-draft"></span>
                <span v-else class="draft-text">[草稿] </span>
                <span :class="{ 'draft-text': onPhone }">{{
                  getDraftSummary(item.draft)
                }}</span>
              </template>
              <template v-else>
                {{ item.lastMessageSummary }}
              </template>
            </div>
            <div v-if="item.hasPendingTask" class="unread-badge">1</div>
          </div>
        </div>
        <div
          v-if="onPhone"
          class="swipe-actions"
          :style="swipedId === item.id ? { opacity: 1 } : { opacity: 0 }"
        >
          <div
            class="action-btn pin"
            @click.stop="handleFriendOption('priority', item)"
          >
            {{ item.priority === 0 ? "取消置顶" : "置顶" }}
          </div>
          <div
            class="action-btn delete"
            @click.stop="handleFriendOption('delete', item)"
          >
            删除
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Search Results Panel -->
    <div v-if="isSearchFocused" class="search-floating-panel">
      <!-- Search History (Shown when searchQuery is empty) -->
      <template v-if="!searchQuery">
        <div v-if="searchHistory.length > 0" class="search-group">
          <div class="search-group-title">历史搜索</div>
          <div
            v-for="(historyItem, idx) in searchHistory"
            :key="idx"
            class="search-history-item"
            @mousedown.prevent="selectHistoryItem(historyItem)"
          >
            <span class="mio-icon mio-icon-history"></span>
            <span class="history-text">{{ historyItem }}</span>
            <span class="delete-history-btn" @mousedown.prevent.stop="removeHistoryItem(historyItem)">✕</span>
          </div>
        </div>
        <div v-else class="search-empty">
          <i class="iconfont sousuo empty-icon"></i>
          <div class="empty-text">输入关键词搜索联系人或聊天记录</div>
        </div>
      </template>

      <!-- Active Search Results -->
      <template v-else>
        <!-- Contacts matched -->
        <div v-if="searchResults.contacts.length > 0" class="search-group">
          <div class="search-group-title">联系人</div>
          <div
            v-for="contact in searchResults.contacts"
            :key="contact.id"
            class="search-item"
            @click="selectAndCloseSearch(contact.id)"
          >
            <div class="avatar" :class="contact.avatarPolicy == 1 ? 'custom' : 'model'">
              <img :src="contact.avatar" :alt="contact.name" />
            </div>
            <div class="info">
              <div class="name" v-html="highlight(contact.name, searchQuery)"></div>
              <div class="title-text">{{ contact.title || 'Bot' }}</div>
            </div>
          </div>
        </div>

        <!-- Messages matched -->
        <div v-if="searchResults.messages.length > 0" class="search-group">
          <div class="search-group-title">聊天记录</div>
          <div
            v-for="msgResult in searchResults.messages"
            :key="msgResult.message.id"
            class="search-item"
            @click="jumpToMessage(msgResult.contactorId, msgResult.message.id)"
          >
            <div class="avatar">
              <img :src="msgResult.contactorAvatar" :alt="msgResult.contactorName" />
            </div>
            <div class="info">
              <div class="search-msg-header">
                <span class="name">{{ msgResult.contactorName }}</span>
                <span class="time">{{ formatTime(msgResult.message.time) }}</span>
              </div>
              <div class="search-msg-preview" v-html="msgResult.highlightedText"></div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="searchResults.contacts.length === 0 && searchResults.messages.length === 0" class="search-empty">
          <i class="iconfont sousuo empty-icon"></i>
          <div class="empty-text">未找到相关联系人或聊天记录</div>
        </div>
      </template>
    </div>
    <div class="resizer" @mousedown="startResize"></div>
    <AddContactor
      v-model:show="showAddWindow"
      @close="showAddWindow = false"
      @add-bot="addPresetContactor"
      @add-by-provider="genBotByProvider"
      @add-by-share-code="genBotByShareCode"
    />
    <ContextMenu
      v-if="showMenu"
      type="friend"
      :message="selectedFriend"
      :style="getMenuStyle"
      :client-x="menuX"
      @message-option="handleFriendOption"
      @close="showMenu = false"
    />
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
  background-color: transparent;
  border-right: 1px solid #ebebeb;
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
  background-color: transparent;
  flex: 0 0 4rem;
  align-items: flex-end;
  -webkit-app-region: drag;
  align-items: center;
  padding: 0rem 0.5rem;
}

#main-search {
  width: calc(100% - 1.125rem);
  margin-top: 0.1875rem;
  padding-left: 0.3125rem;
  height: 1.125rem;
  background-color: transparent;
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
  background-color: #ebebeb;
  height: 2rem;
  display: flex;
  align-items: center;
  padding-left: 0.5rem;
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
  background-color: #ebebeb;
  transition: background-color 0.2s ease;
  cursor: pointer;
}

button#addcont:hover {
  background-color: #e0e0e0;
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
  background-color: #ebebeb;
}

.lists:hover {
  background-color: rgb(240, 240, 240);
  /* border: .0625rem solid pink; */
}

.lists-wrapper#important:hover {
  background-color: #e0e0e0;
  /* border: .0625rem solid pink; */
}

.lists-wrapper#active .lists {
  background-color: rgb(0, 153, 255);
}

.lists > .avatar {
  flex-basis: 2.65rem;
  min-width: 2.65rem;
  height: 2.65rem;
  border-radius: 50%;
  overflow: hidden;
  background-color: white;
}

.avatar > img {
  width: 100%;
  height: 100%;
}

.avatar.model > img {
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

@media screen and (max-width: 768px) {
  #friendlists {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: none;
    background-color: #fff;
    border-right: none;
  }

  .mobile-qq-header {
    padding: 0.75rem 1rem 0.5rem 1rem;
    background-color: #f1f4fe;
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
    overflow: hidden;
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
    background-color: #f1f4fe;
  }

  .lists:hover,
  .lists-wrapper#important:hover {
    background-color: inherit;
  }
}

/* Clear Button in Search Input */
.search {
  position: relative;
}
.clear-btn {
  position: absolute;
  right: 0.5rem;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}
.clear-btn::before,
.clear-btn::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 1.2px;
  background-color: #ffffff;
}
.clear-btn::before {
  transform: rotate(45deg);
}
.clear-btn::after {
  transform: rotate(-45deg);
}
.clear-btn:hover {
  background-color: #999;
}

/* Clear button on mobile */
.clear-btn-mobile {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
  margin-right: 6px;
}
.clear-btn-mobile::before,
.clear-btn-mobile::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 1.2px;
  background-color: #ffffff;
}
.clear-btn-mobile::before {
  transform: rotate(45deg);
}
.clear-btn-mobile::after {
  transform: rotate(-45deg);
}
.clear-btn-mobile:hover {
  background-color: #999;
}

/* Mobile search input active state styling */
.mobile-search-input {
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.95rem;
  color: #333;
  padding-left: 4px;
}
.search-placeholder {
  cursor: pointer;
  width: 100%;
  text-align: center;
}

/* Floating Search Results Panel */
.search-floating-panel {
  position: absolute;
  top: 4rem;
  left: 0.5rem;
  right: -2rem; /* Exceeds friendList by 2rem */
  background-color: #ffffff;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.08);
  max-height: calc(100vh - 6rem);
  overflow-y: auto;
  overflow-x: hidden !important;
  z-index: 1000;
  padding: 0.5rem 0;
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .search-floating-panel {
    top: 5.5rem;
    left: 0.5rem;
    right: 0.5rem;
    max-height: calc(100vh - 7rem);
  }
}

.search-group {
  margin-bottom: 0.5rem;
}

.search-group-title {
  font-size: 0.75rem;
  color: #8c8c8c;
  text-align: left;
  padding: 0.4rem 0.8rem 0.2rem 0.8rem;
  font-weight: 500;
}

.search-item {
  display: flex;
  padding: 0.5rem 0.8rem;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s;
  gap: 0.75rem;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.search-item:hover {
  background-color: #f5f5f5;
}

.search-item .avatar {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.search-item .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.search-item .info {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.search-item .name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}

.search-item .title-text {
  font-size: 0.75rem;
  color: #999;
}

.search-msg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 2px;
  min-width: 0;
}

.search-msg-header .name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}

.search-msg-header .time {
  font-size: 0.7rem;
  color: #999;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.search-msg-preview {
  font-size: 0.8rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  box-sizing: border-box;
}

.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #aaa;
  text-align: center;
}

.search-empty .empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #ddd;
}

.search-empty .empty-text {
  font-size: 0.85rem;
}

:deep(.search-highlight) {
  background-color: transparent !important;
  color: rgb(0, 153, 255) !important;
  font-weight: bold;
  padding: 0;
}

/* Search History Styling */
.search-history-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.8rem;
  cursor: pointer;
  transition: background-color 0.2s;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: #555;
  min-width: 0;
}

.search-history-item:hover {
  background-color: #f5f5f5;
}

.search-history-item .history-text {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-history-item .delete-history-btn {
  color: #ccc;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 0.75rem;
  transition: color 0.2s, background-color 0.2s;
  border-radius: 4px;
  flex-shrink: 0;
}

.search-history-item .delete-history-btn:hover {
  color: #ff4d4f;
  background-color: rgba(255, 77, 79, 0.08);
}
</style>
