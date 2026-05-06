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
    const syncConnection = (socket) => {
      isConnected.value = !!socket.available;
      client.isConnected = !!socket.available;
      
      socket.on("connection_changed", (status) => {
        isConnected.value = !!status;
        client.isConnected = !!status;
        if (!status) {
          isConnecting.value = false;
        }
      });

      socket.on("connect_error", (err) => {
        isConnected.value = false;
        client.isConnected = false;
        setError(err.message || "Connection error");
      });
    };

    if (client.socket) {
      syncConnection(client.socket);
    } else {
      client.on("socket_ready", (socket) => {
        syncConnection(socket);
      });
    }
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
