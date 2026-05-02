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
      // only open visualizer when ANALYZE env var is set
      process.env.ANALYZE === 'true' && visualizer({ open: true }),
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
              if (id.includes("element-plus")) {
                if (id.includes("@element-plus/icons-vue")) return "vendor_element_plus_icons";
                return "vendor_element_plus";
              }
              if (id.includes("mio-previewer")) {
                // 识别 mio-previewer 内部的各种图表插件，统一归类到 mermaid
                if (id.includes("mermaid") || id.includes("Diagram") || id.includes("dagre") || id.includes("cytoscape") || id.includes("graphlib") || id.includes("d3")) return "vendor_mermaid";
                if (id.includes("katex")) return "vendor_katex";
                return "vendor_editor_preview";
              }
              if (id.includes("prismjs")) return "vendor_prism";
              if (id.includes("markdown-it")) return "vendor_markdown";
              if (id.includes("socket.io-client")) return "vendor_socketio";
              if (id.includes("emoji-picker")) return "vendor_emoji";
              if (id.includes("vue") || id.includes("pinia") || id.includes("vue-router")) return "vendor_vue";
              return "vendor_misc";
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
        "/p": {
          target: env.VITE_API_URL || "http://127.0.0.1:3080/",
          changeOrigin: true,
        },
      },
    },
    base: env.VITE_BASE_URL || "/",
  };
});
