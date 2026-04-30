<template>
  <div class="logs-view">
    <div class="logs-header">
      <h2>日志管理</h2>
      <p class="logs-description">实时查看系统日志，支持搜索、过滤和导出功能</p>
    </div>

    <!-- 连接状态 -->
    <el-card class="connection-card" shadow="never">
      <div class="connection-status">
        <div class="status-indicator" :class="{ 'connected': isConnected, 'disconnected': !isConnected }">
          <div class="status-dot"></div>
          <span>{{ isConnected ? '已连接' : '未连接' }}</span>
        </div>
        <div class="connection-info">
          <span v-if="isConnected && stats">
            服务运行时间: {{ formatUptime(stats.service?.uptime) }} | 
            总日志数: {{ stats.service?.totalLogsSent || 0 }}
          </span>
          <span v-else-if="isConnected">
            连接正常，正在加载日志...
          </span>
          <span v-else>
            请检查网络连接和服务器状态
          </span>
        </div>
      </div>
      
      <!-- 调试信息 -->
      <div class="debug-info" style="margin-top: 12px; font-size: 12px; color: #909399;">
        <div>连接状态: {{ isConnected ? '✅ 已连接' : '❌ 未连接' }}</div>
        <div>日志数量: {{ logs.length }} 条</div>
        <div>过滤后日志数量: {{ filteredLogs.length }} 条</div>
        <div>logStore是否初始化: {{ logStore.isInitialized ? '是' : '否' }}</div>
      </div>
    </el-card>

    <!-- 控制面板 -->
    <el-card class="control-panel" shadow="never">
      <div class="control-row">
        <div class="control-group">
          <el-button @click="clearLogs" :disabled="logs.length === 0">
            清空日志
          </el-button>
          <el-button @click="exportLogs" :disabled="logs.length === 0">
            导出日志
          </el-button>
        </div>
        
        <div class="filter-group">
          <el-select v-model="filterLevel" placeholder="日志级别" style="width: 120px">
            <el-option label="全部" value=""></el-option>
            <el-option label="ERROR" value="ERROR"></el-option>
            <el-option label="WARN" value="WARN"></el-option>
            <el-option label="MARK" value="MARK"></el-option>
            <el-option label="INFO" value="INFO"></el-option>
            <el-option label="DEBUG" value="DEBUG"></el-option>
          </el-select>
          
          <el-select v-model="filterModule" placeholder="模块" style="width: 120px">
            <el-option label="全部" value=""></el-option>
            <el-option label="llm" value="llm"></el-option>
            <el-option label="onebot" value="onebot"></el-option>
            <el-option label="system" value="system"></el-option>
          </el-select>
          
          <el-input
            v-model="searchKeyword"
            placeholder="搜索关键词"
            style="width: 200px"
            clearable
            @keyup.enter="performSearch"
          >
            <template #append>
              <el-button @click="performSearch" :icon="Search"></el-button>
            </template>
          </el-input>
        </div>
      </div>
    </el-card>

    <!-- 日志列表 -->
    <el-card class="logs-container" shadow="never">
      <div class="logs-header-row">
        <span class="logs-count">共 {{ filteredLogs.length }} 条日志</span>
        <div class="logs-controls">
          <el-switch
            v-model="autoScroll"
            active-text="自动滚动"
            inactive-text=""
          />
          <el-button 
            size="small" 
            @click="scrollToBottom"
            :disabled="filteredLogs.length === 0"
          >
            滚动到底部
          </el-button>
        </div>
      </div>
      
      <div 
        ref="logsContainer" 
        class="logs-list"
        @scroll="handleScroll"
      >
        <div 
          v-for="log in filteredLogs" 
          :key="log.id"
          class="log-item"
          :class="[`level-${log.level.toLowerCase()}`, { 'highlighted': log.highlighted }]"
        >
          <div class="log-header">
            <span class="log-timestamp">{{ formatTimestamp(log.timestamp) }}</span>
            <span class="log-level" :class="`level-${log.level.toLowerCase()}`">{{ log.level }}</span>
            <span class="log-module">{{ log.module }}</span>
            <span v-if="log.caller" class="log-caller">{{ log.caller }}</span>
          </div>
          <div class="log-message">
            <span v-if="log.extra?.type === 'json'" class="json-message" @click="openJsonDialog(log)">
              {{ getJsonSummary(log) }}
              <el-icon class="json-expand-icon"><View /></el-icon>
            </span>
            <span v-else-if="isObjectMessage(log.message)" class="object-message" @click="openObjectDialog(log)">
              {{ getObjectSummary(log.message) }}
              <el-icon class="json-expand-icon"><View /></el-icon>
            </span>
            <span v-else v-html="log.message"></span>
          </div>
          <div v-if="log.extra && Object.keys(getDisplayExtra(log.extra)).length > 0" class="log-extra">
            <el-tag 
              v-for="(value, key) in getDisplayExtra(log.extra)" 
              :key="key"
              size="small"
              :type="isObjectValue(value) ? 'warning' : 'info'"
              class="log-extra-tag"
              :class="{ 'clickable': isObjectValue(value) }"
              :title="getTagTitle(key, value)"
              @click="isObjectValue(value) ? openExtraObjectDialog(key, value, log) : null"
            >
              {{ key }}: {{ formatTagValue(value) }}
            </el-tag>
          </div>
        </div>
        
        <div v-if="filteredLogs.length === 0" class="empty-logs">
          <el-empty description="暂无日志数据" />
        </div>
      </div>
    </el-card>

    <!-- JSON 查看对话框 -->
    <el-dialog 
      v-model="jsonDialogVisible" 
      :title="getDialogTitle()" 
      width="800px" 
      class="json-dialog"
    >
      <div class="json-content">
        <div class="json-header">
          <span class="json-timestamp">{{ selectedLog?.timestamp }}</span>
          <span class="json-level" :class="`level-${selectedLog?.level?.toLowerCase()}`">
            {{ selectedLog?.level }}
          </span>
          <span class="json-module">{{ selectedLog?.module }}</span>
        </div>
        <div class="json-body">
          <pre class="json-pre">{{ formatJsonContent(selectedLog) }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="copyJsonContent">复制内容</el-button>
        <el-button type="primary" @click="jsonDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 导出对话框 -->
    <el-dialog v-model="exportDialogVisible" title="导出日志" width="500px">
      <el-form :model="exportForm" label-width="100px">
        <el-form-item label="导出格式">
          <el-radio-group v-model="exportForm.format">
            <el-radio label="json">JSON</el-radio>
            <el-radio label="csv">CSV</el-radio>
            <el-radio label="txt">TXT</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="最大记录数">
          <el-input-number 
            v-model="exportForm.maxRecords" 
            :min="1" 
            :max="50000"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="包含元数据">
          <el-switch v-model="exportForm.includeMetadata" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmExport" :loading="exportLoading">
          导出
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { useLogStore } from '@/stores/logStore.js'
import { Search, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

// 使用日志store
const logStore = useLogStore()

// 从store中获取数据和方法
const logs = computed(() => {
  const logsData = logStore.logs || []
  console.log('LogsView: 当前日志数量:', logsData.length)
  return logsData
})
const isConnected = computed(() => logStore.isConnected)
const stats = computed(() => logStore.stats)
const search = logStore.search
const exportLogsData = logStore.exportLogs
const getStats = logStore.getStats
const clearLogsData = logStore.clearLogs

// 过滤和搜索
const filterLevel = ref('')
const filterModule = ref('')
const searchKeyword = ref('')

// UI 状态
const autoScroll = ref(true)
const logsContainer = ref(null)
const exportDialogVisible = ref(false)
const exportLoading = ref(false)
const jsonDialogVisible = ref(false)
const selectedLog = ref(null)
const extraObjectKey = ref(null)

// 导出表单
const exportForm = ref({
  format: 'json',
  maxRecords: 10000,
  includeMetadata: true
})

// 过滤后的日志
const filteredLogs = computed(() => {
  let filtered = logs.value || []
  console.log('filteredLogs computed 被调用，原始日志数量:', filtered.length)

  if (filterLevel.value) {
    filtered = filtered.filter(log => log.level === filterLevel.value)
  }

  if (filterModule.value) {
    filtered = filtered.filter(log => log.module === filterModule.value)
  }

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    filtered = filtered.filter(log => 
      log.message.toLowerCase().includes(keyword) ||
      log.module.toLowerCase().includes(keyword) ||
      (log.caller && log.caller.toLowerCase().includes(keyword))
    )
  }

  return filtered
})



// 清空日志
const clearLogs = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有日志吗？', '确认清空', {
      type: 'warning'
    })
    clearLogsData()
    ElMessage.success('日志已清空')
  } catch (error) {
    // 用户取消
  }
}

