<script setup>
defineProps({
  searchQuery: {
    type: String,
    required: true,
  },
  searchResults: {
    type: Object,
    required: true,
  },
  searchHistory: {
    type: Array,
    required: true,
  },
});

defineEmits([
  "select-history",
  "remove-history",
  "select-contact",
  "jump-message",
]);

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
</script>

<template>
  <div class="search-floating-panel">
    <!-- Search History (Shown when searchQuery is empty) -->
    <template v-if="!searchQuery">
      <div v-if="searchHistory.length > 0" class="search-group">
        <div class="search-group-title">历史搜索</div>
        <div
          v-for="(historyItem, idx) in searchHistory"
          :key="idx"
          class="search-history-item"
          @mousedown.prevent="$emit('select-history', historyItem)"
        >
          <span class="mio-icon mio-icon-history"></span>
          <span class="history-text">{{ historyItem }}</span>
          <span
            class="delete-history-btn"
            @mousedown.prevent.stop="$emit('remove-history', historyItem)"
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
          @click="$emit('select-contact', contact.id)"
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
          @click="
            $emit('jump-message', msgResult.contactorId, msgResult.message.id)
          "
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
</template>

<style scoped>
/* Floating Search Results Panel */
.search-floating-panel {
  position: absolute;
  top: 4rem;
  left: 0.5rem;
  right: -2rem; /* Exceeds friendList by 2rem */
  background-color: #ffffff;
  border-radius: 10px;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.15),
    0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.08);
  max-height: calc(100vh - 6rem);
  overflow-y: auto;
  overflow-x: hidden !important;
  z-index: 1000;
  padding: 0.5rem 0;
  display: flex;
  flex-direction: column;
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
  transition:
    color 0.2s,
    background-color 0.2s;
  border-radius: 4px;
  flex-shrink: 0;
}

.search-history-item .delete-history-btn:hover {
  color: #ff4d4f;
  background-color: rgba(255, 77, 79, 0.08);
}
</style>
