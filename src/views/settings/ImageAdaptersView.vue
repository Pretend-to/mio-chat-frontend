<template>
  <div class="image-adapters-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-title">
        <h1>生图服务配置</h1>
        <div class="header-desc">配置生图厂商（Google Gemini Nano Banana、OpenAI、硅基流动 FLUX、火山引擎、土块绘图、SD WebUI 等），支持 AnyUI 异步渲染</div>
      </div>
      <div class="header-actions">
        <el-button type="primary" :icon="Plus" @click="openAddDialog">添加生图实例</el-button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">实例总数：</span>
        <span class="stat-value">{{ adapters.length }} 个</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">当前默认：</span>
        <span class="stat-value">{{ defaultAdapterName }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已启用：</span>
        <span class="stat-value">{{ enabledCount }} 个</span>
      </div>
    </div>

    <!-- 实例列表表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="adapters" v-loading="loading" style="width: 100%">
        <el-table-column prop="instanceName" label="实例名称" min-width="150" />
        <el-table-column prop="adapterType" label="类型/厂商" width="190">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.adapterType)">{{ getTypeName(row.adapterType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="默认实例" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="success" effect="dark" size="small">默认</el-tag>
            <el-button v-else size="small" link type="primary" @click="setDefault(row)">设为默认</el-button>
          </template>
        </el-table-column>
        <el-table-column label="启用状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="toggleEnabled(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="right">
          <template #default="{ row }">
            <el-button size="small" type="success" link @click="openTestDialog(row)">测试</el-button>
            <el-button size="small" type="primary" link @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" link @click="deleteAdapter(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑/添加弹窗 -->
    <el-dialog v-model="showEditDialog" :title="isEdit ? '编辑生图配置' : '添加生图配置'" width="620px">
      <el-form :model="form" label-width="140px" class="adapter-config-form">
        <el-form-item label="实例名称" required>
          <el-input v-model="form.instanceName" placeholder="例如: Google-NanoBanana-2" />
        </el-form-item>
        <el-form-item label="厂商类型" required>
          <el-select v-model="form.adapterType" placeholder="选择生图厂商" :disabled="isEdit" style="width: 100%" @change="handleTypeChange">
            <el-option v-for="t in allAvailableTypes" :key="t.type" :label="t.name" :value="t.type" />
          </el-select>
        </el-form-item>

        <!-- 动态配置参数 -->
        <div v-if="currentSchema">
          <template v-for="(field, key) in currentSchema" :key="key">
            <template v-if="isFieldVisible(key, field)">
              <!-- 密码输入框 -->
              <el-form-item v-if="field.secret" :required="field.required">
                <template #label>
                  <div class="form-item-label">
                    <span>{{ field.label }}</span>
                    <el-tooltip v-if="field.tip || field.description" :content="field.tip || field.description" placement="top">
                      <el-icon class="help-tooltip-icon"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </div>
                </template>
                <el-input 
                  v-model="form.configData[key]" 
                  type="password" 
                  show-password 
                  :placeholder="field.placeholder || field.default || '请输入密钥'" 
                />
              </el-form-item>

              <!-- 布尔开关 -->
              <el-form-item v-else-if="field.type === 'boolean'">
                <template #label>
                  <div class="form-item-label">
                    <span>{{ field.label }}</span>
                    <el-tooltip v-if="field.tip || field.description" :content="field.tip || field.description" placement="top">
                      <el-icon class="help-tooltip-icon"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </div>
                </template>
                <div class="switch-row">
                  <el-switch v-model="form.configData[key]" />
                </div>
              </el-form-item>

              <!-- 数字输入 -->
              <el-form-item v-else-if="field.type === 'number'" :required="field.required">
                <template #label>
                  <div class="form-item-label">
                    <span>{{ field.label }}</span>
                    <el-tooltip v-if="field.tip || field.description" :content="field.tip || field.description" placement="top">
                      <el-icon class="help-tooltip-icon"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </div>
                </template>
                <el-input-number v-model="form.configData[key]" :min="field.min ?? 1" :max="field.max ?? 100" />
              </el-form-item>

              <!-- 模型选择输入框 (支持在线拉取 /models) -->
              <el-form-item v-else-if="key === 'model'" :required="field.required">
                <template #label>
                  <div class="form-item-label">
                    <span>{{ field.label }}</span>
                    <el-tooltip v-if="field.tip || field.description" :content="field.tip || field.description" placement="top">
                      <el-icon class="help-tooltip-icon"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </div>
                </template>
                <div style="display: flex; gap: 8px; width: 100%">
                  <el-select 
                    v-model="form.configData.model" 
                    filterable 
                    allow-create 
                    default-first-option
                    placeholder="可从下拉选择或直接输入模型名称"
                    style="flex: 1"
                  >
                    <el-option 
                      v-for="opt in getModelOptions(field)" 
                      :key="typeof opt === 'string' ? opt : opt.id" 
                      :label="typeof opt === 'string' ? opt : opt.name" 
                      :value="typeof opt === 'string' ? opt : opt.id" 
                    />
                  </el-select>
                  <el-button 
                    :icon="Refresh" 
                    :loading="fetchingModels" 
                    title="请求 API 基础端点拉取在线可用模型列表"
                    @click="fetchRemoteModels"
                  >
                    拉取模型
                  </el-button>
                </div>
              </el-form-item>

              <!-- 其他选项下拉框 -->
              <el-form-item v-else-if="field.options" :required="field.required">
                <template #label>
                  <div class="form-item-label">
                    <span>{{ field.label }}</span>
                    <el-tooltip v-if="field.tip || field.description" :content="field.tip || field.description" placement="top">
                      <el-icon class="help-tooltip-icon"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </div>
                </template>
                <el-select 
                  v-model="form.configData[key]" 
                  filterable 
                  allow-create 
                  default-first-option
                  style="width: 100%"
                >
                  <el-option v-for="opt in field.options" :key="opt" :label="opt" :value="opt" />
                </el-select>
              </el-form-item>

              <!-- 普通文本框 -->
              <el-form-item v-else :required="field.required">
                <template #label>
                  <div class="form-item-label">
                    <span>{{ field.label }}</span>
                    <el-tooltip v-if="field.tip || field.description" :content="field.tip || field.description" placement="top">
                      <el-icon class="help-tooltip-icon"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </div>
                </template>
                <el-input 
                  v-model="form.configData[key]" 
                  :placeholder="field.placeholder || field.default || ''" 
                />
              </el-form-item>
            </template>
          </template>
        </div>

        <el-form-item label="设为默认">
          <div class="switch-row">
            <el-switch v-model="form.isDefault" />
          </div>
        </el-form-item>
        <el-form-item label="启用实例">
          <div class="switch-row">
            <el-switch v-model="form.enabled" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAdapter">保存</el-button>
      </template>
    </el-dialog>

    <!-- 生图测试弹窗 -->
    <el-dialog v-model="showTestDialog" title="生图连通性与画风体验测试" width="650px">
      <el-form label-width="110px">
        <el-form-item label="提示词" required>
          <el-input v-model="testPrompt" placeholder="例如: A serene Japanese garden with cherry blossoms, digital art 8k" @keyup.enter="runTest" />
        </el-form-item>
        <el-form-item label="参考图(可选)">
          <el-input v-model="testImage" placeholder="支持输入图片 URL 或 Base64 (图生图模式)" clearable />
        </el-form-item>
        <el-form-item label="指定通道">
          <el-select v-model="testAdapterId" placeholder="默认使用系统默认生图实例" style="width: 100%" clearable>
            <el-option v-for="a in adapters" :key="a.id" :label="`${a.instanceName} (${a.adapterType})`" :value="a.instanceName" />
          </el-select>
        </el-form-item>
      </el-form>

      <div v-if="testResult" class="test-results-list">
        <h4>生成结果预览:</h4>
        <div class="search-result-item">
          <img v-if="testResult.url || testResult.base64" :src="testResult.url || testResult.base64" alt="Generated image" class="preview-image" />
          <a v-if="testResult.url" :href="testResult.url" target="_blank" class="result-title">查看高清源图地址</a>
          <p v-if="testResult.revisedPrompt" class="result-snippet">优化提示词: {{ testResult.revisedPrompt }}</p>
        </div>
      </div>

      <template #footer>
        <el-button @click="showTestDialog = false">关闭</el-button>
        <el-button type="primary" :loading="testing" @click="runTest">发送生图请求</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus, Picture, Refresh, QuestionFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { configAPI } from '@/lib/configApi.js'

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const fetchingModels = ref(false)
const adapters = ref([])
const availableTypes = ref([])
const dynamicModelsMap = ref({})

const defaultTypes = [
  {
    type: 'google-image',
    name: 'Google Gemini',
    description: 'Google 原生图像生成（支持 AI Studio 与企业级 Vertex AI 双通道）',
    configSchema: {
      platform: {
        type: 'string',
        label: '接入平台',
        default: 'aistudio',
        options: ['aistudio', 'vertex']
      },
      apiKey: {
        type: 'string',
        label: 'API Key',
        required: true,
        secret: true
      },
      projectId: {
        type: 'string',
        label: '项目 ID',
        placeholder: 'Google Cloud 项目 ID (Vertex 必填)',
        default: ''
      },
      location: {
        type: 'string',
        label: '部署区域',
        default: 'us-central1',
        options: ['us-central1', 'us-east4', 'europe-west4', 'asia-northeast1', 'asia-east1', 'global']
      },
      expressMode: {
        type: 'boolean',
        label: '启用 Express 模式',
        tip: '使用 API Key 直连（关闭则使用 Google Cloud ADC 凭证）',
        default: true
      },
      baseUrl: {
        type: 'string',
        label: 'Base URL',
        placeholder: '留空使用默认基础地址',
        default: 'https://generativelanguage.googleapis.com'
      },
      model: {
        type: 'string',
        label: '模型名称',
        default: 'gemini-3.1-flash-image',
        options: [
          'gemini-3.1-flash-image',
          'gemini-3.1-flash-lite-image',
          'gemini-2.5-flash-image',
          'gemini-2.5-flash',
          'gemini-2.5-pro',
          'imagen-3.0-generate-002',
          'imagen-3.0-fast-generate-001'
        ]
      }
    }
  },
  {
    type: 'openai-image',
    name: 'OpenAI',
    description: '支持最新 GPT Image 2、GPT Image 1.5、DALL-E 3 及兼容网关',
    configSchema: {
      apiKey: { type: 'string', label: 'API Key', required: true, secret: true },
      baseUrl: { type: 'string', label: 'Base URL', default: 'https://api.openai.com/v1' },
      model: { 
        type: 'string', 
        label: '模型名称', 
        default: 'gpt-image-2', 
        options: ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1.5-mini', 'dall-e-3', 'dall-e-2'] 
      }
    }
  },
  {
    type: 'siliconflow-image',
    name: '硅基流动',
    description: '支持 FLUX.1-schnell、FLUX.1-dev、SD 3.5、Kolors 等',
    configSchema: {
      apiKey: { type: 'string', label: 'API Key', required: true, secret: true },
      baseUrl: { type: 'string', label: 'Base URL', default: 'https://api.siliconflow.cn/v1' },
      model: { 
        type: 'string', 
        label: '模型名称', 
        default: 'black-forest-labs/FLUX.1-schnell',
        options: [
          'black-forest-labs/FLUX.1-schnell',
          'black-forest-labs/FLUX.1-dev',
          'stabilityai/stable-diffusion-3-5-large',
          'Kwai-Kolors/Kolors'
        ] 
      }
    }
  },
  {
    type: 'volcengine-image',
    name: '火山引擎',
    description: '字节跳动火山引擎低延迟生图 API',
    configSchema: {
      apiKey: { type: 'string', label: 'API Key (ARK)', required: true, secret: true },
      baseUrl: { type: 'string', label: 'Base URL', default: 'https://ark.cn-beijing.volces.com/api/v3' },
      model: { 
        type: 'string', 
        label: '模型接入点/名称', 
        default: 'doubao-seedream-5-0-260128',
        options: [
          'doubao-seedream-5-0-260128',
          'doubao-seedream-4.5',
          'cv-seadream-v1'
        ] 
      }
    }
  },
  {
    type: 'tukuai-image',
    name: '土块绘图',
    description: '土块 API (datukuai.top) 动漫二次元专属绘图服务',
    configSchema: {
      apiKey: { type: 'string', label: '土块 API Token', required: true, secret: true, default: '' },
      bindQQ: { type: 'string', label: '绑定 QQ 号', required: true, default: '' },
      baseUrl: { type: 'string', label: 'API Base URL', default: 'http://datukuai.top:1450' },
      sampler: { type: 'string', label: '采样器 (Sampler)', default: 'Euler a', options: ['Euler a', 'Euler', 'DPM++ 2M Karras', 'DDIM'] },
      steps: { type: 'number', label: '生成步数 (Steps)', default: 23 },
      cfg_scale: { type: 'number', label: '提示词相关性 (CFG Scale)', default: 9 },
      negativePrompt: {
        type: 'string',
        label: '默认负向词',
        default: '(easynegative:1.1), (verybadimagenegative_v1.3:1), (low quality:1.2), (worst quality:1.2)'
      }
    }
  },
  {
    type: 'sd-webui',
    name: 'Stable Diffusion',
    description: '本地部署的 SD WebUI (Automatic1111) txt2img 接口',
    configSchema: {
      baseUrl: { type: 'string', label: 'WebUI 地址', default: 'http://127.0.0.1:7860' },
      steps: { type: 'number', label: '采样步数', default: 20 },
      samplerName: { type: 'string', label: '采样器', default: 'DPM++ 2M Karras' },
      defaultNegativePrompt: { type: 'string', label: '默认负向词', default: 'blurry, low quality, bad anatomy' }
    }
  }
]

const allAvailableTypes = computed(() => {
  if (availableTypes.value && availableTypes.value.length > 0) {
    return availableTypes.value
  }
  return defaultTypes
})

const defaultAdapterName = computed(() => {
  const def = adapters.value.find((a) => a.isDefault)
  return def ? `${def.instanceName} (${getTypeName(def.adapterType)})` : '未指定'
})

const enabledCount = computed(() => {
  return adapters.value.filter((a) => a.enabled).length
})

const showEditDialog = ref(false)
const isEdit = ref(false)
const currentId = ref(null)

const showTestDialog = ref(false)
const testPrompt = ref('A serene Japanese garden with cherry blossoms, digital art 8k')
const testImage = ref('')
const testAdapterId = ref('')
const testResult = ref(null)

const form = ref({
  instanceName: '',
  adapterType: 'google-image',
  configData: {},
  isDefault: false,
  enabled: true
})

const currentSchema = computed(() => {
  const meta = allAvailableTypes.value.find(t => t.type === form.value.adapterType)
  return meta?.configSchema || null
})

const isFieldVisible = (key, field) => {
  if (form.value.adapterType === 'google-image') {
    const isVertex = form.value.configData?.platform === 'vertex'
    if (!isVertex && (key === 'projectId' || key === 'location' || key === 'expressMode' || key === 'blockExpress')) {
      return false
    }
  }
  return true
}

const getModelOptions = (field) => {
  const dynamic = dynamicModelsMap.value[form.value.adapterType]
  if (dynamic && dynamic.length > 0) {
    return dynamic
  }
  return field.options || []
}

const fetchRemoteModels = async () => {
  fetchingModels.value = true
  try {
    const res = await configAPI.request('/api/images/models', {
      method: 'POST',
      body: JSON.stringify({
        adapterType: form.value.adapterType,
        ...form.value.configData
      })
    })
    const data = res.data || res
    const list = data.models || []
    if (list.length > 0) {
      dynamicModelsMap.value[form.value.adapterType] = list
      ElMessage.success(`成功从接口拉取到 ${list.length} 个模型！`)
    } else {
      ElMessage.warning('接口未返回模型列表，请手动输入模型名称')
    }
  } catch (err) {
    ElMessage.error('拉取模型失败: ' + err.message)
  } finally {
    fetchingModels.value = false
  }
}

const handleTypeChange = () => {
  const schema = currentSchema.value
  if (!schema) return
  const newConfig = {}
  for (const [k, field] of Object.entries(schema)) {
    if (field.default !== undefined) {
      newConfig[k] = field.default
    }
  }
  form.value.configData = newConfig
}

const fetchAdapters = async () => {
  loading.value = true
  try {
    const res = await configAPI.request('/api/images/adapters')
    const data = res.data || res
    adapters.value = data.adapters || []
    if (data.availableTypes && data.availableTypes.length > 0) {
      availableTypes.value = data.availableTypes
    }
  } catch (err) {
    ElMessage.error('加载生图适配器失败: ' + (err.message || '请先验证管理员访问码'))
  } finally {
    loading.value = false
  }
}

const openAddDialog = () => {
  isEdit.value = false
  currentId.value = null
  const initType = allAvailableTypes.value[0]?.type || 'google-image'
  form.value = {
    instanceName: '',
    adapterType: initType,
    configData: {},
    isDefault: adapters.value.length === 0,
    enabled: true
  }
  handleTypeChange()
  showEditDialog.value = true
}

const openEditDialog = (row) => {
  isEdit.value = true
  currentId.value = row.id
  let parsedConfig = {}
  try {
    parsedConfig = typeof row.configData === 'string' ? JSON.parse(row.configData) : (row.configData || {})
  } catch {}

  form.value = {
    instanceName: row.instanceName,
    adapterType: row.adapterType,
    configData: parsedConfig,
    isDefault: row.isDefault,
    enabled: row.enabled
  }
  showEditDialog.value = true
}

const saveAdapter = async () => {
  if (!form.value.instanceName) {
    return ElMessage.warning('请输入实例名称')
  }

  saving.value = true
  try {
    const url = isEdit.value ? `/api/images/adapters/${currentId.value}` : '/api/images/adapters'
    const method = isEdit.value ? 'PUT' : 'POST'
    await configAPI.request(url, {
      method,
      body: JSON.stringify(form.value)
    })
    ElMessage.success(isEdit.value ? '配置更新成功' : '配置创建成功')
    showEditDialog.value = false
    await fetchAdapters()
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  } finally {
    saving.value = false
  }
}

const setDefault = async (row) => {
  try {
    await configAPI.request(`/api/images/adapters/${row.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isDefault: true })
    })
    ElMessage.success(`已设置 ${row.instanceName} 为默认生图实例`)
    await fetchAdapters()
  } catch (err) {
    ElMessage.error('设置默认失败: ' + err.message)
  }
}

const toggleEnabled = async (row) => {
  try {
    await configAPI.request(`/api/images/adapters/${row.id}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: row.enabled })
    })
    ElMessage.success('状态已同步')
  } catch (err) {
    ElMessage.error('状态更新失败: ' + err.message)
  }
}

