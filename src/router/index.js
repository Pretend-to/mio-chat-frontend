import { createRouter, createWebHistory } from "vue-router";
import { client } from "@/lib/runtime.js";
import { ElMessage } from "element-plus";
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
