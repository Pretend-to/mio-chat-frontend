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
  it("should return undefined for empty or invalid inputs", () => {
    expect(cleanChatParams(null)).toBeUndefined();
    expect(cleanChatParams(undefined)).toBeUndefined();
    expect(cleanChatParams({})).toBeUndefined();
  });

  it("should return undefined if all parameters are at their default values", () => {
    const allDefaults = {
      temperature: 1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      reasoning_effort: -1,
    };
    expect(cleanChatParams(allDefaults)).toBeUndefined();
  });

  it("should keep non-default top_p and filter other default parameters", () => {
    const params = {
      temperature: 1,
      top_p: 0.8,
      frequency_penalty: 0,
      presence_penalty: 0,
      reasoning_effort: -1,
    };
    expect(cleanChatParams(params)).toEqual({
      top_p: 0.8,
    });
  });

  it("should keep non-default temperature (including 0) and filter defaults", () => {
    const params1 = {
      temperature: 0.7,
      top_p: 1,
    };
    expect(cleanChatParams(params1)).toEqual({
      temperature: 0.7,
    });

    const params2 = {
      temperature: 0,
      top_p: 1,
    };
    expect(cleanChatParams(params2)).toEqual({
      temperature: 0,
    });
  });

  it("should keep non-default frequency_penalty and presence_penalty", () => {
    const params = {
      temperature: 1,
      top_p: 1,
      frequency_penalty: 1.5,
      presence_penalty: -0.5,
    };
    expect(cleanChatParams(params)).toEqual({
      frequency_penalty: 1.5,
      presence_penalty: -0.5,
    });
  });

  it("should handle reasoning_effort (filter -1, keep >= 0)", () => {
    expect(cleanChatParams({ reasoning_effort: -1 })).toBeUndefined();
    expect(cleanChatParams({ reasoning_effort: "-1" })).toBeUndefined();
    expect(cleanChatParams({ reasoning_effort: 0 })).toEqual({ reasoning_effort: 0 });
    expect(cleanChatParams({ reasoning_effort: 3 })).toEqual({ reasoning_effort: 3 });
  });

  it("should preserve custom unknown keys", () => {
    const params = {
      temperature: 1,
      top_p: 1,
      custom_param: "test",
    };
    expect(cleanChatParams(params)).toEqual({
      custom_param: "test",
    });
  });
});
