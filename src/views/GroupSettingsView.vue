<template>
  <div v-if="group" class="tab-pane">
    <!-- 分栏：移动端没有侧边栏，群公告只能从这里进 -->
    <div class="group-tabs">
      <div
        class="group-tab"
        :class="{ active: activeTab === 'settings' }"
        @click="activeTab = 'settings'"
      >
        群聊设置
      </div>
      <div
        class="group-tab"
        :class="{ active: activeTab === 'notice' }"
        @click="activeTab = 'notice'"
      >
        群公告
      </div>
    </div>

    <!-- ========== 群公告 ========== -->
    <template v-if="activeTab === 'notice'">
      <div class="group-title">群公告</div>
      <div class="settings-card notice-card">
        <div class="notice-tip">
          公告会自动同步注入到各 Agent 的讨论上下文中，可用于声明本群准则或当前目标。
        </div>
        <el-input
          v-model="noticeForm"
          type="textarea"
          :rows="8"
          placeholder="输入群公告内容、本群准则或项目目标..."
        />
        <div class="notice-actions">
          <el-button
            v-if="noticeForm"
            @click="noticeForm = group.notice || ''"
          >
            撤销修改
          </el-button>
          <el-button type="primary" :disabled="!noticeDirty" @click="saveNotice">
            保存并发布
          </el-button>
        </div>
      </div>
    </template>

    <!-- ========== 群聊设置 ========== -->
    <template v-else>
    <!-- 群聊基本配置 -->
    <div class="group-title">群聊基本配置</div>
    <div class="settings-card">
      <div class="setting-field">
        <div class="field-label">群名称</div>
        <div class="field-value">
          <el-input
            v-model="groupForm.name"
            placeholder="群聊名称"
            @change="saveGroupInfo"
          />
        </div>
      </div>

      <div class="setting-field">
        <div class="field-label">群介绍 / 全局规则</div>
        <div class="field-value">
          <el-input
            v-model="groupForm.intro"
            type="textarea"
            :rows="3"
            placeholder="描写群聊设定与规则，如：本群专注于全栈开发与方案评审..."
            @change="saveGroupInfo"
          />
        </div>
      </div>

      <div class="setting-field">
        <div class="field-label">头像绘制策略</div>
        <div class="field-value">
          <el-select
            v-model="groupForm.avatarPolicy"
            style="width: 100%"
            @change="handleAvatarPolicyChange"
          >
            <el-option label="拼图头像 (动态多宫格)" value="composite" />
            <el-option label="自定义网络 URL" value="url" />
          </el-select>
        </div>
      </div>

      <div v-if="groupForm.avatarPolicy === 'url' || groupForm.avatarPolicy === 'custom'" class="setting-field">
        <div class="field-label">头像 URL</div>
        <div class="field-value">
          <el-input
            v-model="groupForm.avatar"
            placeholder="https://example.com/avatar.png"
            @change="saveGroupInfo"
          />
        </div>
      </div>

      <div class="setting-field">
        <div class="field-label">会话置顶</div>
        <div class="field-value">
          <el-switch
            v-model="groupForm.priority"
            @change="saveGroupInfo"
          />
        </div>
      </div>

      <div class="setting-field">
        <div class="field-label">
          默认发言人
          <el-tooltip
            placement="top"
            popper-class="mio-hint-popper"
            content="用户未 @ 任何人时：优先由上一轮发言的成员接话；上一轮无人发言或多人同时发言时，交给这里指定的成员（不归它管时它会自行 @ 转交）"
          >
            <el-icon class="label-hint-icon"><InfoFilled /></el-icon>
          </el-tooltip>
        </div>
        <div class="field-value">
          <el-select
            v-model="groupForm.defaultResponderId"
            placeholder="成员列表首位"
            clearable
            style="width: 180px;"
            @change="saveGroupInfo"
          >
            <el-option
              v-for="m in (group?.members || [])"
              :key="m.id"
              :label="m.name"
              :value="m.id"
            />
          </el-select>
        </div>
      </div>

      <div class="setting-field">
        <div class="field-label">
          上下文 ToolCall 传递
          <el-tooltip
            placement="top"
            popper-class="mio-hint-popper"
            content="构造群聊讨论上下文时，其他 Agent 的 toolcall 以何种形式呈现给当前发言成员。完整：含工具名、参数与结果；简略：仅工具名，参数与结果不可见。"
          >
            <el-icon class="label-hint-icon"><InfoFilled /></el-icon>
          </el-tooltip>
        </div>
        <div class="field-value">
          <el-switch
            :model-value="groupForm.toolCallContextMode === 'brief'"
            @update:model-value="handleToolCallModeSwitch"
            inline-prompt
            active-text="简略"
            inactive-text="完整"
          />
        </div>
      </div>

      <div class="setting-field">
        <div class="field-label">
          Agent 连锁唤起最大深度
          <el-tooltip
            placement="top"
            popper-class="mio-hint-popper"
            content="本群内部 Agent 互相 @ 讨论的最大连续轮数。每条唤起支线独立计数，到顶后会插入系统提示。默认 5 轮，设为 0 则禁用连锁唤起。"
          >
            <el-icon class="label-hint-icon"><InfoFilled /></el-icon>
          </el-tooltip>
        </div>
        <div class="field-value">
          <el-input-number
            v-model="groupForm.maxInvocationDepth"
            :min="0"
            :max="20"
            :step="1"
            controls-position="right"
            style="width: 120px;"
            @change="saveGroupInfo"
          />
        </div>
      </div>
    </div>

    <!-- 群成员管理 -->
    <div class="group-title-header">
      <div class="group-title">群成员管理 ({{ displayMembers.length }})</div>
      <el-button size="small" type="primary" plain @click="showAddMemberModal = true">
        + 添加群成员
      </el-button>
    </div>
    <div class="settings-card">
      <div class="group-members-grid">
        <div v-for="m in displayMembers" :key="m.id" class="group-member-card">
          <img :src="m.avatar" class="member-avatar" />
          <div class="member-info">
            <div class="member-name">{{ m.name }}</div>
            <div class="member-title">{{ m.title || 'Agent 成员' }}</div>
          </div>
          <el-tag v-if="m.isUser" size="small" type="success" effect="plain">我</el-tag>
          <template v-else>
            <el-button
              size="small"
              type="primary"
              link
              @click="openMemberProfile(m.id)"
            >
              设置
            </el-button>
            <el-button
              size="small"
              type="danger"
              link
              @click="removeMember(m.id)"
            >
              移除
            </el-button>
          </template>
        </div>
      </div>
    </div>
    </template>

    <!-- 弹窗：添加成员 -->
    <el-dialog
      v-model="showAddMemberModal"
      title="添加群成员"
      width="420px"
      append-to-body
    >
      <div class="add-member-dialog-body">
        <el-tabs v-model="candidateTab">
          <el-tab-pane label="最近聊天" name="recent" />
          <el-tab-pane label="本地预设" name="presets" />
        </el-tabs>
        <el-scrollbar height="240px">
          <div
            v-for="item in candidateMembers"
            :key="item.id"
            class="candidate-item"
            @click="addCandidateToGroup(item)"
          >
            <img :src="item.avatar" class="candidate-avatar" />
            <div class="candidate-info">
              <div class="candidate-name">{{ item.name }}</div>
              <div class="candidate-desc">{{ item.title || 'Agent' }}</div>
            </div>
            <el-button size="small" type="primary" plain>加入</el-button>
          </div>
        </el-scrollbar>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useContactorsStore, getAvatarByModel } from "@/stores/contactorsStore.js";
