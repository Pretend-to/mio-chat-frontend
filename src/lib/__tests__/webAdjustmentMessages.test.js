import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const { fakeSocket } = vi.hoisted(() => ({
  fakeSocket: { socket: { connected: true }, ackMessage: vi.fn() },
}));

vi.mock("@/lib/runtime.js", () => ({
  client: {
    isConnected: true,
    socket: fakeSocket,
    saveNow: vi.fn(async () => {}),
    saveContactorMessages: vi.fn(),
    setLocalStorage: vi.fn(),
  },
  config: { baseConfig: {} },
}));
vi.mock("@/lib/groupGateway.js", () => ({ resolveUnhandledMentions: vi.fn() }));
vi.mock("@/lib/clientSettings.js", () => ({
  addGlobalMemoryItem: vi.fn(),
  updateGlobalMemoryItem: vi.fn(),
  deleteGlobalMemoryItem: vi.fn(),
  buildUserProfileXml: vi.fn(() => ""),
}));
vi.mock("@/stores/configStore.js", () => ({ useConfigStore: () => ({ userProfile: {} }) }));
vi.mock("@/stores/interactionStore.js", () => ({
  useInteractionStore: () => ({ resolveRequest: vi.fn(), setInteraction: vi.fn() }),
}));

import { useContactorsStore } from "@/stores/contactorsStore.js";
import { gateway, getValidOpenaiMessage } from "@/lib/gateway.js";

const contactorId = "web-adjust-contact";
const requestId = "original-reply";
const eventId = "adjust-reply";

function frame(message, messageId, data = {}) {
  return {
    protocol: "llm", message, request_id: requestId,
    data: { ...data, metaData: { contactorId, messageId } },
  };
}

describe("Web adjustment message sequence", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const store = useContactorsStore();
    store.loadContactors([{ id: contactorId, platform: "openai", name: "Agent" }]);
    store.applyMessageEvent({
      type: "message.upsert", contactorId,
      message: {
        id: requestId, role: "other", status: "streaming",
        content: [{ type: "text", data: { text: "Earlier output" } }],
      },
    });
  });

  it("completes the prior answer and presents the adjustment as a new user turn", async () => {
    const store = useContactorsStore();
    gateway.handleLlmMessageEvent({
      message: "adjust_status",
      data: {
        contactorId, eventId, continuationMessageId: eventId,
        previousMessageId: requestId, targetRequestId: requestId,
        text: "Add a comparison", origin: "web_adjust", status: "absorbed",
      },
    });
    const chain = store.contactors[contactorId].messageChain;
    expect(chain.map((message) => message.role)).toEqual(["other", "user", "other"]);
    expect(chain[0].status).toBe("completed");
    expect(chain[1].content[0].data.text).toBe("Add a comparison");
    expect(chain[2].id).toBe(eventId);
    expect(chain[0].content.some((block) => block.type === "context_message")).toBe(false);

    gateway.handleLlmMessageEvent(frame("complete", requestId, { segmentBoundary: true }));
    expect(chain[2].status).toBe("pending");
    gateway.handleLlmMessageEvent(frame("update", eventId, {
      type: "content", content: "Compared results",
    }));
    gateway.handleLlmMessageEvent(frame("complete", eventId));
    expect(chain[0].status).toBe("completed");
    expect(chain[2].status).toBe("completed");
    expect(chain[2].content.map((block) => block.data?.text).join(" ")).toContain("Compared results");
    expect(store.contactors[contactorId].pendingAdjustments).toEqual([]);
    expect(getValidOpenaiMessage(chain).map((message) => message.role)).toEqual([
      "assistant", "user", "assistant",
    ]);
  });

  it("keeps the user's already inserted message when the checkpoint confirms injection", () => {
    const store = useContactorsStore();
    const contactor = store.contactors[contactorId];
    store.applyMessageEvent({
      type: "message.upsert", contactorId,
      message: {
        id: "local-user", role: "user", status: "completed",
        content: [{ type: "text", data: { text: "Add a comparison" } }],
      },
    });
    store.applyMessageEvent({
      type: "message.upsert", contactorId,
      message: {
        id: eventId, role: "other", status: "pending",
        content: [{ type: "blank", data: {} }],
      },
    });
    contactor.pendingAdjustments = [{
      eventId, targetRequestId: requestId, text: "Add a comparison",
      resubmitUserId: "local-user", resubmitMessageId: eventId,
      status: "accepted_for_checkpoint",
    }];

    gateway.handleLlmMessageEvent({
      message: "adjust_status",
      data: {
        contactorId, eventId, continuationMessageId: eventId,
        previousMessageId: requestId, targetRequestId: requestId,
        text: "Add a comparison", origin: "web_adjust", status: "absorbed",
      },
    });
    expect(contactor.messageChain.map((message) => message.id)).toEqual([
      requestId, "local-user", eventId,
    ]);
    expect(contactor.messageChain[0].status).toBe("completed");
    expect(contactor.messageChain[2].continuationOfRequestId).toBe(requestId);
  });
});
