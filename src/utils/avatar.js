/**
 * 头像处理工具函数
 * 用于在头像右下角裁剪出一个圆孔，以便放置连线状态圆点
 */
export async function processAvatarWithStatusHole(imageUrl) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      // 1. 绘制原始图片
      ctx.drawImage(img, 0, 0);

      // 2. 在右下角创建一个透明的缺口 (与 SideBar 逻辑一致)
      let centerX = img.width * 0.8; // 圆心X坐标
      let centerY = img.height * 0.86; // 圆心Y坐标
      let radius = (5 / 24) * img.width; // 缺口半径

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
      ctx.clip();
      ctx.clearRect(0, 0, img.width, img.height);

      // 3. 转换为 Blob URL
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas toBlob failed"));
          return;
        }
        const url = URL.createObjectURL(blob);
        resolve(url);
      }, "image/png");
    };

    img.onerror = (error) => {
      reject(error);
    };
  });
}

/**
 * 获取管理员头像地址
 */
export function getAdminAvatarUrl(adminId) {
  if (!adminId) return "/p/qava?q=1099834705";
  if (
    typeof adminId === "string" &&
    (adminId.startsWith("http") || adminId.startsWith("/"))
  ) {
    return adminId;
  }
  return `/p/qava?q=${adminId}`;
}

// 模型头像映射已移动至后端处理 (/p/mava)

/**
 * 根据模型所有者获取头像 URL
 * @param {string} modelOwner - 模型所有者名称
 * @returns {string} - 头像 URL
 */
export function getAvatarByOwner(modelOwner) {
  return `/p/mava?provider=${modelOwner || "OpenAI"}`;
}

/**
 * 根据适配器类型获取完整的头像 URL
 * @param {string} adapterType - 适配器类型
 * @returns {string} - 完整的头像 URL
 */
export function getAvatarByAdapterType(adapterType) {
  return `/p/mava?adapter=${adapterType}`;
}
