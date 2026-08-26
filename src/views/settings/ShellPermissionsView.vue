<template>
  <div class="shell-permissions-view">
    <div class="page-header">
      <div class="header-title">
        <h1>Shell 权限</h1>
        <div class="header-desc">管理后端权威的 Shell 命令自动审批名单：deny 高危黑名单（必须人工介入）与 allow 自动放行名单（可绑定工作区目录）。前端已不再维护本地审批名单。</div>
      </div>
      <div class="header-actions">
        <el-button type="primary" :icon="Plus" @click="openAdd">添加规则</el-button>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">高危黑名单(deny)：</span>
        <span class="stat-value">{{ denyCount }} 条</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">自动放行(allow)：</span>
        <span class="stat-value">{{ allowCount }} 条</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">工作区绑定：</span>
        <span class="stat-value">{{ boundCount }} 条</span>
      </div>
    </div>

    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="card-header-flex">
          <span class="card-title">Shell 命令审批规则</span>
          <span class="card-subtitle">判定顺序：YOLO → 后端名单(deny/allow × 工作区) → 旧任务白名单 → 后台拦截 / 前台人工审批</span>
        </div>
      </template>
      <el-table :data="rules" v-loading="loading" style="width: 100%" empty-text="暂无规则，系统将默认播种高危黑名单">
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            <el-tag :type="row.deny ? 'danger' : 'success'" effect="dark" size="small">
              {{ row.deny ? '高危 deny' : '放行 allow' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="匹配方式" width="110">
          <template #default="{ row }">
            <el-tag effect="plain" size="small">{{ row.matchType === 'prefix' ? '前缀' : '全等' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="匹配串" min-width="220">
          <template #default="{ row }">
            <code class="match-code">{{ row.match }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="cwd" label="工作区目录 (留空=全局)" min-width="260">
          <template #default="{ row }">
            <span v-if="row.cwd" class="cwd-text">{{ row.cwd }}</span>
            <el-tag v-else type="info" effect="plain" size="small">全局</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="right">
          <template #default="{ row }">
            <el-button size="small" link type="danger" @click="removeRule(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="addVisible" title="添加 Shell 审批规则" width="520px">
      <el-form label-width="110px">
        <el-form-item label="规则类型">
          <el-radio-group v-model="addForm.deny">
            <el-radio :value="false">自动放行 allow</el-radio>
            <el-radio :value="true">高危黑名单 deny</el-radio>
          </el-radio-group>
          <div class="form-tip" v-if="!addForm.deny">高危命令（rm/node/python/npm/curl/sudo 等）不允许加入放行名单</div>
        </el-form-item>
        <el-form-item label="匹配方式">
          <el-select v-model="addForm.matchType" style="width: 100%">
            <el-option label="全等 (command)" value="command" />
            <el-option label="前缀 (prefix)" value="prefix" />
          </el-select>
        </el-form-item>
        <el-form-item label="匹配串">
          <el-input v-model="addForm.match" placeholder='如 "git status" 或前缀 "git pull"' />
        </el-form-item>
        <el-form-item label="工作区目录">
          <el-input v-model="addForm.cwd" placeholder="可选：仅该目录及子目录内生效，留空=全局" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitAdd">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { configAPI } from "@/lib/configApi.js";

const rules = ref([]);
const loading = ref(false);
const addVisible = ref(false);
const submitting = ref(false);
const addForm = ref({ deny: false, matchType: "command", match: "", cwd: "" });

const denyCount = computed(() => rules.value.filter((r) => r.deny).length);
const allowCount = computed(() => rules.value.filter((r) => !r.deny).length);
const boundCount = computed(() => rules.value.filter((r) => r.cwd).length);

const loadRules = async () => {
  loading.value = true;
  try {
    const res = await configAPI.request("/api/shell/policy");
    const data = res.data || res;
    rules.value = data?.rules || [];
  } catch (e) {
    ElMessage.error(`加载失败: ${e?.message || e}`);
  } finally {
    loading.value = false;
  }
};

const openAdd = () => {
  addForm.value = { deny: false, matchType: "command", match: "", cwd: "" };
  addVisible.value = true;
};

const submitAdd = async () => {
  if (!addForm.value.match?.trim()) {
    ElMessage.warning("请填写匹配串");
    return;
  }
  submitting.value = true;
  try {
    await configAPI.request("/api/shell/policy", {
      method: "POST",
      body: JSON.stringify({
        matchType: addForm.value.matchType,
        match: addForm.value.match.trim(),
        cwd: addForm.value.cwd?.trim() || null,
        deny: addForm.value.deny,
      }),
      headers: { "Content-Type": "application/json" },
    });
    ElMessage.success("规则已添加");
    addVisible.value = false;
    loadRules();
  } catch (e) {
    ElMessage.error(`添加失败: ${e?.message || e}`);
  } finally {
    submitting.value = false;
  }
};

const removeRule = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除规则「${row.match}」${row.deny ? "（高危deny）" : ""}？`, "删除确认", { type: "warning" });
  } catch {
    return;
  }
  try {
    await configAPI.request(`/api/shell/policy/${row.id}`, { method: "DELETE" });
    ElMessage.success("规则已删除");
    loadRules();
  } catch (e) {
    ElMessage.error(`删除失败: ${e?.message || e}`);
  }
};

onMounted(loadRules);
</script>

<style scoped>
.shell-permissions-view {
  padding: 16px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.header-title h1 {
  margin: 0 0 6px;
  font-size: 20px;
}
.header-desc {
  color: var(--mio-text-secondary, #909399);
  font-size: 13px;
  line-height: 1.6;
}
.stats-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--mio-bg-secondary, #fafafa);
  border-radius: 8px;
}
.stat-label {
  color: var(--mio-text-secondary, #909399);
  font-size: 13px;
}
.stat-value {
  font-weight: 600;
}
.table-card {
  border-radius: 8px;
}
.card-header-flex {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.card-title {
  font-weight: 600;
}
.card-subtitle {
  color: var(--mio-text-secondary, #909399);
  font-size: 12px;
}
.match-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  background: var(--mio-bg-secondary, #f5f5f5);
  padding: 2px 6px;
  border-radius: 4px;
}
.cwd-text {
  font-size: 12px;
  color: var(--mio-text-secondary, #606266);
}
.form-tip {
  font-size: 12px;
  color: var(--mio-color-warning, #e6a23c);
  margin-top: 4px;
}
</style>