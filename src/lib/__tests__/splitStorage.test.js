import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockStorage } = vi.hoisted(() => {
  return { mockStorage: new Map() };
});

vi.mock("localforage", () => ({
  default: {
    config: vi.fn(),
    getItem: vi.fn(async (key) => mockStorage.get(key) || null),
    setItem: vi.fn(async (key, value) => {
      mockStorage.set(key, value);
      return value;
    }),
    removeItem: vi.fn(async (key) => {
      mockStorage.delete(key);
    }),
    clear: vi.fn(async () => {
      mockStorage.clear();
    }),
  },
}));

// 准备全局 localStorage 与 fetch mock
const localStoreMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
global.localStorage = localStoreMock;
globalThis.localStorage = localStoreMock;

globalThis.fetch = vi.fn().mockImplementation(async () => ({
  ok: true,
  json: async () => ({ code: 0, data: {} }),
}));

import { setActivePinia, createPinia } from "pinia";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { client } from "@/lib/runtime.js";

describe("Split Storage & Auto-Migration Test Suite", () => {
  let store;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useContactorsStore();
    mockStorage.clear();
    globalThis.localStorage.clear();
  });

  it("1. 自动无感平滑迁移：旧版内嵌 messageChain 的数据应自动分片转存至 mio_msg_*", async () => {
    const legacyClient = {
      id: "user_123",
      code: "code_abc",
      contactList: [
        {
          id: "c_1",
          name: "Agent 1",
          platform: "openai",
          priority: 1,
          messageChain: [
            {
              id: "m_1",
              role: "user",
              time: 1000,
              status: "completed",
              content: [{ type: "text", data: { text: "Hello" } }],
            },
            {
              id: "m_2",
              role: "other",
              time: 1001,
              status: "completed",
              content: [{ type: "text", data: { text: "Hi!" } }],
            },
          ],
        },
        {
          id: "c_2",
          name: "Agent 2",
          platform: "openai",
          priority: 1,
          messageChain: [
            {
              id: "m_3",
              role: "user",
              time: 2000,
              status: "completed",
              content: [{ type: "text", data: { text: "Test 2" } }],
            },
          ],
        },
      ],
    };

    // 执行加载与自动迁移
    await client.loadLocalStorage(legacyClient);

    // 验证 store 中消息是否完整恢复
    expect(store.contactors["c_1"]).toBeDefined();
    expect(store.contactors["c_1"].messageChain.length).toBe(2);
    expect(store.contactors["c_1"].messageChain[0].content[0].data.text).toBe(
      "Hello",
    );
    expect(store.contactors["c_2"].messageChain.length).toBe(1);

    // 验证是否已无感分片写入 localforage
    expect(mockStorage.has("mio_msg_c_1")).toBe(true);
    expect(mockStorage.has("mio_msg_c_2")).toBe(true);

    const c1Msgs = JSON.parse(mockStorage.get("mio_msg_c_1"));
    expect(c1Msgs.length).toBe(2);
    expect(c1Msgs[0].id).toBe("m_1");

    // 验证 client 元数据中是否已剥离巨型 messageChain
    const metadataClient = JSON.parse(mockStorage.get("client"));
    expect(metadataClient.contactList.length).toBe(2);
    expect(metadataClient.contactList[0].messageChain).toBeUndefined();
  });

  it("2. 新版分片读取：从独立 mio_msg_* 并发加载消息链", async () => {
    // 模拟已瘦身后的元数据
    mockStorage.set(
      "mio_msg_c_99",
      JSON.stringify([
        {
          id: "m_99",
          role: "other",
          time: 3000,
          status: "completed",
          content: [{ type: "text", data: { text: "Split loaded" } }],
        },
      ]),
    );

    const splitClient = {
      id: "user_123",
      code: "code_abc",
      contactList: [
        {
          id: "c_99",
          name: "Agent 99",
          platform: "openai",
          priority: 0,
        },
      ],
    };

    await client.loadLocalStorage(splitClient);

    expect(store.contactors["c_99"]).toBeDefined();
    expect(store.contactors["c_99"].messageChain.length).toBe(1);
    expect(store.contactors["c_99"].messageChain[0].content[0].data.text).toBe(
      "Split loaded",
    );
  });

  it("3. 单会话消息持久化与删除联动", async () => {
    store.addContactor("openai", { id: "c_dynamic", name: "Dynamic Agent" });

    // 添加并完成一条消息
    const msg = store.getOrCreateMessage("c_dynamic", "m_new");
    msg.content = [{ type: "text", data: { text: "Dynamic message" } }];
    store.completeMessage("c_dynamic", "m_new");

    // 验证立即保存
    await client._saveContactorMessagesNow("c_dynamic");
    expect(mockStorage.has("mio_msg_c_dynamic")).toBe(true);

    const saved = JSON.parse(mockStorage.get("mio_msg_c_dynamic"));
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe("m_new");

    // 验证删除联系人时联动清除分片
    store.removeContactor("c_dynamic");
    await new Promise((r) => setTimeout(r, 10));
    expect(mockStorage.has("mio_msg_c_dynamic")).toBe(false);
  });

  it("4. SubAgent 联系人按 child Session 去重且消息不落本地", async () => {
    const first = store.upsertSubAgentContactor({
      agentId: "agent_1",
      createdAt: "2026-09-17T00:00:00.000Z",
      groupId: "group_1",
      id: "run_1",
      jobKey: "disk_research",
      objective: "检查磁盘情况",
      parentSessionId: "session_parent",
      sessionId: "session_child",
      startedAt: "2026-09-17T00:00:01.000Z",
      status: "running",
    });
    first.messageChain.push({
      id: "prompt_1",
      role: "user",
      status: "completed",
      content: [{ type: "text", data: { text: "唤起 prompt" } }],
    });

    const revised = store.upsertSubAgentContactor({
      agentId: "agent_1",
      groupId: "group_1",
      id: "run_2",
      jobKey: "disk_research",
      parentSessionId: "session_parent",
      sessionId: "session_child",
      startedAt: "2026-09-17T00:00:02.000Z",
      status: "result_ready",
    });

    expect(
      Object.values(store.contactors).filter(
        (item) => item.sessionId === "session_child",
      ),
    ).toHaveLength(1);
    expect(revised.id).toBe("sub_agent_session_child");
    expect(revised.runId).toBe("run_2");
    expect(revised.readOnly).toBe(true);
    expect(revised.messageChain[0].role).toBe("user");
    expect(store.toMessagesJSON(revised.id)).toEqual([]);

    await client._saveContactorMessagesNow(revised.id);
    expect(mockStorage.has(`mio_msg_${revised.id}`)).toBe(false);
  });

  it("5. 实时流、历史回放与终态统一经过消息事件入口", () => {
    store.addContactor("openai", { id: "canonical", name: "Canonical" });

    store.applyMessageEvent({
      type: "message.upsert",
      contactorId: "canonical",
      message: {
        id: "assistant-1",
        role: "other",
        status: "streaming",
        content: [{ type: "blank", data: {} }],
      },
    });
    store.applyMessageEvent({
      type: "message.chunk",
      contactorId: "canonical",
      messageId: "assistant-1",
      chunkType: "content",
      data: { chunk: "live" },
    });
    store.applyMessageEvent({
      type: "history.reconcile",
      contactorId: "canonical",
      mode: "replace",
      messages: [
        {
          id: "assistant-1",
          role: "other",
          status: "streaming",
          content: [{ type: "text", data: { text: "old" } }],
        },
      ],
    });

    const chain = store.contactors.canonical.messageChain;
    expect(chain).toHaveLength(1);
    expect(chain[0].content[0].data.text).toBe("live");

    store.applyMessageEvent({
      type: "message.complete",
      contactorId: "canonical",
      messageId: "assistant-1",
    });
    const late = store.applyMessageEvent({
      type: "message.chunk",
      contactorId: "canonical",
      messageId: "assistant-1",
      chunkType: "content",
      data: { chunk: " late" },
    });

    expect(late.accepted).toBe(false);
    expect(chain[0].status).toBe("completed");
    expect(chain[0].content[0].data.text).toBe("live");
  });

  it("6. 流式 chunk 热路径不计算摘要或调度持久化", () => {
    store.addContactor("openai", { id: "stream-hot-path", name: "Stream" });
    store.applyMessageEvent({
      type: "message.upsert",
      contactorId: "stream-hot-path",
      message: {
        id: "assistant-stream",
        role: "other",
        status: "streaming",
        content: [{ type: "blank", data: {} }],
      },
    });
    const persist = vi.spyOn(client, "setLocalStorage");
    persist.mockClear();

    store.applyMessageEvent({
      type: "message.chunk",
      contactorId: "stream-hot-path",
      messageId: "assistant-stream",
      chunkType: "content",
      data: { chunk: "streaming text" },
    });

    expect(persist).not.toHaveBeenCalled();
    expect(
      store.contactors["stream-hot-path"].messageChain[0].content[0].data.text,
    ).toBe("streaming text");

    store.applyMessageEvent({
      type: "message.complete",
      contactorId: "stream-hot-path",
      messageId: "assistant-stream",
    });
    expect(persist).toHaveBeenCalled();
    expect(store.contactors["stream-hot-path"].lastMessageSummary).toBe(
      "streaming text",
    );
    persist.mockRestore();
  });
});
