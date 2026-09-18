import { describe, expect, it } from "vitest";

import {
  deriveSubAgentGroupStatus,
  mergeSubAgentGroups,
} from "../subAgentGroups.js";

const live = (id, groupId, status) => ({
  id,
  groupId,
  jobKey: id,
  status,
  updatedAt: 100,
});

describe("deriveSubAgentGroupStatus", () => {
  it("uses backend completion policy semantics", () => {
    expect(
      deriveSubAgentGroupStatus(
        { completionPolicy: "any" },
        [{ status: "result_ready" }, { status: "running" }],
      ),
    ).toBe("completed");
    expect(
      deriveSubAgentGroupStatus(
        { completionPolicy: "quorum", quorum: 2 },
        [
          { status: "result_ready" },
          { status: "result_ready" },
          { status: "running" },
        ],
      ),
    ).toBe("completed");
  });

  it("distinguishes cancelled, failed, and waiting groups", () => {
    expect(
      deriveSubAgentGroupStatus({}, [
        { status: "cancelled" },
        { status: "cancelled" },
      ]),
    ).toBe("cancelled");
    expect(
      deriveSubAgentGroupStatus({}, [
        { status: "failed" },
        { status: "cancelled" },
      ]),
    ).toBe("failed");
    expect(
      deriveSubAgentGroupStatus({}, [
        { status: "result_ready" },
        { status: "running" },
      ]),
    ).toBe("waiting_children");
  });
});

describe("mergeSubAgentGroups", () => {
  it("keeps live runs from different new groups separate", () => {
    const groups = mergeSubAgentGroups([], [
      live("run-1", "group-1", "running"),
      live("run-2", "group-2", "queued"),
    ]);

    expect(groups.map((group) => group.id)).toEqual(["group-1", "group-2"]);
    expect(groups.map((group) => group.runs.map((run) => run.id))).toEqual([
      ["run-1"],
      ["run-2"],
    ]);
    expect(groups.some((group) => group.id === "live_subagent_runs")).toBe(
      false,
    );
  });

  it("adds a new run to its real existing group and updates group status", () => {
    const snapshot = [
      {
        id: "group-1",
        status: "dispatched",
        runs: [{ id: "run-1", status: "running" }],
      },
      {
        id: "group-2",
        status: "dispatched",
        runs: [{ id: "run-3", status: "queued" }],
      },
    ];
    const groups = mergeSubAgentGroups(snapshot, [
      live("run-1", "group-1", "result_ready"),
      live("run-2", "group-1", "running"),
      live("run-3", "group-2", "failed"),
    ]);

    expect(groups[0].runs.map((run) => run.id)).toEqual(["run-1", "run-2"]);
    expect(groups[0].status).toBe("waiting_children");
    expect(groups[1].status).toBe("failed");
  });

  it("keeps malformed runs isolated when no groupId is supplied", () => {
    const groups = mergeSubAgentGroups([], [
      live("run-1", "", "running"),
      live("run-2", "", "running"),
    ]);

    expect(groups.map((group) => group.id)).toEqual([
      "live_subagent_run_run-1",
      "live_subagent_run_run-2",
    ]);
  });
});

