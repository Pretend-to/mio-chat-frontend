<template>
  <el-dialog
    :model-value="visible"
    :title="mode === 'create' ? '创建预设' : '编辑预设'"
    width="800px"
    :before-close="handleClose"
    destroy-on-close
  >
    <div class="dialog-content">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        label-position="left"
      >
      <!-- 预设名称 -->
      <el-form-item label="预设名称" prop="name">
        <el-input
          v-model="formData.name"
          placeholder="请输入预设名称"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>

      <!-- 预设分类 -->
      <el-form-item label="预设分类" prop="category">
        <el-select
          v-model="formData.category"
          placeholder="请选择预设分类"
          style="width: 100%"
        >
          <el-option
            label="常用预设"
            value="common"
          />
          <el-option
            label="推荐预设"
            value="recommended"
          />
          <el-option
            label="隐藏预设"
            value="hidden"
          />
        </el-select>
      </el-form-item>

      <!-- 开场白 -->
      <el-form-item label="开场白" prop="opening">
        <el-input
          v-model="formData.opening"
          type="textarea"
          :rows="3"
          placeholder="请输入开场白（可选）"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>

      <!-- 对话历史 -->
      <el-form-item label="对话历史" prop="history">
        <div class="history-editor">
          <div class="history-header">
            <span>消息列表</span>
            <el-button
              type="primary"
              size="small"
              :icon="Plus"
              @click="addHistoryItem"
            >
              添加消息
            </el-button>
          </div>

          <div class="history-list">
            <div
              v-for="(item, index) in formData.history"
              :key="index"
              class="history-item"
            >
              <div class="item-header">
                <el-select
                  v-model="item.role"
                  placeholder="选择角色"
                  style="width: 120px"
                >
                  <el-option label="系统" value="system" />
                  <el-option label="用户" value="user" />
                  <el-option label="助手" value="assistant" />
                </el-select>
                <el-button
                  type="danger"
                  size="small"
                  text
                  :icon="Delete"
                  @click="removeHistoryItem(index)"
                >
                  删除
                </el-button>
              </div>
              <el-input
                v-model="item.content"
                type="textarea"
                :rows="4"
                placeholder="请输入消息内容"
                maxlength="2000"
                show-word-limit
              />
            </div>

            <div v-if="formData.history.length === 0" class="empty-history">
              <el-empty description="暂无消息" :image-size="80">
                <el-button type="primary" :icon="Plus" @click="addHistoryItem">
                  添加第一条消息
                </el-button>
              </el-empty>
            </div>
          </div>
        </div>
      </el-form-item>

      <!-- 工具列表 -->
      <el-form-item label="工具列表" prop="tools">
        <div class="tools-editor">
          <el-select
            v-model="formData.tools"
            multiple
            filterable
            allow-create
            placeholder="选择或输入工具名称"
            style="width: 100%"
          >
            <el-option
              v-for="tool in availableTools"
              :key="tool"
              :label="tool"
              :value="tool"
            />
          </el-select>
          <div class="tools-help">
            <el-text type="info" size="small">
              可以选择现有工具或输入新的工具名称，多个工具用回车分隔
            </el-text>
          </div>
        </div>
      </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ mode === 'create' ? '创建' : '保存' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { Delete, Plus } from '@element-plus/icons-vue';
import { nextTick, reactive, ref, watch } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create', // 'create' | 'edit'
    validator: (value) => ['create', 'edit'].includes(value)
  },
  preset: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'submit']);

const formRef = ref(null);
const submitting = ref(false);

// 表单数据
const formData = reactive({
  name: '',
  category: 'common', // 默认为常用预设
  opening: '',
  history: [],
  tools: []
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入预设名称', trigger: 'blur' },
    { min: 1, max: 50, message: '名称长度应在 1-50 个字符', trigger: 'blur' }
  ],
  category: [
    { required: true, message: '请选择预设分类', trigger: 'change' }
  ],
  history: [
    { required: true, message: '至少需要一条对话历史', trigger: 'change' },
    {
      validator: (rule, value, callback) => {
        if (!Array.isArray(value) || value.length === 0) {
          callback(new Error('至少需要一条对话历史'));
          return;
        }
        
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (!item.role || !item.content) {
            callback(new Error(`第 ${i + 1} 条消息的角色和内容不能为空`));
            return;
          }
        }
        
        callback();
      },
      trigger: 'change'
    }
  ]
};

// 可用工具列表（示例）
const availableTools = ref([
  'web_search',
  'calculator',
  'code_interpreter',
  'image_generator',
  'file_reader',
  'weather',
  'translator'
]);

// 监听预设数据变化
watch(() => props.preset, (newPreset) => {
  if (newPreset && props.mode === 'edit') {
    formData.name = newPreset.name || '';
    formData.category = newPreset.category || 'common';
    formData.opening = newPreset.opening || '';
    formData.history = newPreset.history ? [...newPreset.history] : [];
    formData.tools = newPreset.tools ? [...newPreset.tools] : [];
  }
}, { immediate: true });

// 监听对话框显示状态
watch(() => props.visible, (visible) => {
  if (visible) {
    if (props.mode === 'create') {
      // 创建模式，重置表单
      resetForm();
    }
    // 等待 DOM 更新后清除验证状态
    nextTick(() => {
      formRef.value?.clearValidate();
    });
  }
});

// 重置表单
const resetForm = () => {
  formData.name = '';
  formData.category = 'common';
  formData.opening = '';
  formData.history = [];
  formData.tools = [];
};

// 添加对话历史项
const addHistoryItem = () => {
  formData.history.push({
    role: 'system',
    content: ''
  });
};

// 删除对话历史项
const removeHistoryItem = (index) => {
  formData.history.splice(index, 1);
};

// 处理关闭
const handleClose = () => {
  if (submitting.value) return;
  emit('close');
};

// 处理提交
const handleSubmit = async () => {
  if (submitting.value) return;

  try {
    // 验证表单
    await formRef.value?.validate();
    
    submitting.value = true;

    // 准备提交数据
    const submitData = {
      name: formData.name.trim(),
      category: formData.category,
      opening: formData.opening.trim(),
      history: formData.history.map(item => ({
        role: item.role,
        content: item.content.trim()
      })).filter(item => item.content), // 过滤空内容
      tools: formData.tools.filter(tool => tool.trim()) // 过滤空工具名
    };

    // 提交数据
    await emit('submit', {
      data: submitData,
      mode: props.mode
    });

    // 提交成功，关闭对话框
    emit('close');
  } catch (error) {
    console.error('表单验证失败:', error);
    // 验证失败或提交失败，不关闭对话框
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped lang="scss">
.history-editor {
  width: 100%;

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-weight: 500;
    color: #303133;
  }

  .history-list {
    .history-item {
      border: 1px solid #e4e7ed;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
      background: #fafafa;

      &:last-child {
        margin-bottom: 0;
      }

      .item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
    }

    .empty-history {
      padding: 20px;
      text-align: center;
      border: 1px dashed #d9d9d9;
      border-radius: 6px;
      background: #fafafa;
    }
  }
}

.tools-editor {
  width: 100%;

  .tools-help {
    margin-top: 8px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 0;
}

// Element Plus 样式覆盖
:deep(.el-dialog__body) {
  padding: 20px 24px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #303133;
}

:deep(.el-textarea__inner) {
  resize: vertical;
}
</style>