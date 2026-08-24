<template>
  <div class="presets-container">
    <!-- 头部说明与快捷操作 -->
    <div class="presets-header">
      <div class="header-tip">
        <span>配置 Few-Shot 对话示范或前置消息，引导模型按照指定语调或上下文回复。</span>
      </div>
      <el-button
        v-if="presetMessages.length > 0"
        type="danger"
        link
        size="small"
        @click="clearAll"
      >
        清空全部
      </el-button>
    </div>

    <!-- 空状态 -->
    <div v-if="presetMessages.length === 0" class="presets-empty">
      <el-empty
        description="暂无预设历史消息"
        :image-size="70"
      >
        <template #description>
          <p style="font-size: 13px; color: var(--mio-text-secondary); margin-bottom: 8px;">
            暂无预设历史，可添加角色消息构建示范样本
          </p>
        </template>
      </el-empty>
    </div>

    <!-- 消息卡片流 -->
    <div v-else class="preset-messages-flow">
      <div
        v-for="(message, index) in presetMessages"
        :key="index"
        class="preset-card"
        :class="`role-${message.role}`"
      >
        <div class="card-header">
          <div class="role-selector-wrap">
            <el-select
              v-model="message.role"
              size="small"
              class="role-select"
              @change="notifyUpdate"
            >
              <el-option label="系统设定" value="system">
                <span class="role-opt system">⚙️ 系统设定</span>
              </el-option>
              <el-option label="用户示范" value="user">
                <span class="role-opt user">👤 用户示范</span>
              </el-option>
              <el-option label="助手回复" value="assistant">
                <span class="role-opt assistant">🤖 助手回复</span>
              </el-option>
            </el-select>
            <span class="index-badge">#{{ index + 1 }}</span>
          </div>

          <div class="card-actions">
            <el-button
              :disabled="index === 0"
              size="small"
              plain
              title="上移"
              class="action-btn"
              @click="moveMessage(index, -1)"
            >
              <el-icon><Top /></el-icon>
            </el-button>
            <el-button
              :disabled="index === presetMessages.length - 1"
              size="small"
              plain
              title="下移"
              class="action-btn"
              @click="moveMessage(index, 1)"
            >
              <el-icon><Bottom /></el-icon>
            </el-button>
            <el-button
              size="small"
              plain
              title="复制"
              class="action-btn"
              @click="duplicateMessage(index)"
            >
              <el-icon><CopyDocument /></el-icon>
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              title="删除"
              class="action-btn delete"
              @click="delPresetMessage(index)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>

        <div class="card-body">
          <el-input
            v-model="message.content"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 8 }"
            :placeholder="getPlaceholder(message.role)"
            @input="notifyUpdate"
          />
        </div>
      </div>
    </div>

    <!-- 底部添加栏 -->
    <div class="add-buttons-bar">
      <el-button
        size="small"
        plain
        class="add-btn user-btn"
        @click="addPresetMessage('user')"
      >
        <el-icon style="margin-right: 4px"><User /></el-icon> + 用户消息
      </el-button>
      <el-button
        size="small"
        plain
        class="add-btn assistant-btn"
        @click="addPresetMessage('assistant')"
      >
        <el-icon style="margin-right: 4px"><Service /></el-icon> + 助手回复
      </el-button>
      <el-button
        size="small"
        plain
        class="add-btn system-btn"
        @click="addPresetMessage('system')"
      >
        <el-icon style="margin-right: 4px"><Setting /></el-icon> + 系统设定
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import {
  Top,
  Bottom,
  CopyDocument,
  Delete,
  User,
  Service,
  Setting,
} from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";

