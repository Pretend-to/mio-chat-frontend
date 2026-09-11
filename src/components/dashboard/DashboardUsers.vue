<template>
  <div class="usage-view">
    <div class="top-nav-bar">
      <div class="view-switch" role="tablist" aria-label="用量分析视图">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="switch-button"
          :class="{ active: activeView === tab.value }"
          type="button"
          @click="activeView = tab.value"
        >
          <i :class="tab.icon"></i>
          {{ tab.label }}
        </button>
      </div>

      <div class="user-filter-box">
        <el-select
          :model-value="store.selectedUser"
          filterable
          clearable
          placeholder="聚焦指定用户..."
          style="width: 220px"
          @update:model-value="(val) => store.setSelectedUser(val || 'All')"
          @clear="store.setSelectedUser('All')"
        >
          <el-option label="全部用户 (All)" value="All" />
          <el-option
            v-for="u in store.userRankings"
            :key="u.userId"
            :label="`${u.userId} (${formatTokens(u.tokens)})`"
            :value="u.userId"
          />
        </el-select>
      </div>
    </div>

    <!-- 聚焦单个用户时的全局提示条 -->
    <div v-if="store.selectedUser !== 'All'" class="user-focus-banner">
      <div class="user-focus-info">
        <i class="fa-solid fa-filter"></i>
        <span>当前已聚焦用户：</span>
        <strong class="mono user-tag">{{ store.selectedUser }}</strong>
        <span class="user-focus-hint"
          >（已切片该用户的会话与模型用量数据）</span
        >
      </div>
      <el-button
        size="small"
        type="primary"
        plain
        @click="store.setSelectedUser('All')"
      >
        <i class="fa-solid fa-xmark"></i> 清除筛选 / 查看全部
      </el-button>
    </div>

    <!-- 子视图 1: 用户用量与排行 -->
    <template v-if="activeView === 'users'">
      <div class="summary-grid">
        <article class="summary-card">
          <div class="summary-heading">
            <span class="source-icon web"
              ><i class="fa-solid fa-users"></i
            ></span>
            <span>活跃用户总数</span>
          </div>
          <strong>{{ formatNumber(store.userRankings.length) }}</strong>
          <span>当前时间窗口内产生调用的用户</span>
        </article>

        <article class="summary-card">
          <div class="summary-heading">
            <span class="source-icon channel"
              ><i class="fa-solid fa-bolt"></i
            ></span>
            <span>人均调用次数</span>
          </div>
          <strong>{{ formatNumber(userAvgCalls) }}</strong>
          <span>总调用 {{ formatNumber(userTotalCalls) }} 次</span>
        </article>

        <article class="summary-card">
          <div class="summary-heading">
            <span class="source-icon system"
              ><i class="fa-solid fa-coins"></i
            ></span>
            <span>人均 Token</span>
          </div>
          <strong>{{ formatTokens(userAvgTokens) }}</strong>
          <span>总 Token {{ formatTokens(userTotalTokens) }}</span>
        </article>

        <article class="summary-card">
          <div class="summary-heading">
            <span class="source-icon unknown"
              ><i class="fa-solid fa-crown"></i
            ></span>
            <span>Top 1 消耗占比</span>
          </div>
          <strong>{{ top1Share }}%</strong>
          <span>最高单人 {{ formatTokens(top1Tokens) }} Token</span>
        </article>
      </div>

      <section class="saas-card">
        <header class="card-header user-header">
          <div>
            <h3>用户用量排行榜</h3>
            <p>
              展示当前活跃用户的 Token
              构成细分（输出、输入、缓存输入）、调用频次及单次均值
            </p>
          </div>
          <div class="header-filters">
            <div class="source-filters">
              <button
                v-for="filter in sourceFilters"
                :key="filter.value"
                type="button"
                :class="{ active: userSourceFilter === filter.value }"
                @click="userSourceFilter = filter.value"
              >
                {{ filter.label }}
              </button>
            </div>
            <el-input
              v-model="userSearchQuery"
              placeholder="搜索用户标识..."
              size="small"
              clearable
              style="width: 170px"
            >
              <template #prefix>
                <i
                  class="fa-solid fa-magnifying-glass"
                  style="color: #94a3b8"
                ></i>
              </template>
            </el-input>
          </div>
        </header>

        <div class="table-responsive-wrapper">
          <el-table
            :data="searchedUsers"
            class="saas-table"
            style="width: 100%"
            :default-sort="{ prop: 'tokens', order: 'descending' }"
          >
            <el-table-column label="排名" width="80" align="center">
              <template #default="scope">
                <span
                  class="rank-badge"
                  :class="`rank-${scope.$index + 1}`"
                >
                  {{
                    scope.$index < 3
                      ? ["🥇", "🥈", "🥉"][scope.$index]
                      : `#${scope.$index + 1}`
                  }}
                </span>
              </template>
            </el-table-column>

            <el-table-column
              label="用户标识"
              min-width="220"
              prop="userId"
              sortable
            >
              <template #default="scope">
                <div class="user-cell">
                  <span class="avatar" :class="scope.row.sourceType">
                    <i :class="sourceIcon(scope.row.sourceType)"></i>
                  </span>
                  <div>
                    <span
                      class="mono ellipsis user-clickable"
                      :title="`${scope.row.userId} (点击聚焦此用户)`"
                      @click="focusUser(scope.row.userId)"
                    >
                      {{ scope.row.userId }}
                    </span>
                    <small>{{ sourceName(scope.row) }}</small>
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="Token 构成" min-width="170">
              <template #default="scope">
                <el-tooltip placement="top" :show-after="50">
                  <template #content>
                    <div class="model-bar-tooltip">
                      <div class="tooltip-header">
                        <span>{{ scope.row.userId }}</span>
                      </div>
                      <div class="tooltip-list">
                        <div class="tooltip-row">
                          <span class="tooltip-label">
                            <i class="legend-dot output"></i>输出:
                          </span>
                          <span class="tooltip-val">
                            {{ formatNumber(scope.row.candidatesTokens) }} Token
                            ({{
                              scope.row.tokens > 0
                                ? Math.round(
                                    (scope.row.candidatesTokens /
                                      scope.row.tokens) *
                                      100,
                                  )
                                : 0
                            }}%)
                          </span>
                        </div>
                        <div class="tooltip-row">
                          <span class="tooltip-label">
                            <i class="legend-dot input"></i>输入:
                          </span>
                          <span class="tooltip-val">
                            {{
                              formatNumber(
                                Math.max(
                                  0,
                                  scope.row.promptTokens -
                                    scope.row.cacheHitTokens,
                                ),
                              )
                            }}
                            Token ({{
                              scope.row.tokens > 0
                                ? Math.round(
                                    (Math.max(
                                      0,
                                      scope.row.promptTokens -
                                        scope.row.cacheHitTokens,
                                    ) /
                                      scope.row.tokens) *
                                      100,
                                  )
                                : 0
                            }}%)
                          </span>
                        </div>
                        <div class="tooltip-row">
                          <span class="tooltip-label">
                            <i class="legend-dot cache"></i>缓存输入:
                          </span>
                          <span class="tooltip-val">
                            {{ formatNumber(scope.row.cacheHitTokens) }} Token
                            ({{
                              scope.row.tokens > 0
                                ? Math.round(
                                    (scope.row.cacheHitTokens /
                                      scope.row.tokens) *
                                      100,
                                  )
                                : 0
                            }}%)
                          </span>
                        </div>
                        <div class="tooltip-divider"></div>
                        <div class="tooltip-row total">
                          <span class="tooltip-label">总计:</span>
                          <span class="tooltip-val"
                            >{{ formatNumber(scope.row.tokens) }} Token</span
                          >
                        </div>
                      </div>
                    </div>
                  </template>
                  <div class="mini-bar-track">
                    <span
                      class="bar output"
                      :style="{
                        width: `${scope.row.tokens > 0 ? (scope.row.candidatesTokens / scope.row.tokens) * 100 : 0}%`,
                      }"
                    ></span>
                    <span
                      class="bar input"
                      :style="{
                        width: `${scope.row.tokens > 0 ? (Math.max(0, scope.row.promptTokens - scope.row.cacheHitTokens) / scope.row.tokens) * 100 : 0}%`,
                      }"
                    ></span>
                    <span
                      class="bar cache"
                      :style="{
                        width: `${scope.row.tokens > 0 ? (scope.row.cacheHitTokens / scope.row.tokens) * 100 : 0}%`,
                      }"
                    ></span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column
              label="总 Token"
              width="140"
              align="right"
              prop="tokens"
              sortable
            >
              <template #default="scope">
                <strong>{{ formatTokens(scope.row.tokens) }}</strong>
              </template>
            </el-table-column>

            <el-table-column
              label="调用次数"
              width="120"
              align="right"
              prop="calls"
              sortable
            >
              <template #default="scope">
                {{ formatNumber(scope.row.calls) }}
              </template>
            </el-table-column>

            <el-table-column
              label="单次平均"
              width="130"
              align="right"
              prop="avgTokensPerCall"
              sortable
            >
              <template #default="scope">
                {{ formatTokens(scope.row.avgTokensPerCall) }}
              </template>
            </el-table-column>

            <el-table-column label="快捷下钻" width="150" align="center">
              <template #default="scope">
                <div class="user-actions">
                  <el-button
                    type="primary"
                    link
                    size="small"
                    @click="viewUserSessions(scope.row.userId)"
                  >
                    看会话
                  </el-button>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    @click="viewUserModel(scope.row.userId)"
                  >
                    看模型
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="searchedUsers.length === 0" class="empty-state">
            当前时间范围内没有匹配的用户用量数据
          </div>
        </div>
      </section>
    </template>

    <!-- 子视图 2: 来源与会话 -->
    <template v-else-if="activeView === 'sessions'">
      <div class="summary-grid">
        <article
          v-for="item in sourceCards"
          :key="item.type"
          class="summary-card"
        >
          <div class="summary-heading">
            <span class="source-icon" :class="item.type"
              ><i :class="item.icon"></i
            ></span>
            <span>{{ item.label }}</span>
          </div>
          <strong>{{ formatNumber(item.calls) }}</strong>
          <span>{{ formatTokens(item.tokens) }} Token</span>
        </article>
      </div>

      <section class="saas-card">
        <header class="card-header source-header">
          <div>
            <h3>来源与会话</h3>
            <p>
              按真实 Session 标题归集，并区分 Web 用户与外部 Channel 用户
              <span v-if="store.selectedUser !== 'All'" class="filter-hint">
                (已按用户 {{ store.selectedUser }} 切片)
              </span>
            </p>
          </div>
          <div class="source-filters">
            <button
              v-for="filter in sourceFilters"
              :key="filter.value"
              type="button"
              :class="{ active: sourceFilter === filter.value }"
              @click="sourceFilter = filter.value"
            >
              {{ filter.label }}
            </button>
          </div>
        </header>
        <div class="table-responsive-wrapper">
          <el-table
            :data="filteredSessions"
            class="saas-table"
            style="width: 100%"
            :default-sort="{ prop: 'tokens', order: 'descending' }"
          >
            <el-table-column label="会话" min-width="260">
              <template #default="scope">
                <div class="session-cell">
                  <span class="session-title">{{
                    scope.row.sessionTitle
                  }}</span>
                  <span class="session-id">{{
                    scope.row.sessionId || "历史记录未关联 Session"
                  }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源" min-width="150">
              <template #default="scope">
                <span class="source-pill" :class="scope.row.sourceType">
                  <i :class="sourceIcon(scope.row.sourceType)"></i>{{ sourceName(scope.row) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              label="用户标识"
              min-width="210"
              prop="userId"
              sortable
            >
              <template #default="scope">
                <span
                  class="mono ellipsis user-clickable"
                  :title="`${scope.row.userId} (点击聚焦此用户)`"
                  @click="focusUser(scope.row.userId)"
                >
                  {{ scope.row.userId }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              label="调用"
              width="110"
              align="right"
              prop="calls"
              sortable
            >
              <template #default="scope">{{
                formatNumber(scope.row.calls)
              }}</template>
            </el-table-column>
            <el-table-column
              label="Token"
              width="130"
              align="right"
              prop="tokens"
              sortable
            >
              <template #default="scope"
                ><strong>{{ formatTokens(scope.row.tokens) }}</strong></template
              >
            </el-table-column>
          </el-table>
          <div v-if="filteredSessions.length === 0" class="empty-state">
            当前时间范围内没有对应来源的会话审计数据
          </div>
        </div>
      </section>
    </template>

    <!-- 子视图 3: 模型用量 -->
    <template v-else>
      <div class="model-summary-grid">
        <article class="metric-card">
          <span>总 Token</span
          ><strong>{{ formatTokens(store.stats.totalTokens) }}</strong
          ><small
            >{{ formatTokens(store.stats.promptTokens) }} 输入 /
            {{ formatTokens(store.stats.compTokens) }} 输出</small
          >
        </article>
        <article class="metric-card">
          <span>API 调用</span><strong>{{ formatNumber(totalCalls) }}</strong
          ><small>{{ modelRows.length }} 个模型</small>
        </article>
        <article class="metric-card">
          <span>缓存命中率</span><strong>{{ cacheHitRate }}%</strong
          ><small>{{ formatTokens(totalCachedTokens) }} 缓存读取 Token</small>
        </article>
      </div>

      <section class="saas-card model-usage-card">
        <header class="card-header">
          <div>
            <h3>模型用量</h3>
            <p>
              输出、输入与缓存输入 Token 的横向对照
              <span v-if="store.selectedUser !== 'All'" class="filter-hint">
                (已按用户 {{ store.selectedUser }} 切片)
              </span>
            </p>
          </div>
          <el-select
            v-model="store.selectedProvider"
            size="small"
            style="width: 160px"
          >
            <el-option label="全部适配器" value="All" />
            <el-option
              v-for="provider in store.providers"
              :key="provider"
              :label="provider"
              :value="provider"
            />
          </el-select>
        </header>
        <div class="legend">
          <span><i class="legend-dot output"></i>输出</span
          ><span><i class="legend-dot input"></i>输入</span
          ><span><i class="legend-dot cache"></i>缓存输入</span>
        </div>
        <div class="model-bars">
          <div
            v-for="row in filteredModelRows"
            :key="`${row.adapterInstanceId || row.adapterName}/${row.model}`"
            class="model-row"
          >
            <div class="model-label">
              <span :title="row.model">{{ row.model }}</span
              ><small>{{ row.adapterName }}</small>
            </div>
            <el-tooltip placement="top" :show-after="50">
              <template #content>
                <div class="model-bar-tooltip">
                  <div class="tooltip-header">
                    <span>{{ row.model }}</span>
                    <small v-if="row.adapterName"
                      >({{ row.adapterName }})</small
                    >
                  </div>
                  <div class="tooltip-list">
                    <div class="tooltip-row">
                      <span class="tooltip-label">
                        <i class="legend-dot output"></i>输出:
                      </span>
                      <span class="tooltip-val"
                        >{{ formatNumber(row.candidatesTokens) }} Token</span
                      >
                    </div>
                    <div class="tooltip-row">
                      <span class="tooltip-label">
                        <i class="legend-dot input"></i>输入:
                      </span>
                      <span class="tooltip-val"
                        >{{ formatNumber(row.uncachedInputTokens) }} Token</span
                      >
                    </div>
                    <div class="tooltip-row">
                      <span class="tooltip-label">
                        <i class="legend-dot cache"></i>缓存输入:
                      </span>
                      <span class="tooltip-val"
                        >{{ formatNumber(row.cacheHitTokens) }} Token</span
                      >
                    </div>
                    <div class="tooltip-divider"></div>
                    <div class="tooltip-row total">
                      <span class="tooltip-label">总计:</span>
                      <span class="tooltip-val"
                        >{{ formatNumber(row.totalTokens) }} Token</span
                      >
                    </div>
                  </div>
                </div>
              </template>
              <div class="bar-track">
                <span
                  class="bar output"
                  :style="segmentStyle(row.candidatesTokens)"
                ></span>
                <span
                  class="bar input"
                  :style="segmentStyle(row.uncachedInputTokens)"
                ></span>
                <span
                  class="bar cache"
                  :style="segmentStyle(row.cacheHitTokens)"
                ></span>
              </div>
            </el-tooltip>
            <strong>{{ formatTokens(row.totalTokens) }}</strong>
          </div>
          <div v-if="filteredModelRows.length === 0" class="empty-state">
            当前时间范围内暂无模型用量
          </div>
        </div>
      </section>

      <section class="saas-card">
        <header class="card-header">
          <div>
            <h3>模型明细</h3>
            <p>缓存命中率仅以输入 Token 为可缓存基数</p>
          </div>
        </header>
        <div class="table-responsive-wrapper">
          <el-table
            :data="filteredModelRows"
            class="saas-table"
            style="width: 100%"
          >
            <el-table-column
              prop="model"
              label="模型"
              min-width="190"
            /><el-table-column
              prop="adapterName"
              label="适配器实例"
              min-width="150"
            />
            <el-table-column
              label="调用"
              width="100"
              align="right"
              prop="callCount"
              sortable
              ><template #default="scope">{{
                formatNumber(scope.row.callCount)
              }}</template></el-table-column
            >
            <el-table-column
              label="输入"
              width="120"
              align="right"
              prop="promptTokens"
              sortable
              ><template #default="scope">{{
                formatTokens(scope.row.promptTokens)
              }}</template></el-table-column
            >
            <el-table-column
              label="输出"
              width="120"
              align="right"
              prop="candidatesTokens"
              sortable
              ><template #default="scope">{{
                formatTokens(scope.row.candidatesTokens)
              }}</template></el-table-column
            >
            <el-table-column
              label="缓存读取"
              width="130"
              align="right"
              prop="cacheHitTokens"
              sortable
              ><template #default="scope">{{
                formatTokens(scope.row.cacheHitTokens)
              }}</template></el-table-column
            >
            <el-table-column
              label="命中率"
              width="120"
              align="right"
              prop="cacheHitRate"
              sortable
              ><template #default="scope"
                ><span class="rate"
                  >{{ scope.row.cacheHitRate }}%</span
                ></template
              ></el-table-column
            >
          </el-table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useDashboardStore } from "@/stores/dashboardStore";

