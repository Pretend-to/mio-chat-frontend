<template>
  <div class="profile-body">
    <div id="profile">
      <div class="profile-container">
        <div class="base-info">
          <div class="base-info-avatar">
            <el-image
              :src="activeContactor.avatar"
              :preview-src-list="[activeContactor.avatar]"
            />
          </div>
          <div class="base-info-content">
            <div class="name">{{ activeContactor.name }}</div>
            <div class="id">ID {{ activeContactor.id }}</div>
            <div class="status">
              <span :class="'delay-status ' + getDelayStatus"></span>
              在线
            </div>
          </div>
        </div>
        <div class="info-blocks">
          <div
            v-if="activeContactor.platform == 'openai'"
            class="openai-settings"
          >
            <div class="block-title">OpenAI 基本配置</div>
            <div class="block-content">
              <div
                v-for="(value, key) in openaiSettings"
                :key="key"
                class="block-content-item"
              >
                <div class="item-title">{{ getShownKey(key) }}</div>
                <div class="item-content">
                  <el-input
                    v-if="['model', 'max_messages_num'].includes(key)"
                    v-model="openaiSettings[key]"
                    @change="updateOpenaiOptions"
                  ></el-input>
                  <el-switch
                    v-else-if="['stream', 'enable_tool_call'].includes(key)"
                    v-model="openaiSettings[key]"
                    @change="updateOpenaiOptions"
                  ></el-switch>
                  <el-slider
                    v-else-if="['temperature'].includes(key)"
                    v-model="openaiSettings[key]"
                    :step="sliderTypeARange[2]"
                    :min="sliderTypeARange[0]"
                    :max="sliderTypeARange[1]"
                    @change="updateOpenaiOptions"
                  />
                  <el-slider
                    v-else-if="['top_p'].includes(key)"
                    v-model="openaiSettings[key]"
                    :step="sliderTypeBRange[2]"
                    :min="sliderTypeBRange[0]"
                    :max="sliderTypeBRange[1]"
                    @change="updateOpenaiOptions"
                  />
                  <el-slider
                    v-else-if="
                      ['frequency_penalty', 'presence_penalty'].includes(key)
                    "
                    v-model="openaiSettings[key]"
                    :step="sliderTypeCRange[2]"
                    :min="sliderTypeCRange[0]"
                    :max="sliderTypeCRange[1]"
                    @change="updateOpenaiOptions"
                  />
                </div>
              </div>
            </div>
            <div class="block-title">OpenAI 预设配置</div>
            <div class="block-content">
              <div class="block-content-item">
                <div class="item-title">预设历史记录</div>
                <div class="item-content">
                  <button
                    :class="{
                      active: showPresetsDetail,
                      'extra-info-button': true,
                    }"
                    @click="showPresetsDetail = !showPresetsDetail"
                  >
                    <svg
                      t="1731677922196"
                      class="icon"
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      p-id="5948"
                      width="16"
                      height="16"
                    >
                      <path
                        d="M778.965749 128.759549l-383.064442 383.063419 388.097062 388.096039-0.070608 0.033769c12.709463 13.137205 20.529569 31.024597 20.529569 50.731428 0 40.376593-32.736589 73.112158-73.115228 73.112158-19.705807 0-37.591153-7.819083-50.730405-20.528546l-0.034792 0.035816L241.890654 564.622498l0.035816-0.035816c-13.779841-13.281491-22.3838-31.915897-22.3838-52.585659 0-0.071631 0-0.106424 0-0.178055 0-0.072655 0-0.10847 0-0.144286 0-20.669762 8.603959-39.341007 22.3838-52.622498l-0.035816-0.034792L680.573835 20.337187l0.180102 0.179079c13.139252-12.5662 30.950919-20.313651 50.587142-20.313651 40.378639 0 73.115228 32.736589 73.115228 73.114205C804.455283 95.485725 794.567076 115.334795 778.965749 128.759549z"
                        p-id="5949"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div
                :class="{
                  hidden: !showPresetsDetail,
                  'block-content-item': true,
                }"
              >
                <PresetsList
                  :presets-history="presetHistory"
                  @update-presets="updateOpenaiPresets"
                />
              </div>
            </div>
            <div class="block-title">OpenAI 工具配置</div>
            <div class="block-content">
              <div class="block-content-item">
                <div class="item-title">工具函数列表</div>
                <div class="item-content">
                  <button
                    :class="{
                      active: showToolsDetail,
                      'extra-info-button': true,
                    }"
                    @click="showToolsDetail = !showToolsDetail"
                  >
                    <svg
                      t="1731677922196"
                      class="icon"
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      p-id="5948"
                      width="16"
                      height="16"
                    >
                      <path
                        d="M778.965749 128.759549l-383.064442 383.063419 388.097062 388.096039-0.070608 0.033769c12.709463 13.137205 20.529569 31.024597 20.529569 50.731428 0 40.376593-32.736589 73.112158-73.115228 73.112158-19.705807 0-37.591153-7.819083-50.730405-20.528546l-0.034792 0.035816L241.890654 564.622498l0.035816-0.035816c-13.779841-13.281491-22.3838-31.915897-22.3838-52.585659 0-0.071631 0-0.106424 0-0.178055 0-0.072655 0-0.10847 0-0.144286 0-20.669762 8.603959-39.341007 22.3838-52.622498l-0.035816-0.034792L680.573835 20.337187l0.180102 0.179079c13.139252-12.5662 30.950919-20.313651 50.587142-20.313651 40.378639 0 73.115228 32.736589 73.115228 73.114205C804.455283 95.485725 794.567076 115.334795 778.965749 128.759549z"
                        p-id="5949"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div
                :class="{
                  hidden: !showToolsDetail,
                  'block-content-item': true,
                }"
              >
                <ul id="tools-list">
                  <li
                    v-for="(tool, index) in toolsList"
                    :key="index"
                    class="block-content-item"
                    :title="tool.description"
                  >
                    <div class="item-title">{{ tool.name }}</div>
                    <div class="item-content">
                      <el-switch
                        v-model="tool.enabled"
                        @change="handleToolConfig"
                      ></el-switch>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div class="extra-info"></div>
      </div>
    </div>
    <div class="action-bar">
      <el-button plain @click="$router.push(`/chat/${activeContactor.id}`)"
        >发送消息</el-button
      >
      <el-button type="danger" plain @click="centerDialogVisible = true"
        >删除好友</el-button
      >
      <el-dialog v-model="centerDialogVisible" title="警告" width="300" center>
        <span> 确认要删除此好友吗？该操作不可逆。 </span>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="centerDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="delContactor"> 确认 </el-button>
          </div>
        </template>
      </el-dialog>
    </div>
  </div>
