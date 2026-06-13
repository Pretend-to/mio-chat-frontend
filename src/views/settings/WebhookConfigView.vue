<template>
  <div class="webhook-config-view">
    <div class="page-header">
      <h1>Webhook 配置</h1>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存配置
        </el-button>
      </div>
    </div>

    <el-alert
      title="GitHub Webhook 部署通知"
      type="info"
      :closable="false"
      show-icon
      class="info-banner"
    >
      <template #default>
        配置 SMTP 邮箱信息后，当 GitHub Webhook
        触发部署时，系统会自动发送部署结果通知邮件。
        接收通知的邮箱可配置多个（用逗号分隔）。 仅监听
        <code>allowed_branches</code> 中指定的分支推送事件。 可选配 Webhook
        Secret 校验请求签名，防止恶意触发。
      </template>
    </el-alert>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>SMTP 邮箱配置</span>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="160px"
        label-position="left"
      >
        <el-form-item label="SMTP 主机" prop="smtp_host">
          <el-input
            v-model="formData.smtp_host"
            placeholder="smtp.qq.com"
            style="width: 400px"
          />
          <template #extra>
            <span class="form-item-tip">SMTP 服务器地址</span>
          </template>
        </el-form-item>

        <el-form-item label="SMTP 端口" prop="smtp_port">
          <el-input-number
            v-model="formData.smtp_port"
            :min="1"
            :max="65535"
            style="width: 200px"
          />
          <template #extra>
            <span class="form-item-tip">端口号（465 为 SSL，587 为 TLS）</span>
          </template>
        </el-form-item>

        <el-form-item label="SSL/TLS 加密" prop="smtp_secure">
          <el-switch
            v-model="formData.smtp_secure"
            active-text="启用"
            inactive-text="禁用"
          />
          <template #extra>
            <span class="form-item-tip">启用 SSL 加密连接</span>
          </template>
        </el-form-item>

        <el-form-item label="SMTP 用户名" prop="smtp_user">
          <el-input
            v-model="formData.smtp_user"
            placeholder="your-email@qq.com"
            style="width: 400px"
          />
          <template #extra>
            <span class="form-item-tip">登录 SMTP 服务器的邮箱地址</span>
          </template>
        </el-form-item>

        <el-form-item label="SMTP 密码" prop="smtp_pass">
          <el-input
            v-model="formData.smtp_pass"
            :type="showSmtpPass ? 'text' : 'password'"
            placeholder="请输入 SMTP 授权码或密码"
            style="width: 400px"
          >
            <template #append>
              <el-button
                :icon="showSmtpPass ? View : Hide"
                @click="showSmtpPass = !showSmtpPass"
              />
            </template>
          </el-input>
          <template #extra>
            <span class="form-item-tip"
              >SMTP 授权码（如 QQ 邮箱需使用独立授权码）</span
            >
          </template>
        </el-form-item>

        <el-divider content-position="left">发件人配置</el-divider>

        <el-form-item label="发件人地址" prop="email_from">
          <el-input
            v-model="formData.email_from"
            placeholder="krumio@qq.com"
            style="width: 400px"
          />
          <template #extra>
            <span class="form-item-tip">邮件发件人地址</span>
          </template>
        </el-form-item>

        <el-form-item label="发件人名称" prop="email_from_name">
          <el-input
            v-model="formData.email_from_name"
            placeholder="MioChat 部署"
            style="width: 400px"
          />
          <template #extra>
            <span class="form-item-tip">收件人显示的发件人名称</span>
          </template>
        </el-form-item>

        <el-divider content-position="left">收件与分支配置</el-divider>

        <el-form-item label="收件人地址" prop="email_to">
          <el-input
            v-model="formData.email_to"
            placeholder="1099834705@qq.com"
            style="width: 400px"
          />
          <template #extra>
            <span class="form-item-tip">
              接收通知的邮箱地址，多个邮箱用逗号分隔
            </span>
          </template>
        </el-form-item>

        <el-form-item label="Webhook Secret" prop="secret">
          <el-input
            v-model="formData.secret"
            type="password"
            show-password
            placeholder="GitHub Webhook 设置的 Secret（可选）"
            style="width: 400px"
          />
          <template #extra>
            <span class="form-item-tip">
              在 GitHub 仓库 Settings → Webhooks 中配置相同的
              Secret，用于校验请求来源，防止恶意触发
            </span>
          </template>
        </el-form-item>

        <el-form-item label="监听分支" prop="allowed_branches">
          <el-select
            v-model="formData.allowed_branches"
            multiple
            allow-create
            filterable
            default-first-option
            placeholder="输入分支名后按回车添加"
            style="width: 400px"
          >
            <el-option
              v-for="branch in branchOptions"
              :key="branch"
              :label="branch"
              :value="branch"
            />
          </el-select>
          <template #extra>
            <span class="form-item-tip">
              仅监听这些分支的推送事件，默认监听 master 和 production
            </span>
          </template>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 测试与 Webhook URL -->
    <el-card style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>Webhook 接入信息</span>
        </div>
      </template>

      <div class="webhook-url-section">
        <el-form-item label="Webhook URL">
          <el-input :model-value="webhookUrl" readonly style="width: 500px">
            <template #append>
              <el-button @click="copyWebhookUrl"> 复制 </el-button>
            </template>
          </el-input>
        </el-form-item>
        <p class="webhook-hint">
          在 GitHub 仓库设置中添加此 Webhook URL，Payload 选择
          <code>application/json</code>，事件选择
          <code>Just the push event</code> 即可。
        </p>
        <el-button type="success" plain :loading="testing" @click="handleTest">
          发送测试邮件
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { configAPI } from "@/lib/configApi.js";
import { useConfigStore } from "@/stores/configStore.js";
import { Hide, View } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, reactive, ref, computed } from "vue";

