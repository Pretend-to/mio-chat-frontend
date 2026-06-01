<template>
  <div class="settings-container">
    <!-- Header: Basic Info (QQ Style) -->
    <div class="profile-header">
      <div class="avatar-container">
        <div
          class="avatar"
          :style="{ backgroundImage: `url(${avatar || ''})` }"
        ></div>
      </div>
      <div class="profile-info">
        <h1 class="profile-name">{{ name || "Mio Assistant" }}</h1>
        <div class="profile-id">ID {{ basicInfo.id || "114514" }}</div>
        <div class="status-text">
          <span :class="{ 'online-indicator': true, offline: !isConnected }"
            >●</span
          >
          {{ isConnected ? "在线" : "离线" }}
        </div>
      </div>
    </div>

    <!-- Top Tabs -->
    <div class="tabs-container" v-if="activeContactorPlatform !== 'onebot'">
      <div class="segmented-tabs">
        <div
          :class="{ 'tab-item': true, active: activeTab === 'basic' }"
          @click="activeTab = 'basic'"
        >
          基础配置
        </div>
        <div
          :class="{ 'tab-item': true, active: activeTab === 'tools' }"
          @click="activeTab = 'tools'"
        >
          工具调用
        </div>
        <div
          :class="{ 'tab-item': true, active: activeTab === 'skills' }"
          @click="activeTab = 'skills'"
        >
          技能库
        </div>
        <div
          :class="{ 'tab-item': true, active: activeTab === 'presets' }"
          @click="activeTab = 'presets'"
        >
          历史预设
        </div>
        <div
          :class="{ 'tab-item': true, active: activeTab === 'memory' }"
          @click="activeTab = 'memory'"
        >
          记忆结晶
        </div>
        <div
          :class="{ 'tab-item': true, active: activeTab === 'automation' }"
          @click="activeTab = 'automation'"
        >
          定时任务
        </div>
        <div
          :class="{ 'tab-item': true, active: activeTab === 'advanced' }"
          @click="activeTab = 'advanced'"
        >
          高级扩展
        </div>
      </div>
    </div>

    <!-- Settings Content Area -->
    <div class="settings-content">
      <!-- Tab: Basic -->
      <ContactorBasicTab
        v-if="activeTab === 'basic'"
        :model-value="modelValue"
        @update:model-value="(val) => $emit('update:modelValue', val)"
        :basic-info="basicInfo"
        @update:basic-info="(val) => $emit('update:basicInfo', val)"
        :active-contactor-platform="activeContactorPlatform"
        :llm-providers-list="llmProvidersList"
        :avatar-policy-list="avatarPolicyListForShow"
        :name-policy-list="namePolicyListForShow"
        :adapter-metadata="adapterMetadata"
        @provider-changed="(p) => $emit('provider-changed', p)"
      />

      <!-- Tab: Tools -->
      <ContactorToolsTab
        v-if="activeTab === 'tools'"
        :model-value="modelValue"
        @update:model-value="(val) => $emit('update:modelValue', val)"
        :tool-call-modes-list="toolCallModesList"
        :all-llm-tools-data="allLlmToolsData"
      />

      <!-- Tab: Skills -->
      <ContactorSkillsTab v-if="activeTab === 'skills'" :is-mobile="isMobile" />

      <!-- Tab: Presets -->
      <div v-if="activeTab === 'presets'" class="tab-pane">
        <div class="group-title">历史预设</div>
        <div class="settings-card presets-card">
          <PresetsList
            :presets-history="presetsHistoryData"
            @update-presets="(presets) => $emit('update-presets', presets)"
          />
        </div>
      </div>

      <!-- Tab: Memory Crystallization -->
      <div v-if="activeTab === 'memory'" class="tab-pane">
        <MemoryManager v-if="contactorId" :contactor-id="contactorId" />
        <div v-else class="no-skills" style="padding: 20px; text-align: center">
          <p>无法获取联系人信息</p>
        </div>
      </div>

      <!-- Tab: Automation (定时任务) -->
      <ContactorAutomationTab
        v-if="activeTab === 'automation'"
        :name="name"
        :contactor-id="contactorId"
        :is-mobile="isMobile"
      />

      <!-- Tab: Advanced -->
      <ContactorAdvancedTab
        v-if="activeTab === 'advanced'"
        :model-value="modelValue"
        @update:model-value="(val) => $emit('update:modelValue', val)"
        :adapter-metadata="adapterMetadata"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import PresetsList from "@/components/PresetsList.vue";
