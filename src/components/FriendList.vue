<script>
import { client, config } from "@/lib/runtime.js";
import AddContactor from "@/components/AddContactor.vue";

export default {
  components: {
    AddContactor,
  },
  data() {
    let list = client.getContactors();
    const onPhone = window.innerWidth < 600;

    return {
      onPhone,
      contactorList: list,
      showAddOptions: false,
      showAddWindow: false,
    };
  },
  computed: {
    sortedList() {
      return [...this.contactorList].sort((a, b) =>
        b.priority - a.priority == -1 ? 1 : b.lastUpdate - a.lastUpdate,
      );
    },
  },
  mounted() {
    this.addReactiveListener();
  },
  beforeCreate() {
    if (client.getContactors().length == 0) {
      client.on(
        "loaded",
        () => {
          this.contactorList = client.getContactors();
        },
        false,
      );
    }
  },
  methods: {
    genBotByPreset() {
      this.showAddOptions = false;
      this.showAddWindow = true;
    },
    showChat(id) {
      // 如果当前路径 name 是 blank 或者 chat_view ，跳转到 /chat/:id
      if (this.$route.name == "blank" || this.$route.name == "chat_view") {
        this.$router.push({ name: "chat_view", params: { id: id } });
      } else if (
        this.$route.name == "contactors" ||
        this.$route.name == "profile_view"
      ) {
        this.$router.push({ name: "profile_view", params: { id: id } });
      } else {
        // 否则，直接跳转到 /chat/:id
        this.$router.replace({ name: "chat_view", params: { id: id } });
      }
    },
    getId(item) {
      // 获取当前页面的id
      let currentId = this.$route.params.id;
      // 获取当前页面的contactorId
      let contactorId = item.id;
      // 如果当前页面的id和contactorId相同，则返回active
      if (currentId == contactorId) {
        return "active";
      } else {
        return item.priority == 0 ? "important" : "";
      }
    },
    async genBlankBot() {
      const options = {
        ...config.openaiDefaultConfig,
      };
      const openaiDefaultConfig = {
        id: this.genFakeId(),
        title: options.default_model,
        avatarPolicy: 0,
        namePolicy: 2,
        priority: 1,
        options: options,
      };

      this.showAddOptions = false;
      await client.addConcator("openai", openaiDefaultConfig);
      this.addReactiveListener();
    },
    startResize(event) {
      this.isResizing = true;
      this.startX = event.clientX;
      this.startWidth = this.$refs.friendlists.offsetWidth;
      document.addEventListener("mousemove", this.resize);
      document.addEventListener("mouseup", this.stopResize);
    },
    resize(event) {
      if (this.isResizing) {
        let newWidth = this.startWidth + (event.clientX - this.startX);
        const maxWidth = 500;
        const minWidth = 176;
        newWidth =
          newWidth > maxWidth
            ? maxWidth
            : newWidth < minWidth
              ? minWidth
              : newWidth;
        this.$refs.friendlists.style.flexBasis = newWidth + "px";
      }
    },
    stopResize() {
      this.isResizing = false;
      document.removeEventListener("mousemove", this.resize);
      document.removeEventListener("mouseup", this.stopResize);
    },
    genFakeId() {
      // 生成5位随机数
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      // 将随机数转换为字符串
      const randomNumStr = `1${randomNum}`;
      if (!this.id) {
        // 将拼接后的字符串转换为数字并返回
        return parseInt(randomNumStr);
      } else {
        // 生成5位随机数
        const subRandomNum = Math.floor(1000 + Math.random() * 9000);
        // 将随机数转换为字符串
        const randomNumStr = `${this.id}${subRandomNum}`;
        return parseInt(randomNumStr);
      }
    },
    mergeOptions(options) {
      let result = {};
      const defaultOptions = config.openaiDefaultConfig;
      for (const key in defaultOptions) {
        if (options[key] === undefined) {
          if (key == "enable_tool_call") {
            if (options.tools) {
              result[key] = true;
            }
            continue;
          }
          result[key] = defaultOptions[key];
        } else {
          result[key] = options[key];
        }
      }
      return result;
    },
    addPresetContactor(preset) {
      const contactor = {
        id: this.genFakeId(),
        namePolicy: 1,
        avatarPolicy: preset.avatar ? 1 : 0,
        avatar: preset.avatar ? preset.avatar : undefined,
        name: preset.name,
        title: preset.title,
        priority: 1,
        options: this.mergeOptions(preset),
      };
      client.addConcator("openai", contactor);
      this.addReactiveListener();
    },
    addReactiveListener() {
      this.contactorList.map((contactor) => {
        contactor.on("updateMessageSummary", () => {
          contactor.lastMessageSummary = contactor.getLastMessageSummary();
        });
      });
    },
  },
};
</script>

