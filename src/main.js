/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import "./assets/global.sass";
import "element-plus/dist/index.css";
import "mio-previewer/style.css";
import "./assets/mio.css";

import { createApp } from "vue";

import ElementPlus from "element-plus";

import App from "./App.vue";
import router from "./router";

const app = createApp(App);

app.use(ElementPlus);
app.use(router);

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