import MemoryManager from "@/components/MemoryManager.vue";
import ContactorBasicTab from "./profile/ContactorBasicTab.vue";
import ContactorToolsTab from "./profile/ContactorToolsTab.vue";
import ContactorSkillsTab from "./profile/ContactorSkillsTab.vue";
import ContactorAutomationTab from "./profile/ContactorAutomationTab.vue";
import ContactorAdvancedTab from "./profile/ContactorAdvancedTab.vue";
import { configAPI } from "@/lib/configApi.js";

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  activeContactorPlatform: {
    type: String,
    required: true,
  },
  llmProvidersList: {
    type: Array,
    required: true,
  },
  toolCallModesList: {
    type: Array,
    required: true,
  },
  allLlmToolsData: {
    type: Array,
    required: true,
  },
  safetySettingsParams: {
    type: Object,
    required: true,
  },
  safetySimpleValueOptions: {
    type: Array,
    required: true,
  },
  presetsHistoryData: {
    type: Array,
    default: () => [],
  },
  contactorId: {
    type: String,
    default: null,
  },
  name: {
    type: String,
    default: "",
  },
  avatar: {
    type: String,
    default: "",
  },
  isConnected: {
    type: Boolean,
    default: false,
  },
  basicInfo: {
    type: Object,
    default: () => ({}),
  },
  avatarPolicyList: {
    type: Array,
    default: () => [],
  },
  namePolicyList: {
    type: Array,
    default: () => [],
  },
});

defineEmits([
  "update:modelValue",
  "update:basicInfo",
  "provider-changed",
  "update-presets",
]);

const activeTab = ref("basic");
const adapterMetadata = ref([]);
const isMobile = ref(false);

const updateMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

const avatarPolicyListForShow = computed(() => {
  if (props.activeContactorPlatform === "onebot") {
    return [
      { value: 0, label: "跟随QQ头像" },
      { value: 1, label: "自定义" },
    ];
  }
  return props.avatarPolicyList;
});

const namePolicyListForShow = computed(() => {
  if (props.activeContactorPlatform === "onebot") {
    return [
      { value: 0, label: "跟随QQ昵称" },
      { value: 1, label: "自定义" },
    ];
  }
  return props.namePolicyList;
});

const fetchAdapterMetadata = async () => {
  try {
    const res = await configAPI.getAdapterTypes();
    if (res.code === 0 && res.data?.adapters) {
      adapterMetadata.value = res.data.adapters;
      console.log(
        "[Debug] 适配器元数据加载成功，共",
        adapterMetadata.value.length,
        "个",
      );
    }
  } catch (err) {
    console.error("获取适配器元数据失败:", err);
  }
};

onMounted(() => {
  if (props.activeContactorPlatform === "onebot") {
    activeTab.value = "basic";
  }
  updateMobile();
  window.addEventListener("resize", updateMobile);
  fetchAdapterMetadata();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateMobile);
});
</script>

<style scoped>
/* Profile Header */
.profile-header {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  background: #fff;
  border-radius: 16px;
  margin-bottom: 24px;
}

.avatar-container {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  background-color: #f0f0f0;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.profile-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding-top: 4px;
}

.profile-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-id {
  font-size: 13px;
  color: #999;
  margin: 4px 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-text {
  color: #000;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.online-indicator {
  color: #2ecc71;
  font-size: 12px;
}

.online-indicator.offline {
  color: #ccc;
}

/* Tabs */
.tabs-container {
  display: flex;
  justify-content: center;
  padding: 0 20px;
  margin-bottom: 20px;
  overflow-x: auto;
  scrollbar-width: none;
  /* Firefox */
}

.tabs-container::-webkit-scrollbar {
  display: none;
  /* Chrome/Safari */
}

.segmented-tabs {
  display: flex;
  background: #f0f2f5;
  padding: 3px;
  border-radius: 10px;
  width: fit-content;
  white-space: nowrap;
  margin: 0 auto;
}

.tab-item {
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.tab-item.active {
  background: #fff;
  color: #000;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

/* Content Area */
.settings-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 4rem;
}

.divider {
  height: 1px;
  background: #f0f0f0;
  margin: 24px 0;
  width: 100%;
}

/* Mobile Adaptation */
@media (max-width: 768px) {
  .settings-container {
    background: white;
    flex: 1;
    overflow: hidden;
  }

  .profile-header {
    background: #fff;
    margin-bottom: 12px;
    padding: 24px 16px;
    border-radius: 16px;
  }

  .tabs-container {
    margin-bottom: 12px;
    padding: 0 16px;
    justify-content: flex-start;
    -webkit-overflow-scrolling: touch;
  }

  .segmented-tabs {
    margin: 0;
    padding: 4px;
    background: #f5f6f8;
  }

  .tab-item {
    padding: 8px 18px;
    font-size: 14px;
  }

  .settings-content {
    padding: 0;
    background: #ffffff;
    flex: 1;
    overflow: hidden;
    /* Constrain this so child can scroll */
    display: flex;
    flex-direction: column;
  }

  .tab-pane {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 0 4rem;
  }

  .avatar {
    width: 64px;
    height: 64px;
  }
}

.tab-pane {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 600;
}

.presets-card {
  padding: 16px 24px;
}

.no-skills {
  padding: 40px;
  text-align: center;
  color: #ccc;
  font-size: 13px;
}
</style>