</template>
<script>
import { client, config } from "@/lib/runtime.js";
import PresetsList from "@/components/PresetsList.vue";

export default {
  components: {
    PresetsList,
  },
  data() {
    const currentId = parseInt(this.$route.params.id);
    const contactor = client.getContactor(currentId);

    return {
      activeContactor: contactor,
      openaiSettings: this.getShownOpenAISettings(contactor.options),
      currentDelay: 0,
      centerDialogVisible: false,
      sliderTypeARange: [0, 2, 0.1],
      sliderTypeBRange: [0, 1, 0.1],
      sliderTypeCRange: [-2, 2, 0.1],
      showPresetsDetail: false,
      showToolsDetail: false,
      presetHistory: contactor.options.history,
      llmTools: config.llmTools,
      toolsList: [],
    };
  },
  computed: {
    getDelayStatus() {
      return this.currentDelay > 1000
        ? "high"
        : this.currentDelay > 500
          ? "mid"
          : this.currentDelay > 100
            ? "low"
            : "ultra";
    },
  },
  watch: {
    "$route.params.id"(newVal) {
      this.activeContactor = client.getContactor(newVal);
      this.initContactor();
    },
  },
  mounted() {
    this.initContactor();

    setInterval(() => {
      this.currentDelay = client.socket.delay;
    }, 3000);
  },
  methods: {
    handleToolConfig() {
      this.activeContactor.options.tools = this.toolsList
        .filter((tool) => tool.enabled)
        .map((tool) => tool.name);
      client.setLocalStorage(); //持久化存储
    },
    initContactor() {
      if (this.activeContactor.platform == "openai") {
        this.openaiSettings = this.getShownOpenAISettings(
          this.activeContactor.options,
        );
        this.presetHistory = this.activeContactor.options.history;
        this.loadToolsList();
      }
    },
    loadToolsList() {
      const enabledTools = this.activeContactor.options.tools;
      this.toolsList = this.llmTools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          enabled: enabledTools.includes(tool.name),
        };
      });
    },
    async updateOpenaiPresets(presets) {
      this.activeContactor.options.history = presets;
      await client.setLocalStorage(); //持久化存储
      this.$message({
        message: "预设历史记录已更新",
        type: "success",
      });
    },
    updateOpenaiOptions() {
      this.activeContactor.options = {
        ...this.activeContactor.options,
        ...this.openaiSettings,
      };
      client.setLocalStorage(); //持久化存储
    },
    getShownOpenAISettings(options) {
      const shownKeys = [
        "model",
        "max_messages_num",
        "stream",
        "enable_tool_call",
        "temperature",
        "top_p",
        "frequency_penalty",
        "presence_penalty",
      ];
      const shownSettings = {};
      shownKeys.map((key) => {
        shownSettings[key] = options[key];
      });
      return shownSettings;
    },
    getShownKey(key) {
      const shownNameMap = {
        enable_tool_call: "工具调用",
        model: "模型",
        max_messages_num: "最大历史消息数",
        stream: "流式响应",
        temperature: "温度",
        top_p: "核采样",
        frequency_penalty: "重复惩罚度",
        presence_penalty: "话题新鲜度",
      };
      return shownNameMap[key];
    },
    async delContactor() {
      this.centerDialogVisible = false;
      await client.rmContactor(this.activeContactor.id);
      this.$router.push("/");
    },
  },
};
</script>

