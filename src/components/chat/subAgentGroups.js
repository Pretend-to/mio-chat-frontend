const TERMINAL_RUN_STATUSES = new Set([
  "blocked",
  "cancelled",
  "expired",
  "failed",
  "result_ready",
]);

const GROUP_STATUS = Object.freeze({
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  FAILED: "failed",
  WAITING_CHILDREN: "waiting_children",
});

const runIdOf = (run) => String(run?.id || run?.runId || "");
const groupIdOf = (group) => String(group?.id || "");

/**
 * Mirrors SubAgentRunService._recalculateGroup without coupling the drawer
 * to Vue or the backend. A group with no runs keeps its persisted status.
 */
export function deriveSubAgentGroupStatus(group, runs = group?.runs || []) {
  if (!runs.length) return group?.status || GROUP_STATUS.WAITING_CHILDREN;

  const ready = runs.filter((run) => run.status === "result_ready").length;
  const terminal = runs.filter((run) =>
    TERMINAL_RUN_STATUSES.has(run.status),
  ).length;
  const threshold =
    group?.completionPolicy === "any"
      ? 1
      : group?.completionPolicy === "quorum"
        ? group.quorum || runs.length
        : runs.length;

  if (ready >= threshold) return GROUP_STATUS.COMPLETED;
  if (runs.every((run) => run.status === "cancelled")) {
    return GROUP_STATUS.CANCELLED;
  }
  if (terminal === runs.length) return GROUP_STATUS.FAILED;
  return GROUP_STATUS.WAITING_CHILDREN;
}

function mergeRun(existing, liveRun) {
  const merged = { ...existing, ...liveRun };
  // A contactor can be created before its first status frame. Do not let an
  // empty live value erase a useful REST snapshot value.
  if (!liveRun.status && existing.status) merged.status = existing.status;
  return merged;
}

/**
 * Merge the initial REST snapshot with the read-only SubAgent contactors
 * updated by Socket.IO. Live runs are always keyed by their real groupId;
 * when malformed transport data has no groupId, each run gets its own stable
 * fallback group rather than being combined with unrelated runs.
 */
export function mergeSubAgentGroups(snapshotGroups = [], liveRuns = []) {
  const merged = snapshotGroups.map((group) => ({
    ...group,
    runs: [...(group.runs || [])],
  }));
  const byGroupId = new Map(
    merged
      .filter((group) => group.id != null)
      .map((group) => [groupIdOf(group), group]),
  );
  const liveGroupIds = new Set();

  for (const liveRun of liveRuns) {
    const runId = runIdOf(liveRun);
    if (!runId) continue;

    const realGroupId = liveRun.groupId ? String(liveRun.groupId) : "";
    const targetId = realGroupId || `live_subagent_run_${runId}`;
    let target = byGroupId.get(targetId);
    if (!target) {
      target = {
        id: targetId,
        createdAt: liveRun.updatedAt || Date.now(),
        runs: [],
      };
      byGroupId.set(targetId, target);
      merged.push(target);
    }
    liveGroupIds.add(targetId);

    // A run's groupId is authoritative. Remove a stale snapshot copy from a
    // different group before inserting it into the live group.
    for (const group of merged) {
      if (group === target) continue;
      group.runs = group.runs.filter((run) => runIdOf(run) !== runId);
    }

    const index = target.runs.findIndex((run) => runIdOf(run) === runId);
    if (index === -1) target.runs.push({ ...liveRun });
    else target.runs[index] = mergeRun(target.runs[index], liveRun);
  }

  return merged.map((group) => ({
    ...group,
    status: liveGroupIds.has(groupIdOf(group))
      ? deriveSubAgentGroupStatus(group, group.runs)
      : group.status,
  }));
}

