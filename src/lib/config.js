export default class Config {
  constructor() {
    this.localPresets = [];
    this.openaiDefaultConfig = {
      model: "gpt-4o-mini",
      stream: true,
      temperature: 1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      history: [],
      tools: [],
      enable_tool_call: false,
      opening: "",
      max_messages_num: 10,
    };
    this.openaiTools = [];
    this.onebotDefaultConfig = null;
    this.displayConfig = {};
    this.loadOpenaiTools();
    this._loadStrogeConfig();
  }

  setDisplayConfig(config) {
    this.displayConfig = config;
    localStorage.setItem("display_config", JSON.stringify(config));
  }

  setOpenaiModels(models) {
    this.openaiModels = models;
    this._saveStrogeConfig();
  }

  getOpenaiModels() {
    return this.openaiModels;
  }

  getOpenaiModelOwner(model) {
    const group = this.openaiModels.find((modelGroup) =>
      modelGroup.models.includes(model),
    )
    return group?.owner;
  }

  updateDisplayConfig(patch) {
    this.displayConfig = {
      ...this.displayConfig,
      ...patch,
    };
    localStorage.setItem("display_config", JSON.stringify(this.displayConfig));
  }

  getDisplayConfig() {
    const config = localStorage.getItem("display_config");
    if (config) {
      return JSON.parse(config);
    }
  }

  updateOpenaiDefaultConfig(patch) {
    this.openaiDefaultConfig = {
      ...this.openaiDefaultConfig,
      ...patch,
    };
    this._saveStrogeConfig();
  }

  async loadOpenaiTools() {
    const res = await fetch("/api/openai/tools");
    const data = await res.json();
    this.openaiTools = Object.values(data.data.tools);
    this._saveStrogeConfig();
  }

  async loadOnebotDefaultConfig() {
    const onebotOptionsData = await fetch(`/api/onebot/plugins`);
    const onebotOptionsJson = await onebotOptionsData.json();
    this.onebotDefaultConfig = onebotOptionsJson.data.options;
    this._saveStrogeConfig();
  }

  _loadStrogeConfig() {
    const config = localStorage.getItem("config");
    if (config) {
      Object.assign(this, JSON.parse(config));
    } else {
      this._saveStrogeConfig();
    }
  }

  _saveStrogeConfig() {
    localStorage.setItem("config", JSON.stringify(this));
  }
}
