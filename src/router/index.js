import { createRouter, createWebHistory } from 'vue-router'
import { client } from '@/lib/runtime.js'
import { ElMessage } from 'element-plus'
import ChatView from '../views/ChatView.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      children: [
        {
          path: '/',
          name: 'blank',
          component: () => import('../views/BlankView.vue')
        },
        {
          path: '/contactors',
          name: 'contactors',
          component: () => import('../views/BlankView.vue')
        },
        {
          path: '/chat/:id',
          name: 'chat_view',
          component: ChatView
        },
        {
          path: '/profile/:id',
          name: 'profile_view',
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

  let everLogin = client.everLogin

  if (!everLogin) everLogin = await client.getLoginHistory()
  if (
    // 检查用户是否已登录
    !everLogin &&
    // ❗️ 避免无限重定向
    to.name !== 'auth' &&
    to.name !== 'settings'
  ) {
    console.log(`everLogin: ${everLogin} to.name!== auth: ${to.name!== 'auth'}`)
    ElMessage.warning('请先登录')
    // 将用户重定向到登录页面
    return { name: 'auth' }
  }
})

export default router
