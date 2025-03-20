import EventEmitter from "./event.js";

/**
 * WebSocket Connection Class
 * This class handles the WebSocket connection, manages message sending and receiving, and supports heartbeats.
 */
export default class Socket extends EventEmitter {
  /**
   * Creates an instance of Socket.
   * @param {String} id - The QQ number of the bot.
   * @param {String} code - The login token for the bot.
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
  }

  /**
   * Retrieves the WebSocket URL based on the current host and port.
   * @returns {String} - The WebSocket URL.
   */
  getURL() {
    const url = new URL(window.location.href);
    const host = url.host;
    // 临时改动：如果 host 以 cdn. 开头，删除 cdn.
    if (host.startsWith("cdn.")) {
      return url.protocol === "https:"
        ? `wss://${host.slice(4)}/api/gateway`
        : `ws://${host.slice(4)}/api/gateway`;
    } else {
      return url.protocol === "https:"
        ? `wss://${host}/api/gateway`
        : `ws://${host}/api/gateway`;
    }
  }

  /**
   * Connects to the WebSocket server.
   */
  async connect() {
    const params = { "mio-chat-id": this.id, "mio-chat-token": this.code };
    const fullUrl = `${this.url}?${new URLSearchParams(params).toString()}`;
    this.socket = new WebSocket(fullUrl);
    console.log("WebSocket连接中...");

    this.socket.onopen = () => {
      this.available = true;
      console.log("WebSocket连接成功");

      // Sending heartbeat every 3 seconds
      this.heartBeat = setInterval(async () => {
        if (this.socket.readyState === WebSocket.OPEN) {
          const res = await this.fetch("/api/system/heartbeat", {
            timestamp: Date.now(),
          });
          const serverRevTime = res.revTime;
          const cuurentTime = Date.now();
          const delayTo = res.delay;
          const delayBack = cuurentTime - serverRevTime;
          this.delay = delayTo + delayBack;
        }
      }, 3000);
    };

    this.socket.onclose = () => {
      this.available = false;
      this.disconnect();
      console.error("WebSocket连接断开，将在2秒后尝试重新连接...");
      setTimeout(() => this.connect(), 2000); // Attempt to reconnect after 5 seconds
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket连接出错", error);
    };

    this.socket.onmessage = (event) => {
      this.messageHandler(event.data);
    };
  }

  /**
   * Disconnects the WebSocket connection.
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.available = false;
      clearInterval(this.heartBeat);
      console.log("WebSocket连接已断开");
    }
  }

  /**
   * Sends a message to the WebSocket server.
   * @param {String} message - The message content to send.
   */
  send(message) {
    if (this.available) {
      this.socket.send(message);
    } else {
      console.log("WebSocket连接不可用");
    }
  }

  /**
   * Handles incoming messages from the WebSocket server.W
   * @param {String} message - The message received from the server.
   */
  messageHandler(message) {
    try {
      const e = JSON.parse(message);
      // if (!(e.protocol == "system"))
      //   console.log("WebSocket收到事件，原始数据：", e);
      this.emit(e.request_id, e);
      if (e.protocol == "onebot") {
        this.emit("onebot_message", e);
      } else if (e.protocol == "system") {
        if (e.type == "login") this.emit("connect", e.data);
        this.emit("system_message", e);
      }
    } catch (error) {
      console.error("JSON解析失败:", error);
      // Error handling, e.g., provide default values or other operations
    }
  }

  /**
   * Sends an object type message to the WebSocket server.
   * @param {Object} message - The message object to send.
   */
  sendObject(message) {
    if (this.available) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.log("WebSocket连接不可用");
    }
  }

  /**
   * Generates a unique request ID using a timestamp and a secure random number generator.
   * @returns {String} - The unique request ID.
   */
  genRequestID() {
    const timestamp = Date.now().toString(36); // Convert current timestamp to base 36 string
    const randomPart = crypto
      .getRandomValues(new Uint32Array(1))[0]
      .toString(36); // Generate a secure random number
    const id = timestamp + randomPart.substring(0, 5); // Take a part of the random number to ensure length
    return id;
  }

  /**
   * Sends a request to the specified URL with the provided data and returns a promise.
   * @param {String} url - The API endpoint.
   * @param {Object} data - The data to be sent with the request.
   * @returns {Promise<any>} - A promise that resolves with the response data.
   */
  fetch(url, data) {
    return new Promise((resolve, reject) => {
      const pathArray = url.split("/").filter(Boolean);
      const protocol = pathArray[1];
      const type = pathArray[2];
      const id = pathArray[3];
      let request_id = this.genRequestID();
      const request = {
        request_id: request_id,
        protocol: protocol,
        type: type,
        id: id,
        data: data,
      };
      this.requests.push(request_id);
      const timeOut = new Promise((reject) => {
        setTimeout(() => {
          reject("timeout");
        }, 60000); // Timeout after 60 seconds
      });
      const response = new Promise((resolve) => {
        this.on(request_id, (res) => {
          this.requests.splice(this.requests.indexOf(request_id), 1);
          resolve(res.data);
        });
      });
      Promise.race([timeOut, response])
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
      this.sendObject(request);
      if (type !== "heartbeat") console.log("WebSocket发送请求", url, request);
    });
  }

  /**
   * Streams completion data from the WebSocket server.
   * @param {Object} data - The data to be sent with the completion request.
   * @returns {AsyncGenerator<any>} - An async generator that yields completion data chunks.
   */
  async *streamCompletions(data) {
    console.log("WebSocket开始流式获取补全数据");
    const request = {
      request_id: this.genRequestID(),
      protocol: "openai",
      type: "completions",
      data: data,
    };
    this.requests.push(request.request_id);
    this.sendObject(request);
    let resolve;
    let reject;
    let promise = new Promise((r, j) => {
      resolve = r;
      reject = j;
    });
    this.on(request.request_id, (data) => {
      if (data.message === "update") {
        resolve(data);
        promise = new Promise((r, j) => {
          resolve = r;
          reject = j;
        }); // Create a new promise for the next data chunk
      } else if (data.message === "completed" || data.message === "failed") {
        console.log("WebSocket流式获取补全数据结束", data.message);
        this.off(request.request_id);
        reject({ done: true, data: data }); // Reject the promise to stop the iteration
      }
    });
    try {
      while (true) {
        const chunk = await promise; // Wait for the 'on' callback to be called
        yield chunk; // Yield the data chunk
      }
    } catch (e) {
      if (e.done) {
        yield e.data;
        return; // Stop the iteration
      }
      throw e; // If it's another error, rethrow it
    }
  }
}
