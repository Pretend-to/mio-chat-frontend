import { computed } from "vue";
import { useInteractionStore } from "@/stores/interactionStore";
import { client } from "@/lib/runtime.js";

export function useInteraction() {
  const store = useInteractionStore();

  const activeInteraction = computed(() => store.activeInteraction);
  const hasActiveInteraction = computed(() => !!store.activeInteraction);

  /**
   * 提交用户的选择/授权结果，并通过 Socket.IO 实时双向回传给后端，随后清空状态
   * @param {object} payload 用户选择/授权的数据载荷
   */
  const submitResponse = (payload) => {
    if (!store.activeInteraction) return;

    const { interactionId, requestId } = store.activeInteraction;

    // 1. 通过全局 Socket.IO 连接实例双向实时发射数据给后端
    if (client && client.socket && client.socket.socket) {
      client.socket.socket.emit("tool:interact", {
        interactionId,
        requestId,
        payload,
      });
    } else {
      console.error("[useInteraction] Socket.IO raw connection is not ready!");
    }

    // 2. 清除 store 状态，收起交互浮层
    store.clearInteraction();
  };

  return {
    activeInteraction,
    hasActiveInteraction,
    submitResponse,
  };
}
