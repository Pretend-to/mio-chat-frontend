<template>
  <div class="onebot-config-view">
    <div class="page-header">
      <h1>OneBot 配置</h1>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存配置
        </el-button>
      </div>
    </div>

    <el-card>
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="160px"
        label-position="left"
      >
        <el-form-item label="启用 OneBot" prop="enable">
          <el-switch
            v-model="formData.enable"
            active-text="启用"
            inactive-text="禁用"
          />
          <template #extra>
            <span class="form-item-tip">
              是否启用 OneBot 协议支持（QQ 机器人）
            </span>
          </template>
        </el-form-item>

        <el-divider content-position="left">连接配置</el-divider>

        <el-form-item label="反向 WebSocket URL" prop="reverse_ws_url">
          <el-input
            v-model="formData.reverse_ws_url"
            placeholder="ws://localhost:8080/onebot/v11/ws"
            style="width: 500px"
            :disabled="!formData.enable"
          />
          <template #extra>
            <span class="form-item-tip">
              OneBot 实现端的反向 WebSocket 地址（如 go-cqhttp）
            </span>
          </template>
        </el-form-item>

        <el-form-item label="Access Token" prop="token">
          <el-input
            v-model="formData.token"
            :type="showToken ? 'text' : 'password'"
            placeholder="留空则不使用 token 验证"
            maxlength="100"
            show-word-limit
            style="width: 500px"
            :disabled="!formData.enable"
          >
            <template #append>
              <el-button
                :icon="showToken ? View : Hide"
                @click="showToken = !showToken"
              />
            </template>
          </el-input>
          <template #extra>
            <span class="form-item-tip">
              与 OneBot 实现端配置的 access_token 保持一致
            </span>
          </template>
        </el-form-item>

        <el-divider content-position="left">机器人配置</el-divider>

        <el-form-item label="机器人 QQ 号" prop="bot_qq">
          <el-input
            v-model="formData.bot_qq"
            placeholder="2698788044"
            maxlength="20"
            style="width: 300px"
            :disabled="!formData.enable"
          />
          <template #extra>
            <span class="form-item-tip"> 接入的 QQ 机器人账号 </span>
          </template>
        </el-form-item>

        <el-form-item label="管理员 QQ 号" prop="admin_qq">
          <el-input
            v-model="formData.admin_qq"
            placeholder="1099834705"
            maxlength="20"
            style="width: 300px"
            :disabled="!formData.enable"
          />
          <template #extra>
            <span class="form-item-tip">
              机器人管理员的 QQ 号，拥有特殊权限
            </span>
          </template>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 连接状态 -->
    <el-card class="status-card" style="margin-top: 16px">
      <template #header>
        <div class="card-header status-header">
          <div class="header-left">
            <span>实时连接状态</span>
            <div class="status-pulsing-badge" :class="statusClass">
              <span class="pulse-dot"></span>
              <span class="status-text">{{ statusLabel }}</span>
            </div>
          </div>
          <el-button
            type="primary"
            link
            :icon="Refresh"
            :loading="connectionStatus.loading"
            @click="fetchConnectionStatus(true)"
          >
            手动刷新
          </el-button>
        </div>
      </template>

      <div class="status-content">
        <div class="status-grid">
          <div class="status-item">
            <span class="status-item-label">协议启用状态</span>
            <span class="status-item-value">
              <el-tag
                :type="connectionStatus.enable ? 'success' : 'info'"
                size="small"
                effect="dark"
              >
                {{ connectionStatus.enable ? "已启用" : "已禁用" }}
              </el-tag>
            </span>
          </div>
          <div class="status-item">
            <span class="status-item-label">连接状态</span>
            <span class="status-item-value">
              <el-tag
                :type="connectionStatus.connected ? 'success' : 'danger'"
                size="small"
                effect="dark"
              >
                {{
                  connectionStatus.connected ? "正常连接中" : "未连接/已离线"
                }}
              </el-tag>
            </span>
          </div>
          <div class="status-item full-width">
            <span class="status-item-label">反向 WS 地址</span>
            <span class="status-item-value ws-url-value">
              <code>{{ connectionStatus.reverse_ws_url || "未配置" }}</code>
            </span>
          </div>
          <div class="status-item">
            <span class="status-item-label">QQ 机器人账号</span>
            <span class="status-item-value bot-qq-value">
              {{ connectionStatus.bot_qq || "—" }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-item-label">上次轮询时间</span>
            <span class="status-item-value check-time-value">
              {{ connectionStatus.lastChecked || "—" }}
            </span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 预设前缀配置 (Text Wraper) -->
    <el-card style="margin-top: 16px">
      <template #header>
        <div class="card-header preset-header">
          <div class="title-with-tip">
            <span>预设前缀配置 (Text Wraper)</span>
            <el-tooltip placement="top" effect="dark">
              <template #content>
                <div class="preset-tooltip-content">
                  <p
                    style="
                      margin: 0 0 6px 0;
                      font-weight: bold;
                      font-size: 14px;
                    "
                  >
                    前缀与包裹模板配置说明：
                  </p>
                  <ul
                    style="
                      margin: 0;
                      padding-left: 16px;
                      font-size: 13px;
                      line-height: 1.6;
                    "
                  >
                    <li>
                      分两级结构：<strong>第一级为前缀分类</strong>（悬浮窗中作为分类，其
                      value 唯一，label 为分类名称）。
                    </li>
                    <li>
                      <strong>第二级为具体的指令前缀模板</strong
                      >（在分类项的子树中展示）。
                    </li>
                    <li>
                      指令前缀必须配置 <strong>前缀模板 (Preset)</strong>，例如
                      <code>#绘个图{xxx}</code>。模板中的
                      <code>{xxx}</code> 会被输入框中的实际文字替换。
                    </li>
                    <li>
                      如果模板不包含 <code>{xxx}</code>，例如
                      <code>#帮助</code
                      >，则在对话界面点击时会被当作直接执行的一键快捷命令立即发送。
                    </li>
                  </ul>
                </div>
              </template>
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
          <el-button
            type="primary"
            size="small"
            :icon="Plus"
            @click="handleAddCategory"
            >添加新分类</el-button
          >
        </div>
      </template>

      <div v-if="presetCategories.length === 0" class="empty-categories">
        <el-empty description="暂无预设配置，点击右上角添加新分类" />
      </div>

      <div v-else class="categories-list">
        <div
          v-for="(category, catIdx) in presetCategories"
          :key="catIdx"
          class="category-card"
        >
          <div class="category-card-header">
            <div class="header-inputs">
              <span class="cat-label-tag">分类：</span>
              <el-input
                v-model="category.label"
                placeholder="分类名称 (如：画图)"
                size="small"
                style="width: 150px"
              />
              <span class="cat-label-tag val-tag">标识：</span>
              <el-input
                v-model="category.value"
                placeholder="分类标识 (如：AP)"
                size="small"
                style="width: 120px"
              />
            </div>
            <div class="header-actions">
              <el-button
                type="success"
                size="small"
                plain
                @click="handleAddPresetItem(category)"
                >添加预设项</el-button
              >
              <el-button
                type="danger"
                size="small"
                plain
                @click="handleDeleteCategory(catIdx)"
                >删除分类</el-button
              >
            </div>
          </div>

          <div class="category-card-body">
            <el-table
              :data="category.children || []"
              border
              size="small"
              empty-text="当前分类下无预设项，请点击上方“添加预设项”"
              style="width: 100%"
            >
              <el-table-column label="项名称 (label)" width="180">
                <template #default="scope">
                  <el-input
                    v-model="scope.row.label"
                    placeholder="如：绘个图"
                    size="small"
                  />
                </template>
              </el-table-column>
              <el-table-column label="项标识 (value)" width="180">
                <template #default="scope">
                  <el-input
                    v-model="scope.row.value"
                    placeholder="如：eDraw"
                    size="small"
                  />
                </template>
              </el-table-column>
              <el-table-column label="前缀模板 (preset)">
                <template #default="scope">
                  <el-input
                    v-model="scope.row.preset"
                    placeholder="如：#绘个图{xxx} 或 #帮助"
                    size="small"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" align="center">
                <template #default="scope">
                  <el-button
                    type="danger"
                    size="small"
                    link
                    @click="handleDeletePresetItem(category, scope.$index)"
                  >
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { useConfigStore } from "@/stores/configStore.js";
import {
  Hide,
  View,
  Plus,
  Delete,
  Refresh,
  QuestionFilled,
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";

const configStore = useConfigStore();
const formRef = ref(null);
const saving = ref(false);
const showToken = ref(false);

// 表单数据
const formData = reactive({
  enable: false,
  reverse_ws_url: "",
  token: "",
  bot_qq: "",
  admin_qq: "",
});

// 连接状态数据
const connectionStatus = reactive({
  enable: false,
  connected: false,
  bot_qq: "",
  admin_qq: "",
  reverse_ws_url: "",
  loading: false,
  lastChecked: null,
});

// 预设前缀分类数据
const presetCategories = ref([]);

// 原始数据（用于重置）
const originalData = reactive({});
let originalOnebotConfig = null;

// 状态计算属性
const statusClass = computed(() => {
  if (!connectionStatus.enable) return "disabled";
  return connectionStatus.connected ? "online" : "offline";
});

const statusLabel = computed(() => {
  if (!connectionStatus.enable) return "协议已禁用";
  return connectionStatus.connected ? "正常在线中" : "未连接/已离线";
});

// 获取连接状态
const fetchConnectionStatus = async (showLoading = false) => {
  if (showLoading) connectionStatus.loading = true;
  try {
    const status = await configStore.fetchOneBotStatus();
    Object.assign(connectionStatus, {
      enable: status.enable ?? false,
      connected: status.connected ?? false,
      bot_qq: status.bot_qq || "",
      admin_qq: status.admin_qq || "",
      reverse_ws_url: status.reverse_ws_url || "",
      lastChecked: new Date().toLocaleTimeString(),
    });
  } catch (error) {
    console.error("获取 OneBot 状态失败:", error);
  } finally {
    if (showLoading) connectionStatus.loading = false;
  }
};

let statusTimer = null;

const startStatusPolling = () => {
  stopStatusPolling();
  fetchConnectionStatus();
  statusTimer = setInterval(() => {
    fetchConnectionStatus();
  }, 5000);
};

const stopStatusPolling = () => {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
};

// 验证规则
const rules = {
  reverse_ws_url: [
    {
      validator: (rule, value, callback) => {
        if (formData.enable && !value) {
          callback(new Error("启用 OneBot 时必须输入反向 WebSocket URL"));
        } else if (
          value &&
          !value.startsWith("ws://") &&
          !value.startsWith("wss://")
        ) {
          callback(new Error("URL 必须以 ws:// 或 wss:// 开头"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
  bot_qq: [
    {
      validator: (rule, value, callback) => {
        if (formData.enable && !value) {
          callback(new Error("启用 OneBot 时必须输入机器人 QQ 号"));
        } else if (value && !/^\d+$/.test(value)) {
          callback(new Error("QQ 号必须为纯数字"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
  admin_qq: [
    {
      validator: (rule, value, callback) => {
        if (value && !/^\d+$/.test(value)) {
          callback(new Error("QQ 号必须为纯数字"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
};

// 加载配置
const loadConfig = async () => {
  try {
    // 使用新的 OneBot API 接口获取配置
    const onebotConfig =
      configStore.config?.onebot ||
      (await configStore.fetchConfigSection("onebot"));
    originalOnebotConfig = JSON.parse(JSON.stringify(onebotConfig));

    Object.assign(formData, {
      enable: onebotConfig.enable ?? false,
      reverse_ws_url: onebotConfig.reverse_ws_url || "",
      token: onebotConfig.token || "",
      bot_qq: onebotConfig.bot_qq || "",
      admin_qq: onebotConfig.admin_qq || "",
    });

    const options = onebotConfig.plugins?.options?.textwraper?.options || [
      { value: "", label: "默认" },
    ];
    presetCategories.value = JSON.parse(JSON.stringify(options));

    // 保存原始数据
    Object.assign(originalData, formData);
  } catch (error) {
    ElMessage.error("加载 OneBot 配置失败：" + error.message);
  }
};

// 保存配置
const handleSave = async () => {
  try {
    await formRef.value.validate();

    saving.value = true;

    // 清理和转换最终保存的预设配置，去除空的 children 键，以保持默认格式的一致性
    const cleanedOptions = presetCategories.value.map((cat) => {
      const newCat = { ...cat };
      if (!newCat.children || newCat.children.length === 0) {
        delete newCat.children;
      } else {
        newCat.children = newCat.children.map((child) => ({
          label: child.label || "",
          value: child.value || "",
          preset: child.preset || "",
        }));
      }
      return newCat;
    });

    await configStore.updateConfigSection("onebot", {
      enable: formData.enable,
      reverse_ws_url: formData.reverse_ws_url,
      token: formData.token,
      bot_qq: formData.bot_qq,
      admin_qq: formData.admin_qq,
      plugins: {
        options: {
          textwraper: {
            options: cleanedOptions,
          },
        },
      },
    });

    ElMessage.success("OneBot 配置保存成功");

    // 重新加载配置，同步最新状态
    await loadConfig();
    // 立即刷新状态
    await fetchConnectionStatus(true);
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("保存失败：" + error.message);
    }
  } finally {
    saving.value = false;
  }
};

// 重置配置
const handleReset = () => {
  Object.assign(formData, originalData);
  if (originalOnebotConfig) {
    const options = originalOnebotConfig.plugins?.options?.textwraper
      ?.options || [{ value: "", label: "默认" }];
    presetCategories.value = JSON.parse(JSON.stringify(options));
  }
  formRef.value?.clearValidate();
  ElMessage.info("已重置为当前保存的配置");
};

// 添加预设分类
const handleAddCategory = () => {
  presetCategories.value.push({
    label: "新分类",
    value: "new_cat_" + Math.random().toString(36).substr(2, 5),
    children: [],
  });
};

// 删除预设分类
const handleDeleteCategory = (index) => {
  ElMessageBox.confirm("确定要删除该分类及其下的所有预设项吗？", "删除确认", {
    confirmButtonText: "删除",
    cancelButtonText: "取消",
    type: "warning",
  })
    .then(() => {
      presetCategories.value.splice(index, 1);
      ElMessage.success("分类已删除");
    })
    .catch(() => {});
};

// 添加子预设项
const handleAddPresetItem = (category) => {
  if (!category.children) {
    category.children = [];
  }
  category.children.push({
    label: "新指令",
    value: "new_item_" + Math.random().toString(36).substr(2, 5),
    preset: "#指令{xxx}",
  });
};

// 删除子预设项
const handleDeletePresetItem = (category, index) => {
  category.children.splice(index, 1);
};

// 初始化
onMounted(async () => {
  if (!configStore.config) {
    await configStore.fetchConfig();
  }
  await loadConfig();
  startStatusPolling();
});

onUnmounted(() => {
  stopStatusPolling();
});
</script>

<style scoped lang="scss">
.onebot-config-view {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #303133;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.card-header {
  font-weight: 600;
  color: #303133;
}

.form-item-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

:deep(.el-form-item) {
  margin-bottom: 28px;
}

:deep(.el-form-item__extra) {
  margin-top: 4px;
}

:deep(.el-divider) {
  margin: 24px 0 16px 0;
}

:deep(.el-divider__text) {
  font-weight: 600;
  color: #606266;
}

// 禁用状态的输入框样式
:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: #f5f7fa;
  border-color: #e4e7ed;
  color: #c0c4cc;
}

:deep(.el-input.is-disabled .el-input__inner) {
  color: #c0c4cc;
  cursor: not-allowed;
}

.preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .title-with-tip {
    display: flex;
    align-items: center;
    gap: 6px;

    .question-icon {
      font-size: 16px;
      color: #909399;
      cursor: pointer;
      transition: color 0.2s ease;
      display: flex;
      align-items: center;

      &:hover {
        color: #409eff;
      }
    }
  }
}

.empty-categories {
  padding: 40px 0;
}

.categories-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.category-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: hidden;

  &:hover {
    box-shadow: 0 6px 16px rgba(0, 153, 255, 0.08);
    border-color: rgba(0, 153, 255, 0.3);
    transform: translateY(-2px);
  }
}

.category-card-header {
  background: linear-gradient(90deg, #f8f9fa 0%, #f1f3f5 100%);
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e4e7ed;

  .header-inputs {
    display: flex;
    align-items: center;
    gap: 8px;

    .cat-label-tag {
      font-size: 13px;
      font-weight: 600;
      color: #606266;
    }

    .val-tag {
      margin-left: 12px;
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.category-card-body {
  padding: 16px 20px;
  background-color: #fff;

  :deep(.el-table) {
    border-radius: 8px;
    overflow: hidden;
  }
}

// 实时连接状态卡片样式
.status-card {
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: hidden;

  &:hover {
    box-shadow: 0 6px 16px rgba(0, 153, 255, 0.06);
    border-color: rgba(0, 153, 255, 0.2);
  }
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    span {
      font-weight: 600;
      color: #303133;
    }
  }
}

.status-pulsing-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;

  &.online {
    background: rgba(103, 194, 58, 0.1);
    color: #67c23a;
    border: 1px solid rgba(103, 194, 58, 0.2);

    .pulse-dot {
      background-color: #67c23a;
      box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7);
      animation: pulse-green 2s infinite;
    }
  }

  &.offline {
    background: rgba(245, 108, 108, 0.1);
    color: #f56c6c;
    border: 1px solid rgba(245, 108, 108, 0.2);

    .pulse-dot {
      background-color: #f56c6c;
      box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.7);
      animation: pulse-red 2s infinite;
    }
  }

  &.disabled {
    background: rgba(144, 147, 153, 0.1);
    color: #909399;
    border: 1px solid rgba(144, 147, 153, 0.2);

    .pulse-dot {
      background-color: #909399;
    }
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
}

@keyframes pulse-green {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(103, 194, 58, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0);
  }
}

@keyframes pulse-red {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(245, 108, 108, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0);
  }
}

.status-content {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.6) 0%,
    rgba(255, 255, 255, 0.9) 100%
  );
  backdrop-filter: blur(10px);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 8px 4px;

  .status-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: #fafafa;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid #f0f0f0;
    transition: all 0.2s ease;

    &:hover {
      background: #fdfdfd;
      border-color: #e6e6e6;
    }

    &.full-width {
      grid-column: span 2;
    }

    .status-item-label {
      font-size: 12px;
      color: #909399;
      font-weight: 500;
    }

    .status-item-value {
      font-size: 14px;
      color: #303133;
      font-weight: 600;

      &.ws-url-value {
        font-family: monospace;
        background: #f4f4f5;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 13px;
        word-break: break-all;
        color: #409eff;
      }

      &.bot-qq-value {
        color: #303133;
        font-family: monospace;
        font-size: 15px;
      }

      &.check-time-value {
        color: #606266;
        font-weight: normal;
      }
    }
  }
}
</style>
