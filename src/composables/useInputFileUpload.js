import { ref } from "vue";
import { client } from "@/lib/runtime.js";

export function useInputFileUpload({
  textareaRef,
  activeContactor,
  insertHtmlAtCursor,
  textToHtml,
  adjustTextareaHeight,
  ElMessage,
  emit,
}) {
  const pendingImageFiles = new Map();
  const showemoji = ref(false);

  const ctrlEmojiPanel = () => {
    showemoji.value = !showemoji.value;
    const editor = textareaRef.value;
    if (editor) editor.focus();
  };

  const getemoji = (e) => {
    const unicode = e.detail.unicode;
    insertHtmlAtCursor(textToHtml(unicode));
    ctrlEmojiPanel();
  };

  const insertImageToTextarea = (imageUrl, imageName) => {
    const imageElement = document.createElement("img");
    imageElement.src = imageUrl;
    imageElement.alt = imageName;
    imageElement.style.maxWidth = "10rem";
    imageElement.style.maxHeight = "10rem";
    const range = document.createRange();
    range.selectNodeContents(textareaRef.value);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const fragment = range.createContextualFragment(
      `<span>${imageElement.outerHTML}</span>`,
    );
    range.insertNode(fragment);
    setTimeout(() => {
      const newRange = document.createRange();
      newRange.selectNodeContents(textareaRef.value);
      newRange.collapse(false);
      const newSelection = window.getSelection();
      newSelection.removeAllRanges();
      newSelection.addRange(newRange);
    }, 0);
  };

  const handleLocalImageInsert = (file) => {
    const blobUrl = URL.createObjectURL(file);
    pendingImageFiles.set(blobUrl, file);
    insertImageToTextarea(blobUrl, file.name);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const clipboardData = e.clipboardData || window.clipboardData;
    const items = clipboardData.items;
    let pastedText = "";
    const imageFiles = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        imageFiles.push(item.getAsFile());
      } else if (item.type === "text/plain") {
        pastedText += clipboardData.getData("text/plain");
      }
    }

    if (pastedText) {
      const html = textToHtml(pastedText);
      insertHtmlAtCursor(html);
    }

    if (imageFiles.length) {
      imageFiles.forEach((file) => {
        handleLocalImageInsert(file);
      });
      adjustTextareaHeight();
    }
  };

  const handleDroppedFile = (file) => {
    if (file.type.startsWith("image/")) {
      handleLocalImageInsert(file);
      adjustTextareaHeight();
    } else {
      uploadFile(file);
    }
  };

  const compressAndUploadImage = (file) => {
    // iOS Safari + iCloud: 图片文件尚未同步到本地
    if (file.size === 0) {
      ElMessage.info('该图片正在从 iCloud 同步，请稍后重新选择');
      return Promise.reject(new Error('iCloud 文件尚未同步'));
    }
    return new Promise((resolve, reject) => {
      const maxSizeMB = 5;
      const maxSizeByte = maxSizeMB * 1024 * 1024;
      const fileType = file.type.toLowerCase();

      const img = new Image();
      const blobUrl = URL.createObjectURL(file);
      img.src = blobUrl;

      img.onload = () => {
        URL.revokeObjectURL(blobUrl);

        if (fileType === "image/gif") {
          if (file.size > maxSizeByte) {
            reject(new Error(`GIF 图片不能超过 ${maxSizeMB}MB`));
            return;
          }
          const formData = new FormData();
          formData.append("image", file, file.name);
          client
            .uploadImage(formData)
            .then((upload) => {
              resolve(upload.data.url);
            })
            .catch(reject);
          return;
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        let mimeType, quality;
        if (fileType === "image/png") {
          mimeType = "image/png";
        } else if (fileType === "image/webp") {
          mimeType = "image/webp";
          quality = 0.7;
        } else {
          mimeType = "image/jpeg";
          quality = 0.7;
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("图片压缩失败"));
              return;
            }
            if (blob.size > maxSizeByte) {
              reject(new Error(`压缩后仍超过 ${maxSizeMB}MB`));
              return;
            }
            const formData = new FormData();
            formData.append("image", blob, file.name);
            client
              .uploadImage(formData)
              .then((upload) => {
                resolve(upload.data.url);
              })
              .catch(reject);
          },
          mimeType,
          quality,
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("图片加载失败"));
      };
    });
  };
  const handleFileUpload = (file) => {
    if (file.size > 50 * 1024 * 1024) {
      ElMessage.error('文件大小超过50MB，无法上传');
      return;
    }
    // iOS Safari + iCloud: 文件尚未下载到本地时 size 为 0
    if (file.size === 0) {
      if (file.type.startsWith('image/')) {
        // 图片：iCloud 可能在后台同步，第二次选大概率就好了
        ElMessage.info('该图片正在从 iCloud 同步，请稍后重新选择');
      } else {
        ElMessage.warning('该文件（iCloud）尚未同步到本地，请先在"文件"App 中打开并等待下载完成后再试');
      }
      return;
    }
    if (file.type.startsWith('image/')) {
      handleLocalImageInsert(file);
      adjustTextareaHeight();
    } else {
      uploadDocumentFile(file);
    }
  };

  const uploadFile = (file) => {
    if (file instanceof File) {
      handleFileUpload(file);
      return;
    }
    const availableImageFormats = ["png", "jpg", "jpeg", "webp"];
    const availableDocFormats = ["docx", "txt", "pdf", "pptx", "xlsx"];
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = [...availableDocFormats, ...availableImageFormats]
      .map((format) => `.${format}`)
      .join(",");
    const handleChange = async (e) => {
      fileInput.removeEventListener("change", handleChange);
      const file = e.target.files[0];
      if (!file) return;
      handleFileUpload(file);
    };
    fileInput.addEventListener("change", handleChange);
    fileInput.click();
  };

  const uploadDocumentFile = async (file) => {
    const localBlobUrl = URL.createObjectURL(file);
    const fileUrl = `${localBlobUrl}?size=${file.size}&name=${file.name}`;

    const container = activeContactor.value.getBaseUserContainer();
    container.status = "uploading";
    container.content.push({
      type: "file",
      data: { file: fileUrl },
    });

    activeContactor.value.messageChain.push(container);
    emit("stroge");
    emit("toButtom");

    try {
      const upload = await client.uploadFile(file);
      URL.revokeObjectURL(localBlobUrl);
      const remoteFileUrl = `${upload.data.url}?size=${file.size}&name=${file.name}`;

      const msgInChain = activeContactor.value.messageChain.find(
        (m) => m.id === container.id,
      );
      if (msgInChain) {
        msgInChain.content[0].data.file = remoteFileUrl;
        msgInChain.status = "completed";
      }

      container.content[0].data.file = remoteFileUrl;
      container.status = "completed";
      ElMessage.success("文件上传成功");
    } catch (error) {
      console.error("文件上传失败:", error);
      ElMessage.error("文件上传失败，请稍后再试");

      const msgInChain = activeContactor.value.messageChain.find(
        (m) => m.id === container.id,
      );
      if (msgInChain) {
        msgInChain.status = "failed";
      }
      container.status = "failed";
    }
    emit("stroge");
    emit("toButtom");
  };

  return {
    pendingImageFiles,
    showemoji,
    ctrlEmojiPanel,
    getemoji,
    handlePaste,
    handleDroppedFile,
    handleLocalImageInsert,
    compressAndUploadImage,
    uploadFile,
    handleFileUpload,
    uploadDocumentFile,
  };
}
