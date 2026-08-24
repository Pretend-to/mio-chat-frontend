import { ref } from "vue";
import { ElMessage } from "element-plus";
import { snapdom } from "@zumer/snapdom";
import QRCode from "qrcode";
import { client } from "@/lib/runtime.js";
import { shareOrCopy } from "@/utils/tools.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";

export function useChatScreenshot({ chatWindowRef, selectedMessages }) {
  const contactorsStore = useContactorsStore();
  const showImagePreview = ref(false);
  const previewImageUrl = ref("");
  const previewShareUrl = ref("");
  const isMobileDevice = ref(window.innerWidth < 768);
  const generatingImage = ref(false);
  const exportWidthMode = ref("narrow");
  const qrUrl = ref("");
  const showQRCode = ref(true);

  const handleMultiShareImage = async (activeContactor) => {
    if (selectedMessages.value.length === 0) return;
    try {
      ElMessage.info("正在获取分享信息...");
      const shareResult = await client.shareMessages(
        activeContactor.id,
        selectedMessages.value,
      );
      const shareUrl = shareResult?.shareUrl ?? window.location.origin;
      previewShareUrl.value = shareUrl;

      // Generate QR code locally as a Data URI and save it in state
      qrUrl.value = await QRCode.toDataURL(shareUrl, { width: 120, margin: 1 });

      // Reset export width mode and display preview
      exportWidthMode.value = "narrow";
      isMobileDevice.value = window.innerWidth < 768;
      showImagePreview.value = true;

      // Generate the screenshot
      await generateScreenshot();
    } catch (err) {
      console.error("分享失败", err);
      ElMessage.error("获取分享信息失败");
    }
  };

  const onExportWidthModeChange = async () => {
    await generateScreenshot();
  };

  const generateScreenshot = async () => {
    generatingImage.value = true;
    previewImageUrl.value = ""; // clear old preview
    let exportEl = null;
    const blobUrls = [];
    const imgBlobPromises = [];
    const srcBlobMap = new Map(); // src -> Promise<blobUrl|null>，同一 URL 只 fetch 一次

    try {
      const width = exportWidthMode.value === "wide" ? "850px" : "500px";

      // Build export container with selected width, mirroring chatwindow bg
      exportEl = document.createElement("div");
      exportEl.id = "chat-window";
      exportEl.className = "is-exporting";
      exportEl.style.cssText = `position:absolute;left:0;top:0;z-index:-10000;pointer-events:none;width:${width};background-color:var(--mio-bg-chat-window);padding:0;box-sizing:border-box;overflow:visible;`;

      // Also support wide mode styling on the inner message items
      if (exportWidthMode.value === "wide") {
        exportEl.classList.add("is-wide-export");
      }

      document.body.appendChild(exportEl);

      // 导出头：自己构造，不复用真实 ChatHeader —— 其形态由视口 media query 决定，
      // 克隆到导出容器会错误呈现（宽图模式下仍是移动端形态）。
      // 统一内联样式渲染，桌面/移动、窄图/宽图形态完全一致。
      const contactor = contactorsStore.activeContactor;
      if (contactor) {
        const headEl = document.createElement("div");
        headEl.style.cssText =
          "display:flex;align-items:center;gap:12px;padding:14px 20px;background-color:var(--mio-bg-card);border-bottom:1px solid var(--mio-border-color-light);";

        // 头像：单聊/自定义群头像用图片；群聊无头像时用圆角方块 + 首字
        const avatarUrl = contactor.avatar || "";
        if (avatarUrl) {
          const avatarImg = document.createElement("img");
          avatarImg.src = avatarUrl;
          avatarImg.style.cssText =
            "width:44px;height:44px;border-radius:12px;object-fit:cover;flex-shrink:0;";
          headEl.appendChild(avatarImg);
        } else {
          const avatarPlaceholder = document.createElement("div");
          avatarPlaceholder.style.cssText =
            "width:44px;height:44px;border-radius:12px;background-color:var(--mio-color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;flex-shrink:0;";
          avatarPlaceholder.textContent = (contactor.name || "群")[0];
          headEl.appendChild(avatarPlaceholder);
        }

        const infoEl = document.createElement("div");
        infoEl.style.cssText =
          "display:flex;flex-direction:column;gap:2px;min-width:0;";

        const nameEl = document.createElement("div");
        nameEl.style.cssText =
          "font-size:16px;font-weight:600;color:var(--mio-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
        nameEl.textContent =
          contactor.name || (contactor.platform === "group" ? "群聊" : "对话");
        infoEl.appendChild(nameEl);

        const subEl = document.createElement("div");
        subEl.style.cssText =
          "font-size:12px;color:var(--mio-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
        if (contactor.platform === "group") {
          subEl.textContent = `${contactor.members?.length || 0} 位成员`;
        } else {
          subEl.textContent = contactor.title || "MioChat";
        }
        infoEl.appendChild(subEl);

        headEl.appendChild(infoEl);
        exportEl.appendChild(headEl);
      }

      // Wrapper to maintain CSS selector hierarchy
      const messageWindow = document.createElement("div");
      messageWindow.className = "message-window";
      // head 与消息区之间保留原顶部留白
      messageWindow.style.paddingTop = "1.25rem";
      exportEl.appendChild(messageWindow);

      const containerEls = Array.from(
        chatWindowRef.value.querySelectorAll(".message-container"),
      );
      for (const el of containerEls) {
        const itemId = el.getAttribute("data-id") || el.dataset?.id;
        const isSelected = selectedMessages.value.some(
          (id) => String(id) === String(itemId),
        );
        if (!isSelected) continue;
        const clone = el.cloneNode(true);
        // Remove multi-selectUI artifacts
        clone.querySelector(".multi-select-box")?.remove();
        const wrapper = clone.querySelector(".message-flex-wrapper");
        if (wrapper) wrapper.classList.remove("is-multi-select", "is-selected");

        // 穿透展开 Shadow DOM：cloneNode(true) 不会克隆 shadowRoot 内部内容
        // 这里主动将每个 shadowRoot 内部的 HTML（含卡片自包含 style 与 DOM）注入到克隆节点中，使 snapdom 能够完整绘制
        const origHosts = el.querySelectorAll(".shadow-html-host");
        const cloneHosts = clone.querySelectorAll(".shadow-html-host");
        origHosts.forEach((origHost, i) => {
          const cloneHost = cloneHosts[i];
          if (cloneHost && origHost.shadowRoot) {
            cloneHost.innerHTML = origHost.shadowRoot.innerHTML;
          }
        });

        messageWindow.appendChild(clone);
      }
      // Footer with QR code in a premium card style
      if (showQRCode.value) {
        const footer = document.createElement("div");
        footer.style.cssText =
          "margin:1rem 1.25rem 0.5rem;padding:1.25rem 1.5rem;background-color:var(--mio-bg-card);border:1px solid var(--mio-border-color-light);border-radius:16px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 20px rgba(0,0,0,0.03);";

        const textDiv = document.createElement("div");
        textDiv.innerHTML =
          '<div style="font-weight:700;font-size:15px;color:var(--mio-text-primary);letter-spacing:0.5px;">扫码接续对话</div><div style="font-size:12px;color:var(--mio-text-secondary);margin-top:6px;line-height:1.5;">在手机上扫码，即可随时接续本次精彩对话</div>';

        const qrImg = document.createElement("img");
        qrImg.src = qrUrl.value;
        qrImg.style.cssText =
          "width:72px;height:72px;flex-shrink:0;border:1px solid var(--mio-border-color-light);border-radius:10px;padding:3px;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.04);";
        qrImg.crossOrigin = "anonymous";

        footer.appendChild(textDiv);
        footer.appendChild(qrImg);
        exportEl.appendChild(footer);
      }

      // Signature line at the very bottom
      const signature = document.createElement("div");
      signature.style.cssText =
        "text-align:center;padding:1rem 0 1.5rem;font-size:12px;color:var(--mio-text-secondary);opacity:0.6;letter-spacing:1px;font-weight:500;";
      signature.innerHTML = "Powered by MioChat & snapdom";
      exportEl.appendChild(signature);

      // 统一处理 exportEl 内所有图片（head 头像 + 消息图片；二维码 data URI 自动跳过）：
      // 聊天窗口里的图片此前以 no-cors 模式加载过，浏览器对同一 URL 缓存了 non-CORS 响应
      // （除非服务器响应带 Vary: Origin）。直接给 img 设 crossorigin 会命中该缓存，
      // 返回 non-CORS 响应导致 snapdom canvas 污染/无法渲染。
      //
      // 解决：用 fetch(cors + cache:reload) 强制绕过本地缓存拿到新鲜 CORS 响应，
      // 转成 blob URL 替换 img.src —— blob 同源天然干净；且 URL 原样不变，
      // 不破坏 S3 签名 / 带 token 的地址（时间戳方案做不到这点）。
      //
      // 按 URL 去重：同一 src（头像最典型，N 条消息共享一个头像 URL）只 fetch 一次，
      // 生成的 blob URL 复用给所有同源 img，避免对同一地址重复发请求。
      const allImgs = Array.from(exportEl.querySelectorAll("img"));
      for (const img of allImgs) {
        const src = img.src;
        if (!src || src.startsWith("data:") || src.startsWith("blob:"))
          continue;

        let blobPromise = srcBlobMap.get(src);
        if (!blobPromise) {
          // 单 URL 8s 超时兜底，避免慢图/挂死的服务器拖垮整张截图
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          blobPromise = fetch(src, {
            mode: "cors",
            cache: "reload",
            signal: controller.signal,
          })
            .then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.blob();
            })
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              blobUrls.push(url);
              return url;
            })
            .catch((err) => {
              // 服务器未配置 CORS / 超时：保留原 src（与旧行为一致，至少不崩溃）
              console.warn(
                "[Screenshot] 图片 CORS 加载失败，保留原 src:",
                src,
                err,
              );
              return null;
            })
            .finally(() => clearTimeout(timer));
          srcBlobMap.set(src, blobPromise);
        }

        imgBlobPromises.push(
          blobPromise.then((blobUrl) => {
            if (blobUrl) img.src = blobUrl;
          }),
        );
      }

      // 先等所有图片完成 CORS 拉取并替换为 blob URL
      await Promise.all(imgBlobPromises);

      // Wait for images to load
      const loadImgs = Array.from(exportEl.querySelectorAll("img"));
      const imgPromises = loadImgs.map((img) => {
        img.setAttribute("loading", "eager");

        return new Promise((resolve) => {
          // Register listeners synchronously to avoid missing any load event
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });

          // In case the image is already loaded (or data URI), check complete status after a short delay
          // to bypass Chrome's stale clone complete status bug.
          setTimeout(() => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
            }
          }, 50);

          // Absolute fallback timeout
          setTimeout(resolve, 5000);
        });
      });

      await Promise.all(imgPromises);
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );

      // Force layout reflow and measure the exact scroll dimensions
      const actualHeight = exportEl.scrollHeight;
      console.log(
        "Measured exportEl dimensions:",
        exportEl.offsetWidth,
        actualHeight,
      );

      // snapdom drawing config
      const result = await snapdom(exportEl, {
        scale: 2,
        dpr: 1,
        width: exportEl.offsetWidth,
        height: actualHeight,
      });
      const img = await result.toPng();
      previewImageUrl.value = img.src;
      ElMessage.success("图片预览生成成功");
    } catch (err) {
      console.error("生成图片失败", err);
      ElMessage.error("生成图片预览失败");
    } finally {
      // snapdom 绘制完成后统一释放 blob URL，避免内存泄漏
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.length = 0;
      exportEl?.remove();
      generatingImage.value = false;
    }
  };

  /**
   * 保存/下载分享图片。
   *
   * 桌面端：保持原有 <a download href="data:..."> 直接下载（稳定已验证）。
   * 移动端：data URI + download 属性兼容性差（iOS 常跳新标签页打开图片而非保存），
   *   优先 Web Share API Level 2（navigator.share({ files })）调起系统分享面板，
   *   用户可直接「存储图像」或分享到微信等应用；浏览器不支持 files 分享时
   *   直接降级为引导长按预览图保存（不再走 blob/data URI 下载，移动端不可靠）。
   */
  const downloadPreviewImage = async () => {
    if (!previewImageUrl.value) return;

    const isMobile = window.innerWidth < 768;

    // 桌面端：保持原有 data URI 下载行为
    if (!isMobile) {
      const a = document.createElement("a");
      a.href = previewImageUrl.value;
      a.download = `chat_image_export_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showImagePreview.value = false;
      return;
    }

    // —— 移动端 ——
    // 首选：Web Share API Level 2
    if (navigator.canShare && navigator.share) {
      try {
        const blob = await fetch(previewImageUrl.value).then((r) => r.blob());
        const file = new File(
          [blob],
          `chat_image_export_${Date.now()}.png`,
          { type: blob.type || "image/png" },
        );
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "MioChat 分享图片",
            text: "来自 MioChat 的聊天记录分享",
          });
          showImagePreview.value = false;
          return;
        }
      } catch (err) {
        // 用户主动取消分享：静默返回，保持预览不关闭
        if (err?.name === "AbortError") return;
        console.warn("[Screenshot] Web Share 失败:", err);
      }
    }

    // 兜底：不支持自动保存时引导长按预览图保存（不关闭预览）
    ElMessage.warning("当前浏览器不支持直接保存，请长按上方图片选择「存储图像」");
  };

  const shareMobilePreviewLink = async () => {
    if (!previewShareUrl.value) return;
    const { success, message } = await shareOrCopy(previewShareUrl.value);
    // 空 message = 用户取消分享，不弹任何提示
    if (!message) return;
    if (success) {
      ElMessage.success(message);
    } else {
      ElMessage.error(message);
    }
  };

  const copyPreviewImage = async () => {
    if (!previewImageUrl.value) return;
    try {
      const response = await fetch(previewImageUrl.value);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      ElMessage.success("已复制到剪贴板");
      showImagePreview.value = false;
    } catch (error) {
      console.error("复制图片失败:", error);
      ElMessage.error("复制图片失败，您的浏览器可能不支持该功能");
    }
  };

  return {
    showImagePreview,
    previewImageUrl,
    previewShareUrl,
    isMobileDevice,
    generatingImage,
    exportWidthMode,
    qrUrl,
    showQRCode,
    handleMultiShareImage,
    onExportWidthModeChange,
    generateScreenshot,
    downloadPreviewImage,
    shareMobilePreviewLink,
    copyPreviewImage,
  };
}
