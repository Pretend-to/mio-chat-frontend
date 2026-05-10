import { client } from "@/lib/runtime.js";
import { ElMessage } from "element-plus";
import { createRouter, createWebHistory } from "vue-router";
const BlankView = () => import("../views/BlankView.vue");
const ChatView = () => import("../views/ChatView.vue");
const HomeView = () => import("../views/HomeView.vue");
const ProfileView = () => import("../views/ProfileView.vue");
const SettingsView = () => import("../views/SettingsView.vue");
const AuthView = () => import("../views/AuthView.vue");

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { title: "主页" },
      children: [
        {
          path: "/",
          name: "blank",
          component: BlankView,
          meta: { title: "开始对话" },
        },
        {
          path: "/contactors",
          name: "contactors",
          component: BlankView,
          meta: { title: "联系人列表" },
        },
        {
          path: "/chat/:id",
          name: "chat_view",
          component: ChatView,
          meta: { title: "正在聊天" },
        },
        {
          path: "/profile/:id",
          name: "profile_view",
          component: ProfileView,
          meta: { title: "个人信息" },
        },
      ],
    },
    {
      path: "/auth",
      name: "auth",
      component: AuthView,
      meta: { title: "身份验证" },
    },
    {
      path: "/s/:shareId",
      name: "share_link",
      component: BlankView,
      meta: { title: "正在加载分享内容" },
      beforeEnter: async (to, from, next) => {
        // Handle direct share links
        const shareId = to.params.shareId;

        // Ensure client is initialized (wait for it if necessary)
        if (!client.inited) {
          // Pre-init isn't complete, let the App.vue or main.js handle the initialization
          // But since this route is matched, we can just load the contactor
          await client.preInit();
        }

        ElMessage.info("正在获取远程 Agent 信息...");
        const contactorId = await client.loadOriginalContactors(shareId);
        if (contactorId) {
          ElMessage.success("成功加载分享的 Agent");
          next(`/chat/${contactorId}`);
        } else {
          ElMessage.error("分享链接无效或已过期");
          next("/");
        }
      },
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsView,
      redirect: "/settings",
      meta: { title: "系统设置" },
      children: [
        {
          path: "",
          name: "settings_overview",
          component: () => import("../views/settings/OverviewView.vue"),
          meta: { title: "设置概览" },
        },
        {
          path: "llm-adapters",
          name: "settings_llm_adapters",
          component: () => import("../views/settings/LLMAdaptersView.vue"),
          meta: { title: "模型适配器" },
        },
        {
          path: "automation",
          name: "settings_automation",
          component: () => import("../views/settings/AutomationView.vue"),
          meta: { title: "自动化任务" },
        },
        {
          path: "server",
          name: "settings_server",
          component: () => import("../views/settings/ServerConfigView.vue"),
          meta: { title: "服务端配置" },
        },
        {
          path: "web",
          name: "settings_web",
          component: () => import("../views/settings/WebConfigView.vue"),
          meta: { title: "网页端配置" },
        },
        {
          path: "onebot",
          name: "settings_onebot",
          component: () => import("../views/settings/OnebotConfigView.vue"),
          meta: { title: "Onebot 配置" },
        },
        {
          path: "plugins",
          name: "settings_plugins",
          component: () => import("../views/settings/PluginsView.vue"),
          meta: { title: "插件管理" },
        },
        {
          path: "presets",
          name: "settings_presets",
          component: () => import("../views/settings/PresetsView.vue"),
          meta: { title: "预设管理" },
        },
        {
          path: "storage",
          name: "settings_storage",
          component: () => import("../views/settings/StorageConfigView.vue"),
          meta: { title: "存储设置" },
        },
        {
          path: "logs",
          name: "settings_logs",
          component: () => import("../views/settings/LogsView.vue"),
          meta: { title: "系统日志" },
        },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const everLogin = client.everLogin();
  if (
    // 检查用户是否已登录
    !everLogin &&
    // ❗️ 避免无限重定向
    to.name !== "auth"
  ) {
    console.log(
      `everLogin: ${everLogin} to.name!== auth: ${to.name !== "auth"}`,
    );
    ElMessage.warning("请先登录");
    // 把原本要去的地址 完整的传递给 login?redirect=
    const query = to.path === "/settings" ? null : { redirect: to.fullPath };
    return { name: "auth", query };
  }
});

router.afterEach((to) => {
  const pageTitle = to.meta.title;
  if (pageTitle) {
    document.title = `${pageTitle} - MioChat`;
  } else {
    document.title = "MioChat - 下一代 AI 智能对话平台";
  }
});

export default router;
