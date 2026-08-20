import { ElMessage } from "element-plus";
import { client } from "@/lib/runtime.js";

/**
 * 重试前检查消息中是否有 blob:/data: 本地图片 URL，
 * 若有则从浏览器缓存取回 Blob 后重新上传为远程 URL。
 * 上传失败则移除该图片元素并提示用户。
 *
 * @param {Object} message - 消息对象
 * @param {Function} [compressAndUploadFn] - 可选的 InputEditor 压缩上传方法
 */
export async function reuploadBlobImages(message, compressAndUploadFn) {
  if (!message || !Array.isArray(message.content)) return;

  for (const elm of message.content) {
    if (elm.type !== "image") continue;
    const url = elm.data?.file || "";
    if (!url.startsWith("blob:") && !url.startsWith("data:")) continue;

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const filename = "retry-image." + (blob.type.split("/")[1] || "png");
      const file = new File([blob], filename, { type: blob.type });

      if (compressAndUploadFn) {
        elm.data.file = await compressAndUploadFn(file);
      } else {
        // InputEditor 未挂载（如多选模式）时直接走 client 上传，避免 blob URL 被原样发出
        const formData = new FormData();
        formData.append("image", file, filename);
        const upload = await client.uploadImage(formData);
        elm.data.file = upload.data.url;
      }
    } catch (e) {
      console.error("重试时重新上传图片失败:", e);
      // 上传失败则移除该图片元素，并告知用户
      elm._remove = true;
    }
  }

  // 清理标记为移除的元素
  const before = message.content.length;
  message.content = message.content.filter((elm) => !elm._remove);
  if (message.content.length < before) {
    ElMessage.warning("部分图片无法重新上传，已从消息中移除");
  }
}

export function useChatMedia() {
  return {
    reuploadBlobImages,
  };
}

