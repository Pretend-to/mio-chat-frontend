import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import VueDevTools from "vite-plugin-vue-devtools";
import viteCompression from "vite-plugin-compression";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
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
      },
    },
    build: {
      target: "es2022",
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
                test: /[\\/]node_modules[\\/]mio-previewer/,
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
                name: "vendor_misc",
                test: /[\\/]node_modules[\\/]/,
                priority: 10,
              },
              {
                name: "components",
                test: /[\\/]src[\\/]components[\\/]/,
                priority: 20,
              },
              {
                name: "views",
                test: /[\\/]src[\\/]views[\\/]/,
                priority: 15,
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
    base: env.VITE_BASE_URL || "/",
  };
});
