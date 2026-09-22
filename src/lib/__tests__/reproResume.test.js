import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const { sent, fakeSocket } = vi.hoisted(() => {
  const sent = [];
  const fakeSocket = {
    available: true,
    enterChat: vi.fn(),
    ackMessage: vi.fn(),
    interruptGeneration: vi.fn(),
  };
  return { sent, fakeSocket };
});

vi.mock("@/lib/runtime.js", () => ({
  client: {
    isConnected: true,
    socket: fakeSocket,
    _clientSettings: {},
    setLocalStorage: vi.fn(),
    saveContactorMessages: vi.fn(),
    saveNow: vi.fn(async () => {}),
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
vi.mock("@/stores/configStore.js", () => ({
  useConfigStore: () => ({ userProfile: {} }),
}));
vi.mock("@/stores/interactionStore.js", () => ({
  useInteractionStore: () => ({ resolveRequest: vi.fn(), setInteraction: vi.fn() }),
}));

import { useContactorsStore } from "@/stores/contactorsStore.js";
import { gateway } from "@/lib/gateway.js";

const CONTACTOR = "c1";
const MID = "1111111111111111";

function frame(message, data) {
  return { protocol: "llm", message, request_id: MID, data };
}

function meta() {
  return {
    agentId: null,
    contactorId: CONTACTOR,
    isTask: false,
    messageId: MID,
    namePolicy: 2,
    sessionId: null,
    triggerType: "chat",
  };
}

function liveChunk(text) {
  return frame("update", { type: "content", content: text, metaData: meta() });
}

function syncFrame(chunks, status) {
  return frame("sync", {
    chunks,
    messageId: MID,
    metaData: meta(),
    status,
  });
}

describe("断点续传复现", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sent.length = 0;
  });

  it("离开再回来：流式消息应保持 streaming 并能继续增长", async () => {
    const store = useContactorsStore();
    store.loadContactors([
      { id: CONTACTOR, platform: "openai", name: "Agent", title: "t" },
    ]);
    store.selectContactor(CONTACTOR);

    // useChatSend: 先建 pending 占位
    store.applyMessageEvent({
      type: "message.upsert",
      contactorId: CONTACTOR,
      message: {
        id: MID,
        role: "other",
        status: "pending",
        time: Date.now(),
        content: [{ type: "blank", data: {} }],
      },
    });

    // 直播中的 chunk
    gateway.handleLlmMessageEvent(liveChunk("Hello"));
    gateway.flushAllBuffers?.();
    await new Promise((r) => setTimeout(r, 150));

    let msg = store.contactors[CONTACTOR].messageChain.find((m) => m.id === MID);
    console.log("after live chunk:", msg.status, JSON.stringify(msg.content));

    // ===== 切走：ChatView unmount =====
    store.contactors[CONTACTOR].active = false;

    // ===== 切回：ChatView mount → trySync → enter_chat =====
    store.selectContactor(CONTACTOR);
    fakeSocket.enterChat(CONTACTOR);

    // 后端流缓存回放帧（状态仍是 streaming，chunks 为完整内容快照）
    gateway.handleLlmMessageEvent(
      syncFrame([{ type: "content", content: "Hello" }], "streaming"),
    );

    msg = store.contactors[CONTACTOR].messageChain.find((m) => m.id === MID);
    console.log("after sync:", msg.status, JSON.stringify(msg.content));

    // 同步之后又来了新的直播 chunk
    gateway.handleLlmMessageEvent(liveChunk(" world"));
    await new Promise((r) => setTimeout(r, 150));

    msg = store.contactors[CONTACTOR].messageChain.find((m) => m.id === MID);
    console.log("after post-sync chunk:", msg.status, JSON.stringify(msg.content));

    expect(msg.status).toBe("streaming");
    expect(JSON.stringify(msg.content)).toContain("Hello world");
  });
});
