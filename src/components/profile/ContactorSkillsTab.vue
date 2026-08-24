<template>
  <div class="tab-pane skills-tab-pane">
    <div
      class="group-title"
      v-if="!isMobile"
      style="display: flex; align-items: center; justify-content: space-between"
    >
      <span>Agent Skills 技能库</span>
      <el-button
        type="primary"
        size="small"
        :loading="reloadingSkills"
        @click="handleReloadSkills"
        style="font-weight: 500"
      >
        同步技能库
      </el-button>
    </div>
    <!-- 移动端额外提供刷新按钮 -->
    <div
      v-else
      style="padding: 10px 12px 0; display: flex; justify-content: flex-end"
    >
      <el-button
        type="primary"
        size="small"
        :loading="reloadingSkills"
        @click="handleReloadSkills"
        style="font-weight: 500"
      >
        同步技能库
      </el-button>
    </div>
    <div class="skills-scroll-container" style="margin-top: 12px">
      <!-- 骨架屏占位 -->
      <div v-if="loadingSkills && availableSkills.length === 0" class="skills-grid">
        <div v-for="i in 6" :key="i" class="skill-item skeleton-item">
          <el-skeleton animated style="display: flex; align-items: center; gap: 16px; width: 100%;">
            <template #template>
              <el-skeleton-item variant="circle" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px;" />
              <div style="flex: 1; min-width: 0;">
                <el-skeleton-item variant="h3" style="width: 45%; height: 16px; margin-bottom: 8px;" />
                <el-skeleton-item variant="text" style="width: 85%; height: 12px;" />
              </div>
            </template>
          </el-skeleton>
        </div>
      </div>

      <!-- 实际技能卡片列表 -->
      <div v-else class="skills-grid">
        <div v-if="availableSkills.length === 0" class="no-skills">
          <p>暂无可用技能，点击同步刷新</p>
        </div>
        <div
          v-for="skill in availableSkills"
          :key="skill.name"
          class="skill-item"
        >
          <div class="skill-icon">
            <i class="iconfont robot"></i>
          </div>
          <div class="skill-info">
            <el-tooltip :content="skill.name" placement="top" :show-after="800">
              <div class="skill-name">{{ skill.name }}</div>
            </el-tooltip>
            <div class="skill-description">{{ skill.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useConfigStore } from "@/stores/configStore.js";
import { client } from "@/lib/runtime.js";
import { ElMessage } from "element-plus";

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
});

const configStore = useConfigStore();
const availableSkills = computed(() => configStore.skills);
const reloadingSkills = ref(false);
const loadingSkills = ref(false);

const loadSkills = async (force = false) => {
  if (!configStore.skillsLoaded || force) {
    loadingSkills.value = true;
  }
  try {
    await configStore.fetchSkills(force);
  } finally {
    loadingSkills.value = false;
  }
};

const handleReloadSkills = async () => {
  reloadingSkills.value = true;
  try {
    await configStore.reloadSkills();
    ElMessage.success("技能库已同步");
  } catch (err) {
    ElMessage.error("同步失败: " + err.message);
  } finally {
    reloadingSkills.value = false;
  }
};

const handlePluginsUpdated = () => {
  console.log("[ContactorSkillsTab] 检测到后端插件更新，正在刷新技能列表...");
  loadSkills(true);
};

onMounted(() => {
  loadSkills();
  client.on("plugins_updated", handlePluginsUpdated);
});

onBeforeUnmount(() => {
  client.off("plugins_updated", handlePluginsUpdated);
});
</script>

<style scoped>
.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.skill-item {
  background: var(--mio-bg-card);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--mio-shadow-light);
  border: 1px solid var(--mio-border-color-lighter);
  transition: all 0.2s;
  min-width: 0;
}

.skill-item:hover {
  border-color: var(--mio-bg-active);
  background: var(--mio-bg-hover);
}

.skill-icon {
  width: 44px;
  height: 44px;
  background: var(--mio-bg-active);
  color: var(--mio-color-primary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.skills-scroll-container {
  max-height: 500px;
  overflow-y: auto;
  padding: 4px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

.skill-description {
  font-size: 12px;
  color: var(--mio-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.no-skills {
  grid-column: 1 / -1;
  padding: 40px;
  text-align: center;
  color: var(--mio-text-placeholder);
  font-size: 13px;
}

@media (max-width: 768px) {
  .skills-scroll-container {
    overflow: visible;
    max-height: none !important;
    width: 100%;
    padding: 0;
  }

  .skills-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 0 12px;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .skills-grid .skill-item {
    background: var(--mio-bg-card);
    margin-bottom: 0;
    border: none;
    box-shadow: var(--mio-shadow-light);
    min-width: 0;
  }
}
</style>