import { getLocalPresets } from "@/lib/clientSettings.js";
import { client } from "@/lib/runtime.js";
import { ElMessage, ElMessageBox } from "element-plus";
import { InfoFilled } from "@element-plus/icons-vue";

const props = defineProps({
  contactorId: {
    type: String,
    required: true,
  },
});

const contactorStore = useContactorsStore();
const router = useRouter();
const group = computed(() => contactorStore.contactors[props.contactorId]);

// 群公告：桌面端在侧边栏弹窗里，移动端没有侧边栏，这里是唯一入口
const activeTab = ref("settings");
const noticeForm = ref(group.value?.notice || "");

const noticeDirty = computed(
  () => noticeForm.value !== (group.value?.notice || ""),
);

watch(
  () => group.value?.notice,
  (val) => {
    // 外部（桌面端侧边栏）改了公告时同步过来，但不要覆盖用户正在编辑的内容
    if (!noticeDirty.value) noticeForm.value = val || "";
  },
);

function saveNotice() {
  if (!group.value?.id) return;
  contactorStore.updateContactor(group.value.id, { notice: noticeForm.value });
  ElMessage.success("群公告已更新");
}

function openMemberProfile(memberId) {
  if (!group.value?.id) return;
  router.push({
    name: "profile_view",
    params: { id: group.value.id },
    query: { memberId },
  });
}

