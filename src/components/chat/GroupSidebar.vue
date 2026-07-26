<template>
  <div class="group-right-sidebar">
    <!-- 上栏：群公告 (QQ 风格) -->
    <div class="sidebar-section notice-section">
      <div class="section-header" @click="showNoticeModal = true">
        <span class="header-title">群公告</span>
        <span class="header-arrow">›</span>
      </div>
      <div class="notice-card" @click="showNoticeModal = true">
        <div v-if="group.notice && group.notice.trim()" class="notice-content">
          {{ group.notice }}
        </div>
        <div v-else class="notice-empty">
          <span class="empty-icon">📢</span> 暂无群公告，点击编辑...
        </div>
      </div>
    </div>

    <!-- 下栏：群聊成员 (QQ 风格) -->
    <div class="sidebar-section members-section">
      <div class="section-header">
        <span class="header-title">群聊成员 {{ displayMembers.length }}</span>
        <div class="header-actions">
          <span
            class="action-icon"
            :class="{ active: showSearch }"
            title="搜索成员"
            @click="showSearch = !showSearch"
          >
            🔍
          </span>
        </div>
      </div>

      <!-- 搜索栏 -->
      <div v-if="showSearch" class="member-search-box">
        <el-input
          v-model="searchKey"
          placeholder="搜索群成员..."
          size="small"
          clearable
        />
      </div>

      <!-- 成员列表 (可滚动) -->
      <div class="members-scroll-list">
        <div
          v-for="m in filteredMembers"
          :key="m.id"
          class="member-item"
          :class="{ clickable: !m.isUser }"
          @click="openMemberSettings(m)"
        >
          <div class="avatar-box">
            <GroupAvatar v-if="m.isUser" :members="[]" size="24" />
            <img v-else :src="m.avatar" class="member-img" />
          </div>

          <span class="member-name">{{ m.name }}</span>

          <span
            class="role-tag"
            :class="m.isUser ? 'owner' : 'admin'"
          >
            {{ m.isUser ? '群主' : (m.title || 'Agent') }}
          </span>
        </div>
      </div>
    </div>

    <!-- 弹窗：编辑群公告 -->
    <el-dialog
      v-model="showNoticeModal"
      title="群公告管理"
      width="440px"
      append-to-body
    >
      <div class="notice-dialog-body">
        <div class="dialog-tip">修改后的群公告将自动同步注入至各 Agent 的讨论上下文中</div>
        <el-input
          v-model="noticeForm"
          type="textarea"
          :rows="6"
          placeholder="输入群公告内容、本群准则或项目目标..."
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
  group: {
    type: Object,
    required: true,
  },
});

const contactorsStore = useContactorsStore();
const router = useRouter();
const showNoticeModal = ref(false);
const noticeForm = ref("");
const showSearch = ref(false);
const searchKey = ref("");

watch(
  () => props.group?.notice,
  (val) => {
    noticeForm.value = val || "";
  },
  { immediate: true }
);

function saveNotice() {
  if (!props.group?.id) return;
  contactorsStore.updateContactor(props.group.id, {
    notice: noticeForm.value,
  });
  showNoticeModal.value = false;
  ElMessage.success("群公告发布成功！");
}

function openMemberSettings(m) {
  if (m.isUser) return;
  router.push({
    name: "profile_view",
    params: { id: props.group.id },
    query: { memberId: m.id },
  });
}

// 包含用户自己 (群主) + Agent 成员
const userSelf = computed(() => ({
  id: "user_self",
  name: client.name || "我",
  avatar: client.avatar || "/static/icons/512x512.png",
  title: "群主",
  isUser: true,
}));

const displayMembers = computed(() => {
  const agents = props.group?.members || [];
  return [userSelf.value, ...agents];
});

const filteredMembers = computed(() => {
  if (!searchKey.value.trim()) return displayMembers.value;
  const kw = searchKey.value.trim().toLowerCase();
  return displayMembers.value.filter((m) =>
    m.name.toLowerCase().includes(kw)
  );
});
</script>

<style scoped lang="scss">
.group-right-sidebar {
  width: 200px;
  height: 100%;
  border-left: 1px solid var(--mio-border-color-light, #e5e6eb);
  background-color: var(--mio-bg-chat-window, #f2f2f2);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  flex-shrink: 0;

  @media (max-width: 768px) {
    display: none !important; // 移动端视口完全隐藏
  }
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  box-sizing: border-box;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    cursor: pointer;

    .header-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--mio-text-primary, var(--el-text-color-primary));
    }

    .header-arrow {
      font-size: 14px;
      color: var(--mio-text-secondary, var(--el-text-color-secondary));
    }

    .header-actions {
      .action-icon {
        font-size: 12px;
        cursor: pointer;
        padding: 1px 3px;
        border-radius: 4px;
        color: var(--mio-text-secondary);
        transition: background 0.15s;

        &:hover,
        &.active {
          background-color: var(--mio-bg-hover, rgba(0, 0, 0, 0.05));
        }
      }
    }
  }
}

/* 上栏：群公告 */
.notice-section {
  border-bottom: 1px solid var(--mio-border-color-light, #e5e6eb);
  height: 20rem;
  max-height: 40vh;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;

  .notice-card {
    flex: 1;
    background-color: transparent;
    border: none;
    padding: 4px 2px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--mio-text-secondary, #8a8a8a);
    cursor: pointer;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: none;
    transition: opacity 0.15s;

    &:hover {
      opacity: 0.85;
    }

    .notice-empty {
      color: var(--mio-text-placeholder, var(--el-text-color-placeholder));
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}

/* 下栏：群成员 */
.members-section {
  flex: 1;
  min-height: 0;

  .member-search-box {
    margin-bottom: 6px;
  }

  .members-scroll-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .member-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    border-radius: 4px;
    transition: background 0.15s;

    &:hover {
      background-color: var(--mio-bg-hover, rgba(0, 0, 0, 0.05));
    }

    .avatar-box {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    .member-img {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
    }

    .member-name {
      flex: 1;
      font-size: 11px;
      color: var(--mio-text-primary, var(--el-text-color-primary));
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .role-tag {
      font-size: 9px;
      padding: 0 4px;
      border-radius: 3px;
      flex-shrink: 0;
      transform: scale(0.92);
      transform-origin: right center;

      &.owner {
        background-color: #fff7e6;
        color: #ff7a00;
        border: 1px solid #ffe7ba;
      }

      &.admin {
        background-color: #e6f7ff;
        color: #1890ff;
        border: 1px solid #bae7ff;
      }
    }
  }
}

.notice-dialog-body {
  .dialog-tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 10px;
  }
}
</style>
