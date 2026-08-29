import client from './client.js'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isPWAStandalone() {
  return Boolean(
    navigator.standalone ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getPushSubscription() {
  if (!isPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

export async function subscribePush() {
  if (!isPushSupported()) {
    throw new Error('当前浏览器环境不支持 Web Push')
  }

  if (isIOSDevice() && !isPWAStandalone()) {
    throw new Error('iOS 设备必须先点击分享并「添加到主屏幕」，在 PWA 中打开才能启用通知')
  }

  // 必须直接由用户手势触发 requestPermission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? '通知权限已被拒绝，请在浏览器或系统设置中允许通知' : '未授权通知权限')
  }

  // 1. 获取后端 VAPID 公钥
  const res = await client.request('/api/push/vapid-key')
  const vapidPublicKey = res?.data?.publicKey
  if (!vapidPublicKey) {
    throw new Error('获取服务端 Push 公钥失败')
  }

  // 2. 注册 Service Worker PushManager 订阅
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    userVisibleOnly: true,
  })

  // 3. 上报至服务端持久化
  const deviceType = isIOSDevice() ? 'ios_pwa' : (isPWAStandalone() ? 'pwa' : 'web')
  await client.request('/api/push/subscribe', 'POST', {
    device: deviceType,
    subscription: sub.toJSON(),
  })

  return sub
}

export async function unsubscribePush() {
  const sub = await getPushSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe().catch(() => {})
    await client.request('/api/push/unsubscribe', 'POST', { endpoint }).catch(() => {})
  }
  return true
}

export async function testPushNotification(title = 'Mio-Chat 测试提醒', body = '这是一条来自服务端的 Web Push 测试推送！') {
  return await client.request('/api/push/test', 'POST', { body, title })
}
