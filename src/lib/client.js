import localforage from "localforage";
// reactive import removed — state is now managed in Pinia store
import { debounce } from "../utils/tools.js";
import UploadWorker from "../worker/fileUpload.js?worker";
// 浏览器指纹生成
const getBrowserFingerprint = () => {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("MioChat", 2, 15);
    const canvasData = canvas.toDataURL();
    const info = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      canvasData.substring(30, 80),
    ].join("|");
    let hash = 0;
    for (let i = 0; i < info.length; i++) {
      hash = (hash << 5) - hash + info.charCodeAt(i);
      hash |= 0;
    }
    return "F-" + Math.abs(hash).toString(16);
  } catch (e) {
    return "F-fallback";
  }
};

const fingerprint = getBrowserFingerprint();
import EventEmitter from "./event.js";
import Socket from "./websocket.js";
import { getActivePinia } from "pinia";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { gateway } from "@/lib/gateway.js";

// Safe accessor: returns null if called before app.use(pinia)
function getStore() {
  if (!getActivePinia()) return null;
  return useContactorsStore();
}

// Configure localforage
localforage.config({
  name: "mio-chat",
});

export default class Client extends EventEmitter {
  constructor(config) {
    super();
    this.inited = false;
    this.id = null; // Loaded from storage
    this.code = null; // Loaded from storage
    this.isConnected = false; // Dynamic
    this.socket = null; // Dynamic
    this.qq = null; // Web
    this.bot_qq = null; // Web
    this.avatar = null; // Web
    this.onPhone = null; // Dynamic
    this.title = "Mio"; // Fixed
    this.name = "user"; // Fixed
    this.config = config; // Parameter

    this.saveNow = this._setLocalStorage.bind(this); // 立即持久化，用于关键节点
    this.setLocalStorage = debounce(this.saveNow, 500); // 防抖版本，用于高频更新
  }

  get contactList() {
    try {
      const store = getStore();
      if (!store) return [];
      return Object.values(store.contactors);
    } catch {
      return [];
    }
  }

  set contactList(val) {
    // Read-only proxy to store
  }

  /**
   * Prepare initialization
   * @returns {object} Initialization information
   */
  async preInit() {
    const localBaseInfo = this.config.getBaseConfig();
    if (Object.keys(localBaseInfo).length === 0) {
      await this.loadOriginBaseInfo();
    } else {
      this.loadOriginBaseInfo();
      this.loadBaseInfo(localBaseInfo);
    }

    const localStorage = await this.getLocalStorage();
    if (localStorage) {
      this.loadLocalStorage(localStorage);
    }

    this.inited = true;
    this.emit("loaded");
  }

  genDefaultConctor(info) {
    if (info.onebot_enabled) {
      // Create default OneBot contactor
      const onebotConfig = {
        id: this.genFakeId(),
        name: "OneBot",
        namePolicy: 1,
        avatarPolicy: 1,
        avatar:
          typeof this.bot_qq === "string" &&
          (this.bot_qq.startsWith("http") || this.bot_qq.startsWith("/"))
            ? this.bot_qq
            : `/p/qava?q=${this.bot_qq ?? 1099834705}`,
        title: "云崽",
        priority: 0,
        options: {},
        lastUpdate: -Infinity,
      };
      this.addConcator("onebot", onebotConfig);
    }

    // 如果后端传回了推荐预设，则直接加载这些预设
    if (info.recommendedPresets && info.recommendedPresets.length > 0) {
      console.log("加载推荐预设:", info.recommendedPresets.length);
      info.recommendedPresets.forEach((preset) => {
        // 使用 mergeOptions 处理预设数据，确保工具名等被正确解析
        // 注意：mergeOptions 是 FriendList 里的方法，我们这里需要一个通用的合并逻辑
        // 或者简单地在 client 里实现一个基础合并
        const options = this.config.getLLMDefaultConfig();

        if (preset.history) options.presetSettings.history = preset.history;
        if (preset.opening) options.presetSettings.opening = preset.opening;

        // 处理工具映射 (short name -> full name)
        if (preset.tools?.length > 0) {
          const resolvedTools = [];
          const allPluginTools = Object.values(this.config.llmTools || {});
          for (const shortName of preset.tools) {
            let found = false;
            for (const pluginTools of allPluginTools) {
              if (!pluginTools || typeof pluginTools !== "object") continue;
              const fullName = Object.keys(pluginTools).find(
                (name) =>
                  name === shortName || name.startsWith(shortName + "_mid_"),
              );
              if (fullName) {
                resolvedTools.push(fullName);
                found = true;
                break;
              }
            }
            if (found) continue;
            // 如果没找到，退而求其次直接放入（可能此时 llmTools 还没加载完）
            resolvedTools.push(shortName);
          }
          options.toolCallSettings.tools = resolvedTools;
        }

        const contactorConfig = {
          id: this.genFakeId(),
          name: preset.name,
          avatar: preset.avatar || "/static/icons/512x512.png",
          namePolicy: 1,
          avatarPolicy: 1,
          title: preset.name === "系统配置专家" ? "setting" : "chat",
          priority: 1, // 默认不置顶
          lastUpdate: -Infinity,
          options,
        };

        this.addConcator("openai", contactorConfig);
      });
    } else {
      // 后备方案：如果没传预设，则创建一个默认的 MioBot
      const options = this.config.getLLMDefaultConfig();
      const LLMDefaultConfig = {
        id: this.genFakeId(),
        name: "MioBot",
        avatar: "/static/icons/512x512.png",
        namePolicy: 1,
        avatarPolicy: 1,
        title: "chat",
        priority: 1,
        lastUpdate: -Infinity,
        options,
      };
      this.addConcator("openai", LLMDefaultConfig);
    }
  }

