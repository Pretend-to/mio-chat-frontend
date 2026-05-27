<template>
  <div class="action-block-container" :class="[statusClass, { 'is-expanded': isExpanded }]">
    <!-- 头部 Trigger 触发栏 -->
    <div class="action-block-header" @click="handleHeaderClick">
      <!-- 1. 左侧图标插槽 -->
      <slot name="icon">
        <i v-if="iconClass" :class="['mio-icon', iconClass]"></i>
      </slot>
      
      <!-- 2. 主标题 -->
      <slot name="title">
        <span class="block-title">{{ title }}</span>
      </slot>
      
      <!-- 3. 状态/实时计时辅助文本 -->
      <slot name="status">
        <span 
          v-if="statusText" 
          class="block-status-text" 
          :class="{ 'is-loading': isLoading }"
        >
          {{ statusText }}
        </span>
      </slot>

      <!-- 4. 异常/失败状态指示灯 -->
      <slot name="indicator">
        <div v-if="isFailed" class="status-indicator-dot failed"></div>
      </slot>
      
      <!-- 5. 右侧折叠折角按钮/其它动作挂载 -->
      <slot name="actions">
        <div class="block-actions" v-if="collapsible">
          <button :class="{ active: isExpanded, 'action-btn': true }">
            <svg class="chevron" viewBox="0 0 1024 1024" width="10" height="10">
              <path
                d="M338.752 104.704a64 64 0 0 0 0 90.496l316.8 316.8-316.8 316.8a64 64 0 0 0 90.496 90.496l362.048-362.048a64 64 0 0 0 0-90.496L429.248 14.208a64 64 0 0 0-90.496 90.496z"
                fill="currentColor"
              ></path>
            </svg>
          </button>
        </div>
      </slot>
    </div>

    <!-- 折叠详情区 -->
    <div 
      v-if="collapsible"
      ref="detailsEl"
      class="action-block-details"
      :class="{ 'is-expanded': isExpanded }"
      @scroll="handleScroll"
    >
      <div class="details-inner">
        <!-- 默认插槽：放置主体内容（如参数、XML 文本等） -->
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  iconClass: String,
  title: String,
  statusText: String,
  isLoading: Boolean,
  isFailed: Boolean,
  collapsible: {
    type: Boolean,
    default: true
  },
  defaultExpanded: {
    type: Boolean,
    default: false
  },
  statusClass: String
});

const emit = defineEmits(['toggle', 'scroll']);

const isExpanded = ref(props.defaultExpanded);
const detailsEl = ref(null);
let wasManuallyToggled = false;

const handleHeaderClick = () => {
  if (!props.collapsible) return;
  isExpanded.value = !isExpanded.value;
  wasManuallyToggled = true;
  emit('toggle', isExpanded.value);
};

const handleScroll = (e) => {
  emit('scroll', e);
};

// 如果加载（执行）结束且没有被手动点过，延迟自动折叠，给用户良好的查看视觉回馈
watch(() => props.isLoading, (newVal) => {
  if (!newVal && !wasManuallyToggled) {
    setTimeout(() => {
      isExpanded.value = false;
    }, 800);
  }
});

// 监听 defaultExpanded 外部状态，用于响应式重置
watch(() => props.defaultExpanded, (newVal) => {
  if (!wasManuallyToggled) {
    isExpanded.value = newVal;
  }
});
</script>

<style lang="sass" scoped>
.action-block-container
  display: flex
  flex-direction: column
  margin: 2px 0

.action-block-header
  display: flex
  align-items: center
  width: fit-content
  height: 28px
  padding: 0 8px
  border-radius: 6px
  background: transparent
  border: none
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)
  user-select: none
  cursor: pointer
  gap: 8px
  margin-left: -8px

  &:hover
    background-color: rgba(0, 0, 0, 0.04)
    .block-title
      color: #111
    .block-actions
      color: #888

.block-title
  font-size: 13px
  font-weight: 500
  color: #666
  transition: color 0.2s

.block-status-text
  font-size: 12px
  color: #999
  &.is-loading
    animation: dot-blink 1.5s infinite

.status-indicator-dot
  width: 5px
  height: 5px
  border-radius: 50%
  &.failed
    background: #ff4d4f

.block-actions
  display: flex
  align-items: center
  color: #bbb
  transition: color 0.2s
  margin-left: 4px

  .action-btn
    background: transparent
    border: none
    padding: 0
    display: flex
    align-items: center
    cursor: pointer
    color: inherit

    .chevron
      transition: transform 0.3s ease
      transform: rotate(90deg)

    &.active .chevron
      transform: rotate(-90deg)

.action-block-details
  max-width: 100%
  max-height: 0
  overflow: hidden
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease
  opacity: 0
  will-change: max-height

  &.is-expanded
    max-height: 160px
    overflow-y: auto
    opacity: 1
    margin-bottom: 8px

  .details-inner
    padding: 8px 12px
    border-left: 2px solid #efefef
    margin-left: 1px
    background: rgba(0, 0, 0, 0.01)
    border-radius: 0 4px 4px 4px

@keyframes dot-blink
  0%, 100%
    opacity: 0.35
  50%
    opacity: 1
</style>
