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
});
