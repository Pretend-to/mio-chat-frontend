/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import "./assets/global.sass";
import "element-plus/dist/index.css";
import "md-editor-v3/lib/style.css";
import "./assets/mio.css";

import { createApp } from "vue";
import { createPinia } from "pinia";

import ElementPlus from "element-plus";

import App from "./App.vue";
import router from "./router";

const app = createApp(App);

app.use(ElementPlus);
app.use(createPinia());
app.use(router);

app.mount("#app");

// 注册 Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.v3.js") // 确保路径正确
      .then((registration) => {
        console.log("Service Worker registered: ", registration);
      })
      .catch((error) => {
        console.log("Service Worker registration failed: ", error);
      });
  });
}
