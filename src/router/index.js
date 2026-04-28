import { client } from "@/lib/runtime.js";
import { ElMessage } from "element-plus";
import { createRouter, createWebHistory } from "vue-router";
const ChatView = () => import("../views/ChatView.vue");
const HomeView = () => import("../views/HomeView.vue");
const ProfileView = () => import("../views/ProfileView.vue");
const SettingsView = () => import("../views/SettingsView.vue");
const AuthView = () => import("../views/AuthView.vue");
const BlankView = () => import("../views/BlankView.vue");

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      children: [
        {
          path: "/",
          name: "blank",
          component: BlankView,
        },
        {
          path: "/contactors",
          name: "contactors",
          component: BlankView,
        },
        {
          path: "/chat/:id",
          name: "chat_view",
          component: ChatView,
        },
        {
          path: "/profile/:id",
          name: "profile_view",
          component: ProfileView,
        },
      ],
    },
    {
      path: "/auth",
      name: "auth",
      component: AuthView,
    },
    {
      path: "/s/:shareId",
      name: "share_link",
      component: BlankView,
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
      }
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsView,
      redirect: "/settings",
      children: [
        {
          path: "",
          name: "settings_overview",
          component: () => import("../views/settings/OverviewView.vue"),
        },
        {
          path: "llm-adapters",
          name: "settings_llm_adapters",
          component: () => import("../views/settings/LLMAdaptersView.vue"),
        },
        {
          path: "server",
          name: "settings_server",
          component: () => import("../views/settings/ServerConfigView.vue"),
        },
        {
          path: "web",
          name: "settings_web",
          component: () => import("../views/settings/WebConfigView.vue"),
        },
        {
          path: "onebot",
          name: "settings_onebot",
          component: () => import("../views/settings/OnebotConfigView.vue"),
        },
        {
          path: "plugins",
          name: "settings_plugins",
          component: () => import("../views/settings/PluginsView.vue"),
        },
        {
          path: "presets",
          name: "settings_presets",
          component: () => import("../views/settings/PresetsView.vue"),
        },
        {
          path: "logs",
          name: "settings_logs",
          component: () => import("../views/settings/LogsView.vue"),
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

export default router;
