import { ref } from "vue";
import { ElMessage } from "element-plus";
import { snapdom } from "@zumer/snapdom";
import QRCode from "qrcode";
import { client } from "@/lib/runtime.js";
import { shareOrCopy } from "@/utils/tools.js";

const addTimestamp = (url) => {
  if (!url || url.startsWith("data:")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${Date.now()}`;
};

export function useChatScreenshot({ chatWindowRef, selectedMessages }) {
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

    try {
      const width = exportWidthMode.value === "wide" ? "850px" : "500px";

      // Build export container with selected width, mirroring chatwindow bg
      exportEl = document.createElement("div");
      exportEl.id = "chat-window";
      exportEl.className = "is-exporting";
      exportEl.style.cssText = `position:absolute;left:0;top:0;z-index:-10000;pointer-events:none;width:${width};background-color:var(--mio-bg-chat-window);padding:1.25rem 0 0 0;box-sizing:border-box;overflow:visible;`;

      // Also support wide mode styling on the inner message items
      if (exportWidthMode.value === "wide") {
        exportEl.classList.add("is-wide-export");
      }

      document.body.appendChild(exportEl);

      // Wrapper to maintain CSS selector hierarchy
      const messageWindow = document.createElement("div");
      messageWindow.className = "message-window";
      exportEl.appendChild(messageWindow);

      // Clone selected message DOM nodes (preserving real styles)
      const containerEls = Array.from(
        chatWindowRef.value.querySelectorAll(".message-container"),
      );
      for (const el of containerEls) {
        const itemId = el.getAttribute("data-id");
        const isSelected = selectedMessages.value.some(
          (id) => String(id) === itemId,
        );
        if (!isSelected) continue;
        const clone = el.cloneNode(true);
        // Remove multi-select UI artifacts
        clone.querySelector(".multi-select-box")?.remove();
        const wrapper = clone.querySelector(".message-flex-wrapper");
        if (wrapper) wrapper.classList.remove("is-multi-select", "is-selected");

        // Set crossOrigin + cache-busting timestamp on all images so snapdom can render them cross-origin
        const imgs = Array.from(clone.querySelectorAll("img"));
        for (const img of imgs) {
          img.setAttribute("crossorigin", "anonymous");
          img.crossOrigin = "anonymous";
          if (img.src && !img.src.startsWith("data:")) {
            img.src = addTimestamp(img.src);
          }
        }

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

      // Wait for images to load
      const allImgs = Array.from(exportEl.querySelectorAll("img"));
      const imgPromises = allImgs.map((img) => {
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
      exportEl?.remove();
      generatingImage.value = false;
    }
  };

  const downloadPreviewImage = () => {
    if (!previewImageUrl.value) return;
    const a = document.createElement("a");
    a.href = previewImageUrl.value;
    a.download = `chat_image_export_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showImagePreview.value = false;
  };

  const shareMobilePreviewLink = () => {
    if (!previewShareUrl.value) return;
    const { success, message } = shareOrCopy(previewShareUrl.value);
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
