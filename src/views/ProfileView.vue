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
          <div
            v-if="activeContactor.platform === 'openai'"
            class="base-info-provider"
          >
            <el-select
              v-model="llmProvider"
              style="width: 10rem"
              @change="switchLLMProvider"
            >
              <el-option
                v-for="item in llmProviders"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
        </div>
        <div class="info-blocks">
          <div
            v-if="activeContactor.platform == 'openai'"
            class="openai-settings"
          >
            <div class="settings-block">
              <div class="block-title">LLM 基本配置</div>
              <div class="block-content">
                <div
                  v-for="(_, key) in llmGeneralKeys"
                  :key="key"
                  class="block-content-item"
                >
                  <div class="item-title">{{ getShownKey(key) }}</div>
                  <div class="item-content">
                    <el-input
                      v-if="['model', 'max_messages_num'].includes(key)"
                      v-model="llmGeneralKeys[key]"
                    ></el-input>
                    <el-switch
                      v-else-if="['stream'].includes(key)"
                      v-model="llmGeneralKeys[key]"
                    ></el-switch>
                    <el-slider
                      v-else-if="['temperature'].includes(key)"
                      v-model="llmGeneralKeys[key]"
                      :step="sliderTypeARange[2]"
                      :min="sliderTypeARange[0]"
                      :max="sliderTypeARange[1]"
                    />
                    <el-slider
                      v-else-if="['top_p'].includes(key)"
                      v-model="llmGeneralKeys[key]"
                      :step="sliderTypeBRange[2]"
                      :min="sliderTypeBRange[0]"
                      :max="sliderTypeBRange[1]"
                    />
                    <el-slider
                      v-else-if="
                        ['frequency_penalty', 'presence_penalty'].includes(key)
                      "
                      v-model="llmGeneralKeys[key]"
                      :step="sliderTypeCRange[2]"
                      :min="sliderTypeCRange[0]"
                      :max="sliderTypeCRange[1]"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div class="settings-block">
              <div class="block-title">LLM 预设配置</div>
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
                      <i class="iconfont icon-return"></i>
                    </button>
                  </div>
                </div>
                <transition name="expand-slide">
                  <div
                    v-show="showPresetsDetail"
                    class="block-content-item"
                    style="overflow: hidden"
                  >
                    <PresetsList
                      :presets-history="presetHistory"
                      @update-presets="updateOpenaiPresets"
                    />
                  </div>
                </transition>
              </div>
            </div>

            <div class="settings-block">
              <div class="block-title">LLM 工具调用配置</div>
              <div class="block-content">
                <div class="block-content-item">
                  <div class="item-title">工具调用模式</div>
                  <div class="item-content">
                    <el-select
                      v-model="llmToolCallMode"
                      placeholder="AUTO"
                      style="width: 10rem"
                      @change="switchToolCallMode"
                    >
                      <el-option
                        v-for="item in toolCallModes"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </div>
                </div>
                <div
                  v-for="(plugin, index) in allLLMTools"
                  :key="index"
                  class="block-content-item parent-item"
                >
                  <div class="item-title">{{ plugin.name }}</div>
                  <div class="item-content">
                    <button
                      :class="{
                        active: !plugin.collapsed,
                        'extra-info-button': true,
                      }"
                      @click="plugin.collapsed = !plugin.collapsed"
                    >
                      <i class="iconfont icon-return"></i>
                    </button>
                  </div>
                  <transition name="expand-slide">
                    <div
                      v-show="!plugin.collapsed"
                      class="item-hidden-content plugin-tools-container"
                    >
                      <div
                        v-for="(tool, toolIndex) in plugin.tools"
                        :key="toolIndex"
                        class="block-content-item child-item"
                        :title="tool.description"
                      >
                        <div class="item-title">
                          {{ tool.name.split("-_-")[0] }}
                        </div>
                        <div class="item-content">
                          <el-switch
                            v-model="tool.enabled"
                            @change="handleToolConfig"
                          ></el-switch>
                        </div>
                      </div>
                    </div>
                  </transition>
                </div>
              </div>
            </div>

            <div
              v-if="['gemini', 'vertex'].includes(llmProvider)"
              class="settings-block"
            >
              <div class="block-title">Gimini 额外设置</div>
              <div class="block-content">
                <div class="block-content-item">
                  <div class="item-title">过滤等级设置</div>
                  <div class="item-content">
                    <button
                      :class="{
                        active: showSafetySettings,
                        'extra-info-button': true,
                      }"
                      @click="showSafetySettings = !showSafetySettings"
                    >
                      <i class="iconfont icon-return"></i>
                    </button>
                  </div>
                </div>
                <div
                  :class="{
                    hidden: !showSafetySettings,
                    'block-content-item': true,
                  }"
                >
                  <ul id="safety-settings" class="sub-items">
                    <li
                      v-for="(value, key) of geminiSafetySettings"
                      :key="key"
                      class="block-content-item"
                    >
                      <div class="item-title">{{ getShownKey(key) }}</div>
                      <div class="item-content">
                        <el-select
                          v-model="geminiSafetySettings[key]"
                          style="width: 10rem"
                          @change="switchSafetySettings(key)"
                        >
                          <el-option
                            v-for="item in safetySimpleValue"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                          />
                        </el-select>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
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
    const options = JSON.parse(JSON.stringify(contactor.options));
    const toolCallModes = config.getToolCallModes();
    const providers = config.getLLMProviders();
    const safetyParams = config.getSafetySettingsParams();

    const safetySimpleValue = Object.keys(safetyParams).map((key) => ({
      value: key,
      label: key,
    }));

    const allLLMTools = [];
    for (const key in config.llmTools) {
      const toolsObject = config.llmTools[key];
      const toolsList = Object.keys(toolsObject).map((toolKey) => ({
        enabled: false,
        ...toolsObject[toolKey],
      }));
      allLLMTools.push({
        name: key,
        tools: toolsList,
        collapsed: true,
      });
    }

    return {
      safetyParams,
      geminiSafetySettings: {},
      safetySimpleValue: safetySimpleValue,
      llmProviders: providers,
      toolCallModes: toolCallModes,
      currentDelay: 0,
      activeContactor: contactor,
      options: options,
      llmProvider: options.provider,
      llmBaseSettings: options.base,
      llmChatParams: options.chatParams,
      llmToolCallMode: options.toolCallSettings?.mode,
      llmToolCallList: options.toolCallSettings?.tools,
      sliderTypeARange: [0, 2, 0.1],
      sliderTypeBRange: [0, 1, 0.1],
      sliderTypeCRange: [-2, 2, 0.1],
      showSafetySettings: false,
      showPresetsDetail: false,
      showToolsDetail: false,
      presetHistory: options.presetSettings?.history,
      allLLMTools: allLLMTools,
      llmGeneralKeys: {},
      centerDialogVisible: false,
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
    llmGeneralKeys: {
      handler() {
        console.log("update");
        this.setGeneralSettings();
      },
      deep: true,
    },
  },
  beforeMount() {
    this.loadToolsList();
    this.loadGeneralSettings();
  },
  mounted() {
    this.initContactor();

    setInterval(() => {
      this.currentDelay = client.socket.delay;
    }, 3000);
  },
  methods: {
    loadGeneralSettings() {
      this.llmGeneralKeys = {
        ...this.llmBaseSettings,
        ...this.llmChatParams,
      };
    },
    safeSimplify(raw) {
      const result = {};
      const simplifyMethod = new Map();
      const table = config.getSafetySettingsParams();
      Object.keys(table).forEach((key) => {
        simplifyMethod.set(table[key], key);
      });

      Object.keys(raw).forEach((key) => {
        result[key] = simplifyMethod.get(raw[key]);
      });

      return result;
    },
    setGeneralSettings() {
      const {
        model,
        stream,
        max_messages_num,
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
      } = this.llmGeneralKeys;
      this.activeContactor.options.base = {
        model,
        stream,
        max_messages_num,
      };
      this.activeContactor.options.chatParams = {
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
      };
      // 持久化
      client.setLocalStorage();
    },
    switchSafetySettings(key) {
      const simplifiedValue = this.geminiSafetySettings[key];
      const originalValue = this.safetyParams[simplifiedValue];
      this.activeContactor.options.safetySettings[key] = originalValue;
      client.setLocalStorage(); //持久化存储
    },
    handleToolConfig() {
      const adcivedTools = this.allLLMTools
        .filter((plugin) => plugin.tools.some((tool) => tool.enabled))
        .map((plugin) =>
          plugin.tools.filter((tool) => tool.enabled).map((tool) => tool.name),
        )
        .flat();
      this.activeContactor.options.toolCallSettings.tools = adcivedTools;
      client.setLocalStorage(); //持久化存储
    },
    initContactor() {
      // 更新所有配置，不仅仅是openai平台
      this.options = JSON.parse(JSON.stringify(this.activeContactor.options));
      this.llmProvider = this.options.provider;
      this.llmBaseSettings = this.options.base;
      this.llmChatParams = this.options.chatParams;
      this.llmToolCallMode = this.options.toolCallSettings?.mode;
      this.llmToolCallList = this.options.toolCallSettings?.tools;
      this.presetHistory = this.options.presetSettings?.history;

      if (this.options.provider === "gemini") {
        this.geminiSafetySettings = this.safeSimplify(
          this.options.safetySettings,
        );
      }
      if (this.activeContactor.platform === "openai") {
        this.loadGeneralSettings();
        this.loadToolsList();
      }
    },
    loadToolsList() {
      const enabledTools = this.llmToolCallList;
      this.allLLMTools = this.allLLMTools.map((plugin) => {
        plugin.tools = plugin.tools.map((tool) => {
          tool.enabled = enabledTools.includes(tool.name);
          return tool;
        });
        return plugin;
      });
    },
    updateOpenaiPresets(presets) {
      this.activeContactor.options.presetSettings.history = presets;
      this.$message({
        message: "预设历史记录已更新",
        type: "success",
      });
      client.setLocalStorage(); //持久化存储
    },
    getShownKey(key) {
      const shownNameMap = {
        mode: "工具调用",
        model: "模型",
        max_messages_num: "最大历史消息数",
        stream: "流式响应",
        temperature: "温度",
        top_p: "核采样",
        frequency_penalty: "重复惩罚度",
        presence_penalty: "话题新鲜度",
        HARM_CATEGORY_HARASSMENT: "骚扰",
        HARM_CATEGORY_HATE_SPEECH: "仇恨言论",
        HARM_CATEGORY_SEXUALLY_EXPLICIT: "色情",
        HARM_CATEGORY_DANGEROUS_CONTENT: "危险内容",
        HARM_CATEGORY_CIVIC_INTEGRITY: "公民诚信",
      };
      return shownNameMap[key];
    },
    async delContactor() {
      this.centerDialogVisible = false;
      await client.rmContactor(this.activeContactor.id);
      this.$router.push("/");
    },
    switchToolCallMode() {
      this.activeContactor.options.toolCallSettings.mode = this.llmToolCallMode;
      client.setLocalStorage(); //持久化存储
    },
    switchLLMProvider() {
      const model = config.getDefaultModel(this.llmProvider);
      this.llmGeneralKeys.model = model;

      this.activeContactor.options.provider = this.llmProvider;

      this.setGeneralSettings();

      this.activeContactor.loadAvatar();
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
.sub-items {
  width: 100%;
  display: flex;
  flex-direction: column;
}
.base-info-provider {
  flex-grow: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-right: 2rem;
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
  overflow-y: auto;
  margin: 2rem 0rem 0rem 0rem;
  width: calc(100% - 8rem);
  min-width: 20rem;
  max-width: 40rem;
  display: flex;
  flex-direction: column;
}
.base-info {
  background-color: #fff;
  border-radius: 0.5rem;
  display: flex;
  padding-bottom: 1rem;
  border-bottom: 1px solid #88888888;
  flex-wrap: wrap;
  margin-bottom: 2rem;
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
  flex-wrap: nowrap;
}
.block-content-item.parent-item {
  flex-wrap: wrap;
}
.child-item {
  width: calc(100% - 1rem);
  padding-left: 1rem;
}
.item-hidden-content {
  width: 100%;
}
.plugin-tools-container {
  max-height: 20rem; /* 限制最大高度，具体值可调 */
  overflow-y: auto; /* 超出时显示垂直滚动条 */
  -webkit-overflow-scrolling: touch; /* iOS 滚动优化 */
}
.block-content-item::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 5%;
  width: 90%;
  height: 1px;
  background-color: rgba(145, 145, 145, 0.155);
}
.item-title {
  font-size: 0.8rem;
  margin-left: 1rem;
  height: 2.5rem;
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: flex-start;
  max-width: calc(100% - 5rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-content {
  transform: scale(0.9);
  flex-basis: 2rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-right: 1.5rem;
}

.el-input,
.el-slider,
.el-select {
  width: 10rem;
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
  background-color: #f2f2f2;
}

/* 自定义动画 */
.expand-slide-enter-active,
.expand-slide-leave-active {
  transition:
    max-height 0.4s cubic-bezier(0.78, 0.14, 0.15, 0.86),
    opacity 0.4s;
}
.expand-slide-enter-from,
.expand-slide-leave-to {
  max-height: 0;
  opacity: 0;
}
.expand-slide-enter-to,
.expand-slide-leave-from {
  max-height: 20rem;
  opacity: 1;
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
