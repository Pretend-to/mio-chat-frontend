import EventEmitter from "./event.js";
import { randomString } from "../utils/generate.js";
import RetryManager from "./retry-manager.js";
import io from "socket.io-client";

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
    this.pendingRequests = new Set(); // 用于跟踪正在处理的 request_id
    this.reconnectDelay = 5000; // 重连延迟，单位毫秒
    this.maxHeartbeatFails = 3; // 最大心跳失败次数
    this.heartbeatFails = 0; // 当前心跳失败次数
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
    this.heartbeatFails = 0;
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
    this.socket = io(this.url, {
      path: "/socket.io",
      transports: ["polling"],
      auth: { id: this.id, token: this.code },
    });
    this.initEventListeners();
  }

  /**
   * 尝试重新连接
   */
  async attemptReconnect() {
    if (this.connectionState === "reconnecting") return;
    this.connectionState = "reconnecting";
    this.stopHeartbeat(); // 确保停止心跳
    setTimeout(async () => {
      // 延迟重连
      try {
        await this.retryManager.retry(() => this.connect());
      } catch (error) {
        console.error("重连失败，已达到最大重试次数", error);
        this.connectionState = "failed";
        this.emit("reconnect_failed");
      } finally {
        this.connectionState = "disconnected"; // 重连尝试结束后更新状态
      }
    }, this.reconnectDelay);
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
      pingTimeout: 5000, // 如果服务器在5秒内没有响应ping，则认为连接已断开
      pingInterval: 10000, // 每10秒发送一次ping
    });
    console.log("SocketIO连接中...");
    this.initEventListeners();
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    if (this.heartBeat) {
      clearInterval(this.heartBeat); // 清除之前的心跳，避免重复
    }

    this.heartBeat = setInterval(async () => {
      if (this.socket?.connected) {
        try {
          const res = await this.fetch("/api/system/heartbeat", {
            timestamp: Date.now(),
          });
          console.log("心跳检测成功", res);
          this.updateDelay(res);
          this.heartbeatFails = 0; // 重置失败计数器
        } catch (error) {
          this.heartbeatFails++;
          // console.error(
          //   `心跳检测失败 ${this.heartbeatFails}/${this.maxHeartbeatFails}`,
          //   error,
          // );

          // if (
          //   this.heartbeatFails >= this.maxHeartbeatFails &&
          //   !this.socket?.connected
          // ) {
          //   console.error("多次心跳检测失败，触发重连");
          //   this.stopHeartbeat();
          //   this.handleDisconnect(); // 模拟断开连接
          // }
          // if (this.connectionState === "failed") {
          //   console.error("心跳检测失败,连接已失败", error);
          // }
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
      if (e.protocol === "llm") {
        this.emit(e.request_id, e);
      }
      if (e.protocol === "onebot") {
        this.emit("onebot_message", e);
      } else if (e.protocol === "system") {
        if (e.type === "login") this.emit("connect", e.data);
        this.emit("system_message", e);
      }
      this.pendingRequests.delete(e.request_id); // 移除 request_id
    } catch (error) {
      console.error("JSON解析失败:", error);
    }
  }

  /**
   * 发送消息
   * @param {Object} message - 要发送的消息对象
   */
  sendMessage(message) {
    if (!this.available) {
      console.log("SocketIO 连接不可用");
      return;
    }

    if (this.pendingRequests.has(message.request_id)) {
      console.warn(`重复的 request_id: ${message.request_id}, 请求被阻止`);
      return;
    }

    this.pendingRequests.add(message.request_id);
    this.socket.emit("message", JSON.stringify(message));

    if (message.type !== "heartbeat") {
      console.log("WebSocket发送请求", message);
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

      const timeOut = new Promise((_, reject) => {
        setTimeout(() => {
          this.pendingRequests.delete(request.request_id); // 超时时移除
          reject("timeout");
        }, 60000);
      });

      const response = new Promise((resolve) => {
        this.on(request.request_id, (res) => {
          this.pendingRequests.delete(request.request_id); // 收到响应时移除
          resolve(res.data);
        });
      });

      Promise.race([timeOut, response]).then(resolve).catch(reject);
      this.sendMessage(request); // 使用 sendMessage 发送请求
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
    const request = {
      request_id: randomString(16),
      protocol: "llm",
      type: "completions",
      data: data,
    };
    this.sendMessage(request);
    console.log("WebSocket发送请求", request);
    try {
      while (true) {
        const chunk = await new Promise((resolve, reject) => {
          this.on(request.request_id, (data) => {
            if (data.message === "update") {
              resolve(data);
            } else if (
              data.message === "complete" ||
              data.message === "failed"
            ) {
              this.off(request.request_id);
              this.pendingRequests.delete(request.request_id);
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
    } finally {
      this.pendingRequests.delete(request.request_id); // 确保退出时删除
    }
  }
}
