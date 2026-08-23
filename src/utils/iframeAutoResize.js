/**
 * iframe extraRender 高度自适应
 *
 * 原理：wrapIframeDoc 注入 ResizeObserver 脚本，iframe 内容高度变化时
 * 通过 parent.postMessage 上报；前端监听 message，用 e.source 与 iframe.contentWindow
 * 比对定位到具体 iframe，更新其高度。
 *
 * sandbox="allow-scripts"（无 allow-same-origin）下 postMessage 仍可用，
 * unique origin 的 WindowProxy 可与 e.source 正常比对。
 */

const RESIZE_MSG = 'mio-iframe-resize'

/** 注入 iframe 的自适应脚本（放在 body 内容之后，确保首屏高度正确） */
const AUTO_RESIZE_SCRIPT = `<script>
(function () {
  function report() {
    var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
    parent.postMessage({ type: 'mio-iframe-resize', height: h }, '*')
  }
  if (window.ResizeObserver) {
    new ResizeObserver(report).observe(document.body)
  }
  window.addEventListener('load', report)
  report()
})()
</script>`

/**
 * 将 HTML 包装为完整文档，注入自适应脚本
 * 注意：去掉 body height:100%（否则锁死高度，scrollHeight 不随内容增长）
 */
export function wrapIframeDoc(html) {
  const s = String(html || '').trim()
  if (/^<!doctype\s+html/i.test(s)) return s
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}</style></head><body>${s}${AUTO_RESIZE_SCRIPT}</body></html>`
}

/** 建立 / 销毁全局 message 监听（组件挂载时调用 enable，卸载时调用 disable） */
export function setupIframeAutoResize() {
  const onMessage = (e) => {
    const data = e.data
    if (!data || data.type !== RESIZE_MSG || !data.height) return
    const h = Number(data.height)
    if (!(h > 0) || h > 5000) return // 防御异常高度
    document.querySelectorAll('iframe.extra-render-iframe').forEach((iframe) => {
      if (iframe.contentWindow === e.source) {
        iframe.style.height = `${h}px`
      }
    })
  }
  return {
    enable() {
      window.addEventListener('message', onMessage)
    },
    disable() {
      window.removeEventListener('message', onMessage)
    }
  }
}
