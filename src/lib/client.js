import Socket from "./websocket.js";
import Contactor from "./contactor.js";
import localforage from "localforage";
import EventEmitter from "./event.js";
import { reactive } from "vue";
import UploadWorker from "../worker/fileUpload.js?worker";

// Configure localforage
localforage.config({
  name: "mio-chat",
});

export default class Client extends EventEmitter {
  constructor(config) {
    super();
    this.everLogin = false; // Loaded from storage
    this.id = null; // Loaded from storage
    this.code = null; // Loaded from storage
    this.isConnected = false; // Dynamic
    this.contactList = []; // Loaded from storage
    this.socket = null; // Dynamic
    this.qq = null; // Web
    this.botqq = null; // Web
    this.avatar = null; // Web
    this.onPhone = null; // Dynamic
    this.title = "Mio"; // Fixed
    this.name = "user"; // Fixed
    this.displaySettings = null; // Web
    this.config = config; // Parameter
  }

  /**
   * Prepare initialization
   * @returns {object} Initialization information
   */
  async beforeInit() {
    await this.setDisplayInfo();
    const localConfig = await this.getLocalStorage();
    await this.config.loadOnebotDefaultConfig();

    if (localConfig) {
      localConfig.isConnected = false;
      this.loadLocalStorage(localConfig);
    } else {
      // First-time user
      this.id = this.genFakeId();
      this.code = null;
    }

    this.emit("loaded");
  }

  async genDefaultConctor() {
    // Create default OneBot contactor
    const onebotDefaultConfig = {
      id: this.genFakeId(),
      name: "OneBot",
      namePolicy: 1,
      avatarPolicy: 1,
      avatar: `/api/qava?q=${this.botqq}`,
      title: "云崽",
      priority: 0,
      options: this.config.onebotDefaultConfig,
      lastUpdate: -Infinity,
    };
    this.addConcator("onebot", onebotDefaultConfig);

    // Update and create OpenAI contactor
    this.config.updateOpenaiDefaultConfig({
      model: this.default_model,
    });

    const openaiDefaultConfig = {
      id: this.genFakeId(),
      name: "MioBot",
      avatar: "/static/avatar/miobot.png",
      namePolicy: 1,
      avatarPolicy: 1,
      title: "chat",
      priority: 0,
      lastUpdate: -Infinity,
      options: { ...this.config.openaiDefaultConfig },
    };

    openaiDefaultConfig.options.tools = this.config.openaiTools.map(
      (tool) => tool.name,
    );
    openaiDefaultConfig.options.enable_tool_call = true;
    this.addConcator("openai", openaiDefaultConfig);
  }

  async addConcator(platform, config) {
    const bot = new Contactor(platform, config);
    bot.loadName();
    bot.loadAvatar();

    const list = reactive(this.contactList);
    list.push(bot);

    await this.setLocalStorage();
    return bot;
  }

  rmContactor(id) {
    const list = reactive(this.contactList);
    const index = list.findIndex((item) => item.id == id);

    if (index != -1) {
      list.splice(index, 1);
      this.setLocalStorage();
    }
  }

