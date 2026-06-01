import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useInteractionStore = defineStore("interaction", () => {
  const interactionsQueue = ref([]);

  const activeInteraction = computed(() => {
    return interactionsQueue.value[0] || null;
  });

  function setInteraction(interaction) {
    // 避免重复推入相同 ID 的交互以防重复推送
    const exists = interactionsQueue.value.some(
      (item) => item.interactionId === interaction.interactionId,
    );
    if (!exists) {
      interactionsQueue.value.push(interaction);
    }
  }

  function resolveInteraction(interactionId) {
    interactionsQueue.value = interactionsQueue.value.filter(
      (item) => item.interactionId !== interactionId,
    );
  }

  function clearInteraction() {
    interactionsQueue.value = [];
  }

  return {
    interactionsQueue,
    activeInteraction,
    setInteraction,
    resolveInteraction,
    clearInteraction,
  };
});
