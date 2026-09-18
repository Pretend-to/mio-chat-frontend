<template>
  <div class="workspace-group-tab">
    <!-- Group Profile Header Banner -->
    <div v-if="group" class="group-banner">
      <div class="banner-main">
        <div class="group-avatar-wrap">
          <GroupAvatar :contactor="group" :size="44" />
        </div>
        <div class="group-info">
          <div class="group-name">{{ group.name }}</div>
          <div class="group-meta">
            <span class="meta-badge">{{ displayMembers.length }} 位成员</span>
            <span v-if="group.id" class="meta-id">ID: {{ group.id }}</span>
          </div>
        </div>
      </div>
      <button class="settings-btn" title="查看群聊详细设置" @click="openGroupSettings">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>群设置</span>
      </button>
    </div>

    <!-- Notice Section -->
    <div class="tab-section notice-section">
      <div class="section-title-row" @click="showNoticeModal = true">
        <div class="title-with-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span class="title-text">群公告</span>
        </div>
        <button class="action-link" @click.stop="showNoticeModal = true">
          编辑公告
        </button>
      </div>

      <div class="notice-card" @click="showNoticeModal = true">
        <div v-if="group?.notice && group.notice.trim()" class="notice-content">
          {{ group.notice }}
        </div>
        <div v-else class="notice-empty">
          <span class="empty-icon">📢</span>
          <span>暂无群公告，点击此处编辑并发布...</span>
        </div>
      </div>
    </div>

    <!-- Members Section -->
    <div class="tab-section members-section">
      <div class="section-title-row">
        <div class="title-with-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span class="title-text">群聊成员</span>
          <span class="count-pill">{{ displayMembers.length }}</span>
        </div>
        <div class="search-wrap">
          <input
            v-model="searchKey"
            type="text"
            placeholder="搜索成员..."
            class="member-search-input"
          />
        </div>
      </div>

      <div class="members-grid">
        <div
          v-for="m in filteredMembers"
          :key="m.id"
          class="member-card"
          :class="{ 'is-clickable': !m.isUser }"
          @click="openMemberSettings(m)"
        >
          <div class="member-avatar">
            <GroupAvatar v-if="m.isUser" :members="[]" :size="32" />
            <img v-else :src="m.avatar" :alt="m.name" />
          </div>
          <div class="member-details">
            <div class="member-name" :title="m.name">{{ m.name }}</div>
            <div class="member-role">
              <span class="role-tag" :class="m.isUser ? 'role-owner' : 'role-agent'">
                {{ m.isUser ? "群主" : m.title || "Agent" }}
              </span>
            </div>
          </div>
          <span v-if="!m.isUser" class="member-arrow">›</span>
        </div>
      </div>
    </div>

    <!-- Notice Edit Dialog -->
    <el-dialog
      v-model="showNoticeModal"
      title="群公告管理"
      width="460px"
      append-to-body
      destroy-on-close
    >
      <div class="notice-dialog-body">
        <div class="dialog-tip">
          群公告将作为群聊背景准则，并在讨论时同步注入到各 Agent 成员的上下文中。
        </div>
        <el-input
          v-model="noticeForm"
          type="textarea"
          :rows="7"
          placeholder="输入群公告、讨论目标或行为规范..."
        />
      </div>
      <template #footer>
        <el-button @click="showNoticeModal = false">取消</el-button>
        <el-button type="primary" @click="saveNotice">保存并发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { client } from "@/lib/runtime.js";
import GroupAvatar from "@/components/GroupAvatar.vue";
import { ElMessage } from "element-plus";

const props = defineProps({
  tab: {
    type: Object,
    default: () => ({}),
  },
});

const router = useRouter();
const contactorsStore = useContactorsStore();

const group = computed(() => {
  return (
    props.tab?.payload?.group ||
    (contactorsStore.activeContactor?.platform === "group"
      ? contactorsStore.activeContactor
      : null)
  );
});

const showNoticeModal = ref(false);
const noticeForm = ref("");
const searchKey = ref("");

watch(
  () => group.value?.notice,
  (val) => {
    noticeForm.value = val || "";
  },
  { immediate: true },
);

function saveNotice() {
  if (!group.value?.id) return;
  contactorsStore.updateContactor(group.value.id, {
    notice: noticeForm.value,
  });
  showNoticeModal.value = false;
  ElMessage.success("群公告发布成功！");
}

function openGroupSettings() {
  if (!group.value?.id) return;
  router.push({
    name: "profile_view",
    params: { id: group.value.id },
  });
}

function openMemberSettings(m) {
  if (m.isUser || !group.value?.id) return;
  router.push({
    name: "profile_view",
    params: { id: group.value.id },
    query: { memberId: m.id },
  });
}

const userSelf = computed(() => ({
  id: "user_self",
  name: client.name || "我",
  avatar: client.avatar || "/static/icons/512x512.png",
  title: "群主",
  isUser: true,
}));

const displayMembers = computed(() => {
  const agents = group.value?.members || [];
  return [userSelf.value, ...agents];
});

const filteredMembers = computed(() => {
  if (!searchKey.value.trim()) return displayMembers.value;
  const kw = searchKey.value.trim().toLowerCase();
  return displayMembers.value.filter((m) =>
    (m.name || "").toLowerCase().includes(kw),
  );
});
</script>

