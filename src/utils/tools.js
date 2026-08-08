export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * 分享或复制链接。
 *
 * 优先 Web Share API（移动端弹系统分享面板，桌面端部分浏览器也有），
 * 降级复制到剪贴板。
 *
 * 注意：返回 Promise。原实现同步返回，Promise 未 resolve 就提前返回
 * `success: true`，导致分享失败/被取消时仍提示「分享成功」。
 *
 * @param {string} url
 * @returns {Promise<{success: boolean, message: string}>}
 *   message 为空字符串表示「用户取消分享」，调用方不应弹出任何提示。
 */
export async function shareOrCopy(url) {
  // 优先 Web Share API：url 走规范字段，系统分享面板展示更友好
  if (navigator.share) {
    try {
      await navigator.share({
        title: "从MioChat分享",
        url,
      });
      return { success: true, message: "分享成功" };
    } catch (err) {
      // 用户取消分享：视为已处理，静默返回空 message
      if (err?.name === "AbortError") {
        return { success: true, message: "" };
      }
      console.error("分享失败:", err);
    }
  }

  // 降级：复制到剪贴板
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return { success: true, message: "链接已复制到剪贴板" };
    } catch (err) {
      console.error("复制失败:", err);
      return { success: false, message: "复制失败" };
    }
  }

  return { success: false, message: "当前浏览器不支持分享与复制" };
}
