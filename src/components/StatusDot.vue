<script setup>
import { computed } from 'vue';

const props = defineProps({
  online: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: '12px'
  },
  border: {
    type: String,
    default: 'none'
  }
});

const dotStyle = computed(() => ({
  width: props.size,
  height: props.size,
  border: props.border
}));
</script>

<template>
  <div class="status-dot" :class="{ online: props.online, offline: !props.online }" :style="dotStyle"></div>
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

.status-dot.offline {
  background: #ccc;
}
</style>
