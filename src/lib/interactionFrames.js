export function isInteractionOnlyFrame(metaData = {}) {
  return (
    metaData.interactionOnly === true ||
    metaData.triggerType === "subagent_approval"
  );
}

export function extractInteractionAction(data = {}) {
  if (data.type === "action") return data.content || null;
  if (!Array.isArray(data.chunks)) return null;
  return data.chunks.find((chunk) => chunk?.type === "action")?.content || null;
}

/**
 * Preserve ownership metadata for global approvals. An action may target a
 * child SubAgent session while its transport frame identifies the owning Agent.
 */
export function buildInteractionMeta(actionMeta = {}, frameMeta = {}) {
  const meta = { ...(actionMeta || {}) };
  if (frameMeta?.agentId) meta.agentId = frameMeta.agentId;
  if (!meta.sessionId && frameMeta?.sessionId) {
    meta.sessionId = frameMeta.sessionId;
  }
  if (!meta.parentSessionId && frameMeta?.parentSessionId) {
    meta.parentSessionId = frameMeta.parentSessionId;
  }
  if (!meta.subagentRunId && frameMeta?.subagentRunId) {
    meta.subagentRunId = frameMeta.subagentRunId;
  }
  return meta;
}

export function isLegacyInteractionBubble(message = {}) {
  if (message.triggerType === "subagent_approval") return true;
  const content = Array.isArray(message.content) ? message.content : [];
  return (
    String(message.id || "").startsWith("approval_") &&
    ["pending", "running", "streaming"].includes(message.status) &&
    content.length > 0 &&
    content.every((item) => item?.type === "blank")
  );
}

export default {
  buildInteractionMeta,
  extractInteractionAction,
  isInteractionOnlyFrame,
  isLegacyInteractionBubble,
};
