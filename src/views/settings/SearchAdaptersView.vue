<template>
  <div class="search-adapters-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-title">
        <h1>搜索服务配置</h1>
        <div class="header-desc">配置与管理 LLM 联网搜索通道（如 Tavily 等），并配合系统内置兜底引擎实现高可用联网检索</div>
      </div>
      <div class="header-actions">
        <el-button type="primary" :icon="Plus" @click="openAddDialog">添加搜索实例</el-button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">自定义实例：</span>
        <span class="stat-value">{{ adapters.length }} 个</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">主搜索通道：</span>
        <span class="stat-value">{{ defaultAdapterName }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已启用实例：</span>
        <span class="stat-value">{{ enabledCount }} 个</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">兜底搜索：</span>
        <span class="stat-value">DuckDuckGo / Bing / 百度 (常驻)</span>
      </div>
    </div>

    <!-- 内置免配置兜底引擎说明卡片 -->
    <el-card shadow="never" class="fallback-card">
      <div class="fallback-header">
        <div class="fallback-title">
          <el-icon class="shield-icon"><CircleCheckFilled /></el-icon>
          <span>内置免配置兜底搜索引擎</span>
        </div>
        <el-tag type="success" effect="plain" size="small">自动级联保障</el-tag>
      </div>
      <div class="fallback-desc">
        系统已内置无需配置的轻量级搜索引擎。当未配置自定义搜索实例，或主搜索引擎调用失败（如超时、网络波动、Key 配额耗尽）时，系统将按顺序自动无缝级联调用内置兜底引擎，确保 LLM 联网检索始终可用。
      </div>
      <div class="fallback-chips">
        <div v-for="engine in fallbackEnginesList" :key="engine.type" class="fallback-chip">
          <span class="engine-name">{{ engine.name }}</span>
          <span class="engine-badge">内置常驻 · 免 Key</span>
        </div>
      </div>
    </el-card>

    <!-- 实例列表表格 -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="card-header-flex">
          <span class="card-title">自定义搜索实例列表</span>
          <span class="card-subtitle">（用于配置高级 API 搜索引擎，优先作为主通道使用）</span>
        </div>
      </template>
      <el-table :data="adapters" v-loading="loading" style="width: 100%" empty-text="暂无自定义搜索实例，系统将默认使用内置兜底引擎">
        <el-table-column prop="instanceName" label="实例名称" min-width="150" />
        <el-table-column prop="adapterType" label="类型/渠道" width="180">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.adapterType)">{{ getTypeName(row.adapterType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="默认主通道" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="success" effect="dark" size="small">主通道</el-tag>
            <el-button v-else size="small" link type="primary" @click="setDefault(row)">设为主通道</el-button>
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
    <el-dialog v-model="showEditDialog" :title="isEdit ? '编辑搜索配置' : '添加搜索配置'" width="600px">
      <el-form :model="form" label-width="140px" class="adapter-config-form">
        <el-form-item label="实例名称" required>
          <el-input v-model="form.instanceName" placeholder="例如: Tavily-Agent-Search" />
        </el-form-item>
        <el-form-item label="搜索引擎" required>
          <el-select v-model="form.adapterType" placeholder="选择搜索引擎" :disabled="isEdit" style="width: 100%" @change="handleTypeChange">
            <el-option v-for="t in allAvailableTypes" :key="t.type" :label="t.name" :value="t.type" />
          </el-select>
        </el-form-item>

        <!-- 动态配置参数 -->
        <div v-if="currentSchema">
          <el-form-item v-for="(field, key) in currentSchema" :key="key" :required="field.required">
            <template #label>
              <div class="form-item-label">
                <span>{{ field.label }}</span>
                <el-tooltip v-if="field.tip || field.description" :content="field.tip || field.description" placement="top">
                  <el-icon class="help-tooltip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </div>
            </template>

            <!-- 密码输入框 -->
            <el-input 
              v-if="field.secret" 
              v-model="form.configData[key]" 
              type="password" 
              show-password 
              :placeholder="field.placeholder || field.default || '请输入密钥'" 
            />

            <!-- 布尔开关 -->
            <div v-else-if="field.type === 'boolean'" class="switch-row">
              <el-switch v-model="form.configData[key]" />
            </div>

            <!-- 数字输入框 -->
            <el-input-number 
              v-else-if="field.type === 'number'" 
              v-model="form.configData[key]" 
              :min="field.min ?? 1" 
              :max="field.max ?? 100" 
            />

            <!-- 下拉选择框 -->
            <el-select 
              v-else-if="field.options" 
              v-model="form.configData[key]" 
              filterable 
              allow-create 
              default-first-option
              style="width: 100%"
            >
              <el-option v-for="opt in field.options" :key="opt" :label="opt" :value="opt" />
            </el-select>

            <!-- 普通文本框 -->
            <el-input 
              v-else 
              v-model="form.configData[key]" 
              :placeholder="field.placeholder || field.default || ''" 
            />
          </el-form-item>
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

    <!-- 搜索测试弹窗 -->
    <el-dialog v-model="showTestDialog" title="搜索连通性与检索效果测试" width="650px">
      <el-form label-width="90px">
        <el-form-item label="搜索关键词" required>
          <el-input v-model="testQuery" placeholder="例如: MioChat 开源项目架构" @keyup.enter="runTest" />
        </el-form-item>
        <el-form-item label="指定通道">
          <el-select v-model="testAdapterId" placeholder="默认使用主通道 (带自动级联兜底)" style="width: 100%" clearable>
            <el-option-group label="自定义配置实例" v-if="adapters.length > 0">
              <el-option v-for="a in adapters" :key="a.id" :label="`${a.instanceName} (${a.adapterType})`" :value="a.instanceName" />
            </el-option-group>
            <el-option-group label="内置免配置兜底引擎">
              <el-option v-for="engine in fallbackEnginesList" :key="engine.type" :label="`${engine.name} (内置兜底)`" :value="engine.type" />
            </el-option-group>
          </el-select>
        </el-form-item>
      </el-form>

      <div v-if="testResults" class="test-results-list">
        <h4>检索结果 (共 {{ testResults.length }} 条):</h4>
        <div v-for="(item, idx) in testResults" :key="idx" class="search-result-item">
          <a :href="item.url" target="_blank" class="result-title">{{ item.title }}</a>
          <p class="result-snippet">{{ item.snippet }}</p>
          <span class="result-url">{{ item.url }}</span>
        </div>
      </div>

      <template #footer>
        <el-button @click="showTestDialog = false">关闭</el-button>
        <el-button type="primary" :loading="testing" @click="runTest">执行网页搜索</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus, Search, QuestionFilled, CircleCheckFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { configAPI } from '@/lib/configApi.js'

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const adapters = ref([])
const availableTypes = ref([])
const fallbackEngines = ref([])

