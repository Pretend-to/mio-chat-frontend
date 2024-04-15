/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <118327380+ZY16263646566679@users.noreply.github.com>
 * @lastEditTime 2024-04-15 16:09:44
 */

import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: "5173",
    proxy: {
      "/qava": {
        // 后台地址
        target: "https://api.krumio.com/",
        changeOrigin: true,
      },
      "/mava": {
        // 后台地址
        target: "http://mio.fcip.top:6050/",
        changeOrigin: true,
      },
      "/api/gateway": {
        target: "ws://127.0.0.1:3080/",
      },
      "/api": {
        target: "http://127.0.0.1:3080/",
      }
    }
  }
})
