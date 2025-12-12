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

      <!-- 预设头像 -->
      <el-form-item label="预设头像" prop="avatar">
        <div class="avatar-editor">
          <div class="avatar-preview">
            <el-avatar
              :size="80"
              :src="formData.avatar"
              :icon="UserFilled"
              class="preview-avatar"
            />
          </div>
          <div class="avatar-actions">
            <el-upload
              ref="avatarUploadRef"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="handleFileSelect"
              accept="image/*"
            >
              <el-button type="primary">
                选择头像
              </el-button>
            </el-upload>
            <el-button
              v-if="formData.avatar"
              type="danger"
              text
              @click="removeAvatar"
            >
              移除头像
            </el-button>
          </div>
          <div class="avatar-help">
            <el-text type="info" size="small">
              支持 JPG、PNG 等图片格式，将自动裁剪为正方形
            </el-text>
          </div>
        </div>
      </el-form-item>

      <!-- 图片裁剪组件 -->
      <ImageCropper
        :visible="cropperVisible"
        :image-src="selectedImageSrc"
        @close="handleCropperClose"
        @confirm="handleCropperConfirm"
      />

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
                maxlength="30000"
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
          <el-cascader
            v-model="formData.tools"
            :options="toolsOptions"
            :props="cascaderProps"
            placeholder="选择工具"
            style="width: 100%"
            clearable
            filterable
            :show-all-levels="false"
            collapse-tags
            collapse-tags-tooltip
            :max-collapse-tags="20"
            :loading="loadingTools"
            class="tools-cascader"
          />
          <div class="tools-help">
            <el-text type="info" size="small">
              从插件中选择可用的工具，支持多选和搜索
              <span v-if="loadingTools">（正在加载工具列表...）</span>
              <span v-else-if="toolsOptions.length === 0">（暂无可用工具）</span>
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
import { pluginAPI } from '@/lib/configApi.js';
import { Delete, Plus, UserFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { nextTick, onMounted, reactive, ref, watch } from 'vue';
import ImageCropper from './ImageCropper.vue';

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
  avatar: '', // 头像路径
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
      validator: (_, value, callback) => {
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

// 工具选项数据
const toolsOptions = ref([]);
const loadingTools = ref(false);

// 头像上传相关
const avatarUploadRef = ref(null);
const uploadingAvatar = ref(false);
const cropperVisible = ref(false);
const selectedImageSrc = ref('');
const uploadHeaders = {
  'X-Admin-Code': localStorage.getItem('admin_code') || ''
};

// 级联选择器配置
const cascaderProps = {
  multiple: true,
  checkStrictly: false,
  value: 'value',
  label: 'label',
  children: 'children',
  emitPath: false // 只返回选中的值，不返回完整路径
};

// 从插件获取工具列表
const loadToolsFromPlugins = async () => {
  if (loadingTools.value) return;
  
  loadingTools.value = true;
  try {
    // 获取所有插件
    const pluginsResult = await pluginAPI.listPlugins();
    if (pluginsResult.code !== 0) {
      console.error('获取插件列表失败:', pluginsResult.message);
      return;
    }

    const plugins = pluginsResult.data.plugins || [];
    const toolsMap = new Map(); // 用于去重和分组

    // 遍历每个启用的插件获取工具
    for (const plugin of plugins) {
      if (!plugin.enabled) continue;

      try {
        const toolsResult = await pluginAPI.getPluginTools(plugin.name);
        if (toolsResult.code === 0 && toolsResult.data.tools) {
          // 处理工具数据
          toolsResult.data.tools.forEach(group => {
            group.tools.forEach(tool => {
              // 提取工具名的有意义部分（使用 '_mid_' 分隔符）
              const meaningfulName = tool.name.split('_mid_')[0];
              
              if (!toolsMap.has(meaningfulName)) {
                toolsMap.set(meaningfulName, {
                  value: meaningfulName,
                  label: meaningfulName,
                  fullName: tool.name,
                  description: tool.description,
                  plugin: plugin.displayName,
                  group: group.group
                });
              }
            });
          });
        }
      } catch (error) {
        console.error(`获取插件 ${plugin.name} 工具失败:`, error);
      }
    }

    // 按插件 -> 工具组 -> 工具的三层结构构建级联选择器数据
    const pluginGroups = new Map();
    
    toolsMap.forEach(tool => {
      // 第一层：插件
      if (!pluginGroups.has(tool.plugin)) {
        pluginGroups.set(tool.plugin, {
          value: tool.plugin,
          label: tool.plugin,
          children: new Map()
        });
      }
      
      const pluginGroup = pluginGroups.get(tool.plugin);
      
      // 第二层：工具组
      if (!pluginGroup.children.has(tool.group)) {
        pluginGroup.children.set(tool.group, {
          value: `${tool.plugin}_${tool.group}`,
          label: tool.group,
          children: []
        });
      }
      
      // 第三层：工具
      pluginGroup.children.get(tool.group).children.push({
        value: tool.value,
        label: tool.label
      });
    });

    // 转换为数组格式
    toolsOptions.value = Array.from(pluginGroups.values()).map(plugin => ({
      ...plugin,
      children: Array.from(plugin.children.values())
    }));
  } catch (error) {
    console.error('加载工具列表失败:', error);
    // 如果加载失败，提供一个空的选项结构
    toolsOptions.value = [];
  } finally {
    loadingTools.value = false;
  }
};

// 监听预设数据变化
watch(() => props.preset, (newPreset) => {
  if (newPreset && props.mode === 'edit') {
    formData.name = newPreset.name || '';
    formData.category = newPreset.category || 'common';
    formData.avatar = newPreset.avatar || '';
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
  formData.avatar = '';
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

// 头像上传前验证
// 处理文件选择
const handleFileSelect = (file) => {
  const isImage = file.raw.type.startsWith('image/');
  const isLt5M = file.raw.size / 1024 / 1024 < 5;

  if (!isImage) {
    ElMessage.error('只能上传图片文件!');
    return;
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB!');
    return;
  }

  // 创建图片预览URL
  const reader = new FileReader();
  reader.onload = (e) => {
    selectedImageSrc.value = e.target.result;
    cropperVisible.value = true;
  };
  reader.readAsDataURL(file.raw);
};

// 关闭裁剪器
const handleCropperClose = () => {
  cropperVisible.value = false;
  selectedImageSrc.value = '';
};

// 确认裁剪
const handleCropperConfirm = async (croppedBlob) => {
  cropperVisible.value = false;
  uploadingAvatar.value = true;

  try {
    // 创建 FormData
    const uploadFormData = new FormData();
    uploadFormData.append('image', croppedBlob, 'avatar.jpg');

    // 上传裁剪后的图片
    const response = await fetch('/api/upload/image', {
      method: 'POST',
      headers: uploadHeaders,
      body: uploadFormData
    });

    const result = await response.json();

    if (result.code === 0 && result.data?.url) {
      formData.avatar = result.data.url;
      ElMessage.success('头像上传成功');
    } else {
      ElMessage.error('头像上传失败: ' + (result.message || '未知错误'));
    }
  } catch (error) {
    ElMessage.error('头像上传失败: ' + error.message);
  } finally {
    uploadingAvatar.value = false;
  }
};

// 移除头像
const removeAvatar = () => {
  formData.avatar = '';
  ElMessage.success('头像已移除');
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

    // 添加头像字段（如果有的话）
    if (formData.avatar) {
      submitData.avatar = formData.avatar;
    }

    // 提交数据
    emit('submit', {
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

// 组件挂载时加载工具列表
onMounted(() => {
  loadToolsFromPlugins();
});
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

.avatar-editor {
  width: 100%;

  .avatar-preview {
    margin-bottom: 12px;

    .preview-avatar {
      border: 2px dashed #d9d9d9;
      transition: border-color 0.3s ease;

      &:hover {
        border-color: #409eff;
      }
    }
  }

  .avatar-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 8px;
  }

  .avatar-help {
    font-size: 12px;
    color: #909399;
  }
}

.tools-editor {
  width: 100%;

  .tools-help {
    margin-top: 8px;
  }

  .tools-cascader {
    :deep(.el-cascader-panel) {
      .el-cascader-menu {
        width: 180px; // 固定每一级的宽度
        min-width: 180px;
        
        &:first-child {
          width: 200px; // 插件名可能较长，给更多空间
          min-width: 200px;
        }
        
        &:nth-child(2) {
          width: 160px; // 工具组名通常较短
          min-width: 160px;
        }
        
        &:nth-child(3) {
          width: 140px; // 工具名最短
          min-width: 140px;
        }
      }
      
      .el-cascader-node__label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
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