const defaultTypes = [
  {
    type: 'tavily',
    name: 'Tavily',
    description: '专为 LLM Agent 优化的智能检索与问答增强搜索引擎 API',
    configSchema: {
      apiKey: { type: 'string', label: 'Tavily API Key', required: true, secret: true },
      baseUrl: { type: 'string', label: 'Base URL', default: 'https://api.tavily.com' },
      searchDepth: { type: 'string', label: '搜索深度', default: 'basic', options: ['basic', 'advanced'] },
      topic: { type: 'string', label: '分类主题', default: 'general', options: ['general', 'news', 'finance'] },
      includeAnswer: { type: 'boolean', label: '包含 AI 问答摘要', default: false }
    }
  },
  {
    type: 'volcengine',
    name: '火山引擎',
    description: '火山引擎 Torchlight 开放搜索与中文网页检索 API',
    configSchema: {
      apiKey: { type: 'string', label: 'API Key', required: true, secret: true, placeholder: '请输入火山引擎搜索 API Key' },
      baseUrl: { type: 'string', label: 'Base URL', default: 'https://open.feedcoopapi.com', placeholder: '默认: https://open.feedcoopapi.com' },
      searchType: { type: 'string', label: '搜索类型', default: 'web', options: ['web', 'news', 'academic'] }
    }
  }
]

const fallbackEnginesList = computed(() => {
  if (fallbackEngines.value && fallbackEngines.value.length > 0) {
    return fallbackEngines.value
  }
  return [
    { type: 'duckduckgo', name: 'DuckDuckGo', description: '免注册、免 Key 的轻量化 HTML 搜索' },
    { type: 'bing', name: 'Bing', description: '微软必应搜索网页通道' },
    { type: 'baidu', name: '百度搜索', description: '中文互联网高质量网页检索' }
  ]
})

const allAvailableTypes = computed(() => {
  if (availableTypes.value && availableTypes.value.length > 0) {
    return availableTypes.value
  }
  return defaultTypes
})

const defaultAdapterName = computed(() => {
  const def = adapters.value.find((a) => a.isDefault)
  return def ? `${def.instanceName} (${getTypeName(def.adapterType)})` : '内置兜底搜索 (DuckDuckGo/Bing/百度)'
})

const enabledCount = computed(() => {
  return adapters.value.filter((a) => a.enabled).length
})

const showEditDialog = ref(false)
const isEdit = ref(false)
const currentId = ref(null)

const showTestDialog = ref(false)
const testQuery = ref('MioChat 开源多模态大模型框架')
const testAdapterId = ref('')
const testResults = ref(null)

