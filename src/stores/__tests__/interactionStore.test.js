import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useInteractionStore } from "@/stores/interactionStore.js";

describe("global interaction queue", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("queues approvals from different agents without filtering by contact", () => {
    const store = useInteractionStore();
    store.setInteraction({
      contactorId: "agent-main",
      interactionId: "interaction-main",
      requestId: "request-main",
    });
    store.setInteraction({
      contactorId: "sub-agent",
      interactionId: "interaction-child",
      requestId: "request-child",
    });

    expect(store.interactionsQueue).toHaveLength(2);
    expect(store.activeInteraction.interactionId).toBe("interaction-main");

    store.selectInteraction("interaction-child");
    expect(store.activeInteraction.contactorId).toBe("sub-agent");
  });

  it("deduplicates reconnect replay and advances after resolution", () => {
    const store = useInteractionStore();
    store.setInteraction({
      interactionId: "interaction-1",
      prompt: "old",
      requestId: "request-1",
    });
    store.setInteraction({
      interactionId: "interaction-1",
      prompt: "refreshed",
      requestId: "request-1",
    });
    store.setInteraction({
      interactionId: "interaction-2",
      requestId: "request-2",
    });

    expect(store.interactionsQueue).toHaveLength(2);
    expect(store.activeInteraction.prompt).toBe("refreshed");

    store.resolveRequest("request-1");
    expect(store.activeInteraction.interactionId).toBe("interaction-2");
  });
});
