/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import "./assets/styles/main.scss";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import "mio-previewer/style.css";

import { initAppearanceFromCache } from "@/utils/appearance.js";
import { registerServiceWorker } from "@/lib/pwaUpdate.js";
initAppearanceFromCache();

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

// 尽早注册 SW（注册、更新检查与控制器切换后的自动重载都在 pwaUpdate.js 里）。
registerServiceWorker();
