import { ref, reactive, watch, nextTick, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import { client } from "@/lib/runtime.js";
import { shareOrCopy } from "@/utils/tools.js";

export function useChatSelection({
  chatWindowRef,
  activeMessageChain,
  selectedMessages,
  isMultiSelect,
  isMobileDevice,
}) {
  // Desktop Drag Select State
  const dragSelect = reactive({
    isDown: false,
    active: false,
    mouseDownX: 0,
    mouseDownY: 0,
    startX: 0,
    startY: 0,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    lastClientX: 0,
    lastClientY: 0,
    scrollRafId: null,
  });

  // Mobile Selection Banners State
  const hasSelectedAbove = ref(false);
  const hasSelectedBelow = ref(false);
  const firstVisibleIndex = ref(-1);
  const lastVisibleIndex = ref(-1);
  const minSelectedIndex = ref(Infinity);
  const maxSelectedIndex = ref(-Infinity);

  const toggleSelect = (id) => {
    if (!id) return;
    const idx = selectedMessages.value.indexOf(id);
    if (idx > -1) {
      selectedMessages.value.splice(idx, 1);
    } else {
      selectedMessages.value.push(id);
    }
  };

  const cancelMultiSelect = () => {
    isMultiSelect.value = false;
    selectedMessages.value = [];
  };

  // Update selection banner visibility and indexes
  const updateVisibilitySelectionState = () => {
    if (!isMultiSelect.value || !chatWindowRef.value) {
      hasSelectedAbove.value = false;
      hasSelectedBelow.value = false;
      return;
    }

    if (selectedMessages.value.length === 0) {
      hasSelectedAbove.value = false;
      hasSelectedBelow.value = false;
      return;
    }

    const rect = chatWindowRef.value.getBoundingClientRect();
    const messageElms = chatWindowRef.value.querySelectorAll(
      ".message-container[data-id]",
    );
    if (messageElms.length === 0) return;

    let firstVis = -1;
    let lastVis = -1;
    const visibleTop = rect.top + 72;
    const visibleBottom = rect.bottom - 80;

    messageElms.forEach((el, index) => {
      const elRect = el.getBoundingClientRect();
      const isVisible =
        elRect.bottom > visibleTop && elRect.top < visibleBottom;

      if (isVisible) {
        if (firstVis === -1) {
          firstVis = index;
        }
        lastVis = index;
      }
    });

    if (firstVis === -1) firstVis = 0;
    if (lastVis === -1) lastVis = messageElms.length - 1;

    let minSel = Infinity;
    let maxSel = -Infinity;

    activeMessageChain.value.forEach((msg, index) => {
      if (selectedMessages.value.includes(msg.id)) {
        if (index < minSel) minSel = index;
        if (index > maxSel) maxSel = index;
      }
    });

    firstVisibleIndex.value = firstVis;
    lastVisibleIndex.value = lastVis;
    minSelectedIndex.value = minSel;
    maxSelectedIndex.value = maxSel;

    hasSelectedAbove.value = minSel < firstVis;
    hasSelectedBelow.value = maxSel > lastVis;
  };

  // Watch selected messages changes to update banners
  watch(
    () => selectedMessages.value,
    () => {
      updateVisibilitySelectionState();
    },
    { deep: true },
  );

  // Desktop Drag Select Implementation
  const handleMouseDown = (e) => {
    if (!isMultiSelect.value || isMobileDevice.value || e.button !== 0) return;

    // Check if target is inside an interactive element
    let target = e.target;
    while (target && target !== chatWindowRef.value) {
      if (
        target.classList.contains("multi-select-box") ||
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.classList.contains("round-checkbox") ||
        target.closest(".el-button") ||
        target.closest(".context-menu") ||
        target.closest(".options") ||
        target.closest(".return")
      ) {
        return;
      }
      target = target.parentNode;
    }

    const rect = chatWindowRef.value.getBoundingClientRect();
    dragSelect.isDown = true;
    dragSelect.mouseDownX = e.clientX;
    dragSelect.mouseDownY = e.clientY;
    dragSelect.startX = e.clientX - rect.left + chatWindowRef.value.scrollLeft;
    dragSelect.startY = e.clientY - rect.top + chatWindowRef.value.scrollTop;
    dragSelect.lastClientX = e.clientX;
    dragSelect.lastClientY = e.clientY;
    dragSelect.active = false;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUpDrag);
  };

  const handleMouseMove = (e) => {
    if (!dragSelect.isDown) return;

    const rect = chatWindowRef.value.getBoundingClientRect();
    dragSelect.lastClientX = e.clientX;
    dragSelect.lastClientY = e.clientY;

    if (!dragSelect.active) {
      const dx = e.clientX - dragSelect.mouseDownX;
      const dy = e.clientY - dragSelect.mouseDownY;
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        dragSelect.active = true;
        // Clear text selection
        window.getSelection()?.removeAllRanges();
        // Start auto-scroll loop
        if (dragSelect.scrollRafId) {
          cancelAnimationFrame(dragSelect.scrollRafId);
        }
        dragScrollLoop();
      }
    }

    if (dragSelect.active) {
      e.preventDefault();

      const currentX = e.clientX - rect.left + chatWindowRef.value.scrollLeft;
      const currentY = e.clientY - rect.top + chatWindowRef.value.scrollTop;

      dragSelect.left = Math.min(dragSelect.startX, currentX);
      dragSelect.top = Math.min(dragSelect.startY, currentY);
      dragSelect.width = Math.abs(dragSelect.startX - currentX);
      dragSelect.height = Math.abs(dragSelect.startY - currentY);

      updateDragSelection();
    }
  };

  const handleMouseUpDrag = () => {
    dragSelect.isDown = false;
    dragSelect.active = false;
    if (dragSelect.scrollRafId) {
      cancelAnimationFrame(dragSelect.scrollRafId);
      dragSelect.scrollRafId = null;
    }
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUpDrag);
  };

  const dragScrollLoop = () => {
    if (!dragSelect.active) return;
    const rect = chatWindowRef.value.getBoundingClientRect();
    const clientY = dragSelect.lastClientY;

    let scrollAmount = 0;
    const threshold = 40; // px
    const maxSpeed = 20; // px

    if (clientY - rect.top < threshold) {
      const diff = threshold - (clientY - rect.top);
      scrollAmount = -Math.min(maxSpeed, diff * 0.5);
    } else if (rect.bottom - clientY < threshold) {
      const diff = threshold - (rect.bottom - clientY);
      scrollAmount = Math.min(maxSpeed, diff * 0.5);
    }

    if (scrollAmount !== 0) {
      chatWindowRef.value.scrollTop += scrollAmount;
      updateDragSelection();
    }

    dragSelect.scrollRafId = requestAnimationFrame(() => dragScrollLoop());
  };

  const updateDragSelection = () => {
    if (!dragSelect.active) return;
    const rect = chatWindowRef.value.getBoundingClientRect();
    const boxTop = dragSelect.top;
    const boxLeft = dragSelect.left;
    const boxBottom = dragSelect.top + dragSelect.height;
    const boxRight = dragSelect.left + dragSelect.width;

    const selectedIds = [];
    const messageElms = chatWindowRef.value.querySelectorAll(
      ".message-container[data-id]",
    );

    messageElms.forEach((el) => {
      const idAttr = el.getAttribute("data-id");
      if (!idAttr) return;

      const msgObj = activeMessageChain.value.find(
        (m) => String(m.id) === String(idAttr),
      );
      if (!msgObj || msgObj.role === "mio_system") return;

      const elRect = el.getBoundingClientRect();
      const elTop = elRect.top - rect.top + chatWindowRef.value.scrollTop;
      const elLeft = elRect.left - rect.left + chatWindowRef.value.scrollLeft;
      const elBottom = elTop + elRect.height;
      const elRight = elLeft + elRect.width;

      const isIntersecting = !(
        elLeft > boxRight ||
        elRight < boxLeft ||
        elTop > boxBottom ||
        elBottom < boxTop
      );

      if (isIntersecting) {
        selectedIds.push(msgObj.id);
      }
    });

    selectedMessages.value = selectedIds;
  };

  // Mobile Top/Bottom selection links
  const selectToTopHere = () => {
    if (firstVisibleIndex.value === -1 || maxSelectedIndex.value === -Infinity)
      return;

    const idsToSelect = new Set(selectedMessages.value);
    for (let i = firstVisibleIndex.value; i <= maxSelectedIndex.value; i++) {
      const msg = activeMessageChain.value[i];
      if (msg && msg.role !== "mio_system") {
        idsToSelect.add(msg.id);
      }
    }
    selectedMessages.value = Array.from(idsToSelect);
    updateVisibilitySelectionState();
  };

  const selectToBottomHere = () => {
    if (lastVisibleIndex.value === -1 || minSelectedIndex.value === Infinity)
      return;

    const idsToSelect = new Set(selectedMessages.value);
    for (let i = minSelectedIndex.value; i <= lastVisibleIndex.value; i++) {
      const msg = activeMessageChain.value[i];
      if (msg && msg.role !== "mio_system") {
        idsToSelect.add(msg.id);
      }
    }
    selectedMessages.value = Array.from(idsToSelect);
    updateVisibilitySelectionState();
  };

  // Selection actions
  const handleMultiDelete = (activeContactor) => {
    if (selectedMessages.value.length === 0) return;
    for (let i = activeContactor.messageChain.length - 1; i >= 0; i--) {
      if (selectedMessages.value.includes(activeContactor.messageChain[i].id)) {
        activeContactor.messageChain.splice(i, 1);
      }
    }
    client.setLocalStorage();
    cancelMultiSelect();
  };

  const handleMultiCopy = (activeContactor, clientName) => {
    if (selectedMessages.value.length === 0) return;
    let text = "";
    activeMessageChain.value.forEach((msg) => {
      if (selectedMessages.value.includes(msg.id)) {
        const senderName =
          msg.role === "other" ? activeContactor.name : clientName;
        const time = activeContactor.getShownTime(msg.time);
        let msgText = "";
        msg.content.forEach((element) => {
          if (element.type === "text") {
            msgText += element.data.text;
          } else if (element.type === "image") {
            msgText += `[图片]`;
          }
        });
        text += `${senderName} ${time}\n${msgText}\n\n`;
      }
    });

    const textarea = document.createElement("textarea");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    textarea.value = text.trim();
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    ElMessage.success("已复制选中的消息");
    cancelMultiSelect();
  };

  const handleMultiShareMD = (activeContactor, clientName) => {
    if (selectedMessages.value.length === 0) return;
    let mdText = `# 与${activeContactor.name}的对话记录\n\n`;
    activeMessageChain.value.forEach((msg) => {
      if (selectedMessages.value.includes(msg.id)) {
        const senderName =
          msg.role === "other" ? activeContactor.name : clientName;
        const time = activeContactor.getShownTime(msg.time);
        let msgText = "";
        msg.content.forEach((element) => {
          if (element.type === "text") {
            msgText += element.data.text;
          } else if (element.type === "image") {
            msgText += `![图片](${element.data.file})`;
          }
        });
        mdText += `### ${senderName} _${time}_\n${msgText}\n\n`;
      }
    });

    const blob = new Blob([mdText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat_export_${new Date().getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    ElMessage.success("已导出Markdown");
    cancelMultiSelect();
  };

  const handleMultiShareLink = async (activeContactor) => {
    if (selectedMessages.value.length === 0) return;
    ElMessage.info("正在生成分享链接...");
    const shareResult = await client.shareMessages(
      activeContactor.id,
      selectedMessages.value,
    );
    if (shareResult && shareResult.shareUrl) {
      const { success, message } = shareOrCopy(shareResult.shareUrl);
      if (success) {
        ElMessage.success("分享链接已复制到剪贴板");
      } else {
        ElMessage.error(message);
      }
    } else {
      ElMessage.error("生成分享链接失败");
    }
    cancelMultiSelect();
  };

  onBeforeUnmount(() => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUpDrag);
    if (dragSelect.scrollRafId) {
      cancelAnimationFrame(dragSelect.scrollRafId);
    }
  });

  return {
    dragSelect,
    hasSelectedAbove,
    hasSelectedBelow,
    firstVisibleIndex,
    lastVisibleIndex,
    minSelectedIndex,
    maxSelectedIndex,
    toggleSelect,
    cancelMultiSelect,
    updateVisibilitySelectionState,
    handleMouseDown,
    handleMouseUpDrag,
    selectToTopHere,
    selectToBottomHere,
    handleMultiDelete,
    handleMultiCopy,
    handleMultiShareMD,
    handleMultiShareLink,
  };
}
