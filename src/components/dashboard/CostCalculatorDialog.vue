<template>
  <el-dialog
    v-model="store.showCostModal"
    title="算力成本核算"
    width="500px"
    class="saas-dialog"
    destroy-on-close
  >
    <div class="time-range-hint">
      核算时段：<strong>{{ timeRangeLabel }}</strong>
    </div>

    <el-form label-width="120px" size="default">
      <el-form-item label="服务实例">
        <el-select
          v-model="store.costCalc.provider"
          placeholder="选择服务实例"
          style="width: 100%"
        >
          <el-option
            v-for="p in store.providers"
            :key="p"
            :label="p"
            :value="p"
          ></el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="货币单位">
        <el-radio-group v-model="store.currency" class="currency-radio">
          <el-radio-button value="USD">美元 ($)</el-radio-button>
          <el-radio-button value="CNY">人民币 (¥)</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="输入单价">
        <div class="price-input-row">
          <el-input-number
            v-model="store.costCalc.inputPrice"
            :min="0"
            :precision="4"
            :step="0.001"
            controls-position="right"
            style="width: 180px"
          ></el-input-number>
          <span class="unit-text">{{ currencySymbol }}/1M Tokens</span>
        </div>
      </el-form-item>

      <el-form-item label="输出单价">
        <div class="price-input-row">
          <el-input-number
            v-model="store.costCalc.outputPrice"
            :min="0"
            :precision="4"
            :step="0.001"
            controls-position="right"
            style="width: 180px"
          ></el-input-number>
          <span class="unit-text">{{ currencySymbol }}/1M Tokens</span>
        </div>
      </el-form-item>

      <el-form-item label="缓存命中单价">
        <div class="price-input-row">
          <el-input-number
            v-model="store.costCalc.cachePrice"
            :min="0"
            :precision="4"
            :step="0.001"
            controls-position="right"
            style="width: 180px"
          ></el-input-number>
          <span class="unit-text">{{ currencySymbol }}/1M Tokens</span>
        </div>
      </el-form-item>
    </el-form>

    <div class="cost-estimate-card">
      <div class="estimate-title">
        基于 {{ timeRangeLabel }} 用量预估总成本（{{ store.costCalc.provider || "-" }}）
      </div>
      <div class="estimate-value">{{ currencySymbol }}{{ store.calculatedCost.toFixed(4) }}</div>
      <div class="estimate-sub">
        基于已统计到的输入、输出与缓存命中 Token 量测算。
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="store.showCostModal = false" size="default"
          >关闭</el-button
        >
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from "vue";
import { useDashboardStore } from "@/stores/dashboardStore";

const store = useDashboardStore();

const timeRangeLabel = computed(() => {
  const map = { "24h": "过去 24 小时", "7d": "近 7 天", "30d": "近 30 天" };
  return map[store.timeRange] || store.timeRange;
});

const currencySymbol = computed(() => (store.currency === "CNY" ? "¥" : "$"));
</script>

<style scoped>
.time-range-hint {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.time-range-hint strong {
  color: #0f172a;
  font-weight: 600;
}

.currency-radio {
  width: 100%;
}

.currency-radio .el-radio-button__inner {
  min-width: 100px;
  justify-content: center;
}

.price-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.unit-text {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.cost-estimate-card {
  margin-top: 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 18px;
  text-align: center;
}

.estimate-title {
  font-size: 13px;
  color: #475569;
  font-weight: 600;
  margin-bottom: 6px;
}

.estimate-value {
  font-size: 32px;
  font-weight: 800;
  color: #2563eb;
  font-family: "Plus Jakarta Sans", sans-serif;
  margin-bottom: 6px;
}

.estimate-sub {
  font-size: 11px;
  color: #94a3b8;
}

.dialog-footer {
  text-align: right;
}

:deep(.el-dialog) {
  border-radius: 12px !important;
}

:deep(.el-dialog__header) {
  margin-right: 0px !important;
  padding-bottom: 12px !important;
  border-bottom: 1px solid #f1f5f9 !important;
}

:deep(.el-dialog__title) {
  font-size: 16px !important;
  font-weight: 600 !important;
  color: #0f172a !important;
}

:deep(.el-dialog__body) {
  padding: 24px 20px !important;
}
</style>
