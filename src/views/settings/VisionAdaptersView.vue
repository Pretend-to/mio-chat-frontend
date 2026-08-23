<template>
  <div class="vision-adapters-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-title">
        <h1>识图服务配置</h1>
        <div class="header-desc">复用「LLM 适配器」中已启用的多模态模型，支持纯文本推理模型跨通道中继与 OCR 识别</div>
      </div>
      <div class="header-actions">
        <el-button :icon="View" @click="openTestDialog">识图连通测试</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
      </div>
    </div>

    <!-- 统计状态栏 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">调度模式：</span>
        <span class="stat-value">{{ form.mode === 'custom' ? '指定专属视觉模型' : '智能自动选择 (推荐)' }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">当前生效通道：</span>
        <span class="stat-value">{{ activeModelDisplayName }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已检测多模态模型：</span>
        <span class="stat-value">{{ availableModels.length }} 个</span>
      </div>
    </div>

    <!-- 视觉调度策略设置卡片 -->
    <el-card shadow="never" class="settings-card">
      <template #header>
        <div class="card-header-flex">
          <span class="card-title">多模态视觉调度策略</span>
          <span class="card-subtitle">（基于 LiteLLM 规范精准识别已配置的多模态模型，无需重复配置 API Key）</span>
        </div>
      </template>

      <el-form :model="form" label-width="140px" class="adapter-config-form" v-loading="loading">
        <el-form-item label="调度模式">
          <el-radio-group v-model="form.mode">
            <el-radio value="auto">智能自动选择（自动使用当前启用的首选多模态模型）</el-radio>
            <el-radio value="custom">指定专属视觉通道（手动指定特定 LLM 渠道与模型）</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.mode === 'custom'" label="指定视觉模型" required>
          <el-select 
            v-model="selectedModelKey" 
            placeholder="请从已启用的 LLM 多模态模型中选择" 
            style="width: 100%"
            @change="handleModelKeyChange"
          >
            <el-option 
              v-for="m in availableModels" 
              :key="`${m.provider}:::${m.model}`" 
              :label="m.label" 
              :value="`${m.provider}:::${m.model}`" 
            />
          </el-select>
          <div v-if="availableModels.length === 0" class="field-tip error">
            ⚠️ 当前系统中未检测到已启用的多模态视觉模型，请前往「LLM 适配器」页面配置并启用具备 Vision 能力的模型（如 Gemini、GPT-4o、Qwen-VL 等）。
          </div>
        </el-form-item>

        <el-form-item label="默认分析提示词">
          <el-input 
            v-model="form.defaultPrompt" 
            type="textarea" 
            :rows="3" 
            placeholder="例如: 请详细描述这幅图片中的内容，提取主要主体、场景特征和文字信息。" 
          />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 二级入口：识图连通测试弹窗 -->
    <el-dialog v-model="showTestDialog" title="识图效果与连通性测试" width="650px">
      <el-form label-width="90px">
        <el-form-item label="测试图片" required>
          <el-input v-model="testImageUrl" placeholder="输入公网图片 URL 或本地绝对路径" />
        </el-form-item>
        <el-form-item label="测试指令">
          <el-input 
            v-model="testPrompt" 
            placeholder="例如: 详细描述图片内容并提取文字" 
            @keyup.enter="runTest"
          />
        </el-form-item>
        <el-form-item label="测试通道">
          <el-select v-model="testModelKey" placeholder="默认使用当前配置的视觉通道" style="width: 100%" clearable>
            <el-option 
              v-for="m in availableModels" 
              :key="`${m.provider}:::${m.model}`" 
              :label="`${m.label} (已启用)`" 
              :value="`${m.provider}:::${m.model}`" 
            />
          </el-select>
        </el-form-item>
      </el-form>

      <div v-if="testImageUrl" class="test-preview-box">
        <img :src="testImageUrl" alt="测试图片" class="preview-img" @error="handleImgError" />
      </div>

      <div v-if="testResult" class="test-result-box">
        <div class="result-meta">
          <el-tag size="small" type="success">{{ testResult.providerUsed }}</el-tag>
          <el-tag size="small" type="info">{{ testResult.modelUsed }}</el-tag>
          <span v-if="testResult.durationMs" class="duration-text">耗时: {{ testResult.durationMs }}ms</span>
        </div>
        <div class="result-content">{{ testResult.description }}</div>
      </div>

      <template #footer>
        <el-button @click="showTestDialog = false">关闭</el-button>
        <el-button type="primary" :loading="testing" @click="runTest">执行视觉识别</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { configAPI } from '@/lib/configApi.js'

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const availableModels = ref([])

const form = ref({
  mode: 'auto',
  provider: '',
  model: '',
  defaultPrompt: '请详细描述这幅图片中的内容，提取主要主体、场景特征和文字信息。'
})

const selectedModelKey = ref('')

const showTestDialog = ref(false)
const testImageUrl = ref('https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800')
const testPrompt = ref('请详细描述这幅图片中的艺术风格、主体对象与色彩氛围。')
const testModelKey = ref('')
const testResult = ref(null)

const activeModelDisplayName = computed(() => {
  if (form.value.mode === 'custom' && form.value.provider && form.value.model) {
    const match = availableModels.value.find(m => m.provider === form.value.provider && m.model === form.value.model)
    return match ? match.label : `${form.value.provider} - ${form.value.model}`
  }
  if (availableModels.value.length > 0) {
    return `自动匹配首选: ${availableModels.value[0].label}`
  }
  return '未检测到可用多模态模型'
})

const handleModelKeyChange = (val) => {
  if (!val) {
    form.value.provider = ''
    form.value.model = ''
    return
  }
  const [provider, model] = val.split(':::')
  form.value.provider = provider
  form.value.model = model
}

const fetchConfig = async () => {
  loading.value = true
  try {
    const res = await configAPI.request('/api/vision/config')
    const data = res.data || res
    if (data.config) {
      form.value = {
        mode: data.config.mode || 'auto',
        provider: data.config.provider || '',
        model: data.config.model || '',
        defaultPrompt: data.config.defaultPrompt || '请详细描述这幅图片中的内容，提取主要主体、场景特征和文字信息。'
      }
      if (form.value.provider && form.value.model) {
        selectedModelKey.value = `${form.value.provider}:::${form.value.model}`
      }
    }
    availableModels.value = data.availableModels || []
  } catch (err) {
    ElMessage.error('加载识图配置失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  try {
    await configAPI.request('/api/vision/config', {
      method: 'PUT',
      body: JSON.stringify(form.value)
    })
    ElMessage.success('识图配置保存成功')
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  } finally {
    saving.value = false
  }
}

const openTestDialog = () => {
  testResult.value = null
  showTestDialog.value = true
}

const handleImgError = () => {
  ElMessage.warning('图片加载失败，请检查 URL 是否有效且支持跨域')
}

const runTest = async () => {
  if (!testImageUrl.value) return ElMessage.warning('请输入测试图片地址')

  testing.value = true
  testResult.value = null
  try {
    let prov = undefined
    let mod = undefined

    if (testModelKey.value) {
      const parts = testModelKey.value.split(':::')
      prov = parts[0]
      mod = parts[1]
    } else if (form.value.mode === 'custom') {
      prov = form.value.provider
      mod = form.value.model
    }

    const res = await configAPI.request('/api/vision/test', {
      method: 'POST',
      body: JSON.stringify({
        image: testImageUrl.value,
        prompt: testPrompt.value || undefined,
        provider: prov,
        model: mod
      })
    })
    const data = res.data || res
    testResult.value = data
    ElMessage.success('识别测试完成！')
  } catch (err) {
    ElMessage.error('识图测试失败: ' + err.message)
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  fetchConfig()
})
</script>

<style scoped lang="scss">
.vision-adapters-view {
  padding: 24px;
  box-sizing: border-box;
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  .header-title {
    h1 {
      font-size: 20px;
      font-weight: 600;
      color: var(--mio-text-primary);
      margin: 0 0 4px 0;
    }

    .header-desc {
      font-size: 13px;
      color: var(--mio-text-secondary);
    }
  }

  .header-actions {
    display: flex;
    gap: 12px;
    white-space: nowrap;
    flex-shrink: 0;
  }
}

.stats-bar {
  display: flex;
  gap: 24px;
  background: var(--mio-bg-card);
  padding: 14px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid var(--mio-border-color-light);

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;

    .stat-label {
      color: var(--mio-text-secondary);
    }
    .stat-value {
      color: var(--mio-text-primary);
      font-weight: 600;
    }
  }
}

.settings-card {
  border-radius: 12px;
  border: 1px solid var(--mio-border-color-light);
  background: var(--mio-bg-card);
  margin-bottom: 20px;

  .card-header-flex {
    display: flex;
    align-items: center;
    gap: 8px;

    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--mio-text-primary);
    }

    .card-subtitle {
      font-size: 12px;
      color: var(--mio-text-secondary);
    }
  }
}

.field-tip {
  font-size: 12px;
  margin-top: 6px;

  &.error {
    color: var(--el-color-danger);
  }
}

.test-preview-box {
  margin-bottom: 14px;
  display: flex;
  justify-content: center;
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: 8px;

  .preview-img {
    max-width: 100%;
    max-height: 200px;
    border-radius: 6px;
    object-fit: contain;
  }
}

.test-result-box {
  background: var(--el-fill-color-light);
  padding: 14px;
  border-radius: 8px;
  margin-top: 12px;

  .result-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;

    .duration-text {
      font-size: 12px;
      color: var(--mio-text-secondary);
      margin-left: auto;
    }
  }

  .result-content {
    font-size: 13px;
    line-height: 1.6;
    color: var(--mio-text-primary);
    white-space: pre-wrap;
    max-height: 240px;
    overflow-y: auto;
  }
}
</style>
