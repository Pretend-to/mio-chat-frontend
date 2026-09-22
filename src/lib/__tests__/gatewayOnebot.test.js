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

  it("存在多个 OneBot 联系人时，未知 contact ID 不得跳投给其他联系人", () => {
    const firstContactor = {
      id: "onebot-a",
      platform: "onebot",
      messageChain: [],
    };
    const secondContactor = {
      id: "onebot-b",
      platform: "onebot",
      messageChain: [],
    };
    contactors[firstContactor.id] = firstContactor;
    contactors[secondContactor.id] = secondContactor;

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
  });

  it("唯一的 OneBot 联系人应兜底渲染（后端下发真实 QQ 号，与前端 Fake ID 永不相等）", () => {
    const contactor = {
      id: "fake-1758500000000123",
      platform: "onebot",
      messageChain: [],
    };
    contactors[contactor.id] = contactor;

    gateway.handleOnebotMessageEvent({
      data: {
        type: "message",
        id: "1099834705", // 后端 data.id = params.user_id
        content: {
          message_id: "incoming-real",
          message: [{ type: "text", data: { text: "hi" } }],
        },
      },
    });

    expect(applyMessageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "message.upsert",
        contactorId: contactor.id,
      }),
    );
  });

  it("转发消息 id 为 undefined 时，唯一的 OneBot 联系人也应兜底渲染", () => {
    const contactor = {
      id: "fake-1758500000000123",
      platform: "onebot",
      messageChain: [],
    };
    contactors[contactor.id] = contactor;

    gateway.handleOnebotMessageEvent({
      data: {
        type: "message",
        id: undefined, // send_private_forward_msg 曾误用 data.user_id
        content: {
          message_id: "incoming-fwd",
          message: [{ type: "nodes", data: { messages: [] } }],
        },
      },
    });

    expect(applyMessageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "message.upsert",
        contactorId: contactor.id,
      }),
    );
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
