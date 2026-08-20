import { describe, it, expect, vi } from "vitest";
import { stripEmojis, useChatSpeech } from "../useChatSpeech.js";

vi.mock("@/lib/runtime.js", () => ({
  client: {
    _clientSettings: {},
  },
}));

vi.mock("@/stores/contactorsStore.js", () => ({
  useContactorsStore: () => ({
    activeContactor: null,
  }),
}));

describe("stripEmojis", () => {
  it("should strip single and multiple emojis from text", () => {
    const input = "你好呀！😊🎉 很高兴见到你 👍";
    const result = stripEmojis(input);
    expect(result).toBe("你好呀！ 很高兴见到你");
  });

  it("should strip compound emojis and skin tone modifiers", () => {
    const input = "团队协作 👨‍👩‍👧‍👦 点赞 👍🏻 庆祝 🥳";
    const result = stripEmojis(input);
    expect(result).toBe("团队协作 点赞 庆祝");
  });

  it("should return empty string when input consists only of emojis", () => {
    const input = "😀😃😄😁😆😅😂🤣";
    const result = stripEmojis(input);
    expect(result).toBe("");
  });

  it("should preserve punctuation and natural language", () => {
    const input = "Hello world! This is a test: 123, 456.";
    const result = stripEmojis(input);
    expect(result).toBe("Hello world! This is a test: 123, 456.");
  });
});

describe("useChatSpeech getSpeechText", () => {
  it("should extract text and strip emojis from message object", () => {
    const { getSpeechText } = useChatSpeech();
    const msg = {
      role: "other",
      content: [
        { type: "text", data: { text: "欢迎使用 Mio Chat！🚀✨" } },
        { type: "image", data: { file: "test.png" } },
      ],
    };
    expect(getSpeechText(msg)).toBe("欢迎使用 Mio Chat！");
  });
});