<template>
  <div id="friendlists" ref="friendlists" :class="onPhone ? 'mobile' : ''">
    <div id="friends" class="upsidebar">
      <div class="search">
        <i class="iconfont sousuo listicon"></i>
        <input id="main-search" type="text" placeholder="搜索" />
      </div>
      <div class="bu-add">
        <button
          id="addcont"
          title="Add Bot"
          @click="showAddOptions = !showAddOptions"
        >
          <i class="iconfont add"></i>
        </button>
        <div
          v-show="showAddOptions"
          id="add-options"
          :style="{ left: onPhone ? '-6rem' : '0px' }"
        >
          <ul>
            <li>
              <button @click="genBlankBot">新建空白Bot</button>
            </li>
            <li>
              <button @click="genBotByPreset">从预设新建Bot</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div class="people">
      <div
        v-for="(item, index) of sortedList"
        :id="getId(item)"
        :key="index"
        class="lists"
        @click="showChat(item.id)"
      >
        <div
          class="avatar"
          :class="item.avatarPolicy == 1 ? 'custom' : 'model'"
        >
          <img :src="item.avatar" :alt="item.name" />
        </div>
        <div class="info">
          <div class="name">{{ item.name }}</div>
          <div id="time" class="msginfo">{{ item.getLastTime() }}</div>
          <div id="msgctt" class="msginfo">{{ item.lastMessageSummary }}</div>
        </div>
      </div>
    </div>
    <div class="resizer" @mousedown="startResize"></div>
    <AddContactor
      v-if="showAddWindow"
      @close="showAddWindow = false"
      @add-bot="addPresetContactor"
    ></AddContactor>
  </div>
</template>

<style scoped>
#add-options {
  position: absolute;
  top: 2.5rem;
  background-color: white;
  width: 8rem;
  height: 3rem;
  border: 0.0625rem solid rgba(161, 154, 154, 0.626);
  border-radius: 0.3125rem;
  z-index: 2;
}
#add-options li {
  display: flex;
  flex-direction: row-reverse;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
}
#add-options ul {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 100%;
  box-shadow: 0 0 0.5rem rgba(0, 0, 0, 0.1);
}
#add-options button {
  background-color: transparent;
}
#friendlists {
  height: 100%;
  display: flex;
  min-width: 14rem;
  max-width: 14rem;
  flex-direction: column;
  position: relative;
}

.resizer {
  width: 5px;
  cursor: ew-resize;
  background-color: transparent; /* 可视化的样式，你可以根据需求进行调整 */
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
}
#friendlists.mobile {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: none;
}

.upsidebar {
  justify-content: space-between;
  display: flex;
  flex-direction: row;
  background-color: rgb(255, 255, 255);
  flex: 0 0 4rem;
  align-items: flex-end;
}

#main-search {
  width: calc(100% - 1.125rem);
  margin-top: 0.1875rem;
  padding-left: 0.3125rem;
  height: 1.125rem;
  background-color: transparent;
  border: 0rem;
}

#main-search:focus {
  outline: none;
  border: 0rem;
}

button#searchButton {
  width: 1rem;
  border: 0rem;
  border-radius: 0.3125rem;
  margin-left: 0.5rem;
  text-wrap: nowrap;
}

.search {
  flex-grow: 1;
  flex-basis: 1rem;
  border-radius: 0.3125rem;
  background-color: rgb(245 245, 245);
  height: 2rem;
  display: flex;
  padding: 0rem 0.5rem;
  align-items: center;
  margin: 0 0 0.5rem 0.5rem;
}

.bu-add {
  flex-basis: 2rem;
  font-size: 1rem;
  margin: 0.5rem;
  height: 2rem;
  position: relative;
}

.listicon {
  padding-top: 0.0625rem;
  width: 1rem;
  height: 1rem;
}

button#addcont {
  border-radius: 0.3125rem;
  width: 100%;
  height: 100%;
  border: none;
}

.lists {
  align-items: center;
  min-width: 10rem;
  display: flex;
  padding: 0.25rem 0.5rem;
  height: 3.75rem;
  max-height: 3.75rem;
  min-height: 3.75rem;
  /* border: .0625rem solid pink; */
}

.lists#important {
  background-color: rgb(240, 240, 240);
}

.lists:hover {
  background-color: rgb(240, 240, 240);
  /* border: .0625rem solid pink; */
}

.lists#important:hover {
  background-color: rgb(231, 231, 231);
  /* border: .0625rem solid pink; */
}

.lists#active {
  background-color: rgb(0, 153, 255);
}

.lists > .avatar {
  flex-basis: 2.65rem;
  min-width: 2.65rem;
  height: 2.65rem;
  border-radius: 50%;
  overflow: hidden;
  background-color: white;
}

.avatar > img {
  width: 100%;
  height: 100%;
}

.avatar.model > img {
  scale: 0.9;
}

.info {
  height: 100%;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex: 0 0 calc(100% - 2.65rem);
  max-width: calc(100% - 2.65rem);
  flex-wrap: wrap;
}

.lists#active * {
  color: #f0f8ff;
}

.lists .name {
  flex-basis: 4rem;
  flex-grow: 1;
  margin-top: 0.75rem;
  font-size: 0.875rem;
  margin-left: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info #time {
  font-size: 0.625rem;
  flex-grow: 1;
  text-align: right;
}

.info #msgctt {
  flex-basis: 100%;
  padding-right: 1rem;
  font-size: 0.625rem;
  margin-left: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.people {
  overflow-y: auto;
}
</style>
