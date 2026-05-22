<template>
  <div
    class="message-container"
    :class="{ 'opening-message': isOpening }"
    :data-id="item.id"
  >
    <div v-if="showTimeInfo && showTimeInfo.show" class="message-time">
      {{ showTimeInfo.time }}
    </div>
    <div
      class="message-flex-wrapper"
      :class="{
        'is-multi-select': isMultiSelect && item.role !== 'mio_system',
        'is-selected': isMultiSelect && isSelected
      }"
      @click="$emit('click-message', item)"
    >
      <transition name="checkbox-fade">
        <div v-if="isMultiSelect && item.role !== 'mio_system'" class="multi-select-box">
          <div
            class="round-checkbox"
            :class="{ checked: isSelected }"
            @click.stop="$emit('toggle-checkbox', item.id)"
          >
            <svg v-if="isSelected" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polyline points="1,5 4.5,8.5 11,1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        </div>
      </transition>
      
      <div :id="item.role" class="message-body" :style="{ pointerEvents: isMultiSelect ? 'none' : 'auto' }">
        <div v-if="item.role !== 'mio_system'" class="avatar">
          <img v-if="item.role === 'other'" :src="activeContactor.avatar" :alt="activeContactor.name" @click="$emit('to-profile')" />
          <img v-else :src="client.avatar" :alt="client.name" />
        </div>
        <div v-if="item.role !== 'mio_system'" class="msg">
          <div class="wholename">
            <div v-if="item.role === 'other' ? activeContactor.title : client.title" class="title">
              {{ item.role === 'other' ? activeContactor.title : client.title }}
            </div>
            <div class="name">
              {{ item.role === 'other' ? activeContactor.name : client.name }}
              <i v-if="item.isTask" class="iconfont task-indicator" title="来自计划任务"></i>
            </div>
          </div>
          <div
            :class="['content', item.status]"
            @mouseup="$emit('mouseup-content', $event)"
            @contextmenu="$emit('contextmenu-content', $event, index)"
            @touchstart="$emit('touchstart-content', $event, index)"
            @dblclick="$emit('contextmenu-content', $event, index)"
          >
            <div v-for="(element, elmIndex) of item.content" :key="elmIndex" class="inner-content">
              <MdRenderer
                v-if="element.type === 'text'"
                :md="element.data.text"
                :theme="'github'"
                :isStreaming="['pending', 'retrying'].includes(item.status) && item.content.length - 1 === elmIndex"
                :custom-plugins="mioPlugins"
                :markdown-it-plugins="katexPluginList"
                :markdown-it-options="mdOptions"
              />
              <MdRenderer
                v-if="element.type === 'image'"
                :md="`![image](${element.data.file})`"
                :custom-plugins="mioPlugins"
                :markdown-it-plugins="katexPluginList"
                :theme="'github'"
                :key="element.data.file"
              />
              <div v-else-if="element.type === 'reply'" class="reply-block">
                {{ getReplyText(element.data.id) }}
              </div>
              <ForwardMsg
                v-else-if="element.type === 'nodes'"
                :contactor="activeContactor"
                :messages="element.data.messages"
              />
              <FileBlock v-else-if="element.type === 'file'" :file-url="element.data.file" />
              <span v-else-if="element.type === 'at'" />
              <ReasonBlock
                v-else-if="element.type === 'reason'"
                :end-time="element.data.endTime"
                :start-time="element.data.startTime"
                :content="element.data.text"
                :duration="element.data.duration"
              />
              <div
                v-else-if="element.type === 'blank'"
                class="blank-message"
                style="width: 10rem; height: 28.8px; position: relative"
              >
                <span class="blank-loader"></span>
              </div>
              <ToolCallBar v-else-if="element.type === 'tool_call'" :tool-call="element.data" />
            </div>
          </div>
        </div>
        <div v-else class="system-message">
          <div class="system-message-content">
            {{ item.content[0].data.text }}
          </div>
          <div class="system-message-button">
            <i class="iconfont close" @click="$emit('delete-system', index)"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { client } from "@/lib/runtime.js";
