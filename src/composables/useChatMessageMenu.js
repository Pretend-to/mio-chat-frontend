import { ref } from "vue";
import { ElMessage } from "element-plus";
import { client } from "@/lib/runtime.js";

/**
 * 消息右键菜单状态与操作分发
 */
export function useChatMessageMenu({
  activeContactor,
  renderedCount,
  getRetryTargetIndex,
  handleMenuRetry,
  speakMessage,
  inputEditor,
  isMultiSelect,
  selectedMessages,
}) {
  const showMenu = ref(false);
  const menuTop = ref(0);
  const menuLeft = ref(0);
  const validMessageIndex = ref(-1);
  const canRetry = ref(true);
  const seletedText = ref("");
  const seletedImage = ref("");
  const lastClickTime = ref(0);

  const getseletedMessage = () => {
    if (validMessageIndex.value === -1) return null;
    return activeContactor.value?.messageChain?.[validMessageIndex.value] || null;
  };

  const showMessageMenu = (event, messageIndex) => {
    if (
      event.target &&
      event.target.tagName &&
      event.target.tagName.toLowerCase() === "img"
    ) {
      const imgElement = event.target;
      seletedImage.value = imgElement.src;
    }

    const chain = activeContactor.value?.messageChain || [];
    const renderedCountVal = renderedCount.value;
    const realIndex =
      chain.length > renderedCountVal
        ? chain.length - renderedCountVal + messageIndex
        : messageIndex;

    validMessageIndex.value = realIndex;
    canRetry.value = getRetryTargetIndex(chain, realIndex) !== -1;
    if (event.preventDefault) event.preventDefault();
    showMenu.value = true;
    menuTop.value = event.clientY;
    menuLeft.value = event.clientX;

    const currentSelectedText = window.getSelection().toString();
    if (currentSelectedText) {
      seletedText.value = currentSelectedText;
    } else {
      seletedText.value = "";
    }
  };

  const handleTouchStart = (event, index) => {
    const now = Date.now();
    const delay = now - lastClickTime.value;

    if (delay < 300 && delay > 0) {
      if (event.cancelable) event.preventDefault();
      const touch = event.touches[0];
      const syntheticEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: event.target,
        preventDefault: () => {
          if (event.preventDefault) event.preventDefault();
        },
      };
      showMessageMenu(syntheticEvent, index);
      lastClickTime.value = 0;
    } else {
      lastClickTime.value = now;
    }
  };

  const handleMessageOption = async (option) => {
    const message = getseletedMessage();
    switch (option) {
      case "multi-select":
        isMultiSelect.value = true;
        if (message && message.id) {
          selectedMessages.value.push(message.id);
        }
        break;
      case "retry":
        if (handleMenuRetry) {
          await handleMenuRetry(message, validMessageIndex.value);
        }
        break;
      case "reply":
        if (inputEditor?.value) {
          inputEditor.value.insertReplyBadge(message);
          ElMessage.success("已引用该消息");
        }
        break;
      case "mention": {
        const name = message?.senderName || message?.sender_name;
        const memberId = message?.senderMemberId || message?.sender_id;
        if (inputEditor?.value && name) {
          inputEditor.value.insertMention(name, memberId);
        }
        break;
      }
      case "delete":
        if (activeContactor.value && message) {
          activeContactor.value.delMessage(message.id);
          client.setLocalStorage();
        }
        break;
      case "stop":
        if (activeContactor.value && message) {
          activeContactor.value.interruptMessage(message.id);
        }
        break;
      case "toggle-pin":
        if (message) {
          message.isPinned = !message.isPinned;
          client.setLocalStorage();
          ElMessage.success(message.isPinned ? "消息已钉住" : "已取消钉住");
        }
        break;
      case "read-aloud":
        if (speakMessage && message) {
          speakMessage(message);
        }
        break;
      case "view-detail":
        detailTargetMessage.value = message;
        showDetailDialog.value = true;
        break;
    }
    showMenu.value = false;
  };

  const showDetailDialog = ref(false);
  const detailTargetMessage = ref(null);

  return {
    showMenu,
    menuTop,
    menuLeft,
    validMessageIndex,
    canRetry,
    seletedText,
    seletedImage,
    showDetailDialog,
    detailTargetMessage,
    getseletedMessage,
    showMessageMenu,
    handleTouchStart,
    handleMessageOption,
  };
}
