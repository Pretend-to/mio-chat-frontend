import { client } from "@/lib/runtime.js";

export function useInputDraft({
  textareaRef,
  activeContactor,
  adjustTextareaHeight,
}) {
  const loadDraft = () => {
    const contactor = activeContactor.value;
    if (!contactor || !textareaRef.value) return;
    if (contactor.draft) {
      textareaRef.value.innerHTML = contactor.draft;
      adjustTextareaHeight();
    } else {
      textareaRef.value.innerHTML = "";
    }
  };

  const saveDraftTo = (contactor) => {
    if (!contactor || !textareaRef.value) return;
    const content = textareaRef.value.innerHTML;

    const doc = new DOMParser().parseFromString(content, "text/html");
    const hasImage = doc.querySelector("img") !== null;
    const text = (doc.body.textContent || "").trim();

    if (!hasImage && !text) {
      contactor.draft = "";
    } else {
      contactor.draft = content;
    }

    if (contactor.emit) contactor.emit("updateMessageSummary");
    client.setLocalStorage();
  };

  const saveDraft = () => {
    saveDraftTo(activeContactor.value);
  };

  const clearDraft = () => {
    const contactor = activeContactor.value;
    if (!contactor) return;
    contactor.draft = "";
    if (contactor.emit) contactor.emit("updateMessageSummary");
    client.setLocalStorage();
  };

  return {
    loadDraft,
    saveDraft,
    saveDraftTo,
    clearDraft,
  };
}
