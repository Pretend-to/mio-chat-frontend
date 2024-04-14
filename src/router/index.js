import { createRouter, createWebHistory } from 'vue-router'
import { client } from '@/lib/runtime.js'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/home',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      children: [
        {
          path: '/',
          component: () => import('../views/BlankView.vue')
        },
        {
          path: 'chat',
          component: () => import('../views/ChatView.vue')
        },
        {
          path: 'profile',
          component: () => import('../views/ProfileView.vue')
        }
      ]
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('../views/AuthView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    }
  ]
})

router.beforeEach(async (to) => {
  if (
    // 检查用户是否已登录
    !client.isLogin &&
    // ❗️ 避免无限重定向
    to.name !== 'auth'
  ) {
    console.log(client)
    console.log('未登录，重定向到登录页面')
    // 将用户重定向到登录页面
    return { name: 'auth' }
  }
})

export default router
