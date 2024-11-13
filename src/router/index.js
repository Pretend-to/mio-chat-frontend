/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import { createRouter, createWebHistory } from 'vue-router'
import { client } from '@/lib/runtime.js'
import { ElMessage } from 'element-plus'
import ChatView from '../views/ChatView.vue'


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
          name: 'root',
          component: () => import('../views/BlankView.vue')
        },
        {
          path: '/home',
          name: 'home',
          component: () => import('../views/BlankView.vue')
        },
        {
          path: 'chat',
          name: 'toChat',
          component: () => import('../views/BlankView.vue')
        },
        {
          path: 'profile',
          name: 'toProfile',
          component: () => import('../views/BlankView.vue')
        },
        {
          path: 'chat/:id',
          name: 'privateChat',
          component: ChatView
        },
        {
          path: 'profile/:id',
          name: 'privateProfile',
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

router.beforeEach(async (to,from) => {
  console.log(`router.beforeEach to: ${to.path} from: ${from.path}`)
  console.log(client.everLogin)
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
