/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import "./assets/styles/main.scss";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import "mio-previewer/style.css";

import { createApp } from "vue";
import { createPinia } from "pinia";

import ElementPlus from "element-plus";

import App from "./App.vue";
import router from "./router";

// 注意：这些 import 会被 ESM 静态提升，但 useConnectionStore() 的调用
// 发生在 app.use(pinia) 之后的执行语句中，所以是安全的
import { useConnectionStore } from "./stores/connectionStore";
import { client } from "./lib/runtime";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia); // Pinia 必须先激活
app.use(ElementPlus);
app.use(router);

// Flush any contactors that were loaded from IndexedDB before Pinia was ready.
// preInit() is async (reads IndexedDB), so we listen on the "loaded" event
// which fires after preInit() completes — by then Pinia is guaranteed active.
if (client.inited) {
  client.replayToStore();
} else {
  client.on(
    "loaded",
    () => {
      client.replayToStore();
    },
    false,
  );
}

// 在 pinia 激活后才调用 useConnectionStore
const connectionStore = useConnectionStore(pinia);
connectionStore.initSync(client);

app.mount("#app");

// 注册 Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.v4.js")
      .then((registration) => {
        console.log("Service Worker registered: ", registration);

        // 发送消息到 Service Worker
        const isLocalhost =
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";
        const isDev = process.env.NODE_ENV === "development" || isLocalhost;

        if (registration.active) {
          // 确保 active 已经存在
          registration.active.postMessage({
            type: "SET_DEV_MODE",
            isDevMode: isDev,
          });
        } else {
          // 如果 active 为 null，等待激活后再发送消息 (可选)
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: "SET_DEV_MODE",
                isDevMode: isDev,
              });
            }
          });
        }
      })
      .catch((error) => {
        console.log("Service Worker registration failed: ", error);
      });
  });
}
