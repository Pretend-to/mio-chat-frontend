/**
 * PWA / Service Worker 更新链路。
 *
 * 移动端 PWA 多数时候是被「恢复」而不是重新导航，浏览器因此很少去查新版本 ——
 * 只靠注册一个 SW 不够，需要三件事配合：
 * 1. 页面重新可见时主动 `registration.update()`（长驻 PWA 否则可能几天都不查）；
 * 2. 新 SW 接管控制权后自动重载一次页面（SW 在 install 里已 skipWaiting）；
 * 3. 给用户一个手动入口（设置 → 客户端设置 →「应用更新」）：检查更新 / 强制更新。
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

/** 取文本的 SHA-256 前 12 位：仅用于「服务器 / 本地」两侧对拍 */
async function sha256Short(text) {
  if (!text || !globalThis.crypto?.subtle) return "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

/**
 * 取文本：fresh=true 时加时间戳 + no-store 强制走服务器；
 * 否则用 force-cache，拿到的就是当前客户端实际会用的那份缓存副本。
 */
function probeText(url, { fresh = false } = {}) {
  if (!url) return Promise.resolve("");
  const target = fresh
    ? `${url}${url.includes("?") ? "&" : "?"}__verify=${Date.now()}`
    : url;
  return fetch(target, { cache: fresh ? "no-store" : "force-cache" })
    .then((response) => (response.ok ? response.text() : ""))
    .catch(() => "");
}

function fileNameOf(url) {
  return url ? url.split("/").pop().split("?")[0] : "";
}

/** 当前页面真正在跑的入口脚本 URL */
function runningEntryUrl() {
  const script = document.querySelector('script[src*="/assets/js/index-"]');
  if (!script) return "";
  return new URL(script.getAttribute("src"), window.location.origin).href;
}

/** 服务器最新 index.html 里引用的入口脚本 URL */
function serverEntryUrl(html) {
  const match = html.match(/assets\/js\/index-[A-Za-z0-9_-]+\.js/);
  if (!match) return "";
  return new URL(match[0], window.location.origin).href;
}

/**
 * 同时校验 SW 与入口 JS 的哈希：服务器当前内容 vs 本机缓存副本。
 * 两侧不一致 ⇒ 客户端还停在旧构建（SW / HTTP 缓存没换）。
 * @returns {Promise<{supported: boolean, sw: object, entry: object}>}
 */
export async function verifyAssets() {
  const swUrl = new URL(SW_URL, window.location.origin).href;
  const registration = await getRegistration();
  const installedSwUrl = registration?.active?.scriptURL || swUrl;
  const installedSwVersion = installedSwUrl.includes("?v=")
    ? installedSwUrl.split("?v=")[1]
    : "";

  const html = await probeText(window.location.href.split("#")[0], {
    fresh: true,
  });
  const serverUrl = serverEntryUrl(html) || runningEntryUrl();
  const localUrl = runningEntryUrl();

  const [swServerText, swLocalText, entryServerText, entryLocalText] =
    await Promise.all([
      probeText(swUrl, { fresh: true }),
      probeText(installedSwUrl),
      probeText(serverUrl, { fresh: true }),
      probeText(localUrl),
    ]);

  const [swServer, swLocal, entryServer, entryLocal] = await Promise.all([
    sha256Short(swServerText),
    sha256Short(swLocalText),
    sha256Short(entryServerText),
    sha256Short(entryLocalText),
  ]);

  return {
    supported: Boolean(globalThis.crypto?.subtle),
    sw: {
      server: swServer,
      local: swLocal,
      same: Boolean(swServer) && swServer === swLocal,
      installedVersion: installedSwVersion,
      buildVersion: SW_VERSION,
    },
    entry: {
      server: entryServer,
      local: entryLocal,
      same: Boolean(entryServer) && entryServer === entryLocal,
      serverName: fileNameOf(serverUrl),
      localName: fileNameOf(localUrl),
    },
  };
}
