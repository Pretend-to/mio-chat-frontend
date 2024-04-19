import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag === "emoji-picker"
        }
      }
    }),
    VueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: "0.0.0.0",
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
        target: "ws://149.88.72.168:3080/",
      },
      "/api": {
        target: "http://149.88.72.168:3080/",
      }
    }
  }
})