const deleteAdapter = (row) => {
  ElMessageBox.confirm(`确定要删除生图配置「${row.instanceName}」吗？`, '删除确认', {
    type: 'warning'
  }).then(async () => {
    try {
      await configAPI.request(`/api/images/adapters/${row.id}`, { method: 'DELETE' })
      ElMessage.success('配置已删除')
      await fetchAdapters()
    } catch (err) {
      ElMessage.error('删除失败: ' + err.message)
    }
  })
}

const openTestDialog = (row = null) => {
  if (row && row.instanceName) {
    testAdapterId.value = row.instanceName
  }
  testResult.value = null
  showTestDialog.value = true
}

const runTest = async () => {
  if (!testPrompt.value) return ElMessage.warning('请输入提示词')

  testing.value = true
  testResult.value = null
  try {
    const res = await configAPI.request('/api/images/test', {
      method: 'POST',
      body: JSON.stringify({
        prompt: testPrompt.value,
        image: testImage.value || undefined,
        adapterId: testAdapterId.value || undefined
      })
    })
    const data = res.data || res
    const img = data.results?.[0]
    if (img) {
      testResult.value = img
      ElMessage.success('生成成功！')
    } else {
      ElMessage.warning('未能生成有效的图片')
    }
  } catch (err) {
    ElMessage.error('测试失败: ' + err.message)
  } finally {
    testing.value = false
  }
}