  async addConcator(platform, config) {
    const store = getStore();
    if (!store) return null;
    const bot = store.addContactor(platform, config);
    return bot;
  }

  initContactor(_contactor) {
    // No-op: listeners are handled reactively in the store
  }

  async rmContactor(id) {
    const store = getStore();
    if (!store) return;

    const contactor = store.contactors[id];
    if (contactor) {
      try {
        const { taskAPI } = await import("./configApi.js");
        const res = await taskAPI.getTasks();
        const tasks = res?.data || [];
        const relatedTasks = tasks.filter(
          (t) =>
            t.preset === contactor.name ||
            t.preset === id ||
            t.contactorId === id,
        );

        if (relatedTasks.length > 0) {
          const { ElMessageBox } = await import("element-plus");
          try {
            await ElMessageBox.confirm(
              `当前 Agent 存在 ${relatedTasks.length} 个关联的定时任务，删除 Agent 将同步彻底删除这些后台任务。是否确定删除？`,
              "提示",
              {
                confirmButtonText: "确定删除",
                cancelButtonText: "取消",
                type: "warning",
              },
            );
          } catch (e) {
            // 用户取消了删除
            return;
          }
        }

        // 清理后台任务
        for (const task of relatedTasks) {
          console.log(
            `[rmContactor] 发现关联定时任务: ${task.name} (${task.id})，正在同步删除...`,
          );
          await taskAPI.deleteTask(task.id);
        }
      } catch (err) {
        console.warn(
          "未获得定时任务清理权限或请求失败，跳过定时任务同步清理:",
          err.message,
        );
      }
    }

    store.removeContactor(id);
    this.setLocalStorage();
  }

  async loadOriginalContactors(shareId) {
    const path = `/api/share?id=${shareId}`;
    let contactor = null;
    try {
      const res = await fetch(path);
      const data = await res.json();
      if (data.code == 0) {
        contactor = data.data.contactor;
        contactor.firstMessageIndex = 0;
        // 检查是否已经存在
        if (!this.getContactor(contactor.id)) {
          this.addConcator(contactor.platform, contactor);
        }
        return contactor.id;
      } else {
        console.error("Failed to load original contactors:", data.message);
        return false;
      }
    } catch (error) {
      console.error("Failed to load original contactors:", error);
      return false;
    }
  }

  async shareContactor(id) {
    const uploadResult = await this.setOriginalContactor(id);
    if (uploadResult) {
      return uploadResult;
    } else {
      return null;
    }
  }

