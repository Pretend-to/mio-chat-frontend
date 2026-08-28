import { ElMessage } from "element-plus";
import { client } from "@/lib/runtime.js";
import { gateway } from "@/lib/gateway.js";
import { numberString } from "@/utils/generate.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";

const clearMessageTip = "这是一条消息分隔线，上方消息不再作为上下文输入";

/**
 * 消息发送管线、画像注入与会话清除操作
 */
export function useChatSend({ activeContactor, toBottom, autoScroll }) {
  const contactorsStore = useContactorsStore();
  const _profileInjectedIds = new Set();

  const sendMessage = async (msg, toServer = true) => {
    const contactor = activeContactor.value;
    if (!contactor) return;

    if (autoScroll) autoScroll.value = false;
    contactor.lastUpdate = Date.now();

    const exists = contactor.messageChain.some((m) => m.id === msg.id);
    if (!exists) {
      contactor.messageChain.push(msg);
    }

    // carryProfile: 首次发送时插入 <user_profile> 到会话头部
    if (
      toServer &&
      contactor.platform === "openai" &&
      !_profileInjectedIds.has(contactor.id)
    ) {
      const cs = client._clientSettings || {};
      if (cs.chat?.carryProfile) {
        const hasProfileInChain = contactor.messageChain.some(
          (m) =>
            m.role === "mio_system" &&
            Array.isArray(m.content) &&
            m.content.some(
              (c) =>
                c.data?.text &&
                (c.data.text.includes("已注入相关元信息") ||
                  c.data.text.includes("<user_profile>")),
            ),
        );

        if (!hasProfileInChain) {
          const userMsgIndex = contactor.messageChain.findIndex(
            (m) => m.role === "user",
          );
          const systemMsg = {
            role: "mio_system",
            time: Date.now(),
            content: [{ type: "text", data: { text: "已注入相关元信息" } }],
            id: numberString(16),
            status: "completed",
          };

          if (userMsgIndex !== -1) {
            contactor.messageChain.splice(userMsgIndex, 0, systemMsg);
          } else {
            contactor.messageChain.unshift(systemMsg);
          }
        }
      }
      _profileInjectedIds.add(contactor.id);
    }

    const msgInChain = contactor.messageChain.find((m) => m.id === msg.id);

    if (contactor.platform === "onebot") {
      contactorsStore.updateContactorSummary(contactor);
      client.setLocalStorage();

      if (toBottom) toBottom();

      if (!toServer) return msg.id;

      try {
        const messageId = await gateway.send(
          "onebot",
          contactor.id,
          contactor.messageChain,
          msg.id,
        );
        if (msgInChain) {
          msgInChain.id = messageId;
        }
        msg.id = messageId;
        contactorsStore.completeMessage(contactor.id, messageId);
        return messageId;
      } catch (e) {
        ElMessage.error(e.message || "发送失败");
        contactorsStore.failedMessage(contactor.id, msg.id, e.message || "发送失败");
        throw e;
      }
    } else if (contactor.platform === "group") {
      if (toBottom) toBottom();

      if (!toServer) {
        contactorsStore.updateContactorSummary(contactor);
        client.setLocalStorage();
        return msg.id;
      }

      const assistantMsgId = numberString(16);
      contactorsStore.getOrCreateMessage(
        contactor.id,
        assistantMsgId,
        {
          role: "other",
          status: "pending",
          content: [{ type: "blank", data: {} }],
        },
      );

      contactorsStore.updateContactorSummary(contactor);
      client.setLocalStorage();
      if (toBottom) toBottom();

      if (msgInChain) {
        msgInChain.status = "completed";
      }

      try {
        const { sendGroupCompletions } = await import("@/lib/groupGateway.js");
        await sendGroupCompletions(contactor, assistantMsgId);
        contactorsStore.completeMessage(contactor.id, msg.id);
        return msg.id;
      } catch (e) {
        ElMessage.error(e.message || "群聊发送失败");
        contactorsStore.failedMessage(contactor.id, msg.id, e.message || "群聊发送失败");
        const asstIdx = contactor.messageChain.findIndex(
          (m) => m.id === assistantMsgId,
        );
        if (asstIdx !== -1) {
          contactor.messageChain.splice(asstIdx, 1);
        }
        return msg.id;
      }
    } else {
      // OpenAI platform
      if (toBottom) toBottom();

      if (!toServer) {
        contactorsStore.updateContactorSummary(contactor);
        client.setLocalStorage();
        return msg.id;
      }

      const assistantMsgId = numberString(16);
      contactorsStore.getOrCreateMessage(
        contactor.id,
        assistantMsgId,
        {
          role: "other",
          status: "pending",
          content: [{ type: "blank", data: {} }],
        },
      );

      contactorsStore.updateContactorSummary(contactor);
      client.setLocalStorage();

      if (toBottom) toBottom();

      if (msgInChain) {
        msgInChain.status = "pending";
      }
      try {
        await gateway.send(
          "openai",
          contactor.id,
          contactor.messageChain,
          assistantMsgId,
          contactor.options,
        );
        contactorsStore.completeMessage(contactor.id, msg.id);
        return msg.id;
      } catch (e) {
        ElMessage.error(e.message || "请求失败");
        contactorsStore.failedMessage(contactor.id, msg.id, e.message || "请求失败");
        const asstIdx = contactor.messageChain.findIndex(
          (m) => m.id === assistantMsgId,
        );
        if (asstIdx !== -1) {
          contactor.messageChain.splice(asstIdx, 1);
        }
        throw e;
      }
    }
  };

  const cleanScreen = () => {
    if (activeContactor.value) {
      contactorsStore.clearHistory(activeContactor.value.id);
      activeContactor.value.updateFirstMessage();
      activeContactor.value.emit("updateMessageSummary");
    }

    if (autoScroll) autoScroll.value = false;
    ElMessage.success("已清除会话记录");
  };

  const cleanHistory = () => {
    const contactor = activeContactor.value;
    if (!contactor) return;

    contactor.updateFirstMessage();
    if (contactor.platform === "group") {
      const chainLen = contactor.messageChain.length;
      (contactor.members || []).forEach((m) => {
        m.lastCompressedIndex = chainLen;
      });
    }
    ElMessage.success("上下文信息已清除，之后的请求将不再记录上文记录");

    for (let i = contactor.messageChain.length - 1; i >= 0; i--) {
      const message = contactor.messageChain[i];
      if (
        message.role === "mio_system" &&
        message.content[0]?.type === "text" &&
        message.content[0].data.text === clearMessageTip
      ) {
        contactor.messageChain.splice(i, 1);
      }
    }
    contactor.makeSystemMessage(clearMessageTip);
    client.setLocalStorage();
  };

  const delSystemMessage = (index, renderedCount) => {
    const chain = activeContactor.value?.messageChain || [];
    const renderedCountVal = renderedCount?.value || 20;
    const realIndex =
      chain.length > renderedCountVal
        ? chain.length - renderedCountVal + index
        : index;

    const message = chain[realIndex];
    if (!message) return;
    if (
      message.content[0]?.type === "text" &&
      message.content[0].data.text === clearMessageTip
    ) {
      activeContactor.value.firstMessageIndex = 0;
    }
    activeContactor.value.messageChain.splice(realIndex, 1);
    client.setLocalStorage();
  };

  const handleDeleteMessage = (item) => {
    if (activeContactor.value && item) {
      activeContactor.value.delMessage(item.id);
      client.setLocalStorage();
      ElMessage.success("消息已删除");
    }
  };

  return {
    sendMessage,
    cleanScreen,
    cleanHistory,
    delSystemMessage,
    handleDeleteMessage,
  };
}
