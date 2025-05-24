import { createRouter, createWebHistory } from "vue-router";
import { client } from "@/lib/runtime.js";
import { ElMessage } from "element-plus";
import ChatView from "../views/ChatView.vue";
import HomeView from "../views/HomeView.vue";
import ProfileView from "../views/ProfileView.vue";
import SettingsView from "../views/SettingsView.vue";
import AuthView from "../views/AuthView.vue";
import BlankView from "../views/BlankView.vue";

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