const userSelf = computed(() => ({
  id: "user_self",
  name: client.name || "我",
  avatar: client.avatar || "/static/icons/512x512.png",
  title: "群主 (我)",
  isUser: true,
}));

const displayMembers = computed(() => {
  const agentMembers = group.value?.members || [];
  return [userSelf.value, ...agentMembers];
});

const groupForm = reactive({
  name: "",
  intro: "",
  avatarPolicy: "composite",
  avatar: "",
  priority: false,
  maxInvocationDepth: 5,
  defaultResponderId: "",
  toolCallContextMode: "brief",
});

watch(
  group,
  (val) => {
    if (val) {
      groupForm.name = val.name || "";
      groupForm.intro = val.intro || "";
      groupForm.avatarPolicy = val.avatarPolicy || "composite";
      groupForm.avatar = val.avatar || "";
      // priority 数字语义 0=置顶 1=普通（兼容历史遗留的布尔值）。
      // 不能写 !!val.priority：!!0 = false 会把「置顶」读成「关」，导致
      // 保存后 watch(deep) 把开关弹回、连续保存时置顶状态反复反转。
      groupForm.priority = val.priority === 0 || val.priority === true;
      groupForm.maxInvocationDepth =
        val.maxInvocationDepth !== undefined ? Number(val.maxInvocationDepth) : 5;
      groupForm.defaultResponderId = val.defaultResponderId || "";
      groupForm.toolCallContextMode = val.toolCallContextMode || "brief";
    }
  },
  { immediate: true, deep: true }
);

function saveGroupInfo() {
  if (!props.contactorId) return;
  contactorStore.updateContactor(props.contactorId, {
    name: groupForm.name,
    intro: groupForm.intro,
    avatarPolicy: groupForm.avatarPolicy,
    avatar: groupForm.avatar,
    // el-switch 是布尔值，落库统一转成数字语义：true → 0 置顶，false → 1 普通
    priority: groupForm.priority ? 0 : 1,
    maxInvocationDepth: groupForm.maxInvocationDepth,
    defaultResponderId: groupForm.defaultResponderId || "",
    toolCallContextMode: groupForm.toolCallContextMode || "brief",
  });
  ElMessage.success("群聊基本配置已更新");
}

function handleAvatarPolicyChange(val) {
  saveGroupInfo();
}

function handleToolCallModeSwitch(val) {
  groupForm.toolCallContextMode = val ? "brief" : "full";
  saveGroupInfo();
}

// 成员管理
const showAddMemberModal = ref(false);
const candidateTab = ref("recent");
const localPresetsList = ref([]);

async function fetchPresets() {
  try {
    const res = await getLocalPresets();
    localPresetsList.value = Array.isArray(res) ? res : [];
  } catch (e) {
    localPresetsList.value = [];
  }
}

watch(candidateTab, (val) => {
  if (val === "presets") {
    fetchPresets();
  }
});

onMounted(() => {
  fetchPresets();
});

