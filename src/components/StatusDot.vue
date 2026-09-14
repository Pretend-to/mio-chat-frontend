<script setup>
import { computed } from "vue";
import { useConnectionStore } from "@/stores/connectionStore";
import { client } from "@/lib/runtime.js";

const props = defineProps({
  size: {
    type: String,
    default: "12px",
  },
  border: {
    type: String,
    default: "none",
  },
});

const connectionStore = useConnectionStore();

const isOnline = computed(() => {
  return connectionStore.isConnected || client.isConnected;
});

const isConnecting = computed(
  () => !isOnline.value && connectionStore.isConnecting,
);

const dotStyle = computed(() => ({
  width: props.size,
  height: props.size,
  border: props.border,
}));
</script>

<template>
  <div
    class="status-dot"
    :class="{
      online: isOnline,
      connecting: isConnecting,
      offline: !isOnline && !isConnecting,
    }"
    :style="dotStyle"
  ></div>
</template>

<style scoped>
.status-dot {
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.3s ease;
  box-sizing: border-box;
}

.status-dot.online {
  background: linear-gradient(to bottom, #34ee8f, #36dd96);
}

.status-dot.connecting {
  background: #e6a23c;
  animation: status-dot-pulse 1s ease-in-out infinite alternate;
}

.status-dot.offline {
  background: #ccc;
}

@keyframes status-dot-pulse {
  from {
    opacity: 0.45;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-dot.connecting {
    animation: none;
  }
}
</style>