const store = useDashboardStore();
const activeView = ref("users");
const sourceFilter = ref("all");
const userSourceFilter = ref("all");
const userSearchQuery = ref("");

const tabs = [
  {
    value: "users",
    label: "用户用量与排行",
    icon: "fa-solid fa-ranking-star",
  },
  {
    value: "sessions",
    label: "来源与会话",
    icon: "fa-solid fa-users-viewfinder",
  },
  {
    value: "models",
    label: "模型用量",
    icon: "fa-solid fa-chart-simple",
  },
];

const sourceFilters = [
  { value: "all", label: "全部" },
  { value: "web", label: "Web" },
  { value: "channel", label: "Channel" },
  { value: "system", label: "系统" },
];

const sourceMeta = {
  web: { label: "Web", icon: "fa-solid fa-window-maximize" },
  channel: { label: "Channel", icon: "fa-solid fa-comments" },
  system: { label: "系统任务", icon: "fa-solid fa-gears" },
  unknown: { label: "历史未识别", icon: "fa-solid fa-circle-question" },
};

// --- 用户排行与 KPI 统计 ---
const userTotalCalls = computed(() =>
  store.userRankings.reduce((sum, u) => sum + (u.calls || 0), 0),
);
const userTotalTokens = computed(() =>
  store.userRankings.reduce((sum, u) => sum + (u.tokens || 0), 0),
);
const userAvgCalls = computed(() =>
  store.userRankings.length > 0
    ? Math.round(userTotalCalls.value / store.userRankings.length)
    : 0,
);
const userAvgTokens = computed(() =>
  store.userRankings.length > 0
    ? Math.round(userTotalTokens.value / store.userRankings.length)
    : 0,
);
const top1Tokens = computed(() => store.userRankings[0]?.tokens || 0);
const top1Share = computed(() =>
  userTotalTokens.value > 0
    ? ((top1Tokens.value / userTotalTokens.value) * 100).toFixed(1)
    : "0",
);