<style lang="scss" scoped>
.workspace-group-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 1.25rem;
  gap: 1.25rem;
  box-sizing: border-box;
  background-color: var(--mio-bg-page, #ffffff);
}

.group-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-radius: 0.75rem;
  background-color: var(--mio-bg-card, #ffffff);
  border: 1px solid var(--mio-border-color-light, #e4e7ed);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

  .banner-main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .group-avatar-wrap {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    max-width: 44px;
    max-height: 44px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .group-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--mio-text-primary, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .group-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.2rem;
    font-size: 0.72rem;
    color: var(--mio-text-secondary, #8a8a92);

    .meta-badge {
      background: rgba(139, 92, 246, 0.12);
      color: var(--mio-color-primary, #8b5cf6);
      padding: 0.1rem 0.35rem;
      border-radius: 0.25rem;
      font-weight: 500;
    }
  }

  .settings-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.65rem;
    border-radius: 0.4rem;
    border: 1px solid var(--mio-border-color-light, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--mio-text-primary, #fff);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;

    &:hover {
      background: var(--mio-bg-hover, rgba(255, 255, 255, 0.06));
      border-color: var(--mio-color-primary, #8b5cf6);
      color: var(--mio-color-primary, #8b5cf6);
    }
  }
}

.tab-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.25rem;

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--mio-text-primary, #fff);
    font-size: 0.82rem;
    font-weight: 600;

    svg {
      color: var(--mio-color-primary, #8b5cf6);
    }

    .count-pill {
      font-size: 0.68rem;
      background: var(--mio-bg-hover, rgba(255, 255, 255, 0.08));
      color: var(--mio-text-secondary, #999);
      padding: 0.08rem 0.35rem;
      border-radius: 0.5rem;
    }
  }

  .action-link {
    background: none;
    border: none;
    font-size: 0.75rem;
    color: var(--mio-color-primary, #8b5cf6);
    cursor: pointer;
    padding: 0.15rem 0.35rem;
    border-radius: 0.25rem;
    transition: opacity 0.15s;

    &:hover {
      opacity: 0.8;
      text-decoration: underline;
    }
  }
}

.notice-card {
  padding: 0.85rem 1rem;
  border-radius: 0.65rem;
  background-color: var(--mio-bg-card, #1c1c1f);
  border: 1px solid var(--mio-border-color-light, rgba(255, 255, 255, 0.08));
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: rgba(139, 92, 246, 0.4);
  }

  .notice-content {
    font-size: 0.8rem;
    line-height: 1.6;
    color: var(--mio-text-secondary, #b4b4bb);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .notice-empty {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.78rem;
    color: var(--mio-text-placeholder, #666);
  }
}

.members-section {
  flex: 1;
  min-height: 0;

  .search-wrap {
    .member-search-input {
      font-size: 0.75rem;
      padding: 0.25rem 0.6rem;
      border-radius: 0.35rem;
      border: 1px solid var(--mio-border-color-light, rgba(255, 255, 255, 0.12));
      background: var(--mio-bg-card, #1e1e24);
      color: var(--mio-text-primary, #fff);
      outline: none;
      width: 120px;
      transition: width 0.2s, border-color 0.2s;

      &:focus {
        width: 160px;
        border-color: var(--mio-color-primary, #8b5cf6);
      }
    }
  }

  .members-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.6rem;
    overflow-y: auto;
    padding-bottom: 1rem;
  }

  .member-card {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 0.75rem;
    border-radius: 0.55rem;
    background-color: var(--mio-bg-card, #1c1c1f);
    border: 1px solid var(--mio-border-color-light, rgba(255, 255, 255, 0.06));
    box-sizing: border-box;
    transition: all 0.15s ease;

    &.is-clickable {
      cursor: pointer;

      &:hover {
        background-color: var(--mio-bg-hover, rgba(255, 255, 255, 0.05));
        border-color: rgba(139, 92, 246, 0.35);
        transform: translateY(-1px);
      }
    }

    .member-avatar {
      width: 32px;
      height: 32px;
      min-width: 32px;
      min-height: 32px;
      max-width: 32px;
      max-height: 32px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        border-radius: 50%;
        object-fit: cover;
        display: block;
      }
    }

    .member-details {
      flex: 1;
      min-width: 0;
    }

    .member-name {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--mio-text-primary, #fff);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .member-role {
      margin-top: 0.15rem;

      .role-tag {
        display: inline-block;
        font-size: 0.65rem;
        line-height: 1;
        padding: 0.15rem 0.35rem;
        border-radius: 0.25rem;
        font-weight: 500;

        &.role-owner {
          background: rgba(245, 158, 11, 0.14);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        &.role-agent {
          background: rgba(139, 92, 246, 0.14);
          color: #8b5cf6;
          border: 1px solid rgba(139, 92, 246, 0.25);
        }
      }
    }

    .member-arrow {
      font-size: 1rem;
      color: var(--mio-text-secondary, #666);
      opacity: 0.6;
    }
  }
}

.notice-dialog-body {
  .dialog-tip {
    font-size: 0.8rem;
    color: var(--el-text-color-secondary);
    margin-bottom: 0.75rem;
    line-height: 1.4;
  }
}
</style>
