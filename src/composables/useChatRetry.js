import { ref } from "vue";
import { ElMessage } from "element-plus";
import { client } from "@/lib/runtime.js";
import { gateway } from "@/lib/gateway.js";
import { numberString } from "@/utils/generate.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { reuploadBlobImages } from "@/composables/useChatMedia.js";

/**
 * 消息重试子系统
 */
export function useChatRetry({ activeContactor, toBottom, inputEditor }) {
  const contactorsStore = useContactorsStore();
  const retryList = ref([]);

  const getRetryTargetIndex = (chain, index) => {
    const clickedMsg = chain?.[index];
    if (!clickedMsg) return -1;

    if (clickedMsg.role === "other") {
      // Assistant message: must be chat source
      if (clickedMsg.triggerType === "task") return -1;
      return index;
    }

    if (clickedMsg.role === "user") {
      // User message: skip tasks until we find a chat message or end of chain
      let targetIdx = index + 1;
      while (
        targetIdx < chain.length &&
        chain[targetIdx].triggerType === "task"
      ) {
        targetIdx++;
      }
      return targetIdx;
    }

    return -1;
  };

  /**
   * 消息项失败气泡上的重试按钮
   */
  const handleRetryMessage = async (item) => {
    const contactor = activeContactor.value;
    if (!contactor) return;

    if (item.triggerType === "task") {
      ElMessage.warning("非聊天来源的消息不支持重试");
      return;
    }

    const uploadFn = inputEditor?.value?.compressAndUploadImage;

    if (contactor.platform === "onebot") {
      item.status = "pending";
      item.time = Date.now();
      client.setLocalStorage();
      try {
        await reuploadBlobImages(item, uploadFn);
        await contactor.webSend(item);
        ElMessage.success("消息已重新发送");
      } catch (e) {
        // Error handled in sendMessage
      }
    } else {
      // OpenAI / Group platform retry
      const idx = contactor.messageChain.findIndex((m) => m.id === item.id);
      if (idx === -1) return;

      item.status = "pending";
      item.time = Date.now();

      const targetIndex = idx + 1;
      let assistantMsg = contactor.messageChain[targetIndex];
      if (!assistantMsg || assistantMsg.role !== "other") {
        assistantMsg = {
          role: "other",
          time: Date.now(),
          content: [{ type: "blank", data: {} }],
          id: numberString(16),
          status: "pending",
          triggerType: "chat",
        };
        contactor.messageChain.splice(targetIndex, 0, assistantMsg);
      } else {
        assistantMsg.content = [{ type: "blank", data: {} }];
        assistantMsg.time = Date.now();
        assistantMsg.status = "pending";
      }

      client.setLocalStorage();
      if (toBottom) toBottom();

      await reuploadBlobImages(item, uploadFn);

      try {
        await gateway.send(
          contactor.platform,
          contactor.id,
          contactor.messageChain,
          assistantMsg.id,
          contactor.options,
        );
        item.status = "completed";
        client.setLocalStorage();
      } catch (error) {
        ElMessage.error(error.message || "重试失败");
        item.status = "failed";
        assistantMsg.status = "failed";
        client.setLocalStorage();
      }
    }
  };

  /**
   * 右键菜单触发的重新生成 / 重发
   */
  const handleMenuRetry = async (message, messageIndex) => {
    const contactor = activeContactor.value;
    if (!contactor) return;

    const uploadFn = inputEditor?.value?.compressAndUploadImage;

    if (contactor.platform === "onebot") {
      const msgToSend = {
        ...message,
        role: "user",
        id: numberString(16),
        status: "pending",
        time: Date.now(),
      };
      await reuploadBlobImages(msgToSend, uploadFn);
      activeContactor.value.webSend(msgToSend);
      ElMessage.success("消息已重新发送");
    } else {
      const targetIndex = getRetryTargetIndex(
        contactor.messageChain,
        messageIndex,
      );

      if (targetIndex === -1) {
        ElMessage.warning("非聊天来源的消息不支持重试");
        return;
      }

      let validMessage = contactor.messageChain[targetIndex];
      if (!validMessage || validMessage.role !== "other") {
        validMessage = {
          role: "other",
          time: Date.now(),
          content: [{ type: "blank", data: {} }],
          id: numberString(16),
          status: "pending",
        };
        contactor.messageChain.splice(targetIndex, 0, validMessage);
        client.setLocalStorage();
      } else {
        validMessage.content = [{ type: "blank", data: {} }];
        validMessage.time = Date.now();
      }

      if (validMessage.status === "retrying") {
        ElMessage.warning("该消息正在重试中");
        return;
      }

      validMessage.status = "retrying";
      retryList.value.push(validMessage.id);

      const userMsg =
        message.role === "user"
          ? message
          : contactor.messageChain[messageIndex - 1];
      if (userMsg?.role === "user") {
        await reuploadBlobImages(userMsg, uploadFn);
      }

      try {
        await gateway.send(
          contactor.platform,
          contactor.id,
          contactor.messageChain,
          validMessage.id,
          contactor.options,
        );
        client.saveNow();
      } catch (error) {
        ElMessage.error(error.message || "重试失败");
        validMessage.status = "failed";
      }
    }

    if (toBottom) toBottom();
  };

  return {
    retryList,
    getRetryTargetIndex,
    handleRetryMessage,
    handleMenuRetry,
  };
}