const configStore = useConfigStore();
const formRef = ref(null);
const saving = ref(false);
const testing = ref(false);
const showSmtpPass = ref(false);

// 表单数据
const formData = reactive({
  smtp_host: "smtp.qq.com",
  smtp_port: 465,
  smtp_secure: true,
  smtp_user: "",
  smtp_pass: "",
  email_from: "",
  email_from_name: "MioChat 部署",
  email_to: "",
  secret: "",
  allowed_branches: ["master", "production"],
});

// Webhook URL（基于当前页面地址自动推导）
const webhookUrl = computed(() => {
  const base = window.location.origin;
  return `${base}/api/webhook`;
});

// 常用分支选项
const branchOptions = ["master", "main", "production", "develop", "release"];

// 原始数据（用于重置）
const originalFormData = reactive({});

// 验证规则
const rules = {
  smtp_host: [
    {
      required: true,
      message: "请输入 SMTP 主机地址",
      trigger: "blur",
    },
  ],
  smtp_port: [
    {
      type: "number",
      required: true,
      message: "请输入有效的端口号",
      trigger: "blur",
    },
  ],
  smtp_user: [
    {
      required: true,
      message: "请输入 SMTP 用户名",
      trigger: "blur",
    },
  ],
  email_from: [
    {
      required: true,
      message: "请输入发件人地址",
      trigger: "blur",
    },
    {
      type: "email",
      message: "请输入有效的邮箱地址",
      trigger: "blur",
    },
  ],
  email_to: [
    {
      required: true,
      message: "请输入收件人地址",
      trigger: "blur",
    },
  ],
};

// 加载配置
const loadConfig = async () => {
  try {
    let webhookConfig =
      configStore.config?.webhook ||
      (await configStore.fetchConfigSection("webhook"));

    Object.assign(formData, {
      smtp_host: webhookConfig.smtp_host || "smtp.qq.com",
      smtp_port: webhookConfig.smtp_port ?? 465,
      smtp_secure: webhookConfig.smtp_secure ?? true,
      smtp_user: webhookConfig.smtp_user || "",
      smtp_pass: webhookConfig.smtp_pass || "",
      email_from: webhookConfig.email_from || "",
      email_from_name: webhookConfig.email_from_name || "MioChat 部署",
      email_to: webhookConfig.email_to || "",
      secret: webhookConfig.secret || "",
      allowed_branches: webhookConfig.allowed_branches || [
        "master",
        "production",
      ],
    });

    // 保存原始数据用于重置
    Object.assign(originalFormData, formData);
  } catch (error) {
    ElMessage.error("加载 Webhook 配置失败：" + error.message);
  }
};

// 保存配置
const handleSave = async () => {
  try {
    await formRef.value.validate();
    saving.value = true;

    await configStore.updateConfigSection("webhook", {
      smtp_host: formData.smtp_host,
      smtp_port: formData.smtp_port,
      smtp_secure: formData.smtp_secure,
      smtp_user: formData.smtp_user,
      smtp_pass: formData.smtp_pass,
      email_from: formData.email_from,
      email_from_name: formData.email_from_name,
      email_to: formData.email_to,
      secret: formData.secret,
      allowed_branches: formData.allowed_branches,
    });

    ElMessage.success("Webhook 配置保存成功");
    await loadConfig();
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("保存失败：" + error.message);
    }
  } finally {
    saving.value = false;
  }
};

// 重置配置
const handleReset = () => {
  Object.assign(formData, originalFormData);
  formRef.value?.clearValidate();
  ElMessage.info("已重置为当前保存的配置");
};

// 复制 Webhook URL
const copyWebhookUrl = () => {
  navigator.clipboard
    .writeText(webhookUrl.value)
    .then(() => {
      ElMessage.success("Webhook URL 已复制到剪贴板");
    })
    .catch(() => {
      ElMessage.error("复制失败，请手动复制");
    });
};

// 发送测试邮件
const handleTest = async () => {
  testing.value = true;
  try {
    const result = await configAPI.request("/api/webhook/demo", {
      method: "POST",
    });
    ElMessage.success("测试邮件已发送，请查收");
  } catch (error) {
    ElMessage.error("发送测试邮件失败：" + error.message);
  } finally {
    testing.value = false;
  }
};

// 初始化
onMounted(async () => {
  if (!configStore.config) {
    await configStore.fetchConfig();
  }
  await loadConfig();
});
</script>

<style scoped lang="scss">
.webhook-config-view {
  padding: 24px;
  max-width: 900px;
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
    color: #303133;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.info-banner {
  margin-bottom: 16px;

  code {
    background: rgba(0, 0, 0, 0.06);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 13px;
    color: #409eff;
  }
}

.card-header {
  font-weight: 600;
  color: #303133;
}

.form-item-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

:deep(.el-form-item) {
  margin-bottom: 28px;
}

:deep(.el-form-item__extra) {
  margin-top: 4px;
}

:deep(.el-divider) {
  margin: 24px 0 16px 0;
}

:deep(.el-divider__text) {
  font-weight: 600;
  color: #606266;
}

.webhook-url-section {
  .webhook-hint {
    margin: 8px 0 16px 0;
    color: #909399;
    font-size: 13px;
    line-height: 1.6;

    code {
      background: rgba(0, 0, 0, 0.06);
      padding: 1px 6px;
      border-radius: 4px;
      color: #409eff;
    }
  }

  .el-button {
    margin-top: 8px;
  }
}
</style>
