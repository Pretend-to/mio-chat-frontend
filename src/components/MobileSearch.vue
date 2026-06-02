<script setup>
import { ref, onMounted } from "vue";
import { useSearch } from "@/composables/useSearch.js";

const emit = defineEmits(["close"]);

const {
  searchQuery,
  searchHistory,
  loadSearchHistory,
  removeHistoryItem,
  selectHistoryItem,
  triggerSearchEnter,
  clearSearch,
  selectAndCloseSearch,
  jumpToMessage,
  searchResults,
  formatTime,
  highlight,
} = useSearch();

const inputRef = ref(null);

onMounted(() => {
  loadSearchHistory();
  // Auto focus input on mount
  setTimeout(() => {
    inputRef.value?.focus();
  }, 100);
});

const handleCancel = () => {
  clearSearch();
  emit("close");
};

const handleSelectContact = (contactId) => {
  selectAndCloseSearch(contactId);
  emit("close");
};

const handleJumpMessage = (contactId, messageId) => {
  jumpToMessage(contactId, messageId);
  emit("close");
};
</script>

<template>
  <div class="mobile-search-overlay">
    <!-- Header -->
    <div class="search-header">
      <div class="search-input-container">
        <i class="iconfont sousuo search-icon"></i>
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="search"
          placeholder="搜索"
          @keydown.esc="handleCancel"
          @keydown.enter="triggerSearchEnter"
        />
        <i v-if="searchQuery" class="clear-btn" @mousedown.prevent="clearSearch"></i>
      </div>
      <span class="cancel-btn" @click="handleCancel">取消</span>
    </div>

    <!-- Scrollable content area -->
    <div class="search-content">
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
            <span
              class="delete-history-btn"
              @mousedown.prevent.stop="removeHistoryItem(historyItem)"
              >✕</span
            >
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
            @mousedown.prevent="handleSelectContact(contact.id)"
          >
            <div
              class="avatar"
              :class="contact.avatarPolicy == 1 ? 'custom' : 'model'"
            >
              <img :src="contact.avatar" :alt="contact.name" />
            </div>
            <div class="info">
              <div
                class="name"
                v-html="highlight(contact.name, searchQuery)"
              ></div>
              <div class="title-text">{{ contact.title || "Bot" }}</div>
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
            @mousedown.prevent="handleJumpMessage(msgResult.contactorId, msgResult.message.id)"
          >
            <div class="avatar">
              <img
                :src="msgResult.contactorAvatar"
                :alt="msgResult.contactorName"
              />
            </div>
            <div class="info">
              <div class="search-msg-header">
                <span class="name">{{ msgResult.contactorName }}</span>
                <span class="time">{{ formatTime(msgResult.message.time) }}</span>
              </div>
              <div
                class="search-msg-preview"
                v-html="msgResult.highlightedText"
              ></div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="
            searchResults.contacts.length === 0 &&
            searchResults.messages.length === 0
          "
          class="search-empty"
        >
          <i class="iconfont sousuo empty-icon"></i>
          <div class="empty-text">未找到相关联系人或聊天记录</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.mobile-search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #ffffff;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* Header */
.search-header {
  height: 56px;
  min-height: 56px;
  background-color: #ffffff;
  padding: 0 1rem;
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
}

.search-input-container {
  flex-grow: 1;
  height: 36px;
  background-color: #f1f4fe;
  border-radius: 10px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 6px;
  position: relative;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.search-input-container input {
  flex-grow: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: #333;
  padding: 0;
  height: 100%;
  width: 100%;
}

.search-input-container input:focus {
  outline: none;
}

.search-icon {
  color: #999;
  font-size: 1rem;
  flex-shrink: 0;
}

.clear-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
}

.clear-btn::before,
.clear-btn::after {
  content: "";
  position: absolute;
  width: 8px;
  height: 1.5px;
  background-color: #ffffff;
}
.clear-btn::before {
  transform: rotate(45deg);
}
.clear-btn::after {
  transform: rotate(-45deg);
}

.cancel-btn {
  font-size: 0.95rem;
  color: #0099ff;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  user-select: none;
  font-weight: 500;
}

/* Content Area */
.search-content {
  flex-grow: 1;
  overflow-y: auto;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
}

.search-group {
  margin-bottom: 1rem;
}

.search-group-title {
  font-size: 0.75rem;
  color: #8c8c8c;
  text-align: left;
  padding: 0.8rem 1rem 0.4rem 1rem;
  font-weight: 500;
  background-color: #ffffff;
}

.search-item {
  display: flex;
  padding: 0.75rem 1rem;
  align-items: center;
  cursor: pointer;
  gap: 0.75rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  box-sizing: border-box;
}

.search-item .avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.search-item .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.search-item .avatar.model img {
  scale: 0.9;
}

.search-item .info {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.search-item .name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-item .title-text {
  font-size: 0.8rem;
  color: #8e8e8e;
}

.search-msg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 4px;
}

.search-msg-header .name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-msg-header .time {
  font-size: 0.75rem;
  color: #999;
  flex-shrink: 0;
}

.search-msg-preview {
  font-size: 0.85rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

:deep(.search-highlight) {
  background-color: transparent !important;
  color: rgb(0, 153, 255) !important;
  font-weight: bold;
  padding: 0;
}

/* Search History */
.search-history-item {
  display: flex;
  align-items: center;
  padding: 0.8rem 1rem;
  cursor: pointer;
  gap: 0.6rem;
  font-size: 0.9rem;
  color: #444;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
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
  padding: 4px 8px;
  font-size: 0.8rem;
  border-radius: 4px;
  flex-shrink: 0;
}

.search-history-item .delete-history-btn:active {
  color: #ff4d4f;
  background-color: rgba(255, 77, 79, 0.08);
}

/* Empty State */
.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 4rem 2rem;
  color: #aaa;
  text-align: center;
}

.search-empty .empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: #ddd;
}

.search-empty .empty-text {
  font-size: 0.9rem;
}
</style>
