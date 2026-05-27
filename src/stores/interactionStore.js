import { defineStore } from "pinia";
import { ref } from "vue";

export const useInteractionStore = defineStore("interaction", () => {
  const activeInteraction = ref(null);

  function setInteraction(interaction) {
    activeInteraction.value = interaction;
  }

  function clearInteraction() {
    activeInteraction.value = null;
  }

  return {
    activeInteraction,
    setInteraction,
    clearInteraction,
  };
});
