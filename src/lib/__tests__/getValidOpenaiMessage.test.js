import { describe, it, expect, vi } from "vitest";
import { getValidOpenaiMessage } from "../gateway.js";

vi.mock("@/lib/runtime.js", () => ({
  client: {
    socket: {
      streamCompletions: vi.fn(),
    },
    setLocalStorage: vi.fn(),
  },
}));

vi.mock("@/stores/configStore.js", () => ({
  useConfigStore: () => ({
    userProfile: { name: "TestUser" },
  }),
}));

vi.mock("@/stores/contactorsStore.js", () => ({
  useContactorsStore: () => ({
    activeContactor: { options: {} },
    contactors: {},
    insertSystemMessage: vi.fn(),
  }),
}));

describe("getValidOpenaiMessage - Step & Signature Preservation", () => {
  it("should split serial tool calls with different steps into distinct Turns", () => {
    const messageChain = [
      {
        id: "msg-1",
        role: "user",
        content: [{ type: "text", data: { text: "Search and read" } }],
      },
      {
        id: "msg-2",
        role: "assistant",
        content: [
          {
            type: "reason",
            data: { text: "Thinking about step 1" },
          },
          {
            type: "tool_call",
            data: {
              id: "call_search",
              name: "search",
              parameters: '{"q":"test"}',
              result: "search results",
              step: 1,
              thoughtSignature: "sig_step_1",
            },
          },
          {
            type: "reason",
            data: { text: "Thinking about step 2" },
          },
          {
            type: "tool_call",
            data: {
              id: "call_read",
              name: "read",
              parameters: '{"id":"doc1"}',
              result: "doc content",
              step: 2,
              thoughtSignature: "sig_step_2",
            },
          },
          {
            type: "text",
            data: { text: "Here is the summary." },
          },
        ],
      },
    ];

    const result = getValidOpenaiMessage(messageChain);

    // Expected turns:
    // 0: user
    // 1: assistant (step 1 tool_call + reasoning)
    // 2: tool (step 1 result)
    // 3: assistant (step 2 tool_call + reasoning)
    // 4: tool (step 2 result)
    // 5: assistant (final text)
    expect(result).toHaveLength(6);

    expect(result[0]).toEqual({
      role: "user",
      content: "Search and read",
    });

    expect(result[1].role).toBe("assistant");
    expect(result[1].reasoning_content).toBe("Thinking about step 1");
    expect(result[1].tool_calls).toHaveLength(1);
    expect(result[1].tool_calls[0].id).toBe("call_search");
    expect(result[1].tool_calls[0].thoughtSignature).toBe("sig_step_1");

    expect(result[2].role).toBe("tool");
    expect(result[2].tool_call_id).toBe("call_search");
    expect(result[2].content).toBe("search results");
    expect(result[2].thoughtSignature).toBe("sig_step_1");

    expect(result[3].role).toBe("assistant");
    expect(result[3].reasoning_content).toBe("Thinking about step 2");
    expect(result[3].tool_calls).toHaveLength(1);
    expect(result[3].tool_calls[0].id).toBe("call_read");
    expect(result[3].tool_calls[0].thoughtSignature).toBe("sig_step_2");

    expect(result[4].role).toBe("tool");
    expect(result[4].tool_call_id).toBe("call_read");
    expect(result[4].content).toBe("doc content");
    expect(result[4].thoughtSignature).toBe("sig_step_2");

    expect(result[5].role).toBe("assistant");
    expect(result[5].content).toBe("Here is the summary.");
  });

  it("should keep parallel tool calls with the same step in a single assistant message", () => {
    const messageChain = [
      {
        id: "msg-1",
        role: "user",
        content: [{ type: "text", data: { text: "Check two things" } }],
      },
      {
        id: "msg-2",
        role: "assistant",
        content: [
          {
            type: "tool_call",
            data: {
              id: "call_1",
              name: "tool_1",
              parameters: '{"a":1}',
              result: "res1",
              step: 1,
            },
          },
          {
            type: "tool_call",
            data: {
              id: "call_2",
              name: "tool_2",
              parameters: '{"b":2}',
              result: "res2",
              step: 1,
            },
          },
        ],
      },
    ];

    const result = getValidOpenaiMessage(messageChain);

    // 0: user
    // 1: assistant (2 parallel tool_calls)
    // 2: tool (call_1)
    // 3: tool (call_2)
    expect(result).toHaveLength(4);

    expect(result[1].role).toBe("assistant");
    expect(result[1].tool_calls).toHaveLength(2);
    expect(result[1].tool_calls[0].id).toBe("call_1");
    expect(result[1].tool_calls[1].id).toBe("call_2");

    expect(result[2].role).toBe("tool");
    expect(result[2].tool_call_id).toBe("call_1");
    expect(result[3].role).toBe("tool");
    expect(result[3].tool_call_id).toBe("call_2");
  });

  it("should split contiguous tool calls if step changes even without intermediate reason/text", () => {
    const messageChain = [
      {
        id: "msg-1",
        role: "user",
        content: [{ type: "text", data: { text: "Serial without thoughts" } }],
      },
      {
        id: "msg-2",
        role: "assistant",
        content: [
          {
            type: "tool_call",
            data: {
              id: "call_step1",
              name: "tool_step1",
              parameters: "{}",
              result: "res1",
              step: 1,
            },
          },
          {
            type: "tool_call",
            data: {
              id: "call_step2",
              name: "tool_step2",
              parameters: "{}",
              result: "res2",
              step: 2,
            },
          },
        ],
      },
    ];

    const result = getValidOpenaiMessage(messageChain);

    // Turns:
    // 0: user
    // 1: assistant (call_step1)
    // 2: tool (call_step1 result)
    // 3: assistant (call_step2)
    // 4: tool (call_step2 result)
    expect(result).toHaveLength(5);
    expect(result[1].tool_calls).toHaveLength(1);
    expect(result[1].tool_calls[0].id).toBe("call_step1");
    expect(result[2].tool_call_id).toBe("call_step1");

    expect(result[3].tool_calls).toHaveLength(1);
    expect(result[3].tool_calls[0].id).toBe("call_step2");
    expect(result[4].tool_call_id).toBe("call_step2");
  });
});