  async loadOriginalContactors(shareId) {
    const path = `/api/share?id=${shareId}`;
    let contactor = null;
    try {
      const res = await fetch(path);
      const data = await res.json();
      if (data.code == 0) {
        contactor = data.data.contactor;
        // 检查是否已经存在
        if (!this.getContactor(contactor.id)) {
          this.addConcator(contactor.platform, contactor);
        }
      }
      return true;
    } catch (error) {
      console.error("Failed to load original contactors:", error);
      return false;
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

  reset() {
    localforage.clear();
    localStorage.clear();
    window.location.reload();
  }

  async init() {
    await this.beforeInit();
    if (this.everLogin) {
      console.log("Detected cache, attempting automatic reconnection");
      this.isConnected = false;
      this.login(this.code);
    } else {
      console.log("Not logged in before, please login first");
    }
  }

  getContactors() {
    return this.contactList;
  }

  getContactor(id) {
    if (id == this.admin_qq) {
      return this.contactList.find((item) => item.platform == "onebot");
    }
    return this.contactList.find((item) => item.id == id);
  }

  /**
   * Generate a random 5-digit ID starting with 1
   * @returns {number} 5-digit random ID starting with 1
   */
  genFakeId() {
    if (!this.id) {
      // Generate 5-digit random number starting with 1
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      return parseInt(`1${randomNum}`);
    } else {
      // Generate 4-digit random number and append to existing ID
      const subRandomNum = Math.floor(1000 + Math.random() * 9000);
      return parseInt(`${this.id}${subRandomNum}`);
    }
  }

  /**
   * Get user information from localStorage
   * @returns {object|false} User information or false if not found
   */
  async getLocalStorage() {
    const client = await localforage.getItem("client");
    return client ? JSON.parse(client) : false;
  }

  /**
   * Load user information from localStorage
   * @param {object} client User information
   */
  loadLocalStorage(client) {
    this.everLogin = client.everLogin;
    this.id = client.id;
    this.code = client.code;
    this.avatar = client.avatar;

    // If contact list exists, instantiate as contact objects
    if (client.contactList && client.contactList.length != 0) {
      this.contactList = client.contactList.map(
        (item) => new Contactor(item.platform, item),
      );
    } else {
      this.contactList = [];
    }
  }

  /**
   * Save user information to localStorage
   */
  async setLocalStorage() {
    await localforage.setItem("client", JSON.stringify(this));
  }

  /**
   * Login
   * @param {string} code Access code
   * @returns {Promise} Login result
   */
  async login(code) {
    this.code = code;

    return new Promise((resolve) => {
      const socket = new Socket(this.id, this.code);

      socket.on("connect", async (info) => {
        console.log("Login successful");
        this.qq = info.admin_qq;
        this.avatar = `/api/qava?q=${this.qq}`;
        this.botqq = info.bot_qq;
        this.default_model = info.default_model;
        this.everLogin = true;
        this.isConnected = true;
        this.socket = socket;

        this.config.setOpenaiModels(info.models);
        this.addMsgListener();
        this.config.updateOpenaiDefaultConfig({
          model: info.default_model,
        });

        if (this.contactList.length == 0) {
          await this.genDefaultConctor();
        }

        this.setLocalStorage();
        resolve(info);
      });

      socket.connect();
    });
  }

  addMsgListener() {
    this.socket.on("onebot_message", (e) => {
      console.log(e);
      const data = e.data;
      const id = data.id;
      const content = data.content;
      const type = data.type;

      if (type == "message") {
        const contactor = this.getContactor(id);
        if (contactor) {
          contactor.revMessage(content);
          this.setLocalStorage();
        }
      } else if (type == "del_msg") {
        const onebotContactors = this.contactList.filter(
          (item) => item.platform == "onebot",
        );
        for (const onebotContactor of onebotContactors) {
          const deleted = onebotContactor.delMessage(content.message_id);
          if (deleted) {
            this.setLocalStorage();
            console.log("Message deleted successfully");
            break;
          }
        }
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
   * Get a contactor by ID
   * @param {number} id Contactor ID
   * @returns {Contactor} Contactor object or first contactor if not found
   */

  async setDisplayInfo() {
    const res = await fetch("/api/base_info");
    const { data } = await res.json();
    const stored = this.config.getDisplayConfig();

    if (!stored) {
      this.config.setDisplayConfig(data);
    }

    this.admin_qq = data.admin_qq;
    this.bot_qq = data.bot_qq;
    this.displaySettings = data;

    const keyWidth = 600;
    this.onPhone = window.innerWidth < keyWidth;

    const handleResize = () => {
      if (window.innerWidth < keyWidth && !this.onPhone) {
        this.emit("device-change", "mobile");
        this.onPhone = true;
      } else if (window.innerWidth >= keyWidth && this.onPhone) {
        this.emit("device-change", "desktop");
        this.onPhone = false;
      }
    };

    window.addEventListener("resize", handleResize);
  }

  getDisplaySettings() {
    return this.displaySettings;
  }

  async getLoginHistory() {
    const myclient = await this.getLocalStorage();
    return myclient.everLogin;
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
      return this.uploadImage(fileOrImage);
    }

    const file = fileOrImage;
    return new Promise((resolve, reject) => {
      const chunkSize = 1024 * 1024; // 1MB
      let md5Hash = null;

      const finalizeUpload = async (totalChunks) => {
        try {
          const response = await fetch("/api/upload/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
   * Upload image (now integrated into uploadFile)
   * @param {string|Blob} image - Base64 string or Blob
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage(formData) {
    try {
      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error; // Re-throw to be handled by caller
    }
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
