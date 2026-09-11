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

  // Provider & User selection
  const selectedProvider = ref("All");
  const selectedUser = ref("All");

  // Rankings
  const userRankings = ref([]);
  const sessionRankings = ref([]);
  const sourceDistribution = ref([]);

  // Tool Call turns list & active trace details
  const toolCallTurns = ref([]);
  const activeTurn = ref(null);

  // Failures list
  const failures = ref([]);

  // Currency setting
  const currency = ref("USD");

  // Cost calculations settings
  const costCalc = ref({
    provider: "",
    inputPrice: 0.15,
    outputPrice: 0.6,
    cachePrice: 0.075,
  });

  // --- Computed Derived Models (Single Source of Truth) ---
  const modelDistribution = computed(() => {
    return historicalData.value?.modelDistribution || [];
  });

  const rawModelDistribution = modelDistribution; // Alias for backward compatibility

  const totalAllTokens = computed(() => {
    return stats.value.totalTokens || 0;
  });

  const providerStats = computed(() => {
    return modelDistribution.value.reduce((acc, curr) => {
      const provName = curr.adapterName || curr.provider || "历史未识别实例";
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
      existing.calls += curr.callCount || 0;
      existing.promptTokens += curr.promptTokens || 0;
      existing.compTokens += curr.candidatesTokens || 0;
      existing.hitTokens += curr.cacheHitTokens || 0;
      existing.missTokens += Math.max(
        0,
        (curr.promptTokens || 0) - (curr.cacheHitTokens || 0),
      );

      const total = existing.promptTokens;
      existing.cacheHitRate =
        total > 0 ? Math.round((existing.hitTokens / total) * 100) : 0;
      return acc;
    }, []);
  });

  const groupedProviders = computed(() => {
    const providerGroups = modelDistribution.value.reduce((acc, curr) => {
      const name = curr.adapterName || curr.provider || "历史未识别实例";
      acc[name] = (acc[name] || 0) + (curr.totalTokens || 0);
      return acc;
    }, {});
    return Object.entries(providerGroups)
      .map(([name, totalTokens]) => ({
        name,
        totalTokens,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);
  });

  const providers = computed(() => providerStats.value.map((p) => p.name));

  const tokenTopUsers = computed(() => {
    return [...userRankings.value]
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);
  });

  const callsTopUsers = computed(() => {
    return [...userRankings.value]
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);
  });

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

  // Loading States for Skeleton Screens
  const loadingOverview = ref(false);
  const loadingTurns = ref(false);
  const loadingTrace = ref(false);
  const loadingFailures = ref(false);

  // In-flight sequence IDs for Race Condition elimination
  let statsSeq = 0;
  let turnsSeq = 0;
  let traceSeq = 0;
  let failuresSeq = 0;
  let isFetchingRealtime = false;

  // Actions
  async function fetchRealtimeStats() {
    // 在途请求去重，防止轮询堆积并发风暴
    if (isFetchingRealtime) return;
    isFetchingRealtime = true;
    try {
      const res = await configAPI.request("/api/admin/dashboard/realtime");
      if (res.success) {
        stats.value.connections = res.data.onlineConnections;
        stats.value.users = res.data.onlineUsers;
        stats.value.pending = res.data.pendingRequests;
      }
    } catch (err) {
      console.error("获取实时数据失败:", err);
    } finally {
      isFetchingRealtime = false;
    }
  }

  async function fetchHistoricalStats() {
    const curSeq = ++statsSeq;
    loadingOverview.value = true;
    try {
      const userParam =
        selectedUser.value && selectedUser.value !== "All"
          ? `&userId=${encodeURIComponent(selectedUser.value)}`
          : "";
      const res = await configAPI.request(
        `/api/admin/dashboard/stats?range=${timeRange.value}${userParam}`,
      );
      // 竞态丢弃：若已有更新的请求发出，丢弃当前滞后响应
      if (curSeq !== statsSeq) return;

      if (res.success) {
        const data = res.data;
        historicalData.value = data;

        // Update global summary metrics
        stats.value.totalTokens = data.summary.totalTokens;
        stats.value.promptTokens = data.summary.promptTokens;
        stats.value.compTokens = data.summary.candidatesTokens;

        // Set default cost calculation provider if empty
        if (!costCalc.value.provider && providerStats.value.length > 0) {
          costCalc.value.provider = providerStats.value[0].name;
        }

        // Process Rankings
        userRankings.value = (data.userRanking || []).map((item) => ({
          channelId: item.channelId,
          channelName: item.channelName,
          channelType: item.channelType,
          userId: item.userId,
          rawUserId: item.rawUserId || item.userId,
          calls: item.callCount,
          sourceType: item.sourceType,
          tokens: item.totalTokens,
          promptTokens: item.promptTokens || 0,
          candidatesTokens: item.candidatesTokens || 0,
          cacheHitTokens: item.cacheHitTokens || 0,
          avgTokensPerCall: Math.round(
            (item.totalTokens || 0) / Math.max(item.callCount || 1, 1),
          ),
        }));
        sessionRankings.value = (data.sessionRanking || []).map((item) => ({
          ...item,
          calls: item.callCount,
          tokens: item.totalTokens,
        }));
        sourceDistribution.value = data.sourceDistribution || [];
      }
    } catch (err) {
      if (curSeq === statsSeq) {
        console.error("获取历史大盘数据失败:", err);
        ElMessage.error("无法连接服务或管理员验证失败");
      }
    } finally {
      if (curSeq === statsSeq) {
        loadingOverview.value = false;
      }
    }
  }

  async function fetchFailures() {
    const curSeq = ++failuresSeq;
    loadingFailures.value = true;
    try {
      const res = await configAPI.request(
        "/api/admin/dashboard/failures?limit=50&offset=0",
      );
      if (curSeq !== failuresSeq) return;
      if (res.success) {
        failures.value = res.data.logs;
      }
    } catch (err) {
      if (curSeq === failuresSeq) {
        console.error("获取故障日志失败:", err);
      }
    } finally {
      if (curSeq === failuresSeq) {
        loadingFailures.value = false;
      }
    }
  }

  async function fetchTurns(search = "") {
    const curSeq = ++turnsSeq;
    loadingTurns.value = true;
    try {
      const url = search
        ? `/api/admin/dashboard/turns?limit=50&offset=0&search=${encodeURIComponent(search)}`
        : "/api/admin/dashboard/turns?limit=50&offset=0";
      const res = await configAPI.request(url);
      if (curSeq !== turnsSeq) return;

      if (res.success) {
        toolCallTurns.value = res.data.turns.map((t) => ({
          requestId: t.requestId,
          user: t.userId,
          userIp: t.userIp || "未知",
          sourceType: t.sourceType,
          sourceLabel: t.sourceLabel,
          channelId: t.channelId,
          channelName: t.channelName,
          channelType: t.channelType,
          contactorId: t.contactorId,
          sessionId: t.sessionId,
          sessionTitle: t.sessionTitle,
          createdAt: t.createdAt,
          totalTokens: t.totalTokens,
          stepsCount: t.stepsCount,
          steps: [],
        }));

        // 桌面端自动选中第一串展示右侧级联；移动端保持会话列表（由用户点选进入详情）
        const isMobile =
          typeof window !== "undefined" && window.innerWidth < 900;
        if (isMobile) {
          activeTurn.value = null;
        } else if (toolCallTurns.value.length > 0) {
          const matched = toolCallTurns.value.find(
            (t) => t.requestId === activeTurn.value?.requestId,
          );
          if (matched) {
            selectTurn(matched);
          } else {
            selectTurn(toolCallTurns.value[0]);
          }
        } else {
          activeTurn.value = null;
        }
      }
    } catch (err) {
      if (curSeq === turnsSeq) {
        console.error("获取最近活跃对话失败:", err);
      }
    } finally {
      if (curSeq === turnsSeq) {
        loadingTurns.value = false;
      }
    }
  }

  async function fetchUserDetail(userId) {
    try {
      const res = await configAPI.request(
        `/api/admin/dashboard/user/${encodeURIComponent(userId)}`,
      );
      if (res.success) {
        return res.data;
      }
    } catch (err) {
      console.error("获取用户画像详情失败:", err);
      ElMessage.error("获取用户画像详情失败");
    }
    return null;
  }

  async function selectTurn(turn) {
    if (!turn) {
      activeTurn.value = null;
      return;
    }
    activeTurn.value = turn;
    const curSeq = ++traceSeq;
    loadingTrace.value = true;
    try {
      const res = await configAPI.request(
        `/api/admin/dashboard/trace/${turn.requestId}`,
      );
      if (curSeq !== traceSeq) return;
      if (
        res.success &&
        activeTurn.value &&
        activeTurn.value.requestId === turn.requestId
      ) {
        activeTurn.value.steps = res.data.steps;
      }
    } catch (err) {
      if (curSeq === traceSeq) {
        console.error("获取链路 Trace 失败:", err);
        ElMessage.error("获取调用链 Trace 失败");
      }
    } finally {
      if (curSeq === traceSeq) {
        loadingTrace.value = false;
      }
    }
  }

  function setSelectedUser(userId) {
    selectedUser.value = userId || "All";
    return fetchHistoricalStats();
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
    selectedProvider,
    selectedUser,
    userRankings,
    sessionRankings,
    sourceDistribution,
    toolCallTurns,
    activeTurn,
    failures,
    costCalc,
    currency,
    loadingOverview,
    loadingTurns,
    loadingTrace,
    loadingFailures,

    // Computed / Derived
    modelDistribution,
    rawModelDistribution,
    providerStats,
    groupedProviders,
    totalAllTokens,
    providers,
    tokenTopUsers,
    callsTopUsers,
    calculatedCost,

    // Actions
    fetchRealtimeStats,
    fetchHistoricalStats,
    fetchFailures,
    fetchTurns,
    fetchUserDetail,
    selectTurn,
    setSelectedUser,
    refreshData,
  };
});
