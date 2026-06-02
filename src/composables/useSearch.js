import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { client } from "@/lib/runtime.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import Fuse from "fuse.js";

export function useSearch() {
  const route = useRoute();
  const router = useRouter();
  const contactorsStore = useContactorsStore();

  // Search States
  const searchQuery = ref("");
  const isSearchFocused = ref(false);
  const searchHistory = ref([]);

  const loadSearchHistory = () => {
    try {
      const stored = localStorage.getItem("mio_chat_search_history");
      searchHistory.value = stored ? JSON.parse(stored) : [];
    } catch {
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
    localStorage.setItem(
      "mio_chat_search_history",
      JSON.stringify(searchHistory.value),
    );
  };

  const removeHistoryItem = (item) => {
    searchHistory.value = searchHistory.value.filter((h) => h !== item);
    localStorage.setItem(
      "mio_chat_search_history",
      JSON.stringify(searchHistory.value),
    );
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

  const handleSearchBlur = () => {
    setTimeout(() => {
      isSearchFocused.value = false;
    }, 200);
  };

  const clearSearch = () => {
    searchQuery.value = "";
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

  const blurSearchInput = () => {
    const inputEl = document.getElementById("main-search");
    if (inputEl) {
      inputEl.blur();
    }
  };

  const selectAndCloseSearch = (contactId) => {
    const q = searchQuery.value.trim();
    if (q) saveSearchHistory(q);
    isSearchFocused.value = false;
    showChat(contactId);
    clearSearch();
    blurSearchInput();
  };

  const jumpToMessage = (contactId, messageId) => {
    const q = searchQuery.value.trim();
    if (q) saveSearchHistory(q);
    isSearchFocused.value = false;
    if (
      route.name === "chat_view" &&
      String(contactId) === String(contactorsStore.activeContactorId)
    ) {
      client.emit("scroll_to_message", messageId);
    } else {
      router.push({
        name: "chat_view",
        params: { id: contactId },
        query: { scrollTo: messageId, t: Date.now() },
      });
    }
    clearSearch();
    blurSearchInput();
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

  const extractTextFromContent = (content, msgId = null, role = null) => {
    if (!content) return "";
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map((item) => extractTextFromContent(item, msgId, role)).join(" ");
    }
    if (typeof content === "object") {
      let result = "";
      if (content.type === "file") {
        result = content.data?.name || "";
      } else if (content.data) {
        if (typeof content.data === "string") result = content.data;
        else if (typeof content.data.text === "string") result = content.data.text;
      } else if (typeof content.text === "string") {
        result = content.text;
      } else if (typeof content.content === "string") {
        result = content.content;
      }

      return result;
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
    const contactMatches = contactFuse.search(query)
      .map((res) => res.item)
      // 确保完整关键词存在于结果中，避免模糊匹配将中文逐字拆分命中（如搜索"测试"不会匹配仅含"测"或"试"的结果）
      .filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
      // 最新联系排在前面（根据最后一条消息时间或创建时间）
      .sort((a, b) => {
        const aTime = a.messageChain?.length ? a.messageChain[a.messageChain.length - 1].time : a.createTime;
        const bTime = b.messageChain?.length ? b.messageChain[b.messageChain.length - 1].time : b.createTime;
        return (bTime || 0) - (aTime || 0);
      });

    // 2. Search Messages
    const allMessages = [];
    contactList.forEach((c) => {
      c.messageChain.forEach((msg) => {
        const textContent = extractTextFromContent(msg.content, msg.id, msg.role);
        if (textContent.trim()) {
          allMessages.push({
            contactorId: c.id,
            contactorName: c.name,
            contactorAvatar: c.avatar,
            message: msg,
            textContent: textContent.trim(),
            msgTime: msg.time,
          });
        }
      });
    });

    const messageFuse = new Fuse(allMessages, {
      keys: ["textContent"],
      threshold: 0.6,
      ignoreLocation: true,
      includeMatches: true,
    });

    const messageMatches = messageFuse.search(query)
      // 先过滤：确保完整关键词完整存在于文本中，避免中文逐字拆分命中
      .filter(res => res.item.textContent.toLowerCase().includes(query.toLowerCase()))
      .map((res) => {
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
      let start = 0;
      if (matchStart !== -1 && matchEnd !== -1) {
        if (matchStart > 5) {
          start = matchStart - 2;
        } else {
          start = 0;
        }
      }

      // Suffix limit to 100 characters
      let end = text.length;
      if (matchStart !== -1) {
        end = Math.min(text.length, matchStart + 100);
      }

      const croppedText = text.substring(start, end);
      let highlightedText = croppedText;

      if (matches && matches.indices && matches.indices.length > 0) {
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
    })
    // 最新消息排在前面
    .sort((a, b) => (b.msgTime || 0) - (a.msgTime || 0));

    return {
      contacts: contactMatches,
      messages: messageMatches,
    };
  });

  return {
    searchQuery,
    isSearchFocused,
    searchHistory,
    loadSearchHistory,
    saveSearchHistory,
    removeHistoryItem,
    selectHistoryItem,
    triggerSearchEnter,
    handleSearchBlur,
    clearSearch,
    selectAndCloseSearch,
    jumpToMessage,
    searchResults,
    formatTime,
    highlight,
  };
}
