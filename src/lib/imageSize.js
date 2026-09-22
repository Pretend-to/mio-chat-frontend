/**
 * 图片固有尺寸解析（"先量后插"用）。
 *
 * 为什么要它：`<img>` 的高度只有解码完成后才知道，而图片往往是在消息已经
 * 插入气泡之后才加载完成的 —— 那一刻容器会突然长高几百 px，滚动位置就"跳"。
 * 解决思路：先把图片自然尺寸量出来，写回消息元素（data.width / data.height），
 * 渲染侧即可在图片解码前按 `aspect-ratio` 预留终态高度，布局零位移。
 *
 * - 同一 URL 只量一次（内存缓存，命中即同步返回）
 * - 超时/失败返回 null，调用方退回占位比例，绝不阻塞消息上屏
 */
const sizeCache = new Map();

export function getCachedImageSize(url) {
  return sizeCache.get(url) || null;
}

export function resolveImageSize(url, { timeoutMs = 800 } = {}) {
  if (!url || typeof url !== "string") return Promise.resolve(null);

  const cached = sizeCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    const finish = (size) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      if (size) sizeCache.set(url, size);
      resolve(size);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    img.onload = () => {
      const width = img.naturalWidth || 0;
      const height = img.naturalHeight || 0;
      finish(width > 0 && height > 0 ? { height, width } : null);
    };
    img.onerror = () => finish(null);
    img.decoding = "async";
    img.src = url;
  });
}

/** 把一组图片 URL 的尺寸量出来（与传入顺序一一对应，量不到为 null） */
export function resolveImageSizes(urls = []) {
  return Promise.all(urls.map((url) => resolveImageSize(url)));
}
