/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import Client from "./client.js";
import Config from "./config.js";

const config = new Config();
const client = new Client();

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered with scope:", registration.scope);
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
  }

// 延时10s
// await new Promise(resolve => setTimeout(resolve, 10000));

export { config, client };
