import { beforeEach, describe, expect, it, vi } from "vitest";

const { applyMessageEvent, clearHistory, client } = vi.hoisted(() => ({
  applyMessageEvent: vi.fn(),
  clearHistory: vi.fn(),
  client: {
    setLocalStorage: vi.fn(),
  },
}));

vi.mock("element-plus", () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/runtime.js", () => ({ client }));

vi.mock("@/lib/gateway.js", () => ({
  gateway: {
    send: vi.fn(),
  },
}));

vi.mock("@/stores/contactorsStore.js", () => ({
  useContactorsStore: () => ({
    applyMessageEvent,
    clearHistory,
  }),
}));

import { useChatSend } from "../useChatSend.js";

const clearMessageTip = "这是一条消息分隔线，上方消息不再作为上下文输入";

function makeSystemMessage(id = "system-1") {
  return {
    id,
    role: "mio_system",
    content: [{ type: "text", data: { text: clearMessageTip } }],
  };
}

describe("useChatSend message removal", () => {
  beforeEach(() => {
    applyMessageEvent.mockReset();
    clearHistory.mockReset();
    client.setLocalStorage.mockReset();
  });

  it("removes the previous separator through the canonical message event", () => {
    const contactor = {
      id: "contactor-1",
      platform: "openai",
      messageChain: [
        { id: "user-1", role: "user", content: [] },
        makeSystemMessage(),
      ],
      updateFirstMessage: vi.fn(),
      makeSystemMessage: vi.fn(),
    };
    const activeContactor = { value: contactor };
    const { cleanHistory } = useChatSend({ activeContactor });

    cleanHistory();

    expect(applyMessageEvent).toHaveBeenCalledWith({
      type: "message.remove",
      contactorId: contactor.id,
      messageId: "system-1",
      persist: false,
    });
    expect(client.setLocalStorage).toHaveBeenCalledTimes(1);
  });

  it("deletes a rendered separator through the canonical message event", () => {
    const contactor = {
      id: "contactor-2",
      messageChain: [
        { id: "old", role: "user", content: [] },
        makeSystemMessage("system-2"),
        { id: "new", role: "user", content: [] },
      ],
      firstMessageIndex: 1,
    };
    const activeContactor = { value: contactor };
    const { delSystemMessage } = useChatSend({ activeContactor });

    delSystemMessage(0, { value: 2 });

    expect(applyMessageEvent).toHaveBeenCalledWith({
      type: "message.remove",
      contactorId: contactor.id,
      messageId: "system-2",
      persist: false,
    });
    expect(contactor.firstMessageIndex).toBe(0);
    expect(client.setLocalStorage).toHaveBeenCalledTimes(1);
  });
});
