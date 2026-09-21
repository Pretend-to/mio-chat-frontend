import { beforeEach, describe, expect, it, vi } from "vitest";

const { applyMessageEvent, contactors } = vi.hoisted(() => ({
  applyMessageEvent: vi.fn(),
  contactors: {},
}));

vi.mock("@/lib/runtime.js", () => ({
  client: {
    setLocalStorage: vi.fn(),
  },
}));

vi.mock("@/stores/configStore.js", () => ({
  useConfigStore: () => ({ userProfile: {} }),
}));

vi.mock("@/stores/contactorsStore.js", () => ({
  useContactorsStore: () => ({
    contactors,
    applyMessageEvent,
  }),
}));

import { gateway } from "../gateway.js";

describe("gateway OneBot message routing", () => {
  beforeEach(() => {
    for (const key of Object.keys(contactors)) delete contactors[key];
    applyMessageEvent.mockClear();
  });

  it("does not route an unknown contact ID to another OneBot contactor", () => {
    const firstContactor = {
      id: "onebot-a",
      platform: "onebot",
      messageChain: [],
    };
    contactors[firstContactor.id] = firstContactor;

    gateway.handleOnebotMessageEvent({
      data: {
        type: "message",
        id: "onebot-unknown",
        content: {
          message_id: "incoming-1",
          message: [{ type: "text", data: { text: "wrong contact" } }],
        },
      },
    });

    expect(applyMessageEvent).not.toHaveBeenCalled();
    expect(firstContactor.messageChain).toEqual([]);

  });

  it("routes a message only to the contactor with the matching ID", () => {
    const contactor = {
      id: "onebot-a",
      platform: "onebot",
      messageChain: [],
    };
    contactors[contactor.id] = contactor;

    gateway.handleOnebotMessageEvent({
      data: {
        type: "message",
        id: contactor.id,
        content: {
          message_id: "incoming-2",
          message: [{ type: "text", data: { text: "right contact" } }],
        },
      },
    });

    expect(applyMessageEvent).toHaveBeenCalledWith({
      type: "message.upsert",
      contactorId: contactor.id,
      message: expect.objectContaining({ id: "incoming-2" }),
      markPending: true,
    });

  });

  it("creates channel assistant placeholder with canonical streaming status", () => {
    contactors["ch-1"] = { id: "ch-1", platform: "agent", messageChain: [] };
    gateway.handleChannelMessageEvent({
      type: "channel_user_message",
      data: {
        assistantMessageId: "am-1",
        contactorId: "ch-1",
        userMessage: { id: "u-1", text: "hi" },
      },
    });

    const placeholder = applyMessageEvent.mock.calls
      .map((call) => call[0])
      .find((event) => event.message?.id === "am-1");
    expect(placeholder).toBeTruthy();
    expect(placeholder.message.status).toBe("streaming");
  });
});