const getTypeTagType = (type) => {
  if (type.includes('google')) return 'success'
  if (type.includes('openai')) return 'primary'
  if (type.includes('silicon')) return 'purple'
  if (type.includes('volc')) return 'warning'
  if (type.includes('sd')) return 'info'
  return 'info'
}

const getTypeName = (type) => {
  const match = allAvailableTypes.value.find(t => t.type === type)
  return match ? match.name : type
}

const formatDate = (str) => {
  if (!str) return '-'
  return new Date(str).toLocaleString()
}

onMounted(() => {
  fetchAdapters()
})
</script>

<style scoped lang="scss">
.image-adapters-view {
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;

  .header-title {
    flex: 1;
    min-width: 0;

    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: var(--mio-text-primary);
    }

    .header-desc {
      margin-top: 6px;
      color: var(--mio-text-secondary);
      font-size: 13px;
      line-height: 1.4;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    white-space: nowrap;

    .el-button {
      margin: 0;
    }
  }
}

.stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 14px 20px;
  background: var(--mio-bg-hover);
  border-radius: 12px;
  margin-bottom: 24px;
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

.table-card {
  border-radius: 12px;
  border: 1px solid var(--mio-border-color-light);
  background: var(--mio-bg-card);
}
.test-results-list {
  margin-top: 16px;
  max-height: 450px;
  overflow-y: auto;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}
.search-result-item {
  padding: 10px;
  margin-bottom: 10px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.preview-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 6px;
  object-fit: contain;
}
.result-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-primary);
  text-decoration: none;
}
.form-item-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;

  .help-tooltip-icon {
    color: var(--mio-text-secondary);
    font-size: 14px;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

.switch-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  width: 100%;
}
</style>
