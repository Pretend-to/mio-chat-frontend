import { client } from '@/lib/runtime.js'
import { randomString } from '@/utils/generate.js'
import { onMounted, onUnmounted, ref } from 'vue'

export function useLogViewer() {
  // 状态
  const logs = ref([])
  const isSubscribed = ref(false)
  const stats = ref(null)
  
  // 手动管理连接状态
  const socket = ref(client.socket)
  const isConnected = ref(client.isConnected)
  
  const pendingRequests = new Map()

  // 监听日志消息的处理器
  let logMessageHandler = null

  // 处理日志消息
  const handleLogMessage = (data) => {
    console.log('处理日志消息:', data)
    const { request_id, type } = data

    // 处理有请求ID的响应
    if (request_id) {
      console.log('收到带request_id的响应:', request_id, '待处理请求:', Array.from(pendingRequests.keys()))
      
      if (pendingRequests.has(request_id)) {
        const resolver = pendingRequests.get(request_id)
        pendingRequests.delete(request_id)
        console.log('找到对应的请求，解析响应:', type)
        
        // 处理订阅相关的响应
        if (type === 'subscribe' && data.success) {
          isSubscribed.value = true
          console.log('订阅成功，更新状态为已订阅')
        } else if (type === 'unsubscribe' && data.success) {
          isSubscribed.value = false
          console.log('取消订阅成功，更新状态为未订阅')
        }
        
        resolver(data)
        return
      } else {
        console.warn('收到未知request_id的响应:', request_id, '类型:', type)
      }
    }

    // 处理实时日志流和其他消息
    switch (type) {
      case 'SUBSCRIBED':
        isSubscribed.value = true
        console.log('收到订阅确认:', data.data)
        break
        
      case 'UNSUBSCRIBED':
        isSubscribed.value = false
        console.warn('⚠️ 后端主动取消订阅！可能原因：连接断开、超时、或多客户端冲突')
        console.log('取消订阅数据:', data)
        break
        
      case 'stream':
        console.log('收到日志流数据:', data.data)
        addLog(data.data)
        break
        
      case 'LOG_STATS':
        // 处理统计信息响应
        console.log('收到统计信息:', data.data)
        if (data.success) {
          stats.value = data.data
        }
        break
        
      case 'ERROR':
        console.error('日志API错误:', data.error)
        break
        
      default:
        console.log('未处理的日志消息类型:', type, data)
    }
  }

  // 初始化日志消息监听
  const initLogListener = () => {
    if (!socket.value || !socket.value.socket) {
      console.log('Socket 未就绪，等待连接...')
      return
    }

    // 清理旧的监听器
    cleanupLogListener()

    // 创建日志消息处理器
    logMessageHandler = (message) => {
      try {
        const data = JSON.parse(message)
        if (data.protocol === 'logs') {
          console.log('收到日志消息:', data)
          handleLogMessage(data)
        }
      } catch (error) {
        console.error('解析日志消息失败:', error)
      }
    }

    // 添加消息监听器
    socket.value.socket.on('message', logMessageHandler)
    console.log('日志消息监听器已初始化')
  }

  // 清理日志消息监听
  const cleanupLogListener = () => {
    if (socket.value && socket.value.socket && logMessageHandler) {
      socket.value.socket.off('message', logMessageHandler)
      console.log('日志消息监听器已清理')
    }
    logMessageHandler = null
  }

  // 发送请求
  const sendRequest = (type, data) => {
    return new Promise((resolve, reject) => {
      console.log('发送日志请求:', type, data)
      console.log('当前连接状态:', isConnected.value)
      console.log('当前 socket:', socket.value)
      
      // 临时：如果没有连接，模拟成功响应用于测试
      if (!socket.value || !isConnected.value) {
        console.warn('未连接到服务器，返回模拟响应')
        
        // 模拟不同类型的响应
        setTimeout(() => {
          if (type === 'subscribe') {
            resolve({
              success: true,
              data: { message: '模拟订阅成功' }
            })
          } else if (type === 'unsubscribe') {
            resolve({
              success: true,
              data: { message: '模拟取消订阅成功' }
            })
          } else {
            resolve({
              success: true,
              data: { message: `模拟 ${type} 成功` }
            })
          }
        }, 500) // 模拟网络延迟
        return
      }

      const requestId = randomString(16)
      pendingRequests.set(requestId, resolve)

      // 设置超时
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId)
          const error = new Error('请求超时')
          console.error('请求超时:', requestId, type)
          reject(error)
        }
      }, 30000)

      const message = {
        request_id: requestId,
        protocol: 'logs',
        type,
        data
      }

      console.log('发送消息:', message)
      socket.value.sendMessage(message)
    })
  }

  // 添加日志到本地缓存
  const addLog = (log) => {
    logs.value.push(log)
    
    // 限制本地缓存大小
    if (logs.value.length > 2000) {
      logs.value.splice(0, logs.value.length - 2000)
    }
  }

  // 订阅日志流
  const subscribe = async (options = {}) => {
    const defaultOptions = {
      level: 'INFO',
      modules: [],
      realtime: true,
      bufferSize: 1000,
      sendHistory: true
    }

    try {
      const response = await sendRequest('subscribe', { ...defaultOptions, ...options })
      
      // 如果是模拟响应，启动模拟日志流
      if (response.success && (!socket.value || !isConnected.value)) {
        isSubscribed.value = true
        startMockLogStream()
      }
      // 真实响应的状态更新在 handleLogMessage 中处理
      
      return response
    } catch (error) {
      console.error('订阅失败:', error)
      throw error
    }
  }

  // 模拟日志流
  let mockLogInterval = null
  
  const startMockLogStream = () => {
    console.log('启动模拟日志流')
    let counter = 1
    
    mockLogInterval = setInterval(() => {
      const mockLog = {
        id: `mock_stream_${counter}`,
        timestamp: new Date().toISOString(),
        level: ['INFO', 'WARN', 'ERROR', 'DEBUG'][Math.floor(Math.random() * 4)],
        module: ['llm', 'onebot', 'system'][Math.floor(Math.random() * 3)],
        message: `模拟实时日志消息 #${counter}`,
        caller: `mock.js:${Math.floor(Math.random() * 100)}`,
        ip: '127.0.0.1'
      }
      
      addLog(mockLog)
      counter++
    }, 2000) // 每2秒添加一条日志
  }
  
  const stopMockLogStream = () => {
    if (mockLogInterval) {
      clearInterval(mockLogInterval)
      mockLogInterval = null
      console.log('停止模拟日志流')
    }
  }

  // 取消订阅
  const unsubscribe = async () => {
    try {
      const response = await sendRequest('unsubscribe', {})
      
      // 如果是模拟响应，停止模拟日志流
      if (response.success && (!socket.value || !isConnected.value)) {
        isSubscribed.value = false
        stopMockLogStream()
      }
      // 真实响应的状态更新在 handleLogMessage 中处理
      
      return response
    } catch (error) {
      console.error('取消订阅失败:', error)
      throw error
    }
  }

  // 搜索日志
  const search = async (query) => {
    const response = await sendRequest('search', query)
    return response
  }

  // 导出日志
  const exportLogs = async (options) => {
    const response = await sendRequest('export', options)
    return response
  }



  // 更新配置
  const updateConfig = async (type, value) => {
    const response = await sendRequest('config', { type, value })
    return response
  }

  // 获取统计信息
  const getStats = async () => {
    try {
      const response = await sendRequest('stats', {})
      if (response.success) {
        stats.value = response.data
      }
      return response
    } catch (error) {
      console.error('获取统计信息失败:', error)
      return { success: false, error }
    }
  }

  // 清空本地日志
  const clearLogs = () => {
    logs.value = []
  }



  // 监听 client socket 的连接状态变化
  const setupSocketListeners = () => {
    if (!client.socket) {
      console.log('Client socket 不存在，无法设置监听器')
      return null
    }
    
    // 监听连接成功事件
    const onConnect = (info) => {
      console.log('Socket 连接成功:', info)
      isConnected.value = true
      socket.value = client.socket
      setTimeout(() => {
        initLogListener()
        // 连接成功后，如果之前有订阅，重新订阅
        if (isSubscribed.value) {
          console.log('连接恢复，重新订阅日志')
          autoSubscribe()
        }
      }, 100)
    }
    
    // 监听连接断开事件
    const onDisconnect = (reason) => {
      console.warn('Socket 连接断开:', reason)
      isConnected.value = false
      cleanupLogListener()
      // 注意：不重置 isSubscribed 状态，以便重连后恢复订阅
    }
    
    // 监听连接错误事件
    const onConnectError = (error) => {
      console.log('Socket 连接失败:', error)
      isConnected.value = false
      cleanupLogListener()
    }
    
    // 添加事件监听器到 client.socket
    client.socket.on('connect', onConnect)
    client.socket.on('disconnect', onDisconnect)
    client.socket.on('connect_error', onConnectError)
    
    // 返回清理函数
    return () => {
      if (client.socket) {
        client.socket.off('connect', onConnect)
        client.socket.off('disconnect', onDisconnect)
        client.socket.off('connect_error', onConnectError)
      }
    }
  }

  // 定期检查连接状态
  const setupStatusPolling = () => {
    let lastSocketId = socket.value ? socket.value.id : null
    
    const checkStatus = () => {
      const currentConnected = client.isConnected
      const currentSocket = client.socket
      const currentSocketId = currentSocket ? currentSocket.id : null
      
      // 只在连接状态真正变化时更新
      if (currentConnected !== isConnected.value) {
        console.log('检测到连接状态变化:', isConnected.value, '->', currentConnected)
        isConnected.value = currentConnected
        
        if (currentConnected && currentSocket) {
          socket.value = currentSocket
          lastSocketId = currentSocketId
          initLogListener()
        } else {
          socket.value = null
          lastSocketId = null
          cleanupLogListener()
        }
      }
      
      // 只在 socket 实例真正变化时更新（通过 ID 比较）
      if (currentSocketId !== lastSocketId) {
        console.log('检测到 socket 实例变化:', lastSocketId, '->', currentSocketId)
        socket.value = currentSocket
        lastSocketId = currentSocketId
        
        if (currentConnected && currentSocket) {
          initLogListener()
        } else {
          cleanupLogListener()
        }
      }
    }
    
    // 每2秒检查一次状态（降低频率）
    const interval = setInterval(checkStatus, 2000)
    
    return () => {
      clearInterval(interval)
    }
  }



  // 清理函数
  let cleanupSocketListeners = null
  let cleanupStatusPolling = null

  // 自动订阅日志
  const autoSubscribe = async () => {
    try {
      console.log('自动订阅日志...')
      await subscribe({
        level: 'INFO',
        modules: [],
        realtime: true,
        bufferSize: 1000,
        sendHistory: true
      })
      console.log('自动订阅成功')
    } catch (error) {
      console.error('自动订阅失败:', error)
      // 如果订阅失败，启动模拟日志流作为备选
      if (!socket.value || !isConnected.value) {
        console.log('启动模拟日志流作为备选')
        isSubscribed.value = true
        startMockLogStream()
      }
    }
  }

  // 手动初始化方法（用于非组件环境）
  const manualInit = () => {
    console.log('LogViewer 手动初始化')
    console.log('Client 当前连接状态:', client.isConnected)
    console.log('Client 当前 socket:', client.socket)
    console.log('Client socket 是否存在:', !!client.socket)
    
    // 同步初始状态
    isConnected.value = client.isConnected
    socket.value = client.socket
    
    console.log('LogViewer 初始化后连接状态:', isConnected.value)
    
    // 设置 socket 事件监听器
    cleanupSocketListeners = setupSocketListeners()
    
    // 设置状态轮询
    cleanupStatusPolling = setupStatusPolling()
    
    // 如果已经连接，立即初始化监听器
    if (isConnected.value && socket.value) {
      console.log('连接已就绪，初始化日志监听器')
      initLogListener()
    } else {
      console.log('连接未就绪，等待连接建立')
    }
    
    // 自动订阅日志（延迟一点确保连接稳定）
    setTimeout(() => {
      console.log('延迟自动订阅，当前连接状态:', isConnected.value)
      autoSubscribe()
    }, 2000)
  }

  // 组件挂载时初始化
  onMounted(() => {
    console.log('LogViewer 组件挂载')
    console.log('Client 当前连接状态:', client.isConnected)
    console.log('Client 当前 socket:', client.socket)
    
    // 同步初始状态
    isConnected.value = client.isConnected
    socket.value = client.socket
    
    // 设置 socket 事件监听器
    cleanupSocketListeners = setupSocketListeners()
    
    // 设置状态轮询
    cleanupStatusPolling = setupStatusPolling()
    
    // 如果已经连接，立即初始化监听器
    if (isConnected.value && socket.value) {
      initLogListener()
    }
    

    
    // 自动订阅日志（延迟一点确保连接稳定）
    setTimeout(() => {
      autoSubscribe()
    }, 2000)
  })

  // 组件卸载时清理
  onUnmounted(async () => {
    // 如果当前已订阅，先取消订阅
    if (isSubscribed.value && (socket.value && isConnected.value)) {
      try {
        console.log('组件卸载，主动取消订阅')
        await unsubscribe()
      } catch (error) {
        console.error('组件卸载时取消订阅失败:', error)
      }
    }
    
    // 清理日志监听器
    cleanupLogListener()
    
    // 停止模拟日志流
    stopMockLogStream()
    
    // 清理 socket 事件监听器
    if (cleanupSocketListeners) {
      cleanupSocketListeners()
    }
    
    // 清理状态轮询
    if (cleanupStatusPolling) {
      cleanupStatusPolling()
    }
    
    // 清理待处理的请求
    pendingRequests.clear()
  })

  return {
    // 状态
    logs,
    isConnected,
    stats,
    
    // 方法
    search,
    exportLogs,
    updateConfig,
    getStats,
    clearLogs,
    subscribe,
    unsubscribe,
    manualInit
  }
}