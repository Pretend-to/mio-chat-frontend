<template>
  <div class="loading-skeleton" :class="{ card: isCard }">
    <div v-if="type === 'adapter-card'" class="skeleton-adapter-card">
      <div class="skeleton-header">
        <div class="skeleton-checkbox"></div>
        <div class="skeleton-title"></div>
        <div class="skeleton-tag"></div>
      </div>
      <div class="skeleton-content">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line long"></div>
      </div>
      <div class="skeleton-actions">
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
      </div>
    </div>

    <div v-else-if="type === 'stat-card'" class="skeleton-stat-card">
      <div class="skeleton-icon"></div>
      <div class="skeleton-stat-content">
        <div class="skeleton-value"></div>
        <div class="skeleton-label"></div>
      </div>
    </div>

    <div v-else-if="type === 'list'" class="skeleton-list">
      <div v-for="i in count" :key="i" class="skeleton-list-item">
        <div class="skeleton-line"></div>
      </div>
    </div>

    <div v-else class="skeleton-default">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    default: 'default',
    validator: (value) => ['adapter-card', 'stat-card', 'list', 'default'].includes(value)
  },
  count: {
    type: Number,
    default: 3
  },
  isCard: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped lang="scss">
@keyframes skeleton-loading {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.loading-skeleton {
  &.card {
    background-color: #fff;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  }
}

.skeleton-adapter-card {
  .skeleton-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .skeleton-checkbox {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
  }

  .skeleton-title {
    width: 120px;
    height: 20px;
    border-radius: 4px;
    background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
  }

  .skeleton-tag {
    width: 60px;
    height: 24px;
    border-radius: 12px;
    margin-left: auto;
    background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
  }

  .skeleton-content {
    margin-bottom: 16px;
  }

  .skeleton-actions {
    display: flex;
    gap: 8px;
  }

  .skeleton-button {
    width: 80px;
    height: 32px;
    border-radius: 4px;
    background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
  }
}

.skeleton-stat-card {
  display: flex;
  align-items: center;
  gap: 16px;

  .skeleton-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
  }

  .skeleton-stat-content {
    flex: 1;
  }

  .skeleton-value {
    width: 60px;
    height: 32px;
    border-radius: 4px;
    margin-bottom: 8px;
    background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
  }

  .skeleton-label {
    width: 80px;
    height: 16px;
    border-radius: 4px;
    background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
  }
}

.skeleton-list {
  .skeleton-list-item {
    padding: 12px 0;
    border-bottom: 1px solid #f2f2f2;

    &:last-child {
      border-bottom: none;
    }
  }
}

.skeleton-line {
  height: 16px;
  margin-bottom: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;

  &:last-child {
    margin-bottom: 0;
  }

  &.short {
    width: 40%;
  }

  &.medium {
    width: 60%;
  }

  &.long {
    width: 80%;
  }
}

.skeleton-default {
  .skeleton-line {
    width: 100%;
  }
}
</style>
