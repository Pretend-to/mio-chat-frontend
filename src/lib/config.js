const TOOL_CALL_MODEDS = {
  AUTO: "AUTO",
  ANY: "ANY",
  NONE: "NONE",
};
const GEMINI_SAFETY_BLOCK_SETTINGS = {
  NONE: "BLOCK_NONE",
  LOW: "BLOCK_ONLY_HIGH",
  MEDIUM: "BLOCK_MEDIUM_AND_ABOVE",
  HIGH: "BLOCK_LOW_AND_ABOVE",
  DEFAULT: "BLOCK_NONE",
};
const GEMINI_SAFETY_SETTINGS_TYPE = {
  HARASSMENT: "HARM_CATEGORY_HARASSMENT",
  HATE_SPEECH: "HARM_CATEGORY_HATE_SPEECH",
  SEXUALLY_EXPLICIT: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  DANGEROUS_CONTENT: "HARM_CATEGORY_DANGEROUS_CONTENT",
  CIVIC_INTEGRITY: "HARM_CATEGORY_CIVIC_INTEGRITY",
};

const CONFIG_KEY = "config";

export default class Config {
  constructor() {
    this.localPresets = [];
    this.toolsConfig = {};
    this.llmTools = [];
    this.onebotConfig = null;
    this.llmModels = []; // 初始化 llmModels
    this.safetyConfig = {};
    this.baseConfig = {};
    this.LLMDefaultConfig = {};

    this._loadStrogeConfig();

    this.initLLMDefaultConfig();
    this.loadllmTools();
    this.loadonebotConfig();
  }

  // 统一设置 localStorage
  _setLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // 统一获取 localStorage
  _getLocalStorage(key) {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : null;
  }

  // 统一保存所有配置
  _saveStrogeConfig() {
    // debugger;
    const configToSave = {
      localPresets: this.localPresets,
      toolsConfig: this.toolsConfig,
      llmTools: this.llmTools,
      onebotConfig: this.onebotConfig,
      llmModels: this.llmModels,
      baseConfig: this.baseConfig,
      safetyConfig: this.safetyConfig,
      LLMDefaultConfig: this.LLMDefaultConfig,
    };
    this._setLocalStorage(CONFIG_KEY, configToSave);
  }

  // 统一加载所有配置
  _loadStrogeConfig() {
    const config = this._getLocalStorage(CONFIG_KEY);
    if (config) {
      Object.assign(this, config);
    } else {
      this._saveStrogeConfig();
    }
  }

  getLLMProviders() {
    return this.baseConfig.llm_providers.map((provider) => ({
      value: provider,
      label: provider,
    }));
  }

  // Display Config
  setBaseConfig(config) {
    this.baseConfig = config;
    this._saveStrogeConfig();

    const { llm_providers, default_model } = config;

    const defaultProvider = llm_providers.slice(-1)[0];

    this.updateLLMDefaultConfig(null, {
      provider: defaultProvider,
    });

    // 设定一下默认的模型
    this.updateLLMDefaultConfig("base", {
      model: default_model[defaultProvider],
    });
  }

  updateBaseConfig(patch) {
    this.baseConfig = {
      ...this.displayConfig,
      ...patch,
    };
    this._saveStrogeConfig();
  }

  getToolCallModes() {
    const values = Object.values(TOOL_CALL_MODEDS);
    return values.map((value) => ({
      value,
      label: value,
    }));
  }

  getBaseConfig() {
    return this.baseConfig;
  }

  getDefaultModel(provider) {
    return this.baseConfig.default_model[provider];
  }

  // Llm Models
  setLlmModels(models) {
    this.llmModels = models;
    this._saveStrogeConfig(); // 保存到总配置
  }

  getLlmModels(provider) {
    return this.llmModels[provider];
  }

  getDefaultLLMModel() {
    return this.baseConfig.default_model;
  }

  getSafetySettingsParams() {
    return GEMINI_SAFETY_BLOCK_SETTINGS;
  }

  isModelAvailable(provider, model) {
    const group = this.llmModels[provider].find((modelGroup) =>
      modelGroup.models.includes(model),
    );
    return group !== undefined;
  }

  // Llm Models
  getModelOwner(model) {
    for (const provider in this.llmModels) {
      const group = this.llmModels[provider].find((modelGroup) =>
        modelGroup.models.includes(model),
      );
      if (group) return group.owner;
    }
    return undefined;
  }

  // Safety Config
  initSafetyConfig() {
    const init = () => {
      // 初始化 safetyConfig
      this.safetyConfig = {};
      for (const key in GEMINI_SAFETY_SETTINGS_TYPE) {
        this.safetyConfig[GEMINI_SAFETY_SETTINGS_TYPE[key]] =
          GEMINI_SAFETY_BLOCK_SETTINGS.DEFAULT;
      }
    };
    if (Object.keys(this.safetyConfig).length === 0) {
      init();
    } else {
      const hasIncrorectKeys = Object.keys(this.safetyConfig).some(
        (key) => !Object.keys(GEMINI_SAFETY_SETTINGS_TYPE).includes(key),
      );
      const hasIncrorectValues = Object.values(this.safetyConfig).some(
        (value) => !Object.values(GEMINI_SAFETY_BLOCK_SETTINGS).includes(value),
      );
      if (hasIncrorectKeys || hasIncrorectValues) {
        init();
        // 更新 llmDefaultConfig 中的 safetySettings
        this.LLMDefaultConfig.safetySettings = {
          ...this.safetyConfig,
        };
      }
    }
    debugger;
  }

  setSafetyConfig(safetyConfig) {
    // 新增：手动设置 safetyConfig 并保存
    this.safetyConfig = safetyConfig;
    this._saveStrogeConfig();
  }

  getSafetyConfig() {
    // 新增：获取 safetyConfig
    return this.safetyConfig;
  }

  // OpenAI Default Config
  initLLMDefaultConfig() {
    this.initSafetyConfig();
    if (Object.keys(this.LLMDefaultConfig).length === 0) {
      this.LLMDefaultConfig = {
        provider: "openai",
        base: {
          model: "gpt-4o-mini",
          max_messages_num: 10,
          stream: true,
        },
        chatParams: {
          temperature: 1,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        },
        toolCallSettings: {
          mode: TOOL_CALL_MODEDS.AUTO,
          tools: [],
        },
        presetSettings: {
          opening: "",
          history: [],
        },
        safetySettings: {
          ...this.safetyConfig, //  使用当前的 safetyConfig
        },
      };
    }
  }

  updateLLMDefaultConfig(type, patch) {
    if (type) {
      this.LLMDefaultConfig[type] = {
        ...this.LLMDefaultConfig[type],
        ...patch,
      };
    } else {
      this.LLMDefaultConfig = {
        ...this.LLMDefaultConfig,
        ...patch,
      };
    }

    this._saveStrogeConfig();
  }

  getLLMDefaultConfig() {
    return JSON.parse(JSON.stringify(this.LLMDefaultConfig));
  }

  // llm Tools
  async loadllmTools() {
    const res = await fetch("/api/openai/tools");
    const data = await res.json();
    this.llmTools = Object.values(data.data.tools);
    this._saveStrogeConfig();
  }

  // OneBot Config
  async loadonebotConfig() {
    const onebotOptionsData = await fetch(`/api/onebot/plugins`);
    const onebotOptionsJson = await onebotOptionsData.json();
    this.onebotConfig = onebotOptionsJson.data.options;
    this._saveStrogeConfig();
  }
}