const filteredUsers = computed(() =>
  store.userRankings
    .filter(
      (row) =>
        userSourceFilter.value === "all" ||
        row.sourceType === userSourceFilter.value,
    )
    .sort((a, b) => b.tokens - a.tokens),
);

const searchedUsers = computed(() => {
  if (!userSearchQuery.value.trim()) return filteredUsers.value;
  const q = userSearchQuery.value.trim().toLowerCase();
  return filteredUsers.value.filter(
    (u) =>
      (u.userId && u.userId.toLowerCase().includes(q)) ||
      (u.channelName && u.channelName.toLowerCase().includes(q)),
  );
});

function focusUser(userId) {
  store.setSelectedUser(userId);
}

function viewUserSessions(userId) {
  store.setSelectedUser(userId);
  activeView.value = "sessions";
}

function viewUserModel(userId) {
  store.setSelectedUser(userId);
  activeView.value = "models";
}

// --- 会话与来源分布 ---
const sourceCards = computed(() => {
  const totals = new Map();
  for (const row of store.sourceDistribution) {
    const type = row.sourceType || "unknown";
    const current = totals.get(type) || { calls: 0, tokens: 0 };
    current.calls += row.callCount || 0;
    current.tokens += row.totalTokens || 0;
    totals.set(type, current);
  }
  return ["web", "channel", "system", "unknown"].map((type) => ({
    type,
    ...sourceMeta[type],
    ...(totals.get(type) || { calls: 0, tokens: 0 }),
  }));
});

