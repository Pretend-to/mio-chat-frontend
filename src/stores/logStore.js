import { useLogViewer } from '@/composables/useLogViewer'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useLogStore = defineStore('log', () => {
  // 状态
  const isInitialized = ref(false)
  let logViewer = null
  
  // 计算属性
  const totalLogsCount = computed(() => {
    return logViewer ? logViewer.logs.value.length : 0
  })
  
  const isConnected = computed(() => {
    return logViewer ? logViewer.isConnected.value : false
  })
  
  const stats = computed(() => {
    return logViewer ? logViewer.stats.value : null
  })
  
  // 方法
  const initialize = async () => {
    if (isInitialized.value) {
      return
    }
    
    try {
      // 延迟初始化useLogViewer，避免在store创建时就调用
      if (!logViewer) {
        logViewer = useLogViewer()
        console.log('日志store初始化完成，开始手动初始化logViewer')
        
        // 手动初始化logViewer，因为composable的onMounted可能不会被调用
        logViewer.manualInit()
      }
      isInitialized.value = true
    } catch (error) {
      console.error('日志store初始化失败:', error)
      throw error
    }
  }
  
  const clearLogs = () => {
    if (logViewer) {
      logViewer.clearLogs()
    }
  }
  
  const getStats = async () => {
    if (logViewer) {
      return await logViewer.getStats()
    }
    return { success: false, error: 'LogViewer not initialized' }
  }
  
  const search = async (query) => {
    if (logViewer) {
      return await logViewer.search(query)
    }
    return { success: false, error: 'LogViewer not initialized' }
  }
  
  const exportLogs = async (options) => {
    if (logViewer) {
      return await logViewer.exportLogs(options)
    }
    return { success: false, error: 'LogViewer not initialized' }
  }
  
  const subscribe = async (options) => {
    if (logViewer) {
      return await logViewer.subscribe(options)
    }
    return { success: false, error: 'LogViewer not initialized' }
  }
  
  const unsubscribe = async () => {
    if (logViewer) {
      return await logViewer.unsubscribe()
    }
    return { success: false, error: 'LogViewer not initialized' }
  }
  
  return {
    // 状态
    isInitialized,
    
    // 计算属性
    totalLogsCount,
    isConnected,
    stats,
    
    // 方法
    initialize,
    clearLogs,
    getStats,
    search,
    exportLogs,
    subscribe,
    unsubscribe,
    
    // 暴露原始日志数据供其他组件使用
    logs: computed(() => logViewer ? logViewer.logs.value : [])
  }
})