import ForwardMsg from "@/components/ForwardMsg.vue";
import FileBlock from "@/components/FileBlock.vue";
import ToolCallBar from "@/components/ToolCallBar.vue";
import ReasonBlock from "@/components/ReasonBlock.vue";
import MdRenderer from "mio-previewer";

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  activeContactor: {
    type: Object,
    required: true,
  },
  isMultiSelect: {
    type: Boolean,
    default: false,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
  isOpening: {
    type: Boolean,
    default: false,
  },
  showTimeInfo: {
    type: Object,
    default: () => ({ show: false, time: "" }),
  },
  mioPlugins: {
    type: Array,
    required: true,
  },
  katexPluginList: {
    type: Array,
    required: true,
  },
  mdOptions: {
    type: Object,
    required: true,
  },
  updateTrigger: {
    type: Number,
    default: 0,
  },
});

defineEmits([
  "click-message",
  "toggle-checkbox",
  "to-profile",
  "mouseup-content",
  "contextmenu-content",
  "touchstart-content",
  "delete-system",
]);

const getReplyText = (id) => {
  let content = "";
  const message = props.activeContactor.messageChain.find(
    (item) => item.id === id || String(item.id) === String(id)
  );
  if (message) {
    message.content.forEach((element) => {
      if (element.type === "text") {
        content += element.data.text;
      } else if (element.type === "image") {
        content += "[图片]";
      }
    });
    return content.trim().slice(0, 20);
  } else {
    return "[消息已删除] ";
  }
};
</script>

<style lang="sass" scoped>
$mobile: 768px
$icon-hover: #09f

.message-container
    content-visibility: auto
    contain-intrinsic-size: auto 150px

:global(.is-exporting) .message-container
    content-visibility: visible !important
    contain: none !important
    
.message-flex-wrapper
    display: flex
    align-items: flex-start
    width: 100%
    position: relative
    transition: background-color 0.15s

    .message-body
        flex: 1
        min-width: 0
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)
        transform: translateX(0)

    &.is-multi-select
        cursor: pointer

        & > #other.message-body
            transform: translateX(1.75rem)

        &:hover
            background-color: rgba(0, 0, 0, 0.04)

    &.is-selected
        background-color: rgba(0, 0, 0, 0.06)

        &:hover
            background-color: rgba(0, 0, 0, 0.08)

    .checkbox-fade-enter-active, .checkbox-fade-leave-active
        transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)

    .checkbox-fade-enter-from, .checkbox-fade-leave-to
        opacity: 0 !important

    .multi-select-box
        position: absolute
        left: 0.5rem
        top: 50%
        transform: translateY(-50%)
        width: 1rem
        height: 1rem
        display: flex
        align-items: center
        justify-content: center
        flex-shrink: 0

        .round-checkbox
            width: 1rem
            height: 1rem
            border-radius: 50%
            border: 2px solid #ccc
            background-color: #fff
            display: flex
            align-items: center
            justify-content: center
            cursor: pointer
            transition: border-color 0.15s, background-color 0.15s
            flex-shrink: 0

            svg
                width: 0.7rem
                height: 0.7rem
                display: block

            &.checked
                border-color: rgb(0, 153, 255)
                background-color: rgb(0, 153, 255)

            &:hover:not(.checked)
                border-color: rgb(0, 153, 255)

.message-body > .avatar
  cursor: pointer
  flex-basis: 2.65rem
  min-width: 2.65rem
  height: 2.65rem

.avatar > img
  width: 100%
  height: 100%
  border-radius: 50%

.inner-content
  display: flex
  flex-direction: column
  width: 100%
  
  & > *
    margin: 2px 0

@keyframes move
  0%
    left: -20%
  100%
    left: 120%

.blank-loader
  width: 10%
  height: 200%
  position: absolute
  background: linear-gradient(to right, rgb(255, 255, 255), rgb(0, 0, 0) 50%, transparent 50%, transparent)
  top: -50%
  transform: rotate(30deg)
  filter: blur(5px)
  animation: move 1s linear infinite
</style>

