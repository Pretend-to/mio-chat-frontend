<script>
import { client, config } from "@/lib/runtime.js";
import AddContactor from "@/components/AddContactor.vue";
import ContextMenu from "@/components/ContextMenu.vue";

export default {
  components: {
    AddContactor,
    ContextMenu,
  },
  data() {
    return {
      contactorList: [],
      showAddOptions: false,
      showAddWindow: false,
      showMenu: false,
      menuX: 0,
      menuY: 0,
      selectedFriend: null,
    };
  },
  computed: {
    sortedList() {
      return [...this.contactorList].sort((a, b) =>
        b.priority < a.priority ? 1 : b.lastUpdate - a.lastUpdate,
      );
    },
    avaliableProvideres() {
      return config.getLLMProviders().map((item) => item.value);
    },
  },
  created() {
    if (client.getContactors().length == 0) {
      client.on(
        "loaded",
        () => {
          this.contactorList = client.getContactors();
          this.addReactiveListener();
        },
        false,
      );
    } else {
      this.contactorList = client.getContactors();
      this.addReactiveListener();
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
    async genBotByProvider(provider) {
      const options = config.getLLMDefaultConfig(provider);
      const blankConfig = {
        id: this.genFakeId(),
        title: options.default_model,
        avatarPolicy: 0,
        namePolicy: 2,
        priority: 1,
        options: options,
      };

      this.showAddOptions = false;
      await client.addConcator("openai", blankConfig);
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
        // debugger;
        let newWidth = this.startWidth + (event.clientX - this.startX);
        const remSize = document.documentElement.style.fontSize
          ? parseFloat(document.documentElement.style.fontSize)
          : 16;
        const maxWidth = 20 * remSize;
        const minWidth = 12 * remSize;
        newWidth =
          newWidth > maxWidth
            ? maxWidth
            : newWidth < minWidth
              ? minWidth
              : newWidth;
        this.$refs.friendlists.style.minWidth = newWidth + "px";
        this.$refs.friendlists.style.maxWidth = newWidth + "px";
      }
    },
    stopResize() {
      this.isResizing = false;
      document.removeEventListener("mousemove", this.resize);
      document.removeEventListener("mouseup", this.stopResize);
    },
    genFakeId() {
      return client.genFakeId();
    },
    manageAddMenu() {
      this.showAddOptions = !this.showAddOptions;
    },
    mergeOptions(options) {
      const defaultOptions = config.getLLMDefaultConfig();
      if (options.history)
        defaultOptions.presetSettings.history = options.history;
      if (options.tools?.length > 0)
        defaultOptions.toolCallSettings.tools = config.getValidTools(
          options.tools,
        );
      if (options.opening)
        defaultOptions.presetSettings.opening = options.opening;

      if (options.model) {
        // 先获取可用的 provider 列表
        const availableProviders = config
          .getLLMProviders()
          .map((item) => item.value);
        // 看看哪个 provider 里面有这个 model
        const provider = availableProviders.find((provider) =>
          config.isModelAvailable(provider, options.model),
        );
        if (provider) {
          // 如果找到了 provider，就使用这个 provider
          defaultOptions.provider = provider;
          defaultOptions.base.model = options.model;
        } else {
          // 如果没有找到 provider，就使用默认的 provider
          defaultOptions.base.model = options.model;
          this.$message({
            message: "预设模型不存在, 已使用默认模型",
            type: "error",
          });
        }
      }
      return defaultOptions;
    },
    async addPresetContactor(preset) {
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
      await client.addConcator("openai", contactor);
      this.addReactiveListener();
    },
    showFriendContextMenu(event, friend) {
      this.selectedFriend = friend;
      this.menuX = event.clientX;
      this.menuY = event.clientY;
      this.showMenu = true;

      const closeMenu = () => {
        this.showMenu = false;
        document.removeEventListener("click", closeMenu);
      };
      document.addEventListener("click", closeMenu);
    },

    async handleFriendOption(option) {
      switch (option) {
        case "enter":
          this.showChat(this.selectedFriend.id);
          break;
        case "priority":
          this.selectedFriend.priority =
            this.selectedFriend.priority === 0 ? 1 : 0;
          client.setLocalStorage();
          break;
        case "share": {
          const shareResult = await client.shareContactor(
            this.selectedFriend.id,
          );
          if (shareResult) {
            this.$message({
              message: "分享链接已复制",
              type: "success",
            });
          } else {
            this.$message({
              message: "分享失败",
              type: "error",
            });
          }
          break;
        }
        case "delete": {
          let index;
          index = this.contactorList.findIndex(
            (c) => c.id === this.selectedFriend.id,
          );
          if (index !== -1) {
            this.contactorList.splice(index, 1);
            client.setLocalStorage();
          }
          break;
        }
      }
      this.showMenu = false;
    },

    addReactiveListener() {
      console.log("addReactiveListener");
      this.contactorList.map((contactor) => {
        contactor.on("updateMessageSummary", () => {
          console.log("updateMessageSummary");
          contactor.lastMessageSummary = contactor.getLastMessageSummary();
          this.$forceUpdate();
        });
      });
    },
  },
};
</script>

<template>
  <div id="friendlists" ref="friendlists">
    <div id="friends" class="upsidebar">
      <div class="search">
        <i class="iconfont sousuo listicon"></i>
        <input id="main-search" type="text" placeholder="搜索" />
      </div>
      <div class="bu-add">
        <button id="addcont" title="Add Bot" @click="manageAddMenu">
          <i class="iconfont add"></i>
        </button>
        <div v-show="showAddOptions" id="add-options">
          <ul>
            <li v-for="(provider, index) in avaliableProvideres" :key="index">
              <button @click="genBotByProvider(provider)">
                新建 {{ provider }} Bot
              </button>
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
        @contextmenu.prevent="showFriendContextMenu($event, item)"
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
    <ContextMenu
      v-if="showMenu"
      type="friend"
      :message="selectedFriend"
      :style="{
        position: 'fixed',
        left: menuX + 'px',
        top: menuY + 'px',
      }"
      @message-option="handleFriendOption"
      @close="showMenu = false"
    />
  </div>
</template>

<style scoped>
#add-options {
  position: absolute;
  top: 2.5rem;
  background-color: white;
  width: 8rem;
  left: 0;
  border: 0.0625rem solid rgba(161, 154, 154, 0.626);
  border-radius: 0.3125rem;
  z-index: 2;
}
#add-options li {
  display: flex;
  flex-direction: row-reverse;
  padding: 0.1rem 0.5rem;
}
#add-options li:hover {
  background-color: #f5f5f5;
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
  background-color: #fff;
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

.upsidebar {
  justify-content: space-between;
  display: flex;
  flex-direction: row;
  background-color: rgb(255, 255, 255);
  flex: 0 0 4rem;
  align-items: flex-end;
  -webkit-app-region: drag;
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

@media screen and (max-width: 600px) {
  #friendlists {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: none;
  }

  #add-options {
    left: -6rem;
  }
}
</style>
