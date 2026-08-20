import { describe, it, expect, vi } from "vitest";

// Mock pinia and client runtime
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
    contactors: {},
    insertSystemMessage: vi.fn(),
  }),
}));

import { cleanChatParams } from "../gateway.js";

describe("cleanChatParams - LLM default parameter filtering", () => {
  it("should return empty object {} for empty or invalid inputs", () => {
    expect(cleanChatParams(null)).toEqual({});
    expect(cleanChatParams(undefined)).toEqual({});
    expect(cleanChatParams({})).toEqual({});
  });

  it("should filter default temperature (1), top_p (1), frequency_penalty (0), presence_penalty (0)", () => {
    const params = {
      temperature: 1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    };
    expect(cleanChatParams(params)).toEqual({});
  });

  it("should preserve reasoning_effort as a persistent parameter", () => {
    const params1 = {
      temperature: 1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      reasoning_effort: -1,
    };
    expect(cleanChatParams(params1)).toEqual({
      reasoning_effort: -1,
    });

    const params2 = {
      temperature: 1,
      top_p: 1,
      reasoning_effort: 3,
    };
    expect(cleanChatParams(params2)).toEqual({
      reasoning_effort: 3,
    });
  });

  it("should keep non-default top_p and temperature", () => {
    const params = {
      temperature: 0.7,
      top_p: 0.8,
      frequency_penalty: 0,
      presence_penalty: 0,
      reasoning_effort: -1,
    };
    expect(cleanChatParams(params)).toEqual({
      temperature: 0.7,
      top_p: 0.8,
      reasoning_effort: -1,
    });
  });

  it("should keep non-default frequency_penalty and presence_penalty", () => {
    const params = {
      temperature: 1,
      top_p: 1,
      frequency_penalty: 1.5,
      presence_penalty: -0.5,
      reasoning_effort: -1,
    };
    expect(cleanChatParams(params)).toEqual({
      frequency_penalty: 1.5,
      presence_penalty: -0.5,
      reasoning_effort: -1,
    });
  });

  it("should preserve custom unknown keys such as tool_choice", () => {
    const params = {
      temperature: 1,
      top_p: 1,
      tool_choice: "auto",
      custom_param: "test",
    };
    expect(cleanChatParams(params)).toEqual({
      tool_choice: "auto",
      custom_param: "test",
    });
  });
});
