<template>
  <div class="push-settings-view">
    <div class="page-header">
      <h1>Web Push 推送设置</h1>
      <div class="header-actions">
        <el-button :loading="loading" @click="fetchData">刷新数据</el-button>
        <el-button
          type="danger"
          plain
          :disabled="devices.length === 0"
          :loading="clearing"
          @click="confirmClearAll"
        >
          清空所有设备订阅
        </el-button>
      </div>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 24px"
    >
      <template #title>
        Web Push 允许服务端在后台定时任务（Cron）执行完成或触发 Channel 联动时，即使浏览器关闭/手机锁屏，也能向用户设备发送原生系统离线推送。
      </template>
    </el-alert>

    <!-- 服务状态与 VAPID 公钥 -->
    <el-card class="config-card" style="margin-bottom: 20px">
      <div class="section-title">
        <el-icon><Bell /></el-icon>
        Web Push 服务协议状态
      </div>
      <el-form label-width="140px" label-position="left">
        <el-form-item label="服务初始化状态">
          <el-tag type="success" size="small">已就绪 (Active)</el-tag>
        </el-form-item>
        <el-form-item label="当前有效设备数">
          <span style="font-size: 15px; font-weight: 600; color: var(--el-color-primary)">
            {{ devices.length }} 台
          </span>
        </el-form-item>
        <el-form-item label="VAPID 公钥">
          <div style="display: flex; align-items: center; gap: 8px; width: 100%; max-width: 600px">
            <el-input
              :model-value="vapidPublicKey || '加载中...'"
              readonly
              size="small"
            />
            <el-button size="small" @click="copyPublicKey">复制</el-button>
          </div>
          <template #extra>
            <span class="form-item-tip">
              客户端通过此公钥向 Apple APNs / Google FCM 申请加密端点，已安全持久化在服务端数据库。
            </span>
          </template>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 在线测试推送控制台 -->
    <el-card class="config-card" style="margin-bottom: 20px">
      <div class="section-title">
        <el-icon><Promotion /></el-icon>
        离线通知测试控制台
      </div>
      <el-form
        :model="testForm"
        label-width="140px"
        label-position="left"
        style="max-width: 600px"
      >
        <el-form-item label="通知标题">
          <el-input v-model="testForm.title" placeholder="Mio-Chat 测试提醒" />
        </el-form-item>
        <el-form-item label="通知内容">
          <el-input
            v-model="testForm.body"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="这是一条来自管理员后台的 Web Push 测试推送！"
          />
        </el-form-item>
        <el-form-item label="关联联系人/URL">
          <el-input
            v-model="testForm.contactorId"
            placeholder="可选，点击通知直接唤醒跳转的目标 contactorId"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="testing"
            :disabled="devices.length === 0"
            @click="handleSendTest"
          >
            向所有已登记设备发送测试通知 ({{ devices.length }} 台)
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 已登记设备管理表格 -->
    <el-card class="config-card">
      <div class="section-title" style="display: flex; justify-content: space-between; align-items: center">
        <div style="display: flex; align-items: center; gap: 8px">
          <el-icon><Monitor /></el-icon>
          已登记设备列表 ({{ devices.length }})
        </div>
      </div>

      <el-table
        :data="devices"
        v-loading="loading"
        empty-text="暂无已登记的推送设备"
        style="width: 100%; margin-top: 12px"
      >
        <el-table-column label="设备类型" width="130">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.device === 'ios_pwa' ? 'warning' : (row.device === 'pwa' ? 'success' : 'info')"
            >
              {{ row.device === 'ios_pwa' ? 'iOS PWA' : (row.device === 'pwa' ? 'Desktop PWA' : '网页浏览器') }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="推送端点 (Endpoint)" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <code style="font-size: 11px">{{ row.endpoint }}</code>
          </template>
        </el-table-column>

        <el-table-column label="客户端 User-Agent" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span style="font-size: 12px; color: var(--el-text-color-secondary)">
              {{ row.userAgent || '未知设备 UA' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="注册时间" width="170">
          <template #default="{ row }">
            <span style="font-size: 12px">
              {{ new Date(row.createdAt || Date.now()).toLocaleString() }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              type="danger"
              size="small"
              text
              @click="handleRemoveDevice(row.endpoint)"
            >
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell, Promotion, Monitor } from '@element-plus/icons-vue'
import configAPI from '@/lib/configApi.js'

const loading = ref(false)
const clearing = ref(false)
const testing = ref(false)
const vapidPublicKey = ref('')
const devices = ref([])

const testForm = reactive({
  title: 'Mio-Chat 系统提醒',
  body: '这是一条来自管理员后台的 Web Push 测试推送！',
  contactorId: '',
})

const fetchData = async () => {
  loading.value = true
  try {
    const [keyRes, subsRes] = await Promise.all([
      configAPI.request('/api/push/vapid-key').catch(() => null),
      configAPI.request('/api/push/subscriptions').catch(() => null),
    ])
    if (keyRes?.data?.publicKey) {
      vapidPublicKey.value = keyRes.data.publicKey
    }
    if (Array.isArray(subsRes?.data?.list)) {
      devices.value = subsRes.data.list
    }
  } catch (err) {
    ElMessage.error(err.message || '获取推送配置失败')
  } finally {
    loading.value = false
  }
}

const copyPublicKey = () => {
  if (!vapidPublicKey.value) return
  navigator.clipboard.writeText(vapidPublicKey.value)
  ElMessage.success('VAPID 公钥已复制到剪贴板')
}

const handleSendTest = async () => {
  if (devices.value.length === 0) {
    ElMessage.warning('当前暂无已登记的设备，无法发送测试通知')
    return
  }
  testing.value = true
  try {
    const res = await configAPI.request('/api/push/test', {
      body: {
        title: testForm.title,
        body: testForm.body,
        contactorId: testForm.contactorId || null,
      },
      method: 'POST',
    })
    if (res?.data?.delivered > 0) {
      ElMessage.success(`测试通知已成功推送到 ${res.data.delivered} 台设备！`)
    } else {
      ElMessage.warning('通知已触发，但设备端可能未确认接收')
    }
  } catch (err) {
    ElMessage.error(err.message || '发送测试推送失败')
  } finally {
    testing.value = false
  }
}

const handleRemoveDevice = async (endpoint) => {
  try {
    await ElMessageBox.confirm('确认注销并移除该设备的推送订阅吗？', '提示', {
      confirmButtonText: '确定移除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await configAPI.request('/api/push/unsubscribe', {
      body: { endpoint },
      method: 'POST',
    })
    ElMessage.success('已移除该设备订阅')
    await fetchData()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '移除设备失败')
    }
  }
}

const confirmClearAll = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有已登记的设备推送订阅吗？清空后各设备需要重新进入客户端开启通知。',
      '清空设备确认',
      {
        confirmButtonText: '确认全部清空',
        cancelButtonText: '取消',
        type: 'danger',
      }
    )
    clearing.value = true
    await configAPI.request('/api/push/clear-all', { method: 'POST' })
    ElMessage.success('已清空所有设备订阅')
    await fetchData()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '清空失败')
    }
  } finally {
    clearing.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped lang="scss">
.push-settings-view {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--mio-text-primary);
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.config-card {
  margin-bottom: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  .section-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--mio-text-primary);
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--mio-border-color-light);
    display: flex;
    align-items: center;
    gap: 10px;

    .el-icon {
      color: #409eff;
    }
  }
}

.form-item-tip {
  color: var(--mio-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
}

:deep(.el-form-item) {
  margin-bottom: 24px;
}
</style>