// 执行搜索
const performSearch = async () => {
  if (!searchKeyword.value.trim()) {
    return
  }

  try {
    const results = await search({
      keyword: searchKeyword.value,
      level: filterLevel.value || undefined,
      modules: filterModule.value ? [filterModule.value] : [],
      page: 1,
      pageSize: 100
    })
    
    if (results.success) {
      ElMessage.success(`找到 ${results.data.total} 条匹配的日志`)
    }
  } catch (error) {
    ElMessage.error('搜索失败: ' + error.message)
  }
}

// 导出日志
const exportLogs = () => {
  exportDialogVisible.value = true
}

// 确认导出
const confirmExport = async () => {
  exportLoading.value = true
  
  try {
    const result = await exportLogsData({
      format: exportForm.value.format,
      level: filterLevel.value || undefined,
      modules: filterModule.value ? [filterModule.value] : [],
      keyword: searchKeyword.value || undefined,
      maxRecords: exportForm.value.maxRecords,
      includeMetadata: exportForm.value.includeMetadata
    })
    
    if (result.success) {
      // 下载文件
      const blob = new Blob([result.data.data], {
        type: getContentType(result.data.format)
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${result.data.format}`
      a.click()
      
      URL.revokeObjectURL(url)
      ElMessage.success('导出成功')
      exportDialogVisible.value = false
    }
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  } finally {
    exportLoading.value = false
  }
}

// 获取内容类型
const getContentType = (format) => {
  const types = {
    json: 'application/json',
    csv: 'text/csv',
    txt: 'text/plain'
  }
  return types[format] || 'text/plain'
}

// 格式化时间戳
const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

// 格式化运行时间
const formatUptime = (uptime) => {
  if (!uptime) return '未知'
  
  const seconds = Math.floor(uptime / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}天${hours % 24}小时`
  } else if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟`
  } else {
    return `${seconds}秒`
  }
}

// 截断文本
const truncateText = (text, maxLength) => {
  if (!text) return ''
  const str = String(text)
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

// 获取 JSON 摘要
const getJsonSummary = (log) => {
  try {
    const jsonObj = log.extra?.originalObject
    if (!jsonObj || typeof jsonObj !== 'object') {
      return 'JSON: 无效对象'
    }
    
    const keys = Object.keys(jsonObj)
    if (keys.length === 0) {
      return 'JSON: {}'
    } else if (keys.length === 1) {
      return `JSON: { ${keys[0]}: ... }`
    } else {
      return `JSON: { ${keys[0]}, ${keys[1]}${keys.length > 2 ? `, +${keys.length - 2} more` : ''} }`
    }
  } catch (error) {
    return 'JSON: 解析错误'
  }
}

// 格式化 JSON 内容
const formatJsonContent = (log) => {
  try {
    const jsonObj = log.extra?.originalObject
    if (!jsonObj) {
      return '无 JSON 数据'
    }
    return JSON.stringify(jsonObj, null, 2)
  } catch (error) {
    return '格式化失败'
  }
}

// 打开 JSON 对话框
const openJsonDialog = (log) => {
  selectedLog.value = log
  extraObjectKey.value = null // 重置 extra 对象键名
  jsonDialogVisible.value = true
}

// 获取对话框标题
const getDialogTitle = () => {
  if (extraObjectKey.value) {
    return `Extra 字段详情: ${extraObjectKey.value}`
  }
  
  if (selectedLog.value?.extra?.type === 'json') {
    return 'JSON 日志详情'
  }
  
  return '对象详情'
}

// 复制 JSON 内容
const copyJsonContent = async () => {
  if (!selectedLog.value) return
  
  try {
    const formattedJson = formatJsonContent(selectedLog.value)
    await navigator.clipboard.writeText(formattedJson)
    ElMessage.success('内容已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败: ' + error.message)
  }
}

// 判断 message 是否为对象
const isObjectMessage = (message) => {
  return typeof message === 'object' && message !== null
}

// 获取对象消息的摘要
const getObjectSummary = (message) => {
  try {
    if (Array.isArray(message)) {
      return `Array[${message.length}]: ${message.length > 0 ? JSON.stringify(message[0]).substring(0, 30) + '...' : 'empty'}`
    }
    
    const keys = Object.keys(message)
    if (keys.length === 0) {
      return 'Object: {}'
    } else if (keys.length === 1) {
      return `Object: { ${keys[0]}: ... }`
    } else {
      return `Object: { ${keys[0]}, ${keys[1]}${keys.length > 2 ? `, +${keys.length - 2} more` : ''} }`
    }
  } catch (error) {
    return 'Object: 解析错误'
  }
}

// 打开对象消息对话框
const openObjectDialog = (log) => {
  // 创建一个临时的 log 对象，将 message 作为 originalObject
  const tempLog = {
    ...log,
    extra: {
      ...log.extra,
      originalObject: log.message
    }
  }
  selectedLog.value = tempLog
  extraObjectKey.value = null // 重置 extra 对象键名
  jsonDialogVisible.value = true
}

// 判断值是否为对象
const isObjectValue = (value) => {
  return typeof value === 'object' && value !== null
}

// 格式化标签值
const formatTagValue = (value) => {
  if (!isObjectValue(value)) {
    return truncateText(String(value), 20)
  }
  
  if (Array.isArray(value)) {
    return `[${value.length} items]`
  }
  
  const keys = Object.keys(value)
  if (keys.length === 0) {
    return '{}'
  } else if (keys.length === 1) {
    return `{${keys[0]}}`
  } else {
    return `{${keys.length} keys}`
  }
}

// 获取标签的 title 属性
const getTagTitle = (key, value) => {
  if (!isObjectValue(value)) {
    return `${key}: ${value}`
  }
  return `${key}: 点击查看对象详情`
}

// 打开 extra 对象对话框
const openExtraObjectDialog = (key, value, log) => {
  // 创建一个临时的 log 对象，将 extra 中的对象作为 originalObject
  const tempLog = {
    ...log,
    extra: {
      ...log.extra,
      originalObject: value
    }
  }
  selectedLog.value = tempLog
  
  // 修改对话框标题显示字段名
  extraObjectKey.value = key
  jsonDialogVisible.value = true
}

// 获取用于显示的 extra 字段（过滤掉内部字段）
const getDisplayExtra = (extra) => {
  if (!extra) return {}
  
  const { type, originalObject, ...displayExtra } = extra
  return displayExtra
}

// 滚动到底部
const scrollToBottom = () => {
  if (logsContainer.value) {
    nextTick(() => {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    })
  }
}

// 处理滚动事件
const handleScroll = () => {
  if (!logsContainer.value || !autoScroll.value) return
  
  const { scrollTop, scrollHeight, clientHeight } = logsContainer.value
  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
  
  if (!isAtBottom) {
    autoScroll.value = false
  }
}

// 监听日志变化，自动滚动
watch(filteredLogs, () => {
  if (autoScroll.value) {
    nextTick(() => {
      scrollToBottom()
    })
  }
}, { deep: true })

// 监听连接状态变化
watch(isConnected, (newValue, oldValue) => {
  console.log('LogsView: 连接状态变化', oldValue, '->', newValue)
  if (newValue && !oldValue) {
    console.log('LogsView: 连接建立，获取统计信息')
    getStats()
  }
}, { immediate: true })

// 定期获取统计信息
let statsInterval = null

onMounted(async () => {
  // 确保日志store已经初始化
  try {
    await logStore.initialize()
    console.log('日志界面：logStore初始化完成')
    console.log('日志界面：初始化后连接状态:', isConnected.value)
    console.log('日志界面：初始化后日志数量:', logs.value.length)
    console.log('日志界面：强制触发filteredLogs:', filteredLogs.value.length)
  } catch (error) {
    console.error('日志界面：logStore初始化失败:', error)
    ElMessage.error('日志服务初始化失败: ' + error.message)
  }
  
  // 每30秒获取一次统计信息
  statsInterval = setInterval(() => {
    if (isConnected.value) {
      getStats()
    }
  }, 30000)
  
  // 延迟一点获取统计信息，确保连接稳定
  setTimeout(() => {
    if (isConnected.value) {
      console.log('日志界面：延迟获取统计信息')
      getStats()
    } else {
      console.log('日志界面：连接未就绪，跳过统计信息获取')
    }
  }, 1000)
})

onUnmounted(() => {
  if (statsInterval) {
    clearInterval(statsInterval)
  }
})
</script>

<style scoped lang="scss">
.logs-view {
  height: calc(100vh - 120px); // 减去顶部导航和边距
  display: flex;
  flex-direction: column;
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  box-sizing: border-box;
}

.logs-header {
  margin-bottom: 24px;
  
  h2 {
    margin: 0 0 8px 0;
    font-size: 24px;
    font-weight: 600;
    color: #303133;
  }
  
  .logs-description {
    margin: 0;
    color: #606266;
    font-size: 14px;
  }
}

.connection-card {
  margin-bottom: 16px;
  
  :deep(.el-card__body) {
    padding: 16px;
  }
}

.connection-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #f56c6c;
  }
  
  span {
    font-weight: 500;
    color: #f56c6c;
  }
  
  &.connected {
    .status-dot {
      background-color: #67c23a;
    }
    
    span {
      color: #67c23a;
    }
  }
}

.connection-info {
  font-size: 14px;
  color: #909399;
}

.control-panel {
  margin-bottom: 16px;
  
  :deep(.el-card__body) {
    padding: 16px;
  }
}

.control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
}

.control-group {
  display: flex;
  gap: 12px;
  
  @media (max-width: 768px) {
    justify-content: center;
  }
}

.filter-group {
  display: flex;
  gap: 12px;
  align-items: center;
  
  @media (max-width: 768px) {
    flex-wrap: wrap;
    justify-content: center;
  }
}

.logs-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; // 重要：允许 flex 子元素收缩
  
  :deep(.el-card__body) {
    padding: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
}

.logs-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  background-color: #fafafa;
}

.logs-count {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.logs-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logs-list {
  flex: 1;
  overflow-y: auto;
  background-color: #fff;
  min-height: 0; // 重要：允许 flex 子元素收缩
}

.log-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #fafafa;
  }
  
  &.highlighted {
    background-color: #fff7e6;
    border-left: 3px solid #e6a23c;
  }
  
  &.level-error {
    border-left: 3px solid #f56c6c;
  }
  
  &.level-warn {
    border-left: 3px solid #e6a23c;
  }
  
  &.level-info {
    border-left: 3px solid #409eff;
  }
  
  &.level-debug {
    border-left: 3px solid #909399;
  }
  
  &.level-mark {
    border-left: 3px solid #67c23a;
  }
}

.log-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
  font-size: 12px;
}

.log-timestamp {
  color: #909399;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.log-level {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 11px;
  
  &.level-error {
    background-color: #fef0f0;
    color: #f56c6c;
  }
  
  &.level-warn {
    background-color: #fdf6ec;
    color: #e6a23c;
  }
  
  &.level-info {
    background-color: #ecf5ff;
    color: #409eff;
  }
  
  &.level-debug {
    background-color: #f4f4f5;
    color: #909399;
  }
  
  &.level-mark {
    background-color: #f0f9ff;
    color: #67c23a;
  }
}

.log-module {
  background-color: #f0f0f0;
  color: #606266;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.log-caller {
  color: #909399;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.log-message {
  color: #303133;
  line-height: 1.5;
  word-break: break-word;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  
  :deep(mark) {
    background-color: #fff2cc;
    color: #e6a23c;
    padding: 1px 2px;
    border-radius: 2px;
  }
}

.json-message,
.object-message {
  cursor: pointer;
  color: #409eff;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover {
    background-color: #ecf5ff;
    color: #337ecc;
  }
}

.object-message {
  color: #e6a23c; // 使用橙色区分对象消息
  
  &:hover {
    background-color: #fdf6ec;
    color: #cf9236;
  }
}

.json-expand-icon {
  font-size: 12px;
  opacity: 0.7;
}

.log-extra {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 100%;
  overflow: hidden;
}

.log-extra-tag {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  
  &.clickable {
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  }
  
  :deep(.el-tag__content) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
}

.empty-logs {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

// JSON 对话框样式
.json-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
  }
}

.json-content {
  max-height: 600px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.json-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  background-color: #fafafa;
  font-size: 12px;
}

.json-timestamp {
  color: #909399;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.json-level {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 11px;
  
  &.level-error {
    background-color: #fef0f0;
    color: #f56c6c;
  }
  
  &.level-warn {
    background-color: #fdf6ec;
    color: #e6a23c;
  }
  
  &.level-info {
    background-color: #ecf5ff;
    color: #409eff;
  }
  
  &.level-debug {
    background-color: #f4f4f5;
    color: #909399;
  }
  
  &.level-mark {
    background-color: #f0f9ff;
    color: #67c23a;
  }
}

.json-module {
  background-color: #f0f0f0;
  color: #606266;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.json-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.json-pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #303133;
  background-color: #f8f9fa;
  padding: 16px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  white-space: pre-wrap;
  word-break: break-word;
}

// 移动端适配
@media (max-width: 768px) {
  .logs-view {
    padding: 16px;
  }
  
  .logs-header-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .logs-controls {
    justify-content: center;
  }
  
  .log-item {
    padding: 8px 12px;
  }
  
  .log-header {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .log-message {
    font-size: 12px;
  }
  
  .json-dialog {
    :deep(.el-dialog) {
      width: 95% !important;
      margin: 5vh auto;
    }
  }
  
  .json-content {
    max-height: 70vh;
  }
  
  .json-pre {
    font-size: 12px;
    padding: 12px;
  }
}
</style>