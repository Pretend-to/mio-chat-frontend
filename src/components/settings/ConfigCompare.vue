<template>
  <el-dialog
    v-model="visible"
    title="配置对比"
    width="900px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="dialog-content">
      <div class="config-compare-dialog">
      <!-- 上传对比配置 -->
      <div v-if="!compareConfig" class="upload-section">
        <el-upload
          drag
          :before-upload="handleUpload"
          :show-file-list="false"
          accept=".json"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            拖拽配置文件到此处，或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              上传 JSON 格式的配置文件以与当前配置进行对比
            </div>
          </template>
        </el-upload>
      </div>

      <!-- 对比结果 -->
      <div v-else class="compare-result">
        <div class="result-header">
          <el-tag :type="hasDifferences ? 'warning' : 'success'" size="large">
            {{ hasDifferences ? '发现差异' : '配置相同' }}
          </el-tag>
          <el-button @click="handleReset">重新选择</el-button>
        </div>

        <!-- 差异统计 -->
        <div v-if="hasDifferences" class="diff-stats">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="新增项">
              <el-tag type="success">{{ diffStats.added }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="修改项">
              <el-tag type="warning">{{ diffStats.modified }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="删除项">
              <el-tag type="danger">{{ diffStats.removed }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 详细差异 -->
        <div v-if="hasDifferences" class="diff-details">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="LLM 适配器" name="adapters">
              <div class="diff-section" v-for="(changes, type) in adapterDiffs" :key="type">
                <h4>{{ adapterTypeName(type) }}</h4>
                <div v-if="changes.length === 0" class="no-changes">
                  无变化
                </div>
                <div v-else class="changes-list">
                  <div
                    v-for="(change, index) in changes"
                    :key="index"
                    class="change-item"
                    :class="change.type"
                  >
                    <el-tag :type="changeTypeTag(change.type)" size="small">
                      {{ changeTypeText(change.type) }}
                    </el-tag>
                    <span class="change-path">{{ change.path }}</span>
                    <div class="change-values">
                      <div v-if="change.type !== 'added'" class="old-value">
                        <span class="label">当前:</span>
                        <code>{{ formatValue(change.oldValue) }}</code>
                      </div>
                      <div v-if="change.type !== 'removed'" class="new-value">
                        <span class="label">{{ change.type === 'added' ? '新增' : '修改为' }}:</span>
                        <code>{{ formatValue(change.newValue) }}</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="服务器配置" name="server">
              <div class="config-section-compare">
                <div v-if="!hasServerDiff" class="no-changes">无变化</div>
                <div v-else class="diff-table">
                  <el-table :data="serverDifferences" border>
                    <el-table-column prop="key" label="配置项" width="200" />
                    <el-table-column label="当前值">
                      <template #default="{ row }">
                        <code>{{ row.currentValue }}</code>
                      </template>
                    </el-table-column>
                    <el-table-column label="对比值">
                      <template #default="{ row }">
                        <code>{{ row.compareValue }}</code>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="Web 配置" name="web">
              <div class="config-section-compare">
                <div v-if="!hasWebDiff" class="no-changes">无变化</div>
                <div v-else class="diff-table">
                  <el-table :data="webDifferences" border>
                    <el-table-column prop="key" label="配置项" width="200" />
                    <el-table-column label="当前值">
                      <template #default="{ row }">
                        <code>{{ row.currentValue }}</code>
                      </template>
                    </el-table-column>
                    <el-table-column label="对比值">
                      <template #default="{ row }">
                        <code>{{ row.compareValue }}</code>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="OneBot 配置" name="onebot">
              <div class="config-section-compare">
                <div v-if="!hasOnebotDiff" class="no-changes">无变化</div>
                <div v-else class="diff-table">
                  <el-table :data="onebotDifferences" border>
                    <el-table-column prop="key" label="配置项" width="200" />
                    <el-table-column label="当前值">
                      <template #default="{ row }">
                        <code>{{ row.currentValue }}</code>
                      </template>
                    </el-table-column>
                    <el-table-column label="对比值">
                      <template #default="{ row }">
                        <code>{{ row.compareValue }}</code>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- 无差异提示 -->
        <el-empty v-else description="配置完全相同" />
      </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
        <el-button
          v-if="compareConfig && hasDifferences"
          type="primary"
          @click="handleApply"
        >
          应用对比配置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { useConfigStore } from '@/stores/configStore.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const configStore = useConfigStore();

const visible = ref(props.modelValue);
const compareConfig = ref(null);
const activeTab = ref('adapters');

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (!val) {
    compareConfig.value = null;
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const currentConfig = computed(() => configStore.config || {});

// 计算差异
const adapterDiffs = computed(() => {
  if (!compareConfig.value) return {};
  
  const diffs = {
    openai: [],
    gemini: [],
    vertex: []
  };
  
  ['openai', 'gemini', 'vertex'].forEach(type => {
    const current = currentConfig.value.adapters?.[type] || [];
    const compare = compareConfig.value.adapters?.[type] || [];
    
    // 检查每个实例
    const maxLen = Math.max(current.length, compare.length);
    for (let i = 0; i < maxLen; i++) {
      const curr = current[i];
      const comp = compare[i];
      
      if (!curr && comp) {
        // 新增
        diffs[type].push({
          type: 'added',
          path: `实例 ${i + 1}`,
          newValue: comp
        });
      } else if (curr && !comp) {
        // 删除
        diffs[type].push({
          type: 'removed',
          path: `实例 ${i + 1}`,
          oldValue: curr
        });
      } else if (curr && comp) {
        // 检查属性差异
        const props = new Set([...Object.keys(curr), ...Object.keys(comp)]);
        props.forEach(prop => {
          if (JSON.stringify(curr[prop]) !== JSON.stringify(comp[prop])) {
            diffs[type].push({
              type: 'modified',
              path: `实例 ${i + 1} - ${prop}`,
              oldValue: curr[prop],
              newValue: comp[prop]
            });
          }
        });
      }
    }
  });
  
  return diffs;
});

const diffStats = computed(() => {
  let added = 0, modified = 0, removed = 0;
  
  Object.values(adapterDiffs.value).forEach(changes => {
    changes.forEach(change => {
      if (change.type === 'added') added++;
      else if (change.type === 'modified') modified++;
      else if (change.type === 'removed') removed++;
    });
  });
  
  // TODO: 添加其他配置项的差异统计
  
  return { added, modified, removed };
});

const hasDifferences = computed(() => {
  return diffStats.value.added > 0 ||
         diffStats.value.modified > 0 ||
         diffStats.value.removed > 0;
});

// 服务器配置差异
const serverDifferences = computed(() => {
  return getConfigDifferences(currentConfig.value.server, compareConfig.value?.server);
});

const hasServerDiff = computed(() => serverDifferences.value.length > 0);

// Web 配置差异
const webDifferences = computed(() => {
  return getConfigDifferences(currentConfig.value.web, compareConfig.value?.web);
});

const hasWebDiff = computed(() => webDifferences.value.length > 0);

// OneBot 配置差异
const onebotDifferences = computed(() => {
  return getConfigDifferences(currentConfig.value.onebot, compareConfig.value?.onebot);
});

const hasOnebotDiff = computed(() => onebotDifferences.value.length > 0);

// 通用配置差异计算函数
const getConfigDifferences = (current, compare) => {
  const diffs = [];
  const keys = new Set([
    ...Object.keys(current || {}),
    ...Object.keys(compare || {})
  ]);
  
  keys.forEach(key => {
    const currVal = current?.[key];
    const compVal = compare?.[key];
    
    if (JSON.stringify(currVal) !== JSON.stringify(compVal)) {
      diffs.push({
        key,
        currentValue: formatConfigValue(currVal),
        compareValue: formatConfigValue(compVal)
      });
    }
  });
  
  return diffs;
};

const formatConfigValue = (val) => {
  if (val === undefined) return '-';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const adapterTypeName = (type) => {
  const names = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    vertex: 'Vertex AI'
  };
  return names[type] || type;
};

const changeTypeTag = (type) => {
  const tags = {
    added: 'success',
    modified: 'warning',
    removed: 'danger'
  };
  return tags[type] || '';
};

const changeTypeText = (type) => {
  const texts = {
    added: '新增',
    modified: '修改',
    removed: '删除'
  };
  return texts[type] || type;
};

const formatValue = (value) => {
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const handleUpload = async (file) => {
  try {
    const text = await file.text();
    const config = JSON.parse(text);
    
    // 验证配置格式
    const result = await configStore.validateConfig(config);
    if (!result.valid) {
      ElMessage.error('配置文件格式无效：' + result.errors.join(', '));
      return false;
    }
    
    compareConfig.value = config;
    ElMessage.success('配置文件加载成功');
  } catch (error) {
    ElMessage.error('加载配置文件失败：' + error.message);
  }
  
  return false;
};

const handleReset = () => {
  compareConfig.value = null;
  activeTab.value = 'adapters';
};

const handleClose = () => {
  visible.value = false;
};

const handleApply = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要应用对比配置吗？这将覆盖当前配置。',
      '确认应用',
      {
        confirmButtonText: '应用',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    await configStore.updateConfig(compareConfig.value);
    ElMessage.success('配置已应用，请重启服务使配置生效');
    handleClose();
    
    // 重新加载配置
    await configStore.fetchConfig();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('应用配置失败：' + error.message);
    }
  }
};


</script>

<style scoped lang="scss">
.dialog-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 0;
}

.config-compare-dialog {
  min-height: 400px;
}

.upload-section {
  padding: 40px 20px;
}

.compare-result {
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e4e7ed;
  }

  .diff-stats {
    margin-bottom: 24px;
  }

  .diff-details {
    margin-top: 24px;
  }
}

.diff-section {
  margin-bottom: 24px;

  h4 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .no-changes {
    padding: 20px;
    text-align: center;
    color: #909399;
    background-color: #f5f7fa;
    border-radius: 4px;
  }

  .changes-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .change-item {
    padding: 12px;
    border-radius: 4px;
    border: 1px solid #e4e7ed;

    &.added {
      background-color: #f0f9ff;
      border-color: #67c23a;
    }

    &.modified {
      background-color: #fdf6ec;
      border-color: #e6a23c;
    }

    &.removed {
      background-color: #fef0f0;
      border-color: #f56c6c;
    }

    .change-path {
      margin-left: 8px;
      font-weight: 500;
      color: #303133;
    }

    .change-values {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .old-value,
      .new-value {
        display: flex;
        align-items: flex-start;
        gap: 8px;

        .label {
          flex-shrink: 0;
          color: #909399;
          font-size: 13px;
        }

        code {
          flex: 1;
          padding: 4px 8px;
          background-color: #f5f7fa;
          border-radius: 3px;
          font-size: 12px;
          word-break: break-all;
        }
      }

      .old-value code {
        background-color: #fef0f0;
      }

      .new-value code {
        background-color: #f0f9ff;
      }
    }
  }
}

.config-section-compare {
  .no-changes {
    padding: 40px;
    text-align: center;
    color: #909399;
  }
}
</style>
