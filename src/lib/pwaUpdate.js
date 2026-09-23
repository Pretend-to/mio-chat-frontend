/**
 * PWA / Service Worker 更新链路。
 *
 * 移动端 PWA 多数时候是被「恢复」而不是重新导航，浏览器因此很少去查新版本 ——
 * 只靠注册一个 SW 不够，需要三件事配合：
 * 1. 页面重新可见时主动 `registration.update()`（长驻 PWA 否则可能几天都不查）；
 * 2. 新 SW 接管控制权后自动重载一次页面（SW 在 install 里已 skipWaiting）；
 * 3. 给用户一个手动入口（设置 → Web 配置 →「应用更新」）：检查更新 / 强制更新。
 *
 * 另外 SW 的导航请求是 network-first（见 public/service-worker.v5.js），
 * 所以只要真的导航一次就能拿到最新 shell。
 */
const SW_URL = "/service-worker.v5.js";
// 构建时注入（见 vite.config.js）：SW 内容变了才变。
// 目的：SW 的 URL 随内容变化，CDN / 边缘缓存的 max-age=604800 无法再把旧 SW 钉住。
const SW_VERSION = import.meta.env.VITE_SW_VERSION || "";
const SW_REGISTER_URL = SW_VERSION ? `${SW_URL}?v=${SW_VERSION}` : SW_URL;

let registrationPromise = null;

function isDevEnvironment() {
  return (
    process.env.NODE_ENV === "development" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function postDevMode(worker) {
  worker?.postMessage({ type: "SET_DEV_MODE", isDevMode: isDevEnvironment() });
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(SW_REGISTER_URL, { updateViaCache: "none" })
      .then((registration) => {
        console.log("Service Worker registered:", registration);
        return registration;
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
        return null;
      });
  }
  return registrationPromise;
}

/** 注册 SW 并接好自动更新链路（main.js 调用一次） */
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const hadController = Boolean(navigator.serviceWorker.controller);
  const registration = await getRegistration();
  if (!registration) return null;

  postDevMode(registration.active);

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    postDevMode(navigator.serviceWorker.controller);
    // 首次安装（原本没有 controller）不需要重载；有更新落地才重载一次
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  // 移动端 PWA 常被「恢复」而非重新导航：回到前台时主动查一次
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      registration.update().catch(() => {});
    }
  });

  return registration;
}

/**
 * 手动检查更新：发现新版会走 controllerchange → 自动重载。
 * @returns {Promise<{supported: boolean, updated: boolean}>}
 */
export async function checkForUpdate() {
  const registration = await getRegistration();
  if (!registration) return { supported: false, updated: false };

  try {
    await registration.update();
  } catch {
    return { supported: true, updated: false };
  }

  const hasNewWorker = Boolean(registration.installing || registration.waiting);
  if (hasNewWorker) {
    // SW 在 install 里会 skipWaiting，稍等一下让接管与自动重载发生
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return { supported: true, updated: hasNewWorker };
}

/**
 * 强制更新：注销 SW + 清空全部 Cache Storage 后重载。
 * 移动端卡在旧版本、又找不到浏览器「清除站点数据」时的兜底。
 */
export async function forceUpdate() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((item) => item.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  window.location.reload();
}

/** 当前页面看到的 SW 缓存版本（用于「应用更新」处显示，便于确认是否真的换了版本） */
export async function getCacheVersion() {
  if (!("caches" in window)) return "";
  const keys = await caches.keys();
  const shell = keys.find((key) => key.startsWith("mio-shell-"));
  return shell || keys[0] || "";
}
