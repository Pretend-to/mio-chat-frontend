import { describe, expect, it } from "vitest";
import { isReactive, markRaw, reactive } from "vue";
import {
  mergeMessageHistory,
  mergeSameMessage,
  normalizeMessage,
  unmarkRaw,
  upsertMessage,
} from "@/lib/messageState.js";

const text = (value) => [{ type: "text", data: { text: value } }];

describe("canonical message state", () => {
  it("deduplicates the same id and preserves object identity", () => {
    const original = normalizeMessage({
      id: 42,
      role: "other",
      status: "streaming",
      content: text("partial"),
    });
    const chain = [original];

    upsertMessage(chain, {
      id: "42",
      role: "other",
      status: "completed",
      content: text("complete"),
    });

    expect(chain).toHaveLength(1);
    expect(chain[0]).toBe(original);
    expect(chain[0].status).toBe("completed");
    expect(chain[0].content[0].data.text).toBe("complete");
  });

  it("does not let stale history erase a live stream", () => {
    const live = normalizeMessage({
      id: "m1",
      status: "streaming",
      content: text("long live chunk"),
    });
    const chain = [live];

    mergeMessageHistory(chain, [
      { id: "m1", status: "streaming", content: text("old") },
    ]);

    expect(chain[0]).toBe(live);
    expect(chain[0].content[0].data.text).toBe("long live chunk");
    expect(chain[0].status).toBe("streaming");
  });

  it("initial history keeps in-flight messages but drops stale completed rows", () => {
    const chain = [
      normalizeMessage({ id: "old", status: "completed", content: text("x") }),
      normalizeMessage({ id: "live", status: "streaming" }),
    ];

    mergeMessageHistory(chain, [
      { id: "persisted", status: "completed", content: text("saved") },
    ]);

    expect(chain.map((message) => message.id)).toEqual(["persisted", "live"]);
  });

  it("never rolls a terminal message back to streaming", () => {
    const merged = mergeSameMessage(
      normalizeMessage({ id: "m", status: "completed", content: text("done") }),
      { id: "m", status: "streaming", content: text("d") },
    );
    expect(merged.status).toBe("completed");
    expect(merged.content[0].data.text).toBe("done");
  });

  it("unmarkRaw strips __v_skip from marked objects and deep arrays", () => {
    const obj = markRaw({
      id: "raw1",
      content: [{ type: "text", data: { text: "hello" } }],
    });
    expect(obj.__v_skip).toBe(true);

    const clean = unmarkRaw(obj);
    expect(clean.__v_skip).toBeUndefined();
    expect(clean.content[0].data.text).toBe("hello");
  });

  it("reactivates markRaw messages into reactive proxies upon retry", () => {
    const chain = reactive([]);
    const terminalMsg = markRaw({
      id: "retry-target",
      role: "other",
      status: "completed",
      content: text("old response"),
    });
    chain.push(terminalMsg);

    expect(isReactive(chain[0])).toBe(false);

    // 用户触发重试：upsertMessage 接收 retrying 活跃态
    const result = upsertMessage(
      chain,
      {
        id: "retry-target",
        role: "other",
        status: "retrying",
        content: [{ type: "blank", data: {} }],
      },
      { authority: "replace" },
    );

    expect(result.accepted).toBe(true);
    expect(chain).toHaveLength(1);
    expect(chain[0].status).toBe("retrying");
    // 关键：已被替换为可被 Vue 响应式代理的对象
    expect(isReactive(chain[0])).toBe(true);
    expect(chain[0].__v_skip).toBeUndefined();

    // 验证流式追加可以正常运作在响应式对象上
    chain[0].content = text("new streaming chunk");
    expect(chain[0].content[0].data.text).toBe("new streaming chunk");
  });
});
