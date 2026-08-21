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
 * 同时传递 url 和 text 字段，确保系统面板中“复制”功能能复制出完整 URL。
 * 降级复制到剪贴板。
 *
 * @param {string|{url: string, title?: string, text?: string}} urlOrOptions
 * @param {string} [title="从MioChat分享"]
 * @param {string} [text=""]
 * @returns {Promise<{success: boolean, message: string}>}
 *   message 为空字符串表示「用户取消分享」，调用方不应弹出任何提示。
 */
export async function shareOrCopy(urlOrOptions, title = "从MioChat分享", text = "") {
  let url = "";
  let finalTitle = title;
  let finalText = text;

  if (typeof urlOrOptions === "object" && urlOrOptions !== null) {
    url = urlOrOptions.url || "";
    finalTitle = urlOrOptions.title || title;
    finalText = urlOrOptions.text !== undefined ? urlOrOptions.text : url;
  } else {
    url = String(urlOrOptions || "");
    finalText = text || url;
  }

  // 优先 Web Share API：同时传递 url 与 text，确保移动端/系统分享面板点击复制时能复制出完整链接
  if (navigator.share) {
    try {
      const shareData = {
        title: finalTitle,
        text: finalText,
        url: url || undefined,
      };
      await navigator.share(shareData);
      return { success: true, message: "分享成功" };
    } catch (err) {
      // 用户取消分享：视为已处理，静默返回空 message
      if (err?.name === "AbortError") {
        return { success: true, message: "" };
      }
      console.error("分享失败:", err);
    }
  }

  // 降级：复制到剪贴板，优先写入完整 url 或 text
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url || finalText);
      return { success: true, message: "链接已复制到剪贴板" };
    } catch (err) {
      console.error("复制失败:", err);
      return { success: false, message: "复制失败" };
    }
  }

  return { success: false, message: "当前浏览器不支持分享与复制" };
}
