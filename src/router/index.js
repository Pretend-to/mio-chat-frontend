/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-22 12:12:28
 */

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
          component: () => import('../views/ProfileView.vue')
        },
        {
          path: 'chat/:id',
          name: 'privateChat',
          component: () => import('../views/ChatView.vue')
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
  const isLogin = await client.checkLogin()
  if (
    // 检查用户是否已登录
    !isLogin &&
    // ❗️ 避免无限重定向
    to.name !== 'auth'
  ) {
    console.log(`client.isLogin: ${client.isLogin} to.name!== auth: ${to.name!== 'auth'}`)
    console.log('未登录，重定向到登录页面')
    // 将用户重定向到登录页面
    return { name: 'auth' }
  }
})

export default router
