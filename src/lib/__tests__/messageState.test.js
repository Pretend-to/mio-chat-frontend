import { describe, expect, it } from "vitest";
import {
  mergeMessageHistory,
  mergeSameMessage,
  normalizeMessage,
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
});
