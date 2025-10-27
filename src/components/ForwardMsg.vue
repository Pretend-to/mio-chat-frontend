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
        {{ contactor.name }}: {{ contactor.getLastMessageSummary(message) }}
      </div>
    </div>
    <div id="forward-msg-foot">查看{{ messages.length }}条转发消息</div>
  </div>
  <div v-if="showBox" id="forward-msg-box" :class="onPhone ? 'on-phone' : ''">
    <div class="forward-msg-head">
      <div class="forward-msg-title">转发的聊天消息</div>
      <displayButtons class="cfg-btns" @close="showBox = false" />
      <!-- <span class="close" @click="showBox = false">&times;</span> -->
    </div>
    <div class="body">
      <div
        v-for="(message, index) of messages"
        :key="index"
        class="message-container"
      >
        <div v-if="message.type === 'node'" id="other" class="message-body">
          <div class="avatar">
            <img :src="`/p/qava/?q=${message.data.uin}`" :alt="message.data.name" />
          </div>
          <div class="msg">
            <div class="wholename">
              <div class="title">{{ contactor.title }}</div>
              <div class="name">{{ message.data.name }}</div>
            </div>
            <div
              v-for="(elm,index) of message.data.content" 
              :key="index"
              class="content"
            >
              <div>
                <MdRenderer
                  v-if="elm.type === 'text'"
                  :md="elm.data.text"
                />
                <el-image
                  v-else-if="elm.type === 'image'"
                  :key="index"
                  style="margin: 8px 0; max-width: 20rem; border-radius: 1rem"
                  :src="elm.data.file"
                  :zoom-rate="1.2"
                  :preview-teleported="true"
                  :max-scale="7"
                  :min-scale="0.2"
                  :preview-src-list="[elm.data.file]"
                  :initial-index="4"
                  fit="cover"
                />
                <ForwardMsg
                  v-else-if="elm.type === 'nodes'"
                  :contactor="activeContactor"
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
</template>

<script>
import MdRenderer from "mio-previewer";
import { client } from "@/lib/runtime.js";
import displayButtons from "@/components/DisplayButtons.vue";

export default {
  name: "ForwardMsg",
  components: {
    MdRenderer,
    displayButtons,
  },
  props: {
    messages: {
      type: Array,
      default: () => [], // 对于数组，使用函数返回一个新的空数组
    },
    contactor: {
      type: Object,
      default: () => {}, // 对于字符串，使用空字符串
    },
  },
  data() {
    return {
      showBox: false,
      onPhone: false,
    };
  },
  created() {
    this.onPhone = window.innerWidth < 600;

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
};
</script>

<style scoped>
#forward-msg-preview {
  width: 15rem;
  display: flex;
  flex-direction: column;
  padding: 0.2rem 0.5rem;
}

#forward-msg-preview.on-phone {
  transform: translateX(-0.35rem);
}

#forward-msg-body {
  margin: 0.5rem 0;
  width: 100%;
  text-overflow: ellipsis;
}

#forward-msg-summary {
  width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 300;
}

#forward-msg-foot {
  border-top: 1px solid #ccc;
  padding-top: 0.2rem;
  width: 100%;
  font-size: 0.7rem;
  color: rgb(150, 150, 150);
}

.cfg-btns {
  transform: scale(0.8);
  transform-origin: top right;
}

#forward-msg-box {
  border: 1px solid rgb(199, 199, 199);
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24rem;
  height: 30rem;
  z-index: 9999;
  background-color: rgb(241, 241, 241);
  border-radius: 0.25rem;
  overflow: hidden;
  box-shadow: 0 0 1rem rgba(0, 0, 0, 0.1);
}

.message-body > .avatar {
  flex-basis: 2.65rem;
  min-width: 2.65rem;
  height: 2.65rem;
}

.avatar > img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

#forward-msg-box.on-phone {
  border: null;
  border-radius: null;
  position: fixed;
  width: 100%;
  height: 100%;
  z-index: 9999;
  background-color: rgb(241, 241, 241);
  overflow: hidden;
}

.forward-msg-head {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 1.5rem;
  padding-left: 1rem;
  border-bottom: 1px solid #ccc;
  color: black;
  font-size: .8rem;
}

.close {
  width: 1.5rem;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
}

.close:hover {
  color: aliceblue;
  background-color: rgb(196, 43, 28);
}

.body {
  height: auto;
  max-height: calc(100% - 2rem);
  overflow: auto;
}
</style>