const props = defineProps({
  presetsHistory: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update-presets", "updatePresets"]);

const presetMessages = ref(
  (props.presetsHistory || []).map((m) => ({ ...m })),
);

watch(
  () => props.presetsHistory,
  (newVal) => {
    presetMessages.value = (newVal || []).map((m) => ({ ...m }));
  },
  { deep: true },
);

const notifyUpdate = () => {
  const cloned = JSON.parse(JSON.stringify(presetMessages.value));
  emit("update-presets", cloned);
  emit("updatePresets", cloned);
};

const getPlaceholder = (role) => {
  if (role === "system") return "输入系统提示词或环境设定 (System)...";
  if (role === "user") return "输入用户示范问题或指令 (User)...";
  return "输入助手理想回复样本 (Assistant)...";
};

const addPresetMessage = (role) => {
  presetMessages.value.push({
    role,
    content: "",
  });
  notifyUpdate();
};

const delPresetMessage = (index) => {
  presetMessages.value.splice(index, 1);
  notifyUpdate();
};

const duplicateMessage = (index) => {
  const item = presetMessages.value[index];
  presetMessages.value.splice(index + 1, 0, {
    role: item.role,
    content: item.content,
  });
  notifyUpdate();
};

const moveMessage = (index, delta) => {
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= presetMessages.value.length) return;
  const [item] = presetMessages.value.splice(index, 1);
  presetMessages.value.splice(targetIndex, 0, item);
  notifyUpdate();
};

const clearAll = async () => {
  try {
    await ElMessageBox.confirm("确定清空所有历史预设消息吗？", "提示", {
      type: "warning",
      confirmButtonText: "确定",
      cancelButtonText: "取消",
    });
    presetMessages.value = [];
    notifyUpdate();
  } catch (e) {}
};
</script>

<style scoped>
.presets-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.presets-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-tip {
  font-size: 12px;
  color: var(--mio-text-secondary);
  line-height: 1.4;
}

.presets-empty {
  padding: 24px 0;
  border-radius: 8px;
  background: var(--mio-bg-page);
  border: 1px dashed var(--mio-border-color-lighter);
  margin-bottom: 16px;
}

.preset-messages-flow {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.preset-card {
  background: var(--mio-bg-card);
  border-radius: 10px;
  border: 1px solid var(--mio-border-color-lighter);
  box-shadow: var(--mio-shadow-light);
  padding: 10px 12px;
  transition: all 0.2s ease;
  position: relative;
}

.preset-card:hover {
  border-color: var(--mio-border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.role-selector-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-select {
  width: 160px;
}

.index-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--mio-text-placeholder);
}

.role-opt {
  font-size: 13px;
  font-weight: 500;
}

.card-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 26px;
  height: 26px;
  min-width: 26px;
  max-width: 26px;
  padding: 0;
  font-size: 12px;
  color: var(--mio-text-secondary);
  border-color: var(--mio-border-color-lighter);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-btn:hover {
  color: var(--mio-color-primary);
  border-color: var(--mio-color-primary);
  background-color: var(--mio-bg-hover);
}

.action-btn.delete:hover {
  color: var(--mio-color-danger);
  border-color: var(--mio-color-danger);
  background-color: rgba(245, 108, 108, 0.1);
}

.card-body :deep(.el-textarea__inner) {
  font-size: 13px;
  line-height: 1.5;
  background-color: var(--mio-bg-page);
  border-radius: 6px;
  padding: 8px 10px;
  border-color: transparent;
  color: var(--mio-text-primary);
  transition: all 0.2s;
}

.card-body :deep(.el-textarea__inner:focus) {
  background-color: var(--mio-bg-card);
  border-color: var(--mio-color-primary);
  box-shadow: 0 0 0 1px var(--mio-color-primary);
}

.add-buttons-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
  padding-top: 4px;
  box-sizing: border-box;
}

.add-btn {
  width: 100%;
  padding: 8px 4px !important;
  margin: 0 !important;
  font-size: 12px;
  font-weight: 500;
  border-radius: 8px;
  border-color: var(--mio-border-color-lighter);
  color: var(--mio-text-regular);
  background: var(--mio-bg-card);
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.add-btn:hover {
  color: var(--mio-color-primary);
  border-color: var(--mio-color-primary);
  background: var(--mio-bg-hover);
}

@media (max-width: 768px) {
  .role-select {
    width: 110px;
  }

  .role-selector-wrap {
    gap: 4px;
  }

  .card-actions {
    gap: 2px;
  }

  .add-buttons-bar {
    gap: 6px;
  }

  .add-btn {
    font-size: 11px;
    padding: 7px 2px !important;
  }
}
</style>
