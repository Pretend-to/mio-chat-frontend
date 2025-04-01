import EventEmitter from "./event.js";
import { randomString } from "../utils/generate.js";
import io from "socket.io-client";

/**
 * WebSocket Connection Class
 * Handles WebSocket connection and message sending/receiving.
 */
export default class Socket extends EventEmitter {
  /**
   * Creates a Socket instance.
   * @param {String} id - Robot QQ number
   * @param {String} code - Login token
   */
  constructor(id, code) {
    super();
    this.available = null;
    this.url = this.getURL();
    this.socket = null;
    this.code = code;
    this.id = id;
    this.requests = [];
    this.pendingRequests = new Set(); // Track ongoing request_ids
  }

  /**
   * Gets the WebSocket URL.
   * @returns {String} WebSocket URL
   */
  getURL() {
    const url = new URL(window.location.href);
    // 保持原样，因为 io() 知道如何处理 host
    return url.host;
  }

  /**
   * Initializes WebSocket event listeners.
   */
  initEventListeners() {
    if (!this.socket) return; // Safety check

    // --- 清理旧监听器 (如果需要重新附加) ---
    // 这对于确保在重新连接时不重复添加监听器很重要
    // Socket.IO v3+ 的 off() 或 removeAllListeners()
    this.socket.off("connect");
    this.socket.off("disconnect");
    this.socket.off("connect_error");
    this.socket.off("message");
    // --- 重新附加监听器 ---
    this.socket.on("connect", () => this.handleConnect());
    this.socket.on("disconnect", (reason) => this.handleDisconnect(reason)); // Pass reason
    this.socket.on("connect_error", (error) => this.handleConnectError(error));
    this.socket.on("message", (message) => this.messageHandler(message));
  }

  /**
   * Handles the connect event.
   */
  handleConnect() {
    this.available = true;
    this.hasAttemptedPollingFallback = false; // Reset fallback flag on successful connect
    this.isAttemptingWebSocket = false; // Reset attempt flag
    const transport = this.socket.io?.engine?.transport?.name || "unknown";
    console.log(`SocketIO connected successfully via: ${transport}`);
  }

  /**
   * Handles the disconnect event.
   * @param {String} reason - The reason for disconnection
   */
  handleDisconnect(reason) {
    this.available = false;
    console.error(`SocketIO disconnected. Reason: ${reason}`);
    // 如果是 'io server disconnect' 或 'io client disconnect'，可能不需要自动重连或回退
    // 如果是 'transport close' 或 'transport error'，Socket.IO 的 reconnection 机制会尝试处理
    // 这里我们主要依赖 connect_error 来处理初始连接失败的回退
  }

  /**
   * Handles the connect_error event.
   * @param {Error} error - The error object
   */
  handleConnectError(error) {
    console.error(`SocketIO connection error: ${error.message}`, error);
    // error 对象可能包含 transport 信息，例如 error.transport
    console.log(
      `Error occurred during ${this.isAttemptingWebSocket ? "WebSocket" : "Polling"} attempt.`,
    );

    // --- 手动回退逻辑 ---
    // 1. 检查是否是 WebSocket 尝试失败
    // 2. 检查是否 *已经* 尝试过回退到 Polling (防止无限循环)
    if (this.isAttemptingWebSocket && !this.hasAttemptedPollingFallback) {
      console.log(
        "WebSocket connection failed. Attempting fallback to Polling...",
      );
      this.hasAttemptedPollingFallback = true; // Mark that we are now trying polling
      this.isAttemptingWebSocket = false; // No longer attempting WebSocket initially

      // 清理当前的 socket 实例
      if (this.socket) {
        this.socket.disconnect(); // 或 .close()
        this.socket = null;
      }

      // 延迟一小段时间再尝试 Polling，避免立即重试可能遇到的瞬时问题
      setTimeout(() => {
        // 发起只使用 Polling 的新连接
        this._connectWithTransport(["polling"]);
      }, 500); // 延迟 500ms (可调整)
    } else if (!this.isAttemptingWebSocket) {
      // Polling 尝试也失败了
      console.error("Polling connection attempt also failed.");
      this.available = false;
      // 这里可以决定是否彻底放弃，或者依赖 Socket.IO 的 reconnection 机制（如果开启）
      // 如果 Socket.IO 的 reconnection 开启，它会继续尝试用 polling 重连
    } else {
      // 如果 isAttemptingWebSocket 为 true 但 hasAttemptedPollingFallback 也为 true
      // 理论上不应该发生，但作为保险
      console.warn("Unexpected state in handleConnectError.");
      this.available = false;
    }
  }

  /**
   * Internal connect method allowing transport specification.
   * @param {String[]} transports - Array of transports to use.
   */
  _connectWithTransport(transports) {
    console.log(
      `Attempting to connect using transports: ${transports.join(", ")}...`,
    );
    // 确保清理可能存在的旧 socket
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.url, {
      path: "/socket.io",
      transports: transports, // <-- 使用指定的 transports
      auth: { id: this.id, token: this.code },
      reconnection: true, // 保持开启，让 Socket.IO 处理后续的重连尝试
      reconnectionAttempts: 5, // 可以为 polling 设置不同的重试次数
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 15000, // 可以为 polling 调整超时
      // 重要：强制新的连接尝试，而不是升级现有连接（如果适用）
      // 对于 polling，这通常不是问题，但加上无妨
      forceNew: true,
    });

