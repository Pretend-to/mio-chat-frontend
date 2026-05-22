<template>
  <div
    id="forward-msg-preview"
    :class="onPhone ? 'on-phone' : ''"
    @click="showBox = true"
  >
    <div id="forward-msg-head">转发的聊天消息</div>
    <div id="forward-msg-body">
      <div
        v-for="(message, index) in messages.slice(0, 2)"
        id="forward-msg-summary"
        :key="index"
      >
        {{ contactor.name }}: {{ getLastMessageSummary(message) }}
      </div>
    </div>
    <div id="forward-msg-foot">
      <span>查看{{ messages.length }}条转发消息</span>
      <i class="iconfont right-arrow" style="font-size: 0.6rem;"></i>
    </div>
  </div>

  <teleport to="body">
    <transition name="forward-fade">
      <div v-if="showBox" class="forward-msg-overlay" @click="showBox = false">
        <div class="forward-msg-box" :class="{ 'on-phone': onPhone }" @click.stop>
          <div class="forward-msg-header">
            <div class="forward-msg-title">转发的聊天消息</div>
            <displayButtons class="cfg-btns" @close="showBox = false" />
          </div>
          <div class="forward-msg-body">
            <div
              v-for="(message, index) of messages"
              :key="index"
              class="forward-message-item"
            >
              <div v-if="message.type === 'node'" class="forward-message-content">
                <div class="avatar">
                  <img :src="getAvatarUrl(message.data.uin)" :alt="message.data.name" />
                </div>
                <div class="msg-details">
                  <div class="wholename">
                    <span class="title" v-if="contactor && contactor.title">{{ contactor.title }}</span>
                    <span class="name">{{ message.data.name }}</span>
                  </div>
                  <div class="bubble-wrapper">
                    <div
                      v-for="(elm, elmIdx) of message.data.content" 
                      :key="elmIdx"
                      class="bubble-elm"
                    >
                      <MdRenderer
                        v-if="elm.type === 'text'"
                        :md="elm.data.text"
                        :theme="'github'"
                        :markdown-it-options="{breaks: true}"
                      />
                      <MdRenderer
                        v-else-if="elm.type === 'image'"
                        :md="`![image](${elm.data.file})`"
                        :key="elm.data.file"
                        :custom-plugins="mioPlugins"
                        :theme="'github'"
                      />
                      <ForwardMsg
                        v-else-if="elm.type === 'nodes'"
                        :contactor="contactor"
                        :messages="elm.data.messages"
                      />
                      <MdRenderer
                        v-else
                        :md="`尚未支持的消息类型：${elm.type}`"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script>
import MdRenderer from "mio-previewer";
import { client } from "@/lib/runtime.js";
import displayButtons from "@/components/DisplayButtons.vue";
import { imageViewerPlugin } from "mio-previewer/plugins/custom";
import { getLastMessageSummary } from "@/stores/contactorsStore.js";

export default {
  name: "ForwardMsg",
  components: {
    MdRenderer,
    displayButtons,
  },
  props: {
    messages: {
      type: Array,
      default: () => [],
    },
    contactor: {
      type: Object,
      default: () => ({}),
    },
  },
  data() {
    const mioPlugins = [
      {
        plugin: imageViewerPlugin,
      }
    ]
    return {
      showBox: false,
      onPhone: false,
      mioPlugins: mioPlugins,
    };
  },
  created() {
    this.onPhone = window.innerWidth < 768;

    client.on(
      "device-change",
      (type) => {
        if (type == "mobile") {
          this.onPhone = true;
        } else {
          this.onPhone = false;
        }
      },
      false,
    );
  },
  methods: {
    getAvatarUrl(uin) {
      if (typeof uin === "string" && (uin.startsWith("http") || uin.startsWith("/"))) {
        return uin;
      }
      return `/p/qava/?q=${uin || 1099834705}`;
    },
    getLastMessageSummary(message) {
      return getLastMessageSummary([], message);
    },
  },
};
</script>

<style scoped>
#forward-msg-preview {
  width: 15rem;
  display: flex;
  flex-direction: column;
  padding: 0.7rem 0.9rem;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

#forward-msg-preview:hover {
  border-color: #0099ff;
  box-shadow: 0 4px 12px rgba(0, 153, 255, 0.1);
  transform: translateY(-1px);
}

#forward-msg-head {
  font-size: 0.8rem;
  font-weight: 600;
  color: #333333;
  margin-bottom: 0.4rem;
}

#forward-msg-body {
  margin: 0.2rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

#forward-msg-summary {
  font-size: 0.75rem;
  color: #666666;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

#forward-msg-foot {
  margin-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: 0.4rem;
  font-size: 0.7rem;
  color: #0099ff;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Glassmorphism Blurred Overlay */
.forward-msg-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

/* Premium Dialog Styling */
.forward-msg-box {
  width: 32rem;
  max-width: 92vw;
  height: 38rem;
  max-height: 82vh;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.forward-msg-box.on-phone {
  width: 100vw;
  max-width: 100vw;
  height: 100vh;
  max-height: 100vh;
  border-radius: 0;
  border: none;
}

.forward-msg-header {
  height: 3.5rem;
  padding: 0 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  background: #fafafa;
}

.forward-msg-title {
  font-size: 1rem;
  font-weight: 600;
  color: #333333;
}

.cfg-btns {
  transform: scale(0.85);
  transform-origin: right center;
}

.forward-msg-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Message Item styling */
.forward-message-item {
  width: 100%;
}

.forward-message-content {
  display: flex;
  align-items: flex-start;
}

.forward-message-content > .avatar {
  width: 2.4rem;
  height: 2.4rem;
  min-width: 2.4rem;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 0.75rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.avatar > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.msg-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wholename {
  display: flex;
  align-items: center;
  margin-bottom: 0.25rem;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.wholename > .title {
  font-size: 0.65rem;
  background: rgba(0, 153, 255, 0.08);
  color: #0099ff;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  font-weight: 500;
}

.wholename > .name {
  font-size: 0.75rem;
  color: #666666;
  font-weight: 500;
}

/* Bubble Styling */
.bubble-wrapper {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 4px 14px 14px 14px;
  padding: 0.6rem 0.8rem;
  max-width: 88%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.bubble-elm {
  font-size: 0.85rem;
  line-height: 1.4;
  color: #333333;
}

.bubble-elm :deep(p) {
  margin: 0;
}

/* Transition Animations */
.forward-fade-enter-active,
.forward-fade-leave-active {
  transition: opacity 0.25s ease;
}

.forward-fade-enter-from,
.forward-fade-leave-to {
  opacity: 0;
}

.forward-fade-enter-active .forward-msg-box {
  transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
}

.forward-fade-leave-active .forward-msg-box {
  transition: transform 0.18s ease-in, opacity 0.18s ease-in;
}

.forward-fade-enter-from .forward-msg-box,
.forward-fade-leave-to .forward-msg-box {
  transform: scale(0.92);
  opacity: 0;
}

/* Slide Up Transition for Mobile full screen */
.forward-fade-enter-active .forward-msg-box.on-phone {
  transition: transform 0.3s cubic-bezier(0.1, 0.76, 0.55, 0.94);
}

.forward-fade-leave-active .forward-msg-box.on-phone {
  transition: transform 0.22s cubic-bezier(0.6, -0.28, 0.735, 0.045);
}

.forward-fade-enter-from .forward-msg-box.on-phone,
.forward-fade-leave-to .forward-msg-box.on-phone {
  transform: translateY(100%);
  opacity: 1;
}
</style>