<style scoped>
#profile {
  position: relative;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
}

#tools-list {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.item-extra-content {
  width: 100%;
  max-height: 0px;
}

.block-content-item.hidden {
  min-height: 0px;
  max-height: 0px;
}

.extra-info-button.active {
  transform: rotate(-90deg);
}

.item-content button {
  background-color: transparent;
  transition: transform 0.3s ease;
}

.profile-container {
  margin: 2rem 0rem 0rem 0rem;
  width: calc(100% - 8rem);
  min-width: 20rem;
  max-width: 30rem;
  display: flex;
  flex-direction: column;
}

.profile-container > * {
  width: 100%;
  flex-basis: 1rem;
}

.base-info {
  /* border: 1px solid #000000; */
  background-color: #fff;
  border-radius: 0.5rem;
  display: flex;
  padding-bottom: 1rem;
  border-bottom: 1px solid #88888888;
}

.base-info-avatar {
  margin-top: 1rem;
  margin-left: 1rem;
  flex-basis: 5.5rem;
  height: 5.5rem;
}

.base-info-avatar .el-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.block-title {
  font-size: 0.8rem;
}

.block-content {
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  width: 100%;
  display: flex;
  background-color: #fff;
  min-height: 1rem;
  border-radius: 0.5rem;
  flex-direction: column;
}

.block-content:last-child {
  margin-bottom: 2rem;
}

.block-content-item {
  max-height: 50rem;
  overflow-y: auto;
  transition: max-height 0.5s ease;
  position: relative;
  display: flex;
  width: 100%;
  justify-content: space-between;
  min-height: 2.5rem;
  flex-wrap: wrap;
}

.block-content-item::after {
  content: "";
  /* 必须要有 content 属性 */
  position: absolute;
  bottom: 0;
  /* 定位到元素底部 */
  left: 5%;
  /* 距离左边的长度，可以根据需要调整 */
  width: 90%;
  /* 短一些的边框长度 */
  height: 1px;
  /* 边框的高度 */
  background-color: rgba(145, 145, 145, 0.155);
  /* 边框的颜色 */
}

.item-title {
  font-size: 0.8rem;
  margin-left: 1rem;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.item-content {
  transform: scale(0.9);
  flex-basis: 10rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-right: 1.5rem;
}

.base-info-content {
  margin-left: 1.5rem;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
}

.base-info-content .name {
  font-size: 1.25rem;
}

.base-info-content .id {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: dimgrey;
}

.base-info-content .status {
  margin-top: 0.25rem;
}

.info-blocks > * {
  margin-top: 1rem;
}

.info-blocks {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.action-bar {
  position: relative;
  background-color: #f2f2f2;
  bottom: 0px;
  left: 0px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 6rem;
  width: 100%;
  z-index: 2;
}
.profile-body {
  position: relative;
  overflow-y: auto;
  flex-grow: 1;
  padding-top: 4rem;
  background-color: #f2f2f2;
}
</style>
<style scoped lang="sass">
.delay-status
    display: inline-block
    width: 1rem
    height: 1rem
    border-radius: 50%
    transform: translateY(.25rem)
    margin-right: .25rem

    &:hover + .delay-num
        display: inline-block

    &.ultra
        background-color: rgb(53, 233, 146)

    &.low
        background-color: rgb(255, 204, 0)

    &.mid
        background-color: rgb(255, 102, 102)

    &.high
        background-color: #ccc
</style>
