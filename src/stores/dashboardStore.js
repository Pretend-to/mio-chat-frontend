import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { configAPI } from "@/lib/configApi.js";
import { ElMessage } from "element-plus";

export const useDashboardStore = defineStore("dashboard", () => {
  // Navigation & UI States
  const activeTab = ref("overview");
  const timeRange = ref("24h");
  const currentTime = ref("");
  const showCostModal = ref(false);
  const showTraceModal = ref(false);
  const activeTrace = ref(null);
  const slaMetric = ref("ttft");

  // Real-time metrics
  const stats = ref({
    connections: 0,
    users: 0,
    pending: 0,
    totalTokens: 0,
    promptTokens: 0,
    compTokens: 0,
  });

  // Historical data cache
  const historicalData = ref(null);

  // Provider metrics
  const providerStats = ref([]);
  const selectedProvider = ref("All");
  const groupedProviders = ref([]);
  const totalAllTokens = ref(0);
  const rawModelDistribution = ref([]);

  // Rankings
  const userRankings = ref([]);
  const windowRankings = ref([]);

  // Tool Call turns list & active trace details
  const toolCallTurns = ref([]);
  const activeTurn = ref(null);

  // Failures list
  const failures = ref([]);

  // Cost calculations settings
  const costCalc = ref({
    provider: "",
    inputPrice: 0.15,
    outputPrice: 0.6,
    cachePrice: 0.075,
  });

  // Computed Values
  const providers = computed(() => providerStats.value.map((p) => p.name));

  const calculatedCost = computed(() => {
    const pStat = providerStats.value.find(
      (p) => p.name === costCalc.value.provider,
    );
    if (!pStat) return 0;
    return (
      (pStat.promptTokens / 1000000) * costCalc.value.inputPrice +
      (pStat.compTokens / 1000000) * costCalc.value.outputPrice +
      (pStat.hitTokens / 1000000) * costCalc.value.cachePrice
    );
  });

  // Actions
  async function fetchRealtimeStats() {
    try {
      const res = await configAPI.request("/api/admin/dashboard/realtime");
      if (res.success) {
        stats.value.connections = res.data.onlineConnections;
        stats.value.users = res.data.onlineUsers;
        stats.value.pending = res.data.pendingRequests;
      }
    } catch (err) {
      console.error("获取实时数据失败:", err);
    }
  }

  async function fetchHistoricalStats() {
    try {
      const res = await configAPI.request(
        `/api/admin/dashboard/stats?range=${timeRange.value}`,
      );
      if (res.success) {
        const data = res.data;
        historicalData.value = data;

        // Update global summary metrics
        stats.value.totalTokens = data.summary.totalTokens;
        stats.value.promptTokens = data.summary.promptTokens;
        stats.value.compTokens = data.summary.candidatesTokens;

        // 1. Process Provider and Cache Stats
        providerStats.value = data.modelDistribution.reduce((acc, curr) => {
          const provName = curr.provider || "openai";
          let existing = acc.find((item) => item.name === provName);
          if (!existing) {
            existing = {
              name: provName,
              hitTokens: 0,
              missTokens: 0,
              calls: 0,
              promptTokens: 0,
              compTokens: 0,
            };
            acc.push(existing);
          }
          existing.calls += curr.callCount;
          existing.promptTokens += curr.promptTokens;
          existing.compTokens += curr.candidatesTokens;
          existing.hitTokens += curr.cacheHitTokens || 0;
          existing.missTokens +=
            curr.cacheMissTokens ||
            curr.promptTokens +
              curr.candidatesTokens -
              (curr.cacheHitTokens || 0);

          const total = existing.hitTokens + existing.missTokens;
          existing.cacheHitRate =
            total > 0 ? Math.round((existing.hitTokens / total) * 100) : 0;
          return acc;
        }, []);

        // Set default cost calculation provider if empty
        if (!costCalc.value.provider && providerStats.value.length > 0) {
          costCalc.value.provider = providerStats.value[0].name;
        }

        // 2. Process Rankings
        userRankings.value = data.userRanking.map((item) => ({
          userId: item.userId,
          calls: item.callCount,
          tokens: item.totalTokens,
        }));

        windowRankings.value = data.sessionRanking.map((item) => ({
          contactorId: item.contactorId,
          calls: item.callCount,
          tokens: item.totalTokens,
        }));

        // 3. Process Provider Lists and Model Breakdowns
        rawModelDistribution.value = data.modelDistribution || [];
        totalAllTokens.value = rawModelDistribution.value.reduce(
          (sum, item) => sum + (item.totalTokens || 0),
          0,
        );

        const providerGroups = rawModelDistribution.value.reduce(
          (acc, curr) => {
            const name = curr.provider || "openai";
            acc[name] = (acc[name] || 0) + (curr.totalTokens || 0);
            return acc;
          },
          {},
        );
        groupedProviders.value = Object.entries(providerGroups)
          .map(([name, totalTokens]) => ({
            name,
            totalTokens,
          }))
          .sort((a, b) => b.totalTokens - a.totalTokens);
      }
    } catch (err) {
      console.error("获取历史大盘数据失败:", err);
      ElMessage.error("无法连接服务或管理员验证失败");
    }
  }

  async function fetchFailures() {
    try {
      const res = await configAPI.request(
        "/api/admin/dashboard/failures?limit=50&offset=0",
      );
      if (res.success) {
        failures.value = res.data.logs;
      }
    } catch (err) {
      console.error("获取故障日志失败:", err);
    }
  }

  async function fetchTurns() {
    try {
      const res = await configAPI.request(
        "/api/admin/dashboard/turns?limit=50&offset=0",
      );
      if (res.success) {
        toolCallTurns.value = res.data.turns.map((t) => ({
          requestId: t.requestId,
          user: t.userId,
          presetName: t.presetName,
          contactorId: t.contactorId,
          sessionTitle: t.sessionTitle,
          createdAt: t.createdAt,
          totalTokens: t.totalTokens,
          stepsCount: t.stepsCount,
          steps: [],
        }));

        // Auto-select first turn if none active
        if (toolCallTurns.value.length > 0 && !activeTurn.value) {
          selectTurn(toolCallTurns.value[0]);
        }
      }
    } catch (err) {
      console.error("获取最近活跃对话失败:", err);
    }
  }

  async function selectTurn(turn) {
    activeTurn.value = turn;
    try {
      const res = await configAPI.request(
        `/api/admin/dashboard/trace/${turn.requestId}`,
      );
      if (res.success) {
        activeTurn.value.steps = res.data.steps;
      }
    } catch (err) {
      console.error("获取链路 Trace 失败:", err);
      ElMessage.error("获取调用链 Trace 失败");
    }
  }

  function refreshData() {
    fetchHistoricalStats();
    fetchFailures();
    fetchTurns();
  }

  return {
    // State
    activeTab,
    timeRange,
    currentTime,
    showCostModal,
    showTraceModal,
    activeTrace,
    slaMetric,
    stats,
    historicalData,
    providerStats,
    selectedProvider,
    groupedProviders,
    totalAllTokens,
    rawModelDistribution,
    userRankings,
    windowRankings,
    toolCallTurns,
    activeTurn,
    failures,
    costCalc,

    // Computed
    providers,
    calculatedCost,

    // Actions
    fetchRealtimeStats,
    fetchHistoricalStats,
    fetchFailures,
    fetchTurns,
    selectTurn,
    refreshData,
  };
});
