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
        verbose: true,
        threshold: 10240,
        disable: mode === "development",
      }),
      mode !== "development" &&
        viteImagemin({
          gifsicle: { optimizationLevel: 5, interlaced: false },
          optipng: { optimizationLevel: 5 },
          mozjpeg: { quality: 75 },
          pngquant: { quality: [0.8, 0.9], speed: 4 },
          svgo: {
            plugins: [
              { name: "removeViewBox" },
              { name: "removeMetadata" },
              { name: "removeEmptyAttrs", active: false },
            ],
          },
        }),
      visualizer({ open: true }),
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
        "/api/gateway": {
          target: env.VITE_WS_URL || "ws://127.0.0.1:3080/",
          ws: true,
        },
        "/api": {
          target: env.VITE_API_URL || "http://127.0.0.1:3080/",
          changeOrigin: true,
        },
        "/f": {
          target: env.VITE_API_URL || "http://127.0.0.1:3080/",
          changeOrigin: true,
        },
      },
    },
    base: env.VITE_BASE_URL || "/",
  };
});
