import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useInteractionStore = defineStore("interaction", () => {
  const interactionsQueue = ref([]);
  const selectedInteractionId = ref(null);

  const activeInteraction = computed(() => {
    return (
      interactionsQueue.value.find(
        (item) => item.interactionId === selectedInteractionId.value,
      ) ||
      interactionsQueue.value[0] ||
      null
    );
  });

  function setInteraction(interaction) {
    if (!interaction?.interactionId || !interaction?.requestId) return false;
    const index = interactionsQueue.value.findIndex(
      (item) =>
        String(item.interactionId) === String(interaction.interactionId) &&
        String(item.requestId) === String(interaction.requestId),
    );
    const normalized = {
      ...interaction,
      interactionId: String(interaction.interactionId),
      requestId: String(interaction.requestId),
      createdAt: interaction.createdAt || Date.now(),
    };
    if (index === -1) {
      interactionsQueue.value.push(normalized);
    } else {
      interactionsQueue.value.splice(index, 1, {
        ...interactionsQueue.value[index],
        ...normalized,
        createdAt: interactionsQueue.value[index].createdAt,
      });
    }
    if (!selectedInteractionId.value) {
      selectedInteractionId.value = normalized.interactionId;
    }
    return true;
  }

  function resolveInteraction(interactionId) {
    interactionsQueue.value = interactionsQueue.value.filter(
      (item) => item.interactionId !== interactionId,
    );
    if (selectedInteractionId.value === interactionId) {
      selectedInteractionId.value =
        interactionsQueue.value[0]?.interactionId || null;
    }
  }

  function resolveRequest(requestId) {
    interactionsQueue.value = interactionsQueue.value.filter(
      (item) => String(item.requestId) !== String(requestId),
    );
    if (
      !interactionsQueue.value.some(
        (item) => item.interactionId === selectedInteractionId.value,
      )
    ) {
      selectedInteractionId.value =
        interactionsQueue.value[0]?.interactionId || null;
    }
  }

  function selectInteraction(interactionId) {
    if (
      interactionsQueue.value.some(
        (item) => item.interactionId === interactionId,
      )
    ) {
      selectedInteractionId.value = interactionId;
    }
  }

  return {
    interactionsQueue,
    selectedInteractionId,
    activeInteraction,
    setInteraction,
    resolveInteraction,
    resolveRequest,
    selectInteraction,
  };
});
