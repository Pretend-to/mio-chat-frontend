import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useConnectionStore = defineStore('connection', () => {
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const error = ref(null);

  function setConnected(status) {
    isConnected.value = status;
    if (status) {
      isConnecting.value = false;
      error.value = null;
    }
  }

  function setConnecting(status) {
    isConnecting.value = status;
  }

  function setError(err) {
    error.value = err;
    isConnecting.value = false;
  }

  /**
   * 初始化与全局 Client 的同步
   * @param {object} client - 全局 Client 实例
   */
  function initSync(client) {
    const updateState = () => {
      console.log("[connectionStore] sync state called, isConnected:", client.isConnected);
      isConnected.value = client.isConnected;
    };

    // 初始同步
    updateState();

    // 监听 client 的状态变化事件
    client.on("connection_changed", (status) => {
      console.log("[connectionStore] connection_changed received:", status);
      isConnected.value = !!status;
      if (!status) {
        isConnecting.value = false;
      }
    });

    client.on("connect_error", (err) => {
      console.log("[connectionStore] connect_error received:", err);
      isConnected.value = false;
      setError(err.message || "Connection error");
    });
    
    // 如果 socket 重新就绪（重新登录），确保状态也是最新的
    client.on("socket_ready", () => {
      updateState();
    });
  }

  return {
    isConnected,
    isConnecting,
    error,
    setConnected,
    setConnecting,
    setError,
    initSync
  };
});
