import EventEmitter from "./event.js";
import { randomString } from "../utils/generate.js";
import RetryManager from "./retry-manager.js";

/**
 * WebSocket Connection Class
 * 处理WebSocket连接、消息收发、心跳检测和断线重连
 */
export default class Socket extends EventEmitter {
  /**
   * 创建Socket实例
   * @param {String} id - 机器人QQ号
   * @param {String} code - 登录令牌
   */
  constructor(id, code) {
    super();
    this.available = null;
    this.url = this.getURL();
    this.socket = null;
    this.code = code;
    this.id = id;
    this.requests = [];
    this.heartBeat = null;
    this.delay = null;
    this.retryManager = new RetryManager({
      maxRetries: 10,
      baseDelay: 1000,
      maxDelay: 30000,
    });
    this.connectionState = "disconnected";
    this.hasSuccessfulWebSocket = false;
  }

  /**
   * 获取WebSocket URL
   * @returns {String} WebSocket URL
   */
  getURL() {
    const url = new URL(window.location.href);
    return url.host;
  }

  /**
   * 初始化WebSocket事件监听器
   */
  initEventListeners() {
    this.socket.on("connect", () => this.handleConnect());
    this.socket.on("disconnect", () => this.handleDisconnect());
    this.socket.on("connect_error", (error) => this.handleConnectError(error));
    this.socket.on("message", (message) => this.messageHandler(message));
  }

  /**
   * 处理连接成功事件
   */
  handleConnect() {
    this.available = true;
    this.connectionState = "connected";
    if (this.socket?.io?.engine?.transport?.name === "websocket") {
      this.hasSuccessfulWebSocket = true;
    }
    this.retryManager.reset();
    console.log("SocketIO连接成功");
    this.startHeartbeat();
  }

  /**
   * 处理断开连接事件
   */
  handleDisconnect() {
    this.available = false;
    this.connectionState = "disconnected";
    this.stopHeartbeat();
    console.error("SocketIO连接断开");
    this.attemptReconnect();
  }

  /**
   * 处理连接错误事件
   */
  handleConnectError(error) {
    console.error("SocketIO连接出错", error);
    if (this.socket?.io?.engine?.transport?.name === "websocket") {
      if (!this.hasSuccessfulWebSocket) {
        this.switchToPolling();
      } else {
        console.log("之前WebSocket连接成功过，继续尝试WebSocket重连");
        this.attemptReconnect();
      }
    } else {
      this.connectionState = "failed";
      console.log("已经在轮询模式，放弃重连");
      this.disconnect();
    }
  }

  /**
   * 切换到轮询模式
   */
  switchToPolling() {
    console.log("WebSocket 连接失败，切换到轮询模式...");
    this.disconnect();
    const socket = io(this.url, {
      path: "/socket.io",
      transports: ["polling"],
      auth: { id: this.id, token: this.code },
    });
    this.socket = socket;
    this.initEventListeners();
  }

  /**
   * 尝试重新连接
   */
  async attemptReconnect() {
    if (this.connectionState === "reconnecting") return;
    this.connectionState = "reconnecting";

    try {
      await this.retryManager.retry(() => this.connect());
    } catch (error) {
      console.error("重连失败，已达到最大重试次数", error);
      this.connectionState = "failed";
      this.emit("reconnect_failed");
    }
  }

  /**
   * 连接到SocketIO服务器
   */
  async connect() {
    this.socket = io(this.url, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { id: this.id, token: this.code },
      reconnectionAttempts: 0, // 禁用socket.io的自动重连，使用我们自己的重连机制
    });
    console.log("SocketIO连接中...");
    this.initEventListeners();
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    this.heartBeat = setInterval(async () => {
      if (this.socket?.connected) {
        try {
          const res = await this.fetch("/api/system/heartbeat", {
            timestamp: Date.now(),
          });
          this.updateDelay(res);
        } catch (error) {
          console.error("心跳检测失败", error);
        }
      }
    }, 3000);
  }

  /**
   * 更新延迟信息
   */
  updateDelay(res) {
    const serverRevTime = res.revTime;
    const currentTime = Date.now();
    const delayTo = res.delay;
    const delayBack = currentTime - serverRevTime;
    this.delay = delayTo + delayBack;
  }

  /**
   * 停止心跳检测
   */
  stopHeartbeat() {
    if (this.heartBeat) {
      clearInterval(this.heartBeat);
      this.heartBeat = null;
    }
  }

  /**
   * 断开WebSocket连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.available = false;
      this.stopHeartbeat();
      console.log("WebSocket连接已断开");
    }
  }

  /**
   * 处理接收到的消息
   * @param {String} message - 接收到的消息
   */
  messageHandler(message) {
    try {
      const e = JSON.parse(message);
      this.emit(e.request_id, e);
      if (e.protocol === "onebot") {
        this.emit("onebot_message", e);
      } else if (e.protocol === "system") {
        if (e.type === "login") this.emit("connect", e.data);
        this.emit("system_message", e);
      }
    } catch (error) {
      console.error("JSON解析失败:", error);
    }
  }

  /**
   * 发送消息
   * @param {Object} message - 要发送的消息对象
   */
  sendMessage(message) {
    if (this.available) {
      this.socket.emit("message", JSON.stringify(message));
    } else {
      console.log("SocketIO 连接不可用");
    }
  }

  /**
   * 发送请求并等待响应
   * @param {String} url - API端点
   * @param {Object} data - 请求数据
   * @returns {Promise<any>} 响应数据
   */
  fetch(url, data) {
    return new Promise((resolve, reject) => {
      const pathArray = url.split("/").filter(Boolean);
      const request = {
        request_id: randomString(16),
        protocol: pathArray[1],
        type: pathArray[2],
        id: pathArray[3],
        data: data,
      };

      this.requests.push(request.request_id);

      const timeOut = new Promise((_, reject) => {
        setTimeout(() => reject("timeout"), 60000);
      });

      const response = new Promise((resolve) => {
        this.on(request.request_id, (res) => {
          this.requests.splice(this.requests.indexOf(request.request_id), 1);
          resolve(res.data);
        });
      });

      Promise.race([timeOut, response]).then(resolve).catch(reject);

      this.sendMessage(request);
      if (request.type !== "heartbeat") {
        console.log("WebSocket发送请求", url, request);
      }
    });
  }

  /**
   * 流式获取补全数据
   * @param {Object} data - 补全请求数据
   * @returns {AsyncGenerator<any>} - 补全数据生成器
   */
  async *streamCompletions(data) {
    console.log("WebSocket开始流式获取补全数据");
    const request = {
      request_id: randomString(16),
      protocol: "llm",
      type: "completions",
      data: data,
    };

    this.requests.push(request.request_id);
    this.sendMessage(request);

    try {
      while (true) {
        const chunk = await new Promise((resolve, reject) => {
          this.on(request.request_id, (data) => {
            if (data.message === "update") {
              resolve(data);
            } else if (
              data.message === "completed" ||
              data.message === "failed"
            ) {
              this.off(request.request_id);
              reject({ done: true, data: data });
            }
          });
        });
        yield chunk;
      }
    } catch (e) {
      if (e.done) {
        console.log("WebSocket流式获取补全数据结束", e.data.message);
        yield e.data;
        return;
      }
      throw e;
    }
  }
}