  async shareMessages(id, messageIds) {
    const contactor = this.getContactor(id);
    if (!contactor) return null;

    // Create a copy of the contactor with filtered messageChain
    const shadowContactor = { ...contactor };
    shadowContactor.messageChain = contactor.messageChain.filter((msg) =>
      messageIds.includes(msg.id),
    );

    const path = `/api/share/set`;
    const body = {
      contactor: shadowContactor,
    };
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.code == 0) {
        return data.data;
      }
    } catch (error) {
      console.error("Failed to share messages:", error);
      return null;
    }
  }

  async setOriginalContactor(id) {
    const path = `/api/share/set`;
    const body = {
      contactor: this.getContactor(id),
    };
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.code == 0) {
        return data.data;
      }
    } catch (error) {
      console.error("Failed to set original contactor:", error);
      return null;
    }
  }

  async reset() {
    localforage.clear();
    localStorage.clear();
    try {
      await this.resetCache();
    } catch (error) {
      console.error("Failed to reset cache:", error);
    }
    return true;
  }

  async resetCache() {
    try {
      // 2. Send a message to the active Service Worker to clear its cache
      if (navigator.serviceWorker.controller) {
        console.log(
          "Sending message to active Service Worker to clear cache...",
        );
        await new Promise((resolve, reject) => {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = (event) => {
            if (event.data.type === "IDB_CACHE_CLEARED") {
              console.log("Service Worker cache cleared successfully.");
              resolve();
            } else if (event.data.type === "IDB_CACHE_CLEAR_FAILED") {
              console.error(
                "Service Worker cache clear failed:",
                event.data.error,
              );
              reject(event.data.error);
            } else {
              reject(new Error("Unknown message from Service Worker"));
            }
          };
          messageChannel.port1.onerror = (error) => {
            console.error("Message port error:", error);
            reject(error);
          };
          navigator.serviceWorker.controller.postMessage(
            { type: "CLEAR_IDB_CACHE" },
            [messageChannel.port2],
          );
        });
      } else {
        console.log(
          "No active Service Worker found. Skipping cache clear message.",
        );
      }

      // 1. Clear the Cache Storage API (if available)
      if (window.caches) {
        console.log("Clearing Cache Storage API...");
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // 2. Unregister all service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations && registrations.length > 0) {
        console.log(
          `Found ${registrations.length} registered Service Workers, unregistering...`,
        );
        for (const registration of registrations) {
          // Use a for...of loop for cleaner async/await
          try {
            const unregistered = await registration.unregister();
            if (unregistered) {
              console.log(
                `Service Worker ${registration.scope} unregistered successfully`,
              );
            } else {
              console.warn(
                `Service Worker ${registration.scope} unregistration failed`,
              );
            }
          } catch (error) {
            console.error(
              `Failed to unregister Service Worker ${registration.scope}:`,
              error,
            );
            // We don't reject here, to attempt to unregister other SWs. Log it, though.
          }
        }
        console.log(
          "All Service Workers unregistration completed (with possible errors).",
        );
      } else {
        console.log("No registered Service Workers found.");
      }

      return true; // Indicate success
    } catch (error) {
      console.error("Error during cache reset:", error);
      throw error; // Re-throw the error to be caught by the caller
    }
  }

  everLogin() {
    const stroge = localStorage.getItem("everLogin");
    if (stroge) {
      return true;
    } else {
      return false;
    }
  }

  setEverLogin() {
    localStorage.setItem("everLogin", true);
  }

  async init() {
    await this.preInit();
    if (this.everLogin()) {
      console.log("Detected cache, attempting automatic reconnection");
      this.isConnected = false;
      this.login(this.code);
    } else {
      console.log("Not logged in before, please login first");
    }
  }

  getContactors() {
    const store = getStore();
    if (!store) return [];
    return Object.values(store.contactors);
  }

  getContactor(id, onebotId = null) {
    const store = getStore();
    if (!store) return null;
    if (onebotId) {
      return Object.values(store.contactors).find(
        (item) => item.platform === "onebot",
      );
    } else {
      return store.contactors[id] || null;
    }
  }

  /**
   * 生成一个保证唯一的10位纯数字ID
   * 结合设备ID(this.id)、时间戳和随机数
   * @returns {string} 10位纯数字ID
   */
  genFakeId() {
    // 获取当前时间戳的后6位
    const timestamp = Date.now().toString().slice(-6);
    // 生成2位随机数
    const randomNum = Math.floor(Math.random() * 100)
      .toString()
      .padStart(4, "1");

    return randomNum + timestamp;
  }

  /**
   * Get user information from localStorage
   * @returns {object|false} User information or false if not found
   */
  async getLocalStorage() {
    const client = await localforage.getItem("client");
    if (client) {
      const localConfig = JSON.parse(client);
      return localConfig;
    } else {
      // First-time user
      this.id = this.genFakeId();
      this.code = null;
      return null;
    }
  }

  /**
   * Load user information from localStorage
   * @param {object} client User information
   */
  loadLocalStorage(client) {
    this.id = client.id;
    this.code = client.code;

    const store = getStore();
    if (!store) {
      // Pinia not ready yet — cache for replay once mounted
      this._pendingContactList = client.contactList || [];
      return;
    }
    if (client.contactList && client.contactList.length != 0) {
      store.loadContactors(client.contactList);
    } else {
      store.loadContactors([]);
    }
  }

  /**
   * Replay cached contactors into the store once Pinia is active.
   * Call this from main.js immediately after app.use(pinia).
   */
  replayToStore() {
    const store = getStore();
    if (!store) return;
    if (this._pendingContactList !== undefined) {
      store.loadContactors(this._pendingContactList);
      this._pendingContactList = undefined;
    }
  }

  /**
   * Save user information to localStorage
   */
  async _setLocalStorage() {
    const store = getStore();
    if (!store) return;

    try {
      gateway.flushAllBuffers();
    } catch (err) {
      console.error("Failed to flush all stream buffers:", err);
    }

    const client = {
      id: this.id,
      code: this.code,
      contactList: store.toJSON(),
    };
    await localforage.setItem("client", JSON.stringify(client));
    console.log("Client saved");
  }

  /**
   * Login
   * @param {string} code Access code
   * @returns {Promise} Login result
   */
  async login(code) {
    this.code = code;

    return new Promise((resolve, reject) => {
      const socket = new Socket(
        this.id,
        this.code,
        this.contactList.length === 0,
      );

      socket.on("connect", async (info) => {
        console.log("Login successful");
        this.isConnected = true;
        this.socket = socket;
        this.emit("socket_ready", socket);
        this.emit("connection_changed", true);
        this.config.setLlmModels(info.models);
        this.addMsgListener();
        if (this.contactList.length == 0) {
          this.genDefaultConctor(info);
        } else if (info.onebot_enabled) {
          // 即使不是第一次登录，如果开启了 OneBot 且列表中没有，也补上
          const hasOneBot = this.contactList.some(
            (c) => c.platform === "onebot",
          );
          if (!hasOneBot) {
            const onebotConfig = {
              id: this.genFakeId(),
              name: "OneBot",
              namePolicy: 1,
              avatarPolicy: 1,
              avatar:
                typeof this.bot_qq === "string" &&
                (this.bot_qq.startsWith("http") || this.bot_qq.startsWith("/"))
                  ? this.bot_qq
                  : `/p/qava?q=${this.bot_qq ?? 1099834705}`,
              title: "云崽",
              priority: 0,
              options: {},
              lastUpdate: -Infinity,
            };
            this.addConcator("onebot", onebotConfig);
          }
        }
        if (info.pendingTasks && Array.isArray(info.pendingTasks)) {
          console.log("[Login] 待同步任务 (pendingTasks):", info.pendingTasks);
          console.log(
            "[Login] 当前联系人列表:",
            this.contactList.map((c) => ({ id: c.id, name: c.name })),
          );

          info.pendingTasks.forEach((taskId) => {
            const contactor = this.getContactor(taskId);
            if (contactor) {
              console.log(
                `[Login] 任务状态检查: ${contactor.name} (${taskId}), 当前活跃状态: ${contactor.active}`,
              );

              // 只有当该 Agent 不是当前活跃窗口时，才显示红点并触发后台拉取
              if (!contactor.active) {
                contactor.hasPendingTask = true;
                this.socket.enterChat(taskId);
              }
            } else {
              console.warn(
                `[Login] 匹配失败: 无法找到 ID 为 ${taskId} 的联系人`,
              );
            }
          });
        }

        this.setEverLogin();
        this.setLocalStorage();
        resolve(info);
      });

      socket.on("connect_error", (error) => {
        console.log("Login failed", error);
        this.isConnected = false;
        this.emit("connection_changed", false);
        this.emit("connect_error", error);
        reject(error.message);
      });

      // 监听连接状态变化并同步到 client
      socket.on("connection_changed", (status) => {
        this.isConnected = !!status;
        this.emit("connection_changed", status);
      });

      socket.connect();
    });
  }

  addMsgListener() {
    this.socket.on("onebot_message", (e) => {
      gateway.handleOnebotMessageEvent(e);
    });

    this.socket.on("llm_message", (e) => {
      gateway.handleLlmMessageEvent(e);
    });

    this.socket.on("system_message", (e) => {
      try {
        if (!e) return;

        // 支持后端推送的 plugins 更新
        if (e.type === "plugins_updated") {
          console.log("[Plugin System] 检测到后端插件更新，正在刷新数据...");
          if (this.config && typeof this.config.loadllmTools === "function") {
            this.config.loadllmTools();
          }
          this.emit("plugins_updated", e.data);
          return;
        }

        // 支持后端推送的 models/providers 更新
        if (e.type === "models_updated" && e.data) {
          const { providers, models, default_model } = e.data;

          // 更新 Config 中的 llmModels
          if (
            models &&
            this.config &&
            typeof this.config.setLlmModels === "function"
          ) {
            this.config.setLlmModels(models);
            console.log("LLM models updated from system message");
          }

          // 更新 baseConfig 中的 providers 列表 (llm_providers)
          if (
            providers &&
            this.config &&
            typeof this.config.updateBaseConfig === "function"
          ) {
            try {
              // 检查是否是新的 API 结构（providers 数组中包含 default_model）
              const hasNewStructure = providers.some(
                (p) => p.default_model !== undefined,
              );

              if (hasNewStructure) {
                // 新结构：直接使用 providers 数组
                this.config.updateBaseConfig({ llm_providers: providers });
              } else {
                // 旧结构：同时传递 providers 和 default_model
                this.config.updateBaseConfig({
                  llm_providers: providers,
                  default_model,
                });
              }
              console.log("LLM providers updated from system message");
            } catch (err) {
              console.error("Failed to update baseConfig.llm_providers:", err);
            }
          }

          // 广播事件给客户端监听者（比如 UI）
          this.emit("models_updated", { providers, models });
          return;
        }

        // 处理后端自动总结的标题更新
        if (e.type === "chat_title_updated" && e.data) {
          const { contactorId, title } = e.data;
          const store = getStore();
          const contactor = store.contactors[contactorId];
          if (contactor) {
            console.log(
              `[System] 对话标题已由后端更新: ${contactor.name} -> ${title}`,
            );
            contactor.name = title;
            store.loadContactorName(contactor);
            store.updateContactorSummary(contactor);
            this.setLocalStorage();
          }
          return;
        }

        console.log("System message received:", e);
      } catch (err) {
        console.error("Error handling system_message:", err, e);
      }
    });
  }

  /**
   * Logout
   */
  async logout() {
    this.isConnected = false;
    this.socket.disconnect();
    this.socket = null;
    this.setLocalStorage();
  }

  /**
   * Set base information
   * @returns {Promise} Base information
   */
  async loadOriginBaseInfo() {
    const res = await fetch("/api/base_info");
    const { data } = await res.json();
    this.config.setBaseConfig(data);
    this.loadBaseInfo(data);

    return data;
  }

  loadBaseInfo(data) {
    this.admin_qq = data.admin_qq;
    this.bot_qq = data.bot_qq;

    if (
      typeof this.admin_qq === "string" &&
      (this.admin_qq.startsWith("http") || this.admin_qq.startsWith("/"))
    ) {
      this.avatar = this.admin_qq;
    } else {
      this.avatar = `/p/qava?q=${this.admin_qq}`;
    }

    const onebotContactor = this.getContactor(null, 10000);
    if (onebotContactor) {
      if (
        typeof this.bot_qq === "string" &&
        (this.bot_qq.startsWith("http") || this.bot_qq.startsWith("/"))
      ) {
        onebotContactor.avatar = this.bot_qq;
      } else {
        onebotContactor.avatar = `/p/qava?q=${this.bot_qq}`;
      }
    }
  }

  /**
   * Upload file or image
   * @param {File|Blob|string} fileOrImage - File object, Blob, or base64 string for images
   * @param {Object} options - Upload options
   * @param {boolean} options.isImage - Indicates if upload is an image
   * @param {Function} options.onProgress - Progress callback (percent complete)
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(fileOrImage, options = {}) {
    const { isImage = false, onProgress = null } = options;

    // Handle image upload (base64 string or blob)
    if (
      isImage ||
      (typeof fileOrImage === "string" && fileOrImage.startsWith("data:"))
    ) {
      return this.uploadImage(fileOrImage, options);
    }

    const file = fileOrImage;
    return new Promise((resolve, reject) => {
      const chunkSize = 1024 * 1024; // 1MB
      let md5Hash = null;

      const finalizeUpload = async (totalChunks) => {
        try {
          const response = await fetch("/api/upload/finalize", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-browser-fingerprint": fingerprint,
            },
            body: JSON.stringify({
              totalChunks,
              md5: md5Hash,
              filename: file.name,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }

          const data = await response.json();
          resolve(data);
        } catch (error) {
          reject({ error: `Finalization error: ${error.message}` });
        }
      };

      const uploadChunk = async (chunk, index, totalChunks) => {
        return new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append("file", chunk);
          formData.append("md5", md5Hash);
          formData.append("chunkIndex", index);
          formData.append("totalChunks", totalChunks);
          formData.append("filename", file.name);

          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/upload/chunk", true);
          xhr.setRequestHeader("x-browser-fingerprint", fingerprint);

          // Track progress if callback provided
          if (onProgress) {
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                // Calculate overall progress based on chunks
                const chunkProgress = event.loaded / event.total;
                const overallProgress =
                  (index / totalChunks + (1 / totalChunks) * chunkProgress) *
                  100;
                onProgress(Math.round(overallProgress));
              }
            };
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(); // Successful upload
            } else {
              reject(xhr.statusText); // Failed upload
            }
          };

          xhr.onerror = () => {
            reject("Network Error");
          };

          xhr.send(formData);
        });
      };

      const uploadFileChunks = async () => {
        if (!file || !md5Hash) {
          return reject({ error: "Invalid file or missing hash" });
        }

        // --- 秒传校验开始 ---
        try {
          console.log("尝试秒传校验...");
          const response = await fetch("/api/upload/finalize", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-browser-fingerprint": fingerprint,
            },
            body: JSON.stringify({
              totalChunks: 1,
              md5: md5Hash,
              filename: file.name,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            // 如果后端确认文件已存在，会返回带有 data.url 的成功响应
            if (data && data.code === 0 && data.data && data.data.url) {
              console.log("秒传校验成功，直接返回文件 URL:", data.data.url);
              resolve(data);
              return;
            }
          }
        } catch (e) {
          console.warn("秒传预检失败，转向正常分片上传流程:", e);
        }
        // --- 秒传校验结束 ---

        const totalChunks = Math.ceil(file.size / chunkSize);

        try {
          for (
            let currentChunk = 0;
            currentChunk < totalChunks;
            currentChunk++
          ) {
            const start = currentChunk * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);

            await uploadChunk(chunk, currentChunk, totalChunks);
          }

          // All chunks uploaded, finalize
          await finalizeUpload(totalChunks);
        } catch (error) {
          reject({ error: `Upload error: ${error}` });
        }
      };

      // Start worker to calculate MD5
      const worker = new UploadWorker();
      worker.postMessage({ file, chunkSize });

      worker.onmessage = (e) => {
        if (e.data.hash) {
          md5Hash = e.data.hash;
          console.log("MD5 calculated. Starting upload...");
          uploadFileChunks();
        } else if (e.data.error) {
          reject({ error: e.data.error });
          worker.terminate();
        }
      };

      worker.onerror = (error) => {
        console.error("Worker error:", error);
        reject({ error: `Worker error: ${error.message}` });
        worker.terminate();
      };
    });
  }

  /**
   * Upload image with progress monitoring support
   * @param {FormData} formData - Image form data
   * @param {Object} options - Upload options
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage(formData, options = {}) {
    const { onProgress = null } = options;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload/image", true);
      xhr.setRequestHeader("x-browser-fingerprint", fingerprint);

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(Math.round(progress));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            reject(new Error("Parse response failed"));
          }
        } else {
          reject(new Error(`HTTP error ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network Error"));
      };

      xhr.send(formData);
    });
  }

  /**
   * Convert Blob to base64 string
   * @param {Blob} blob - Image blob
   * @returns {Promise<string>} Base64 string
   */
  async _convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
