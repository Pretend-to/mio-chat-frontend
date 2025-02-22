import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import VueDevTools from "vite-plugin-vue-devtools";
import viteCompression from "vite-plugin-compression";
import viteImagemin from "vite-plugin-imagemin";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag === "emoji-picker",
          },
        },
      }),
      VueDevTools(),
      viteCompression({
        algorithm: "brotliCompress", // 新增 Brotli 压缩
        verbose: true,
        threshold: 10240,
        ext: ".br",
        disable: mode === "development", // 开发环境禁用
      }),
      viteCompression({
        // 保留原有 gzip
        verbose: true,
        threshold: 10240,
        disable: mode === "development",
      }),
      mode !== "development" &&
        viteImagemin({
          // 开发环境禁用图片压缩
          gifsicle: { optimizationLevel: 5, interlaced: false }, // 优化等级调整
          optipng: { optimizationLevel: 5 }, // 优化等级调整
          mozjpeg: { quality: 75 }, // 质量微调
          pngquant: { quality: [0.8, 0.9], speed: 4 },
          svgo: {
            plugins: [
              { name: "removeViewBox" },
              { name: "removeMetadata" }, // 新增元数据移除
              { name: "removeEmptyAttrs", active: false },
            ],
          },
        }),
      visualizer({ open: true }), // 打包分析（生产环境使用）
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },

    build: {
      target: "es2020", // 更现代的构建目标
      minify: "terser",
      cssCodeSplit: true,
      terserOptions: {
        compress: {
          keep_infinity: true, // 避免大数被压缩
          drop_console: mode !== "development", // 开发环境保留 console
          pure_funcs: ["console.debug", "console.table"], // 保留常用日志方法
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (/vue|@?vue[/\\]/.test(id)) return "vue-vendor";
              if (/emoji-picker/.test(id)) return "emoji";
              return "vendor";
            }
            if (id.includes("src/")) {
              if (id.includes("components/")) return "components";
              if (id.includes("views/")) return "views";
            }
          },
          // 优化文件名格式
          chunkFileNames: `assets/js/[name]-[hash].js`,
          entryFileNames: `assets/js/[name]-[hash].js`,
          assetFileNames: `assets/[ext]/[name]-[hash].[ext]`,
        },
      },
      chunkSizeWarningLimit: 1500, // 调低 chunk 预警阈值
      assetsInlineLimit: 4096,
    },

    server: {
      host: "0.0.0.0",
      port: "1314",
      proxy: {
        "/api/gateway": {
          target: env.VITE_WS_URL || "ws://127.0.0.1:3080/", // 使用环境变量
          ws: true, // 明确启用 WebSocket 代理
        },
        "/api": {
          target: env.VITE_API_URL || "http://127.0.0.1:3080/",
          changeOrigin: true,
        },
      },
    },

    // 公共基础路径配置
    base: env.VITE_BASE_URL || "/",
  };
});
