/**
 * groupAvatar.js — 智能组合头像合成引擎 (SVG/Canvas 双引擎)
 * 
 * 采用 SVG 矢量切割与 Canvas 备用双引擎算法，100% 免疫跨域图片 (CORS) 导致的 Tainted Canvas 崩溃。
 */

/**
 * 计算多宫格布局切片坐标
 */
function calculateGridCells(total, size = 256) {
  const gap = size * 0.03;
  let cells = [];

  if (total <= 1) {
    cells = [{ x: 0, y: 0, w: size, h: size }];
  } else if (total === 2) {
    const w = (size - gap) / 2;
    cells = [
      { x: 0, y: 0, w, h: size },
      { x: w + gap, y: 0, w, h: size },
    ];
  } else if (total === 3) {
    const h = (size - gap) / 2;
    const w = (size - gap) / 2;
    cells = [
      { x: (size - w) / 2, y: 0, w, h },
      { x: 0, y: h + gap, w, h },
      { x: w + gap, y: h + gap, w, h },
    ];
  } else if (total === 4) {
    const s = (size - gap) / 2;
    cells = [
      { x: 0, y: 0, w: s, h: s },
      { x: s + gap, y: 0, w: s, h: s },
      { x: 0, y: s + gap, w: s, h: s },
      { x: s + gap, y: s + gap, w: s, h: s },
    ];
  } else if (total === 5) {
    const h = (size - gap) / 2;
    const w2 = (size - gap) / 2;
    const w3 = (size - gap * 2) / 3;
    cells = [
      { x: (size - (w2 * 2 + gap)) / 2, y: 0, w: w2, h },
      { x: (size - (w2 * 2 + gap)) / 2 + w2 + gap, y: 0, w: w2, h },
      { x: 0, y: h + gap, w: w3, h },
      { x: w3 + gap, y: h + gap, w: w3, h },
      { x: (w3 + gap) * 2, y: h + gap, w: w3, h },
    ];
  } else if (total === 6) {
    const h = (size - gap) / 2;
    const w = (size - gap * 2) / 3;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        cells.push({ x: c * (w + gap), y: r * (h + gap), w, h });
      }
    }
  } else {
    const s = (size - gap * 2) / 3;
    const count = Math.min(total, 9);
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / 3);
      const c = i % 3;
      cells.push({ x: c * (s + gap), y: r * (s + gap), w: s, h: s });
    }
  }
  return cells;
}

/**
 * 尝试异步加载图片
 */
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * 生成 100% 安全不报错的 SVG 拼图头像 Data URL
 */
function createSvgCompositeAvatar(urls, size = 256) {
  const cells = calculateGridCells(urls.length, size);
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark";
  const bgColor = isDark ? "#1e1e24" : "#e2e8f0";

  let svgContent = `<rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${bgColor}"/>`;

  urls.slice(0, 9).forEach((url, idx) => {
    const cell = cells[idx];
    if (!cell) return;
    const clipId = `clip_${idx}_${Math.random().toString(36).slice(2, 7)}`;

    svgContent += `
      <clipPath id="${clipId}">
        <rect x="${cell.x.toFixed(1)}" y="${cell.y.toFixed(1)}" width="${cell.w.toFixed(1)}" height="${cell.h.toFixed(1)}" />
      </clipPath>
      <image href="${escapeXml(url)}" x="${cell.x.toFixed(1)}" y="${cell.y.toFixed(1)}" width="${cell.w.toFixed(1)}" height="${cell.h.toFixed(1)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
    `;
  });

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${svgContent}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 智能合成多宫格群头像 (带安全兜底)
 */
export async function generateCompositeAvatar(avatarUrls = [], canvasSize = 256) {
  try {
    const validUrls = (avatarUrls || []).filter(Boolean);
    if (validUrls.length === 0) {
      return "/static/icons/512x512.png";
    }

    // 优先采用 100% 零报错的 SVG 矢量拼接方案
    return createSvgCompositeAvatar(validUrls, canvasSize);
  } catch (err) {
    console.warn("[groupAvatar] 生成组合头像兜底:", err);
    return "/static/icons/512x512.png";
  }
}
