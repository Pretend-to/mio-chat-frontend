import { configAPI } from "@/lib/configApi.js";

export const subagentsAPI = {
  async cancelGroup(groupId, reason = "") {
    return configAPI.request(`/api/subagent-groups/${groupId}/cancel`, {
      body: { reason },
      method: "POST",
    });
  },

  async cancelRun(runId, reason = "") {
    return configAPI.request(`/api/subagent-runs/${runId}/cancel`, {
      body: { reason },
      method: "POST",
    });
  },

  async getGroup(groupId) {
    return configAPI.request(`/api/subagent-groups/${groupId}`);
  },

  async getRun(runId) {
    return configAPI.request(`/api/subagent-runs/${runId}`);
  },

  async listGroups(agentId, sessionId, limit = 50) {
    return configAPI.request(
      `/api/agents/${agentId}/sessions/${sessionId}/subagent-groups?limit=${limit}`,
    );
  },

  async listAgentSessions(agentId) {
    return configAPI.request(`/api/agents/${agentId}/sessions`);
  },

  async continueRun(runId, instruction) {
    return configAPI.request(`/api/subagent-runs/${runId}/continue`, {
      body: { instruction },
      method: "POST",
    });
  },
};

export default subagentsAPI;
