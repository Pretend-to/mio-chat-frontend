import { useLogViewer } from '@/composables/useLogViewer'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// 全局共享的logViewer实例
let globalLogViewer = null

export const useLogStore = defineStore('log', () => {
  // 状态
  const isInitialized = ref(false)
  // 创建响应式引用来存储logViewer的状态
  const logs = ref([])
  const isConnected = ref(false)
  const stats = ref(null)
  
  console.log('创建logStore实例，当前初始化状态:', isInitialized.value)
  
  // 计算属性
  const totalLogsCount = computed(() => {
    return logs.value.length
  })
  
  // 同步logViewer状态到store
  const syncLogViewerState = () => {
    if (globalLogViewer) {
      // 直接赋值来触发响应式更新
      logs.value = globalLogViewer.logs.value
      isConnected.value = globalLogViewer.isConnected.value
      stats.value = globalLogViewer.stats.value
      console.log('同步logViewer状态 - 连接:', isConnected.value, '日志数量:', logs.value.length)
    }
  }

  // 方法
  const initialize = async () => {
    if (isInitialized.value && globalLogViewer) {
      console.log('日志store已经初始化，跳过重复初始化，当前日志数量:', logs.value.length)
      syncLogViewerState() // 确保状态同步
      return
    }
    
    try {
      console.log('开始初始化日志store...')
      // 延迟初始化useLogViewer，避免在store创建时就调用
      if (!globalLogViewer) {
        globalLogViewer = useLogViewer()
        console.log('日志store初始化完成，开始手动初始化logViewer')
        
        // 手动初始化logViewer，因为composable的onMounted可能不会被调用
        globalLogViewer.manualInit()
        
        // 设置定时同步状态
        setInterval(syncLogViewerState, 1000) // 每秒同步一次状态
      }
      isInitialized.value = true
      syncLogViewerState() // 立即同步一次状态
      console.log('日志store初始化完成，当前日志数量:', logs.value.length)
    } catch (error) {
      console.error('日志store初始化失败:', error)
      throw error
    }
  }
  
  const clearLogs = () => {
    if (globalLogViewer) {
      globalLogViewer.clearLogs()
    }
  }
  
  const getStats = async () => {
    if (globalLogViewer) {
      return await globalLogViewer.getStats()
    }
    return { success: false, error: 'LogViewer not initialized' }
  }
  
  const search = async (query) => {
    if (globalLogViewer) {
      return await globalLogViewer.search(query)
    }
    return { success: false, error: 'LogViewer not initialized' }
  }
  
  const exportLogs = async (options) => {
    if (globalLogViewer) {
      return await globalLogViewer.exportLogs(options)
    }
    return { success: false, error: 'LogViewer not initialized' }
  }
  
  const subscribe = async (options) => {
    if (globalLogViewer) {
      return await globalLogViewer.subscribe(options)
    }
    return { success: false, error: 'LogViewer not initialized' }
  }
  
  const unsubscribe = async () => {
    if (globalLogViewer) {
      return await globalLogViewer.unsubscribe()
    }
    return { success: false, error: 'LogViewer not initialized' }
  }
  
  return {
    // 状态
    isInitialized,
    logs,
    isConnected,
    stats,
    
    // 计算属性
    totalLogsCount,
    
    // 方法
    initialize,
    clearLogs,
    getStats,
    search,
    exportLogs,
    subscribe,
    unsubscribe,
    syncLogViewerState
  }
})