<template>
  <div class="tab-pane skills-tab-pane">
    <div class="group-title" v-if="!isMobile" style="display: flex; align-items: center; justify-content: space-between;">
      <span>Agent Skills 技能库</span>
      <el-button type="primary" size="small" :loading="reloadingSkills" @click="handleReloadSkills" style="font-weight: 500;">
        同步技能库
      </el-button>
    </div>
    <!-- 移动端额外提供刷新按钮 -->
    <div v-else style="padding: 10px 12px 0; display: flex; justify-content: flex-end;">
      <el-button type="primary" size="small" :loading="reloadingSkills" @click="handleReloadSkills" style="font-weight: 500;">
        同步技能库
      </el-button>
    </div>
    <div class="skills-scroll-container" style="margin-top: 12px;">
      <div class="skills-grid" :class="{ 'mobile-skills': isMobile }">
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
            <el-tooltip
              :content="skill.name"
              placement="top"
              :show-after="800"
            >
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
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { skillAPI } from "@/lib/configApi.js";
import { client } from "@/lib/runtime.js";
import { ElMessage } from "element-plus";

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
});

const availableSkills = ref([]);
const reloadingSkills = ref(false);

const fetchSkills = async () => {
  try {
    const res = await skillAPI.getSkills();
    if (res.success) {
      availableSkills.value = res.data;
    }
  } catch (err) {
    console.error("获取技能列表失败:", err);
  }
};

const handleReloadSkills = async () => {
  reloadingSkills.value = true;
  try {
    const res = await skillAPI.reloadSkills();
    if (res.success) {
      availableSkills.value = res.data;
      ElMessage.success("技能库已同步");
    }
  } catch (err) {
    ElMessage.error("同步失败: " + err.message);
  } finally {
    reloadingSkills.value = false;
  }
};

const handlePluginsUpdated = () => {
  console.log("[ContactorSkillsTab] 检测到后端插件更新，正在刷新技能列表...");
  fetchSkills();
};

onMounted(() => {
  fetchSkills();
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
}

.skill-item {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
  border: 1px solid #f0f0f0;
  transition: all 0.2s;
}

.skill-item:hover {
  border-color: #409eff50;
  background: #f9fcff;
}

.skill-icon {
  width: 44px;
  height: 44px;
  background: #f0f4ff;
  color: #409eff;
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
  color: #999;
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
  color: #ccc;
  font-size: 13px;
}

@media (max-width: 768px) {
  .skills-scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
    -webkit-overflow-scrolling: touch;
    max-height: none !important;
  }

  .mobile-skills {
    padding: 0 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .mobile-skills .skill-item {
    background: #fff;
    margin-bottom: 0;
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
}
</style>

