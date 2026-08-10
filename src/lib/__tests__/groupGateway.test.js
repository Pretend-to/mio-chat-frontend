import { describe, it, expect, vi } from "vitest";
import {
  resolveMentionedMembers,
  resolveUnhandledMentions,
} from "../groupGateway.js";

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

describe("groupGateway - Mention Resolution & Invocation Engine", () => {
  const memberA = { id: "member_a", name: "AgentA", avatar: "" };
  const memberB = { id: "member_b", name: "AgentB", avatar: "" };
  const memberC = { id: "member_c", name: "AgentC", avatar: "" };
  const members = [memberA, memberB, memberC];

  describe("resolveMentionedMembers", () => {
    it("should parse standard mention format @'Name'(ID)", () => {
      const text = "Hello @'AgentB'(member_b), how are you?";
      const result = resolveMentionedMembers(text, members);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("member_b");
    });

    it("should parse bare name @Name with word boundary", () => {
      const text = "Hey @AgentC please check this out";
      const result = resolveMentionedMembers(text, members);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("member_c");
    });

    it("should match bare name followed by Chinese punctuation or whitespace", () => {
      const text = "你好@AgentA，请处理这个请求。以及@AgentB！";
      const result = resolveMentionedMembers(text, members);
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(["member_a", "member_b"]);
    });

    it("should not falsely match prefixes of longer names", () => {
      const longMember = { id: "member_b_extra", name: "AgentBExtra" };
      const testMembers = [...members, longMember];
      const text = "Hey @AgentBExtra answer this";
      const result = resolveMentionedMembers(text, testMembers);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("member_b_extra");
    });

    it("should not match substring attached to longer alphanumeric tokens", () => {
      const text = "Contact support@AgentA123.com for help";
      const result = resolveMentionedMembers(text, members);
      expect(result).toHaveLength(0);
    });
  });

  describe("resolveUnhandledMentions", () => {
    it("should trigger member if mentioned and has no response after mention", () => {
      const group = {
        id: "group_1",
        platform: "group",
        maxInvocationDepth: 5,
        members: [memberA, memberB, memberC],
        messageChain: [
          {
            id: "msg_1",
            role: "user",
            status: "completed",
            content: [{ type: "text", data: { text: "Hello @'AgentB'(member_b)" } }],
            invocationDepth: 0,
          },
        ],
      };

      const result = resolveUnhandledMentions(group, null, true);
      expect(result.validTriggers).toHaveLength(1);
      expect(result.validTriggers[0].member.id).toBe("member_b");
      expect(result.validTriggers[0].nextDepth).toBe(1);
    });

    it("should trigger multiple members when mentioned together in a single message", () => {
      const group = {
        id: "group_1",
        platform: "group",
        maxInvocationDepth: 5,
        members: [memberA, memberB, memberC],
        messageChain: [
          {
            id: "msg_1",
            role: "user",
            status: "completed",
            content: [{ type: "text", data: { text: "@'AgentA'(member_a) @'AgentB'(member_b) let us start" } }],
            invocationDepth: 0,
          },
        ],
      };

      const result = resolveUnhandledMentions(group, null, true);
      expect(result.validTriggers).toHaveLength(2);
      const ids = result.validTriggers.map((t) => t.member.id);
      expect(ids).toContain("member_a");
      expect(ids).toContain("member_b");
    });

    it("should ignore self-mentions by the sender", () => {
      const group = {
        id: "group_1",
        platform: "group",
        maxInvocationDepth: 5,
        members: [memberA, memberB, memberC],
        messageChain: [
          {
            id: "msg_1",
            role: "other",
            senderMemberId: "member_b",
            status: "completed",
            content: [{ type: "text", data: { text: "I am @'AgentB'(member_b)" } }],
            invocationDepth: 1,
          },
        ],
      };

      const result = resolveUnhandledMentions(group, null, true);
      expect(result.validTriggers).toHaveLength(0);
    });

    it("should not trigger busy member", () => {
      const group = {
        id: "group_1",
        platform: "group",
        maxInvocationDepth: 5,
        members: [memberA, memberB, memberC],
        messageChain: [
          {
            id: "msg_1",
            role: "user",
            status: "completed",
            content: [{ type: "text", data: { text: "@'AgentB'(member_b)" } }],
            invocationDepth: 0,
          },
          {
            id: "msg_2",
            role: "other",
            senderMemberId: "member_b",
            status: "pending",
            content: [{ type: "text", data: { text: "Typing..." } }],
          },
        ],
      };

      const result = resolveUnhandledMentions(group, null, true);
      expect(result.validTriggers).toHaveLength(0);
    });

    it("should apply tail suppression (member whose msg is at tail does not self-trigger)", () => {
      const group = {
        id: "group_1",
        platform: "group",
        maxInvocationDepth: 5,
        members: [memberA, memberB, memberC],
        messageChain: [
          {
            id: "msg_1",
            role: "user",
            status: "completed",
            content: [{ type: "text", data: { text: "@'AgentB'(member_b)" } }],
            invocationDepth: 0,
          },
          {
            id: "msg_2",
            role: "other",
            senderMemberId: "member_b",
            status: "completed",
            content: [{ type: "text", data: { text: "My reply @'AgentC'(member_c)" } }],
            invocationDepth: 1,
          },
        ],
      };

      const result = resolveUnhandledMentions(group, null, true);
      expect(result.validTriggers).toHaveLength(1);
      expect(result.validTriggers[0].member.id).toBe("member_c");
      expect(result.validTriggers[0].nextDepth).toBe(2);
    });

    it("should ignore mio_system messages when finding tail message", () => {
      const group = {
        id: "group_1",
        platform: "group",
        maxInvocationDepth: 5,
        members: [memberA, memberB, memberC],
        messageChain: [
          {
            id: "msg_1",
            role: "user",
            status: "completed",
            content: [{ type: "text", data: { text: "@'AgentB'(member_b)" } }],
            invocationDepth: 0,
          },
          {
            id: "msg_2",
            role: "other",
            senderMemberId: "member_b",
            status: "completed",
            content: [{ type: "text", data: { text: "I replied" } }],
            invocationDepth: 1,
          },
          {
            id: "msg_sys",
            role: "mio_system",
            time: Date.now(),
            content: [{ type: "text", data: { text: "System notice" } }],
          },
        ],
      };

      const result = resolveUnhandledMentions(group, null, true);
      // Last non-system message is msg_2 by AgentB, so AgentB is suppressed at tail.
      expect(result.validTriggers).toHaveLength(0);
    });

    it("should handle multi-hop ring invocation (A -> B -> C)", () => {
      const group = {
        id: "group_1",
        platform: "group",
        maxInvocationDepth: 5,
        members: [memberA, memberB, memberC],
        messageChain: [
          {
            id: "msg_1",
            role: "user",
            status: "completed",
            content: [{ type: "text", data: { text: "@'AgentA'(member_a)" } }],
            invocationDepth: 0,
          },
          {
            id: "msg_2",
            role: "other",
            senderMemberId: "member_a",
            status: "completed",
            content: [{ type: "text", data: { text: "Delegating to @'AgentB'(member_b)" } }],
            invocationDepth: 1,
          },
          {
            id: "msg_3",
            role: "other",
            senderMemberId: "member_b",
            status: "completed",
            content: [{ type: "text", data: { text: "Delegating to @'AgentC'(member_c)" } }],
            invocationDepth: 2,
          },
        ],
      };

      const result = resolveUnhandledMentions(group, null, true);
      expect(result.validTriggers).toHaveLength(1);
      expect(result.validTriggers[0].member.id).toBe("member_c");
      expect(result.validTriggers[0].nextDepth).toBe(3);
    });

    it("should handle simultaneous B and C invocation scenario correctly", () => {
      const group = {
        id: "group_1",
        platform: "group",
        maxInvocationDepth: 5,
        members: [memberA, memberB, memberC],
        messageChain: [
          {
            id: "msg_a",
            role: "user",
            status: "completed",
            content: [{ type: "text", data: { text: "@'AgentB'(member_b) @'AgentC'(member_c)" } }],
            invocationDepth: 0,
          },
          {
            id: "msg_b1",
            role: "other",
            senderMemberId: "member_b",
            status: "completed",
            content: [{ type: "text", data: { text: "Option A. @'AgentC'(member_c)" } }],
            invocationDepth: 1,
          },
          {
            id: "msg_c1",
            role: "other",
            senderMemberId: "member_c",
            status: "completed",
            content: [{ type: "text", data: { text: "Option B. @'AgentB'(member_b)" } }],
            invocationDepth: 1,
          },
        ],
      };

      const result = resolveUnhandledMentions(group, null, true);
      expect(result.validTriggers).toHaveLength(1);
      expect(result.validTriggers[0].member.id).toBe("member_b");
      expect(result.validTriggers[0].nextDepth).toBe(2);
    });

    it("should stop when maxInvocationDepth limit is reached", () => {
      const group = {
        id: "group_1",
        platform: "group",
        maxInvocationDepth: 2,
        members: [memberA, memberB, memberC],
        messageChain: [
          {
            id: "msg_1",
            role: "other",
            senderMemberId: "member_a",
            status: "completed",
            content: [{ type: "text", data: { text: "@'AgentB'(member_b)" } }],
            invocationDepth: 2,
          },
        ],
      };

      const result = resolveUnhandledMentions(group, null, true);
      expect(result.validTriggers).toHaveLength(0);
      expect(result.exceededTriggers).toHaveLength(1);
      expect(result.exceededTriggers[0].member.id).toBe("member_b");
      expect(result.exceededTriggers[0].nextDepth).toBe(3);
    });

    it("should preserve original namePolicy and avatarPolicy on group members", () => {
      const memberWithPolicies = {
        id: "mem_1",
        name: "Bot1",
        namePolicy: 0,
        avatarPolicy: 0,
      };

      const group = {
        platform: "group",
        members: [memberWithPolicies],
        messageChain: [],
      };

      expect(group.members[0].namePolicy).toBe(0);
      expect(group.members[0].avatarPolicy).toBe(0);
    });
  });
});