const candidateMembers = computed(() => {
  const existingIds = new Set((group.value?.members || []).map((m) => m.agentId || m.id));

  if (candidateTab.value === "recent") {
    return Object.values(contactorStore.contactors)
      .filter((c) => c.id !== props.contactorId && c.platform !== "group" && !existingIds.has(c.id))
      // 按最近活跃时间倒序，与好友列表 sortedContactors 的口径一致
      .sort((a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0))
      .map((c) => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        title: c.title || c.platform,
        namePolicy: c.namePolicy !== undefined ? c.namePolicy : 0,
        avatarPolicy: c.avatarPolicy !== undefined ? c.avatarPolicy : 0,
        options: c.options,
      }));
  } else {
    const presets = Array.isArray(localPresetsList.value) ? localPresetsList.value : [];
    return presets
      .filter((p) => !existingIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar || getAvatarByModel(p.model),
        title: p.title || p.model || "预设",
        namePolicy: p.namePolicy !== undefined ? p.namePolicy : 0,
        avatarPolicy: p.avatarPolicy !== undefined ? p.avatarPolicy : 0,
        options: p,
      }));
  }
});

function addCandidateToGroup(item) {
  if (!group.value) return;
  const newMember = {
    id: item.id,
    agentId: item.id,
    name: item.name,
    avatar: item.avatar || "/static/icons/512x512.png",
    title: item.title || "Agent 成员",
    namePolicy: item.namePolicy !== undefined ? item.namePolicy : 0,
    avatarPolicy: item.avatarPolicy !== undefined ? item.avatarPolicy : 0,
    options: item.options ? JSON.parse(JSON.stringify(item.options)) : {},
  };
  const members = [...(group.value.members || []), newMember];
  contactorStore.updateContactor(props.contactorId, { members });
  ElMessage.success(`已添加 ${item.name} 到群聊`);
}

function removeMember(memberId) {
  if (!group.value) return;
  if ((group.value.members || []).length <= 1) {
    ElMessage.warning("群聊至少需保留 1 位 Agent 成员");
    return;
  }
  const members = (group.value.members || []).filter((m) => m.id !== memberId && m.agentId !== memberId);
  contactorStore.updateContactor(props.contactorId, { members });
  ElMessage.success("已移除该成员");
}
</script>

<style scoped lang="scss">
.group-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 16px;
  border-radius: 10px;
  background: var(--mio-bg-page);

  .group-tab {
    flex: 1;
    padding: 8px 16px;
    text-align: center;
    font-size: 14px;
    font-weight: 500;
    color: var(--mio-text-secondary);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &.active {
      background: var(--mio-bg-card);
      color: var(--mio-text-primary);
      box-shadow: var(--mio-shadow-light);
    }
  }
}

.notice-card {
  padding: 16px 24px 20px;

  .notice-tip {
    font-size: 12px;
    line-height: 1.6;
    color: var(--mio-text-secondary);
    margin-bottom: 12px;
  }

  .notice-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
}

@media (max-width: 768px) {
  .group-tabs {
    margin: 0 12px 12px;
  }

  .notice-card {
    padding: 12px 16px 16px;
  }
}

.group-title-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  margin-bottom: 10px;

  .group-title {
    margin: 0;
  }
}

/* 移动端 .group-title 被全局样式设为 display:none，此时 space-between 下
   只剩按钮一个子元素，会贴到容器最左边（x=0），而 .settings-card 有
   12px 外边距 —— 按钮因此比卡片还靠外。补上与卡片对齐的横向内边距，
   并右对齐（标题已隐藏，操作按钮靠右更符合惯例）。 */
@media (max-width: 768px) {
  .group-title-header {
    justify-content: flex-end;
    padding: 0 12px;
    margin-top: 12px;
  }
}

.group-members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;

  .group-member-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);

    .member-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
    }

    .member-info {
      flex: 1;
      min-width: 0;

      .member-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--el-text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .member-title {
        font-size: 11px;
        color: var(--el-text-color-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.candidate-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  .candidate-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .candidate-info {
    flex: 1;
    min-width: 0;

    .candidate-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--el-text-color-primary);
    }

    .candidate-desc {
      font-size: 11px;
      color: var(--el-text-color-placeholder);
    }
  }
}
</style>
