import { defineConfig, loadEnv } from "vite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import VueDevTools from "vite-plugin-vue-devtools";
import viteCompression from "vite-plugin-compression";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // SW 注册 URL 带上「按 SW 内容算的哈希」：SW 一改，URL 就变，CDN 的
  // max-age=604800 再也钉不住它（生产曾因此让移动端 PWA 永远卡在旧版本）。
  // 内容不变则哈希不变 —— 不会白换，也不会反复重装 SW。
  const swVersion = createHash("md5")
    .update(
      readFileSync(
        fileURLToPath(
          new URL("./public/service-worker.v5.js", import.meta.url),
        ),
        "utf8",
      ),
    )
    .digest("hex")
    .slice(0, 8);

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
        verbose: true,
        threshold: 10240,
        disable: mode === "development",
      }),
      viteCompression({
        verbose: true,
        threshold: 10240,
        disable: mode === "development",
        algorithm: "brotliCompress",
        ext: ".br",
        compressionOptions: {
          level: 11,
        },
      }),
      mode !== "development" &&
        ViteImageOptimizer({
          png: { quality: 80 },
          jpeg: { quality: 75 },
          webp: { quality: 80 },
          svg: {
            plugins: [
              { name: "removeViewBox", active: false },
              { name: "sortAttrs" },
            ],
          },
        }),
      // only open visualizer when ANALYZE env var is set
      process.env.ANALYZE === "true" && visualizer({ open: true }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@napi-rs/canvas": fileURLToPath(
          new URL("./src/utils/emptyShim.js", import.meta.url),
        ),
      },
    },
    optimizeDeps: {
      include: [
        "@open-file-viewer/core",
        "@open-file-viewer/vue",
        "pdfjs-dist",
        "viewerjs",
      ],
      exclude: ["@napi-rs/canvas"],
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @use "@/assets/styles/variables" as *;
            @use "@/assets/styles/mixins" as *;
          `,
        },
      },
    },
    build: {
      target: "es2022",
      // rolldown 默认对所有 chunk（含懒加载路由、异步组件）生成 modulepreload，
      // 导致 echarts/mermaid 等按需代码在启动时被提前下载+编译，内存飙高。
      // 关闭后 chunk 真正按需加载，启动只编译静态可达的代码。
      modulePreload: false,
      minify: "terser",
      cssCodeSplit: true,
      terserOptions: {
        compress: {
          keep_infinity: true,
          drop_console: mode !== "development",
          pure_funcs: ["console.debug", "console.table"],
        },
      },
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "vendor_element_plus",
                test: /[\\/]node_modules[\\/](?:.*?element-plus|element-plus)/,
                priority: 50,
              },
              {
                name: "vendor_editor_preview",
                // 只匹配 mio-previewer 主入口（含 markdown-it 渲染器本体），
                // 刻意排除其 dist/ 下按需加载的异步 chunk（mermaid 引擎、
                // prism 语言模块、viewerjs 等）——它们路径也含 mio-previewer，
                // 若不排除会被强制合并成 2.8MB 同步大块，破坏按需加载
                test: /[\\/]mio-previewer[\\/]dist[\\/]mio-previewer\.es\.js$/,
                priority: 45,
              },
              {
                name: "vendor_socketio",
                test: /[\\/]node_modules[\\/]socket\.io-client/,
                priority: 40,
              },
              {
                name: "vendor_emoji",
                test: /[\\/]node_modules[\\/](?:emoji-picker|emoji-picker-element)/,
                priority: 35,
              },
              {
                name: "vendor_vue",
                test: /[\\/]node_modules[\\/](?:vue|@vue)/,
                priority: 30,
              },
              {
                name: "views",
                // 恢复路由视图聚合：ChatView/HomeView 等与主页面同链，
                // 用户点击联系人列表项可立即进入聊天，无需等待懒加载 chunk。
                // 仅排除 DashboardView：其内部静态 import echarts (~1MB)，
                // 若不排除 echarts 会随启动链加载；排除后只在访问 dashboard
                // 路由时异步加载
                test: (id) =>
                  /[\\/]src[\\/]views[\\/]/.test(id) &&
                  !id.includes("/views/DashboardView.vue"),
                priority: 15,
              },
              {
                name: "vendor_misc",
                // 排除 mio-previewer 包内按需加载的异步 chunk（mermaid 引擎、
                // viewerjs、prism 语言等位于 mio-previewer/dist/ 下），
                // 以及 @open-file-viewer / pdfjs-dist 等纯按需加载的文件预览重型引擎，
                // 让它们保留动态 import 的异步拆分，避免污染主 vendor 并在启动时被提前加载
                test: (id) =>
                  /[\\/]node_modules[\\/]/.test(id) &&
                  !id.includes("/mio-previewer/dist/") &&
                  !id.includes("@open-file-viewer") &&
                  !id.includes("pdfjs-dist"),
                priority: 10,
              },
              {
                name: "components",
                // 排除 dashboard 子目录：其内部静态 import echarts (~1MB)，
                // 若并入启动链会导致 echarts 被 preload；排除后跟随
                // DashboardView（懒加载路由）异步加载
                test: (id) =>
                  /[\\/]src[\\/]components[\\/]/.test(id) &&
                  !id.includes("/components/dashboard/"),
                priority: 20,
              },
            ],
          },
          chunkFileNames: `assets/js/[name]-[hash].js`,
          entryFileNames: `assets/js/[name]-[hash].js`,
          assetFileNames: `assets/[ext]/[name]-[hash].[ext]`,
        },
      },
      chunkSizeWarningLimit: 1500,
      assetsInlineLimit: 4096,
      sourcemap: true,
    },
    server: {
      host: "0.0.0.0",
      port: "1314",
      proxy: {
        "/socket.io": {
          target: env.VITE_API_URL || "http://127.0.0.1:3080/",
          ws: true,
          changeOrigin: true,
        },
        "/api": {
          target: env.VITE_API_URL || "http://127.0.0.1:3080/",
          changeOrigin: true,
        },
        "/f": {
          target: env.VITE_API_URL || "http://127.0.0.1:3080/",
          changeOrigin: true,
        },
        "/p/": {
          target: env.VITE_API_URL || "http://127.0.0.1:3080/",
          changeOrigin: true,
        },
      },
    },
    define: {
      "import.meta.env.VITE_SW_VERSION": JSON.stringify(swVersion),
    },
    base: env.VITE_BASE_URL || "/",
  };
});
