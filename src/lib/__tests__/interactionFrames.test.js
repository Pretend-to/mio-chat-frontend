import { describe, expect, it } from "vitest";

import {
  buildInteractionMeta,
  extractInteractionAction,
  isInteractionOnlyFrame,
  isLegacyInteractionBubble,
} from "../interactionFrames.js";

describe("buildInteractionMeta", () => {
  it("keeps the child session while attaching the owning agent", () => {
    expect(
      buildInteractionMeta(
        { sourceSessionId: "child", sessionId: "child" },
        { agentId: "agent_1", sessionId: "parent" },
      ),
    ).toEqual({
      agentId: "agent_1",
      sessionId: "child",
      sourceSessionId: "child",
    });
  });

  it("fills missing session and subagent transport metadata", () => {
    expect(
      buildInteractionMeta(
        {},
        {
          agentId: "agent_1",
          parentSessionId: "parent",
          sessionId: "session_1",
          subagentRunId: "run_1",
        },
      ),
    ).toEqual({
      agentId: "agent_1",
      parentSessionId: "parent",
      sessionId: "session_1",
      subagentRunId: "run_1",
    });
  });
});

describe("interaction-only frames", () => {
  it("recognizes the explicit contract and legacy SubAgent approvals", () => {
    expect(isInteractionOnlyFrame({ interactionOnly: true })).toBe(true);
    expect(isInteractionOnlyFrame({ triggerType: "subagent_approval" })).toBe(
      true,
    );
    expect(isInteractionOnlyFrame({ triggerType: "chat" })).toBe(false);
  });

  it("extracts actions from live and replay frames", () => {
    const action = {
      actionType: "REQUEST_APPROVAL",
      interactionId: "interaction-1",
    };
    expect(extractInteractionAction({ content: action, type: "action" })).toBe(
      action,
    );
    expect(
      extractInteractionAction({
        chunks: [
          { content: "text", type: "content" },
          { content: action, type: "action" },
        ],
      }),
    ).toBe(action);
  });

  it("identifies old approval placeholders without matching real messages", () => {
    expect(
      isLegacyInteractionBubble({
        content: [{ data: {}, type: "blank" }],
        id: "approval_run-1_action-1",
        status: "pending",
      }),
    ).toBe(true);
    expect(
      isLegacyInteractionBubble({
        content: [{ data: { text: "real" }, type: "text" }],
        id: "approval_notes",
        status: "completed",
      }),
    ).toBe(false);
  });
});