const filteredSessions = computed(() =>
  store.sessionRankings
    .filter(
      (row) =>
        sourceFilter.value === "all" || row.sourceType === sourceFilter.value,
    )
    .sort((a, b) => b.tokens - a.tokens),
);

// --- 模型用量 ---
const modelRows = computed(() =>
  (store.rawModelDistribution || [])
    .map((row) => {
      const inputTokens = row.promptTokens || 0;
      return {
        ...row,
        adapterName: row.adapterName || row.provider || "历史未识别实例",
        uncachedInputTokens: Math.max(
          0,
          (row.promptTokens || 0) - (row.cacheHitTokens || 0),
        ),
        cacheHitRate:
          inputTokens > 0
            ? Math.min(
                100,
                Math.round(((row.cacheHitTokens || 0) / inputTokens) * 100),
              )
            : 0,
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens),
);

const filteredModelRows = computed(() =>
  store.selectedProvider === "All"
    ? modelRows.value
    : modelRows.value.filter(
        (row) => row.adapterName === store.selectedProvider,
      ),
);

const totalCalls = computed(() =>
  modelRows.value.reduce((sum, row) => sum + (row.callCount || 0), 0),
);
const totalCachedTokens = computed(() =>
  modelRows.value.reduce((sum, row) => sum + (row.cacheHitTokens || 0), 0),
);
const totalCacheableTokens = computed(() =>
  modelRows.value.reduce((sum, row) => sum + (row.promptTokens || 0), 0),
);
const cacheHitRate = computed(() =>
  totalCacheableTokens.value > 0
    ? Math.min(
        100,
        Math.round(
          (totalCachedTokens.value / totalCacheableTokens.value) * 100,
        ),
      )
    : 0,
);

function sourceIcon(type) {
  return (sourceMeta[type] || sourceMeta.unknown).icon;
}

function sourceName(row) {
  return row.sourceType === "channel"
    ? row.channelName || row.channelType || "Channel"
    : (sourceMeta[row.sourceType] || sourceMeta.unknown).label;
}

function segmentStyle(value) {
  const maxTotal = filteredModelRows.value[0]?.totalTokens || 1;
  return { width: `${Math.max(0, ((value || 0) / maxTotal) * 100)}%` };
}

function formatTokens(value) {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return number.toLocaleString("zh-CN");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}
</script>

<style scoped>
.usage-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.top-nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.view-switch {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  border-radius: 10px;
  background: var(--mio-bg-hover, #f1f5f9);
}
.switch-button,
.source-filters button {
  border: 0;
  background: transparent;
  color: var(--mio-text-secondary, #64748b);
  cursor: pointer;
  font: inherit;
}
.switch-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
}
.switch-button.active {
  color: var(--mio-color-primary, #2563eb);
  background: var(--mio-bg-card, #fff);
  box-shadow: 0 1px 3px rgb(15 23 42 / 8%);
}
.user-filter-box {
  display: flex;
  align-items: center;
  gap: 8px;
}
.user-focus-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--mio-bg-hover, #eff6ff);
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  color: #1e40af;
  font-size: 13px;
}
.user-focus-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.user-tag {
  background: #dbeafe;
  padding: 2px 8px;
  border-radius: 4px;
  color: #1d4ed8;
}
.user-focus-hint {
  color: #64748b;
  font-size: 12px;
}
.filter-hint {
  color: var(--mio-color-primary, #2563eb);
  font-weight: 500;
  margin-left: 6px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.summary-card,
.metric-card,
.saas-card {
  border: 1px solid var(--mio-border-color-light, #e2e8f0);
  background: var(--mio-bg-card, #fff);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgb(15 23 42 / 4%);
}
.summary-card {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.summary-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--mio-text-secondary, #64748b);
  font-size: 13px;
}
.source-icon,
.avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
}
.source-icon.web,
.avatar.web {
  color: #2563eb;
  background: #eff6ff;
}
.source-icon.channel,
.avatar.channel {
  color: #059669;
  background: #ecfdf5;
}
.source-icon.system,
.avatar.system {
  color: #7c3aed;
  background: #f5f3ff;
}
.source-icon.unknown,
.avatar.unknown {
  color: #64748b;
  background: #f1f5f9;
}
.summary-card strong,
.metric-card strong {
  color: var(--mio-text-primary, #0f172a);
  font-size: 26px;
  line-height: 1.1;
}
.summary-card > span,
.metric-card small {
  color: var(--mio-text-secondary, #94a3b8);
  font-size: 12px;
}
.saas-card {
  overflow: hidden;
}
.card-header {
  min-height: 66px;
  padding: 15px 20px;
  border-bottom: 1px solid var(--mio-border-color-light, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.card-header h3 {
  margin: 0;
  color: var(--mio-text-primary, #0f172a);
  font-size: 15px;
}
.card-header p {
  margin: 5px 0 0;
  color: var(--mio-text-secondary, #94a3b8);
  font-size: 12px;
}
.header-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.source-filters {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 8px;
  background: var(--mio-bg-hover, #f1f5f9);
}
.source-filters button {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
}
.source-filters button.active {
  color: var(--mio-color-primary, #2563eb);
  background: var(--mio-bg-card, #fff);
  font-weight: 600;
}
.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  color: var(--mio-text-secondary, #64748b);
}
.rank-badge.rank-1,
.rank-badge.rank-2,
.rank-badge.rank-3 {
  font-size: 16px;
}
.session-cell,
.user-cell > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.session-title {
  color: var(--mio-text-primary, #0f172a);
  font-weight: 600;
}
.session-id,
.user-cell small {
  margin-top: 3px;
  color: var(--mio-text-secondary, #94a3b8);
  font-size: 11px;
}
.source-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: #475569;
  background: #f1f5f9;
}
.source-pill.web {
  color: #1d4ed8;
  background: #eff6ff;
}
.source-pill.channel {
  color: #047857;
  background: #ecfdf5;
}
.source-pill.system {
  color: #6d28d9;
  background: #f5f3ff;
}
.mono {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px;
}
.ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.avatar {
  flex: none;
}
.user-clickable {
  cursor: pointer;
  transition: color 0.15s ease;
}
.user-clickable:hover {
  color: var(--mio-color-primary, #2563eb);
  text-decoration: underline;
}
.mini-bar-track {
  width: 100%;
  max-width: 140px;
  height: 12px;
  display: flex;
  overflow: hidden;
  border-radius: 4px;
  background: var(--mio-bg-hover, #f1f5f9);
  cursor: pointer;
  transition: filter 0.15s ease;
}
.mini-bar-track:hover {
  filter: brightness(1.08);
}
.user-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.empty-state {
  padding: 34px;
  text-align: center;
  color: var(--mio-text-secondary, #94a3b8);
  font-size: 13px;
}
.model-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.metric-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.metric-card > span {
  color: var(--mio-text-secondary, #64748b);
  font-size: 13px;
}
.legend {
  display: flex;
  gap: 18px;
  padding: 14px 20px 0;
  color: var(--mio-text-secondary, #64748b);
  font-size: 12px;
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
  flex-shrink: 0;
}
.legend-dot.output,
.bar.output {
  background: #28a99a;
}
.legend-dot.input,
.bar.input {
  background: #5b6ac4;
}
.legend-dot.cache,
.bar.cache {
  background: #8fa0ee;
}
.model-bar-tooltip {
  min-width: 170px;
  padding: 3px 1px;
  font-size: 12px;
  line-height: 1.5;
}
.tooltip-header {
  font-weight: 600;
  margin-bottom: 7px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tooltip-header small {
  opacity: 0.7;
  font-weight: normal;
}
.tooltip-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.tooltip-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tooltip-val {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 600;
}
.tooltip-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.12);
  margin: 3px 0;
}
.tooltip-row.total {
  font-weight: 700;
  opacity: 0.95;
}
.model-bars {
  padding: 16px 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.model-row {
  display: grid;
  grid-template-columns: minmax(150px, 220px) 1fr 80px;
  align-items: center;
  gap: 16px;
}
.model-label {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.model-label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--mio-text-primary, #0f172a);
  font-size: 13px;
  font-weight: 600;
}
.model-label small {
  margin-top: 3px;
  color: var(--mio-text-secondary, #94a3b8);
}
.bar-track {
  width: 100%;
  height: 18px;
  display: flex;
  overflow: hidden;
  border-radius: 6px;
  background: var(--mio-bg-hover, #f1f5f9);
  cursor: pointer;
  transition: filter 0.15s ease;
}
.bar-track:hover {
  filter: brightness(1.06);
}
.bar {
  height: 100%;
  min-width: 0;
  transition: filter 0.15s ease;
}
.bar:hover {
  filter: brightness(1.1);
}
.model-row > strong {
  color: var(--mio-text-regular, #475569);
  text-align: right;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px;
}
.rate {
  color: #059669;
  font-weight: 700;
}
.table-responsive-wrapper {
  overflow-x: auto;
}
@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .model-summary-grid {
    grid-template-columns: 1fr;
  }
  .source-header,
  .user-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .model-row {
    grid-template-columns: minmax(110px, 150px) 1fr 60px;
    gap: 9px;
  }
}
@media (max-width: 560px) {
  .top-nav-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .view-switch {
    align-self: stretch;
  }
  .switch-button {
    flex: 1;
    justify-content: center;
  }
  .user-filter-box {
    width: 100%;
  }
  .user-filter-box :deep(.el-select) {
    width: 100% !important;
  }
  .source-filters {
    width: 100%;
    overflow-x: auto;
  }
  .model-row {
    grid-template-columns: 110px 1fr;
  }
  .model-row > strong {
    display: none;
  }
}
</style>
