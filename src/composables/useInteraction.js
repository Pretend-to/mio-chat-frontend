import { computed, ref, watch } from "vue";
import { useInteractionStore } from "@/stores/interactionStore";
import { client } from "@/lib/runtime.js";

export function useInteraction(contactorIdRef) {
  const store = useInteractionStore();

  const activeInteraction = computed(() => {
    if (!contactorIdRef) return store.activeInteraction;
    const cid =
      contactorIdRef.value !== undefined
        ? contactorIdRef.value
        : contactorIdRef;
    if (cid === undefined || cid === null) return null;
    return (
      store.interactionsQueue.find(
        (item) => String(item.contactorId) === String(cid),
      ) || null
    );
  });

  const hasActiveInteraction = computed(() => !!activeInteraction.value);
  const submittingInteractionId = ref(null);
  const interactionError = ref("");
  const ACK_TIMEOUT_MS = 10_000;

  watch(
    () => activeInteraction.value?.interactionId,
    () => {
      interactionError.value = "";
    },
  );

  /**
   * 提交用户的选择/授权结果，并在服务端确认成功后清空状态。
   * 这样网络失败或 requestId 失效时，当前卡片不会被提前消费，用户可以重试。
   * @param {object} payload 用户选择/授权的数据载荷
   */
  const submitResponse = (payload) => {
    const active = activeInteraction.value;
    if (!active) return;

    const { interactionId, requestId } = active;
    if (submittingInteractionId.value === interactionId) return;

    interactionError.value = "";
    submittingInteractionId.value = interactionId;
    let settled = false;
    const settle = (ack = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(ackTimer);
      if (submittingInteractionId.value === interactionId) {
        submittingInteractionId.value = null;
      }
      if (ack.ok === false) {
        if (activeInteraction.value?.interactionId === interactionId) {
          interactionError.value = ack.error || "交互反馈失败，请重试。";
          console.error("[useInteraction] 交互反馈失败:", interactionError.value);
        }
        return;
      }
      store.resolveInteraction(interactionId);
    };
    const ackTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (submittingInteractionId.value === interactionId) {
        submittingInteractionId.value = null;
      }
      if (activeInteraction.value?.interactionId === interactionId) {
        interactionError.value = "服务端未响应，请检查连接后重试。";
      }
    }, ACK_TIMEOUT_MS);

    // 1. 通过全局 Socket.IO 连接实例双向实时发射数据给后端
    if (client && client.socket && client.socket.socket) {
      try {
        client.socket.socket.emit(
          "tool:interact",
          { interactionId, requestId, payload },
          settle,
        );
      } catch (error) {
        settle({ ok: false, error: error?.message || "交互发送失败，请重试。" });
      }
    } else {
      settle({ ok: false, error: "Socket.IO 连接未就绪，请重试。" });
    }
  };

  return {
    activeInteraction,
    hasActiveInteraction,
    interactionError,
    interactionSubmitting: computed(() =>
      submittingInteractionId.value === activeInteraction.value?.interactionId,
    ),
    submitResponse,
  };
}
