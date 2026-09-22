import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@/lib/runtime.js", () => ({
  client: { setLocalStorage: vi.fn() },
  config: { baseConfig: {} },
}));
vi.mock("@/lib/groupGateway.js", () => ({
  resolveUnhandledMentions: vi.fn(),
}));
vi.mock("@/lib/clientSettings.js", () => ({
  addGlobalMemoryItem: vi.fn(),
  updateGlobalMemoryItem: vi.fn(),
  deleteGlobalMemoryItem: vi.fn(),
}));

import { useContactorsStore } from "@/stores/contactorsStore.js";

/**
 * 回归背景（f0b2e71 引入）：
 * OneBot 发送完成后会先派发 message.rekey（写侧 message.id = String(nextMessageId)），
 * 再派发 message.complete（读侧原为 msg.id === messageId 严格相等）。
 * 后端 genMessageID() 返回的是「数字」，字符串 !== 数字导致 complete 找不到消息：
 *   - 真正的用户消息永远停在 pending（气泡一直转圈）
 *   - getOrCreateMessage 又凭空 push 一条 role:"other" 的幻影气泡
 * 因此消息链内的 id 必须在所有读写入口统一 String() 归一。
 */
describe("contactorsStore 消息 ID 归一化", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function seedOnebot() {
    const store = useContactorsStore();
    store.loadContactors([
      {
        id: "onebot-1",
        platform: "onebot",
        name: "OneBot",
        title: "onebot",
      },
    ]);
    return { store, contactor: store.contactors["onebot-1"] };
  }

  it("后端返回数字型 message_id 时：rekey 后 complete 能命中，且不产生幻影气泡", () => {
    const { store, contactor } = seedOnebot();

    const localId = "1758500000000123"; // numberString(16)
    store.applyMessageEvent({
      type: "message.upsert",
      contactorId: contactor.id,
      message: {
        id: localId,
        role: "user",
        status: "pending",
        time: Date.now(),
        content: [{ type: "text", data: { text: "hi" } }],
      },
    });

    const serverMessageId = 8281234567; // 后端 genMessageID() 返回数字

    store.applyMessageEvent({
      type: "message.rekey",
      contactorId: contactor.id,
      messageId: localId,
      nextMessageId: serverMessageId,
    });
    store.applyMessageEvent({
      type: "message.complete",
      contactorId: contactor.id,
      messageId: serverMessageId,
    });

    expect(contactor.messageChain).toHaveLength(1);
    const userMsg = contactor.messageChain[0];
    expect(userMsg.role).toBe("user");
    expect(userMsg.id).toBe("8281234567");
    expect(userMsg.status).toBe("completed");
  });

  it("字符串/数字两种形式的同一 ID 不会重复创建消息", () => {
    const { store, contactor } = seedOnebot();

    store.applyMessageEvent({
      type: "message.upsert",
      contactorId: contactor.id,
      message: {
        id: "8281234567",
        role: "other",
        status: "streaming",
        time: Date.now(),
        content: [{ type: "text", data: { text: "hello" } }],
      },
    });

    store.applyMessageEvent({
      type: "message.usage",
      contactorId: contactor.id,
      messageId: 8281234567, // 数字入参
      usage: { total_tokens: 10 },
    });

    expect(contactor.messageChain).toHaveLength(1);
    expect(contactor.messageChain[0].usage).toEqual({ total_tokens: 10 });
  });
});