    this.initEventListeners(); // 为新的 socket 实例初始化事件监听
  }

  /**
   * Connects to the SocketIO server, starting with WebSocket.
   */
  async connect() {
    if (this.socket && this.socket.connected) {
      console.log("Already connected.");
      return;
    }
    this.isAttemptingWebSocket = true; // Mark that we are starting with WebSocket
    this.hasAttemptedPollingFallback = false; // Reset fallback state
    this._connectWithTransport(["websocket"]); // Start with WebSocket only
  }

  /**
   * Disconnects from the WebSocket server.
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect(); // 使用 disconnect 更优雅
      // socket 实例会在 disconnect 事件后由库内部清理或重用（如果重连）
      // 我们可以在 handleDisconnect 中或这里设置 this.socket = null，取决于你的状态管理需求
      // this.socket = null; // 如果希望彻底断开后清理引用
      this.available = false;
      console.log("Manual disconnection initiated.");
    }
  }

  /**
   * Handles incoming messages.
   * @param {String} message - The received message
   */
  messageHandler(message) {
    console.log("WebSocket received message", message);
    try {
      const e = JSON.parse(message);
      if (e.protocol === "llm") {
        // this.emit(e.request_id, e);
        this.emit("llm_message", e);
      }
      if (e.protocol === "onebot") {
        this.emit("onebot_message", e);
      } else if (e.protocol === "system") {
        if (e.type === "login") this.emit("connect", e.data);
        this.emit("system_message", e);
      }
      this.pendingRequests.delete(e.request_id); // Remove request_id
    } catch (error) {
      console.error("JSON parsing failed:", error, "Received:", message); // Log received message on error
    }
  }

  /**
   * Sends a message.
   * @param {Object} message - The message object to send
   */
  sendMessage(message) {
    // 在发送前检查连接状态
    // 注意：即使 available 为 true，socket 也可能在发送瞬间断开
    // Socket.IO 客户端通常会缓存消息并在重连后发送，但要了解这个行为
    if (!this.socket || !this.socket.connected) {
      // 使用 socket.connected 更准确
      console.warn("SocketIO not connected. Message sending skipped.", message);
      // 可以考虑将消息放入队列稍后重试，但这会增加复杂性
      this.pendingRequests.delete(message.request_id); // 如果不发送，也应该移除 pending 状态
      return Promise.reject(new Error("Socket not connected")); // 让调用者知道失败了
    }

    // --- 原有的 pendingRequest 检查逻辑 ---
    if (this.pendingRequests.has(message.request_id)) {
      console.warn(
        `Duplicate request_id: ${message.request_id}, request blocked`,
      );
      // 考虑是否应该 reject Promise 或返回特定错误
      return Promise.reject(
        new Error(`Duplicate request_id: ${message.request_id}`),
      );
    }
    this.pendingRequests.add(message.request_id);
    // --- 发送消息 ---
    try {
      this.socket.emit("message", JSON.stringify(message));
      console.log("WebSocket sending request", message);
      // 注意：emit 是异步的，但通常不返回 Promise
      // 如果需要确认服务器收到，需要服务器发送回执
      return Promise.resolve(); // 表示发送尝试已发出
    } catch (error) {
      console.error("Error sending message:", error);
      this.pendingRequests.delete(message.request_id); // 发送失败，移除 pending 状态
      return Promise.reject(error); // 传递错误
    }
  }

  /**
   * Sends a request and waits for a response.
   * @param {String} url - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<any>} Response data
   */
  fetch(url, data) {
    return new Promise((resolve, reject) => {
      const pathArray = url.split("/").filter(Boolean);
      const request = {
        request_id: randomString(16),
        protocol: pathArray[1],
        type: pathArray[2],
        id: pathArray[3],
        // data: {
        //   ...data,
        //   metaData: {
        //     contactorId: this.id,
        //   },
        // },
        data: data,
        metaData: {
          contactorId: this.id,
        },
      };
      const timeOut = new Promise((_, reject) => {
        setTimeout(() => {
          this.pendingRequests.delete(request.request_id); // Remove on timeout
          reject("timeout");
        }, 60000);
      });
      const response = new Promise((resolve) => {
        this.on(request.request_id, (res) => {
          this.pendingRequests.delete(request.request_id); // Remove on response
          resolve(res.data);
        });
      });
      Promise.race([timeOut, response]).then(resolve).catch(reject);
      this.sendMessage(request); // Use sendMessage to send the request
      console.log("WebSocket sending request", url, request);
    });
  }

  /**
   * Streams completion data.
   * @param {Object} data - Completion request data
   * @returns {AsyncGenerator<any>} - Completion data generator
   */
  streamCompletions(data, metaData) {
    const request_id = randomString(16);
    const request = {
      request_id,
      protocol: "llm",
      type: "completions",
      data: data,
      metaData,
    };
    this.sendMessage(request);
    console.log("WebSocket sending request", request);

    // 使用新的 setStreamCompletionsCallback 方法
    // for await (const chunk of this.setStreamCompletionsCallback(request_id)) {
    //   yield chunk;
    // }
  }

  // async *setStreamCompletionsCallback(request_id) {
  //   try {
  //     while (true) {
  //       const chunk = await new Promise((resolve, reject) => {
  //         this.on(request_id, (data) => {
  //           console.log("WebSocket received chunk", data);
  //           if (data.message === "update") {
  //             resolve(data);
  //           } else if (
  //             data.message === "complete" ||
  //             data.message === "failed"
  //           ) {
  //             this.off(request_id);
  //             this.pendingRequests.delete(request_id);
  //             reject({ done: true, data: data });
  //           }
  //         });
  //       });
  //       yield chunk;
  //     }
  //   } catch (e) {
  //     if (e.done) {
  //       console.log("WebSocket stream completions finished", e.data.message);
  //       yield e.data;
  //       return;
  //     }
  //     throw e;
  //   } finally {
  //     this.pendingRequests.delete(request_id); // Ensure removal on exit
  //   }
  // }
}
