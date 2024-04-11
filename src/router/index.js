/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor Mio-FCIP <1099834705@qq.com>
 * @lastEditTime 2024-04-11 11:49:12
 */
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      children: [
        {
          path: '',
          component: () => import('../views/BlankView.vue')
        },
        {
          path: 'chat/:id',
          component: () => import('../views/ChatView.vue')
        },
        {
          path: 'profile/:id',
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

export default router
