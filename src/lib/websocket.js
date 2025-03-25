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
    return url.host;
  }

  /**
   * Initializes WebSocket event listeners.
   */
  initEventListeners() {
    this.socket.on("connect", () => this.handleConnect());
    this.socket.on("disconnect", () => this.handleDisconnect());
    this.socket.on("connect_error", (error) => this.handleConnectError(error));
    this.socket.on("message", (message) => this.messageHandler(message));
  }

  /**
   * Handles the connect event.
   */
  handleConnect() {
    this.available = true;
    console.log("SocketIO connected successfully");
  }

  /**
   * Handles the disconnect event.
   */
  handleDisconnect() {
    this.available = false;
    console.error("SocketIO disconnected");
  }

  /**
   * Handles the connect_error event.
   * @param {Error} error - The error object
   */
  handleConnectError(error) {
    console.error("SocketIO connection error", error);
  }

  /**
   * Connects to the SocketIO server.
   */
  async connect() {
    this.socket = io(this.url, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { id: this.id, token: this.code },
      reconnection: true, // Enable auto-reconnection
      reconnectionAttempts: 10, // Max reconnection attempts
      reconnectionDelay: 1000, // Initial reconnection delay
      reconnectionDelayMax: 30000, // Max reconnection delay
      timeout: 20000, // Connection timeout
    });
    console.log("SocketIO connecting...");
    this.initEventListeners();
  }

  /**
   * Disconnects from the WebSocket server.
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.available = false;
      console.log("WebSocket disconnected");
    }
  }

  /**
   * Handles incoming messages.
   * @param {String} message - The received message
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
      this.pendingRequests.delete(e.request_id); // Remove request_id
    } catch (error) {
      console.error("JSON parsing failed:", error);
    }
  }

  /**
   * Sends a message.
   * @param {Object} message - The message object to send
   */
  sendMessage(message) {
    if (!this.available) {
      console.log("SocketIO connection unavailable");
      return;
    }
    if (this.pendingRequests.has(message.request_id)) {
      console.warn(
        `Duplicate request_id: ${message.request_id}, request blocked`,
      );
      return;
    }
    this.pendingRequests.add(message.request_id);
    this.socket.emit("message", JSON.stringify(message));
    console.log("WebSocket sending request", message);
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
        data: data,
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
  async *streamCompletions(data) {
    const request = {
      request_id: randomString(16),
      protocol: "llm",
      type: "completions",
      data: data,
    };
    this.sendMessage(request);
    console.log("WebSocket sending request", request);

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
        console.log("WebSocket stream completions finished", e.data.message);
        yield e.data;
        return;
      }
      throw e;
    } finally {
      this.pendingRequests.delete(request.request_id); // Ensure removal on exit
    }
  }
}