const form = ref({
  instanceName: '',
  adapterType: 'tavily',
  configData: {},
  isDefault: false,
  enabled: true
})

const currentSchema = computed(() => {
  const meta = allAvailableTypes.value.find(t => t.type === form.value.adapterType)
  return meta?.configSchema || null
})

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
    const res = await configAPI.request('/api/search/adapters')
    const data = res.data || res
    adapters.value = data.adapters || []
    if (data.availableTypes && data.availableTypes.length > 0) {
      availableTypes.value = data.availableTypes
    }
    if (data.fallbackEngines && data.fallbackEngines.length > 0) {
      fallbackEngines.value = data.fallbackEngines
    }
  } catch (err) {
    ElMessage.error('加载搜索适配器失败: ' + (err.message || '请先验证管理员访问码'))
  } finally {
    loading.value = false
  }
}

const openAddDialog = () => {
  isEdit.value = false
  currentId.value = null
  const initType = allAvailableTypes.value[0]?.type || 'tavily'
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
    const url = isEdit.value ? `/api/search/adapters/${currentId.value}` : '/api/search/adapters'
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
    await configAPI.request(`/api/search/adapters/${row.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isDefault: true })
    })
    ElMessage.success(`已设置 ${row.instanceName} 为主搜索通道`)
    await fetchAdapters()
  } catch (err) {
    ElMessage.error('设置主通道失败: ' + err.message)
  }
}

const toggleEnabled = async (row) => {
  try {
    await configAPI.request(`/api/search/adapters/${row.id}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: row.enabled })
    })
    ElMessage.success('状态已同步')
  } catch (err) {
    ElMessage.error('状态更新失败: ' + err.message)
  }
}

const deleteAdapter = (row) => {
  ElMessageBox.confirm(`确定要删除搜索配置「${row.instanceName}」吗？`, '删除确认', {
    type: 'warning'
  }).then(async () => {
    try {
      await configAPI.request(`/api/search/adapters/${row.id}`, { method: 'DELETE' })
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
  testResults.value = null
  showTestDialog.value = true
}

const runTest = async () => {
  if (!testQuery.value) return ElMessage.warning('请输入搜索关键词')

  testing.value = true
  testResults.value = null
  try {
    const res = await configAPI.request('/api/search/test', {
      method: 'POST',
      body: JSON.stringify({
        query: testQuery.value,
        adapterId: testAdapterId.value || undefined,
        count: 5
      })
    })
    const data = res.data || res
    testResults.value = data.results || []
    if (testResults.value.length > 0) {
      ElMessage.success(`搜索完成，获取到 ${testResults.value.length} 条结果`)
    } else {
      ElMessage.warning('未获取到相关搜索结果')
    }
  } catch (err) {
    ElMessage.error('搜索测试失败: ' + err.message)
  } finally {
    testing.value = false
  }
}

const getTypeTagType = (type) => {
  if (type === 'tavily') return 'primary'
  if (type === 'volcengine') return 'warning'
  if (type === 'duckduckgo') return 'success'
  if (type === 'bing') return 'info'
  if (type === 'baidu') return 'info'
  return 'info'
}

const getTypeName = (type) => {
  const match = allAvailableTypes.value.find(t => t.type === type)
  if (match) return match.name
  const fb = fallbackEnginesList.value.find(t => t.type === type)
  return fb ? fb.name : type
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
.search-adapters-view {
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

.fallback-card {
  border-radius: 12px;
  border: 1px solid var(--mio-border-color-light);
  background: var(--mio-bg-card);
  margin-bottom: 20px;

  .fallback-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .fallback-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      color: var(--mio-text-primary);

      .shield-icon {
        color: var(--el-color-success);
        font-size: 16px;
      }
    }
  }

  .fallback-desc {
    font-size: 13px;
    color: var(--mio-text-secondary);
    line-height: 1.5;
    margin-bottom: 12px;
  }

  .fallback-chips {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;

    .fallback-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--el-fill-color-light);
      border-radius: 8px;
      border: 1px solid var(--el-border-color-lighter);
      font-size: 12px;

      .engine-name {
        font-weight: 600;
        color: var(--mio-text-primary);
      }

      .engine-badge {
        color: var(--el-color-success);
        font-size: 11px;
      }
    }
  }
}

.table-card {
  border-radius: 12px;
  border: 1px solid var(--mio-border-color-light);
  background: var(--mio-bg-card);

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

.test-results-list {
  margin-top: 16px;
  max-height: 350px;
  overflow-y: auto;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}

.search-result-item {
  padding: 10px;
  margin-bottom: 10px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.result-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-color-primary);
  text-decoration: none;
}

.result-snippet {
  margin: 6px 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.result-url {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  word-break: break-all;
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
