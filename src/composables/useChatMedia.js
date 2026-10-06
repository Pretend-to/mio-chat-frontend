import { ElMessage } from "element-plus";
import { client } from "@/lib/runtime.js";

/**
 * 重发前把消息里所有“本地资产”（data.file 为 blob:/data: 的 image/file 元素）
 * 重新上传为远程 URL。
 *
 * 返回 { ok, message? }：
 *   - ok=true  → 所有本地资产都已变远程 URL（或本就没有本地资产），可安全发送；
 *   - ok=false → 至少一个本地资产无法恢复（类型不支持被后端拒 / 本地 blob 源已丢失 /
 *                文件未从 iCloud 同步）→ 调用方必须终止发送，避免把本地 blob 发给后端
 *                或误触发一轮对话。失败元素保持原样（仍是本地 URL），气泡维持可重试态。
 *
 * @param {Object} message - 消息对象（content 为块数组）
 * @param {Function} [compressAndUploadFn] - 可选：InputEditor 的图片压缩上传方法
 */
export async function reuploadLocalAssets(message, compressAndUploadFn) {
  if (!message || !Array.isArray(message.content)) return { ok: true };

  let anyFail = false;

  for (const elm of message.content) {
    if (elm.type !== "image" && elm.type !== "file") continue;

    const url = elm.data?.file;
    if (typeof url !== "string") continue; // 部分通道 data.file 是对象(base64)，非本地 URL，跳过
    if (!url.startsWith("blob:") && !url.startsWith("data:")) continue; // 已是远程 URL

    // uploadDocumentFile 产出形如 `${remote}?size=N&name=X`，据此还原元信息
    let size = null;
    let name = null;
    try {
      const q = url.split("?")[1];
      if (q) {
        const params = new URLSearchParams(q);
        size = params.get("size") ? Number(params.get("size")) : null;
        name = params.get("name");
      }
    } catch {
      /* 查询畸形时忽略，走默认命名 */
    }

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("本地源已失效");
      const blob = await resp.blob();
      if (!blob || blob.size === 0) {
        throw new Error("本地源为空（可能尚未从 iCloud 同步）");
      }

      const guessName = name || (elm.type === "image" ? "retry-image" : "retry-file");
      const extFromType = (blob.type.split("/")[1] || "").split(";")[0];
      const filename = /\.[a-z0-9]+$/i.test(guessName)
        ? guessName
        : `${guessName}.${extFromType || "bin"}`;
      const file = new File([blob], filename, {
        type: blob.type || "application/octet-stream",
      });

      if (elm.type === "image") {
        let remoteUrl;
        if (compressAndUploadFn) {
          remoteUrl = await compressAndUploadFn(file);
        } else {
          const formData = new FormData();
          formData.append("image", file, filename);
          const upload = await client.uploadImage(formData);
          remoteUrl = upload.data.url;
        }
        elm.data.file = remoteUrl;
      } else {
        const upload = await client.uploadFile(file);
        const qs = size
          ? `?size=${size}&name=${name || filename}`
          : `?name=${name || filename}`;
        elm.data.file = `${upload.data.url}${qs}`;
      }
    } catch (e) {
      console.error(`重发时重新上传${elm.type}失败:`, e);
      anyFail = true; // 保持该元素为本地 URL，交由调用方终止发送
    }
  }

  return anyFail
    ? {
        ok: false,
        message: "附件无法重新上传（本地源丢失或类型不支持），已终止发送",
      }
    : { ok: true };
}

export function useChatMedia() {
  return {
    reuploadLocalAssets,
  };
}
