// =============================================================
// 常量定义
// =============================================================

// 工具调用模式
const TOOL_CALL_MODEDS = {
  AUTO: "AUTO", // 自动模式，由模型决定是否调用工具
  ANY: "ANY", // 任意模式，强制模型必须调用一个或多个工具
  NONE: "NONE", // 无模式，强制模型不调用任何工具
};

// Gemini 安全设置 - 阻止阈值
const GEMINI_SAFETY_BLOCK_SETTINGS = {
  NONE: "BLOCK_NONE", // 不阻止
  LOW: "BLOCK_ONLY_HIGH", // 仅阻止高可能性内容
  MEDIUM: "BLOCK_MEDIUM_AND_ABOVE", // 阻止中等及以上可能性内容
  HIGH: "BLOCK_LOW_AND_ABOVE", // 阻止低等及以上可能性内容 (最严格)
  DEFAULT: "BLOCK_NONE", // 默认设置为不阻止
};

// Gemini 安全设置 - 危害类别
const GEMINI_SAFETY_SETTINGS_TYPE = {
  HARASSMENT: "HARM_CATEGORY_HARASSMENT", // 骚扰
  HATE_SPEECH: "HARM_CATEGORY_HATE_SPEECH", // 仇恨言论
  SEXUALLY_EXPLICIT: "HARM_CATEGORY_SEXUALLY_EXPLICIT", // 色情内容
  DANGEROUS_CONTENT: "HARM_CATEGORY_DANGEROUS_CONTENT", // 危险内容
  // CIVIC_INTEGRITY: "HARM_CATEGORY_CIVIC_INTEGRITY", // 如果需要，可以取消注释
};

// localStorage 中存储配置的主键
const CONFIG_KEY = "app_config_v1"; // 建议使用带版本号的键名

// =============================================================
// Config 类定义
// =============================================================

export default class Config {
  constructor() {
    // --- 初始化实例属性 ---
    this.localPresets = []; // 本地预设列表
    this.toolsConfig = {}; // 工具特定配置 (如果需要)
    this.llmTools = []; // 从后端加载的可用 LLM 工具列表/结构
    this.onebotConfig = null; // OneBot 相关配置
    this.llmModels = {}; // 按 provider 分类的可用 LLM 模型列表 { provider: [{ group, owner, models }], ... }
    this.safetyConfig = {}; // 当前的安全设置状态 (可能用于UI显示或其他直接访问)
    this.baseConfig = {}; // 基础配置，如 API Keys, providers 列表等
    this.LLMDefaultConfig = {}; // 核心：存储合并后的默认 LLM 配置，会包含用户设置
    this.baseConfigCallback = null; // baseConfig 变更时的回调函数

    // --- 初始化流程 ---
    // 1. 尝试从 localStorage 加载现有配置
    this._loadStrogeConfig();

    // 2. 初始化/验证安全设置状态 (简化版)
    this.initSafetyConfig();

    // 3. 初始化 LLM 默认配置 (核心：合并逻辑)
    this.initLLMDefaultConfig();

    // 4. 异步加载外部数据 (如可用工具、OneBot 插件等)
    //    添加了错误捕获，防止加载失败影响主流程
    this.loadllmTools().catch((error) =>
      console.error("加载 LLM 工具失败:", error)
    );
    this.loadonebotConfig().catch((error) =>
      console.error("加载 OneBot 配置失败:", error)
    );

    // 5. 如果是首次运行 (未从 localStorage 加载到配置), 则保存初始配置
    if (!this._getLocalStorage(CONFIG_KEY)) {
      console.log("未找到本地存储配置，保存初始默认配置。");
      this._saveStrogeConfig();
    }
  }

  // --- 内部辅助方法：LocalStorage 操作 ---

  /**
   * 统一设置 localStorage
   * @param {string} key - 存储键名
   * @param {any} data - 需要存储的数据
   */
  _setLocalStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`保存到 localStorage 时出错 (Key: ${key}):`, error);
      // 可以考虑添加更复杂的错误处理，例如提示用户存储空间不足
    }
  }

  /**
   * 统一获取 localStorage
   * @param {string} key - 读取键名
   * @returns {any | null} - 解析后的数据，如果不存在或解析失败则返回 null
   */
  _getLocalStorage(key) {
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue === null || storedValue === undefined) {
        return null;
      }
      return JSON.parse(storedValue);
    } catch (error) {
      console.error(`从 localStorage 读取或解析时出错 (Key: ${key}):`, error);
      // 清除可能已损坏的数据
      localStorage.removeItem(key);
      return null;
    }
  }

  // --- 内部辅助方法：集中保存和加载配置 ---

  /**
   * 将当前实例的所有配置状态保存到 localStorage
   */
  _saveStrogeConfig() {
    const configToSave = {
      localPresets: this.localPresets,
      toolsConfig: this.toolsConfig,
      llmTools: this.llmTools, // 注意：频繁保存从API获取的数据可能不是最佳实践，取决于更新频率
      onebotConfig: this.onebotConfig,
      llmModels: this.llmModels,
      baseConfig: this.baseConfig,
      safetyConfig: this.safetyConfig, // 保存当前的安全设置状态
      LLMDefaultConfig: this.LLMDefaultConfig, // 保存包含用户设置的默认配置
    };
    this._setLocalStorage(CONFIG_KEY, configToSave);
    console.log("配置已保存到 localStorage。");
  }

  /**
   * 从 localStorage 加载配置并应用到当前实例
   */
  _loadStrogeConfig() {
    const loadedConfig = this._getLocalStorage(CONFIG_KEY);
    if (loadedConfig) {
      console.log("从 localStorage 加载配置:", loadedConfig);
      // 使用 nullish coalescing (??) 为缺失的属性提供默认值
      this.localPresets = loadedConfig.localPresets ?? [];
      this.toolsConfig = loadedConfig.toolsConfig ?? {};
      this.llmTools = loadedConfig.llmTools ?? [];
      this.onebotConfig = loadedConfig.onebotConfig ?? null;
      this.llmModels = loadedConfig.llmModels ?? {};
      this.baseConfig = loadedConfig.baseConfig ?? {};
      this.safetyConfig = loadedConfig.safetyConfig ?? {}; // 加载保存的安全状态
      this.LLMDefaultConfig = loadedConfig.LLMDefaultConfig ?? {}; // 加载保存的LLM配置
    } else {
      console.log("未在 localStorage 中找到配置，将使用初始默认值。");
      // 初始默认值在构造函数和初始化方法中设置
    }
  }

  // --- 内部辅助方法：递归合并默认配置 ---
  /**
   * 递归地将默认属性合并到目标对象中，并删除目标对象中不存在于默认对象的属性。
   * 仅当目标对象缺少某个键时，才会从默认对象添加该键及其值。
   * 不会覆盖目标对象中已存在的属性值。
   * 能正确处理嵌套对象。
   * 会删除目标对象中存在但默认对象中不存在的属性。
   * @param {object} target - 需要合并默认值的目标对象 (例如 this.LLMDefaultConfig)
   * @param {object} defaults - 包含默认值的源对象
   * @returns {object} - 修改后的目标对象
   */
  _mergeDefaultsRecursive(target, defaults) {
    if (
      !target ||
      typeof target !== "object" ||
      !defaults ||
      typeof defaults !== "object"
    ) {
      console.warn("递归合并需要有效的 target 和 defaults 对象。");
      return target; // 如果输入无效，返回原始 target
    }

    // 第一步：删除目标对象中存在但默认对象中不存在的属性
    for (const key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        // 如果默认对象中不存在该键，则删除
        if (!(key in defaults)) {
          delete target[key];
        }
      }
    }

    // 第二步：按照原逻辑合并默认值
    for (const key in defaults) {
      // 确保 key 是 defaults 自身的属性，而不是继承来的
      if (Object.prototype.hasOwnProperty.call(defaults, key)) {
        const defaultValue = defaults[key];
        const targetValue = target[key];

        // 情况 1: 目标对象中不存在该键
        if (!(key in target)) {
          if (
            typeof defaultValue === "object" &&
            defaultValue !== null &&
            !Array.isArray(defaultValue)
          ) {
            // 如果默认值是对象，进行深拷贝（通过递归创建新对象）
            target[key] = this._mergeDefaultsRecursive({}, defaultValue);
          } else if (Array.isArray(defaultValue)) {
            // 如果默认值是数组，进行浅拷贝
            target[key] = [...defaultValue];
          } else {
            // 如果默认值是原始类型，直接赋值
            target[key] = defaultValue;
          }
        }
        // 情况 2: 目标对象中存在该键，并且两者都是普通对象
        else if (
          typeof defaultValue === "object" &&
          defaultValue !== null &&
          !Array.isArray(defaultValue) &&
          typeof targetValue === "object" &&
          targetValue !== null &&
          !Array.isArray(targetValue)
        ) {
          // 递归进入下一层进行合并（包括删除不存在的属性）
          this._mergeDefaultsRecursive(targetValue, defaultValue);
        }
        // 情况 3: 目标对象中存在该键，但类型不匹配或不是普通对象
        // 则保留目标对象中的现有值，不进行任何操作
      }
    }

    return target; // 返回修改后的 target 对象
  }

  // --- 初始化方法 ---

  /**
   * 初始化或验证 this.safetyConfig (当前安全设置状态)。
   * 主要确保它是一个包含所有必需安全类别的对象。
   */
  initSafetyConfig() {
    const requiredCategories = Object.values(GEMINI_SAFETY_SETTINGS_TYPE);
    let configChanged = false;

    // 确保 this.safetyConfig 是一个对象
    if (!this.safetyConfig || typeof this.safetyConfig !== "object") {
      console.log("safetyConfig 未加载或格式无效，创建新的空对象。");
      this.safetyConfig = {};
      configChanged = true; // 需要初始化
    }

    // 检查是否缺少必需的类别，如果缺少则添加默认值
    for (const category of requiredCategories) {
      if (!(category in this.safetyConfig)) {
        console.warn(`为 safetyConfig 补充缺失的类别: ${category}`);
        this.safetyConfig[category] = GEMINI_SAFETY_BLOCK_SETTINGS.DEFAULT;
        configChanged = true;
      }
      // 可选：检查值的有效性，如果需要更严格的控制
      // else if (!Object.values(GEMINI_SAFETY_BLOCK_SETTINGS).includes(this.safetyConfig[category])) {
      //    console.warn(`safetyConfig 中类别 ${category} 的值无效 (${this.safetyConfig[category]})，重置为默认值。`);
      //    this.safetyConfig[category] = GEMINI_SAFETY_BLOCK_SETTINGS.DEFAULT;
      //    configChanged = true;
      // }
    }

    // 可选：移除无效的键 (如果 safetyConfig 可能包含非预期的键)
    // for (const loadedKey in this.safetyConfig) {
    //   if (!requiredCategories.includes(loadedKey)) {
    //     console.warn(`从 safetyConfig 移除未知类别: ${loadedKey}`);
    //     delete this.safetyConfig[loadedKey];
    //     configChanged = true;
    //   }
    // }

    if (configChanged) {
      console.log("初始化或修正后的 safetyConfig:", this.safetyConfig);
      // 注意：这里通常不需要保存，因为 `_saveStrogeConfig` 会在适当的时候保存整个配置。
    } else {
      console.log("使用已加载或验证通过的 safetyConfig:", this.safetyConfig);
    }
  }

  /**
   * 初始化 LLM 默认配置 (this.LLMDefaultConfig)。
   * 定义完整的默认结构，然后使用 _mergeDefaultsRecursive 将其合并到
   * this.LLMDefaultConfig 中，确保用户设置被保留。
   */
  initLLMDefaultConfig() {
    // 1. 确定动态值 (provider 和 model)，尝试从 baseConfig 获取，否则使用后备值
    const defaultProvider = this.baseConfig?.llm_providers?.[0] ?? "openai"; // 默认使用第一个 provider 或 openai
    const defaultModel = this.getDefaultModel(defaultProvider) ?? "gpt-4o-mini"; // 该 provider 的默认模型或 gpt-4o-mini

    // 2. 定义完整的默认配置结构 (包括固定的 safetySettings 默认值)
    const defaultConfigStructure = {
      provider: defaultProvider, // 动态确定
      base: {
        model: defaultModel, // 动态确定
        max_messages_num: 10,
        stream: true,
      },
      chatParams: {
        temperature: 1,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        reasoning_effort: -1,
      },
      toolCallSettings: {
        mode: TOOL_CALL_MODEDS.AUTO,
        tools: [], // 默认无激活工具
      },
      presetSettings: {
        opening: "",
        history: [],
      },
      extraSettings: {
        gemini: {
          imageGeneration: false,
          // Gemini 特定示例
          internalTools: {
            google_search: false,
            code_execution: false,
            url_context: false,
          },
          safetySettings: {
            // 使用固定的默认安全设置结构
            [GEMINI_SAFETY_SETTINGS_TYPE.HARASSMENT]:
              GEMINI_SAFETY_BLOCK_SETTINGS.DEFAULT,
            [GEMINI_SAFETY_SETTINGS_TYPE.HATE_SPEECH]:
              GEMINI_SAFETY_BLOCK_SETTINGS.DEFAULT,
            [GEMINI_SAFETY_SETTINGS_TYPE.SEXUALLY_EXPLICIT]:
              GEMINI_SAFETY_BLOCK_SETTINGS.DEFAULT,
            [GEMINI_SAFETY_SETTINGS_TYPE.DANGEROUS_CONTENT]:
              GEMINI_SAFETY_BLOCK_SETTINGS.DEFAULT,
            // 如果有其他类别，也在这里添加
          },
        },
      },
    };

    // 3. 确保 this.LLMDefaultConfig 是一个对象
    if (!this.LLMDefaultConfig || typeof this.LLMDefaultConfig !== "object") {
      console.log(
        "LLMDefaultConfig 未加载或格式无效，创建新的空对象用于合并。"
      );
      this.LLMDefaultConfig = {};
    }

    // 4. 递归合并默认值到 this.LLMDefaultConfig
    //    这个操作会保留 this.LLMDefaultConfig 中已有的用户设置，只添加缺失的部分
    console.log(
      "合并 LLM 默认配置（之前）:",
      JSON.stringify(this.LLMDefaultConfig)
    );
    this.LLMDefaultConfig = this._mergeDefaultsRecursive(
      this.LLMDefaultConfig,
      defaultConfigStructure
    );
    console.log(
      "合并 LLM 默认配置（之后）:",
      JSON.stringify(this.LLMDefaultConfig)
    );

    // 注意：合并操作后，this.LLMDefaultConfig 可能已更新，保存操作会在适当时机触发。
  }

  // --- 公开方法：获取和设置配置 ---

  /** 获取基础配置对象 */
  getBaseConfig() {
    return this.baseConfig;
  }

  /**
   * 设置基础配置对象，并执行相关副作用（更新LLM默认值、触发回调）。
   * @param {object} config - 新的基础配置对象
   */
  setBaseConfig(config) {
    this.baseConfig = { ...config }; // 创建浅拷贝
    console.log("设置基础配置:", this.baseConfig);

    // 副作用 1: 更新 LLMDefaultConfig 中的 provider 和 model (如果 baseConfig 中有定义)
    const { llm_providers = [], default_model = {} } = this.baseConfig;
    if (llm_providers.length > 0) {
      const newDefaultProvider = llm_providers[0]; // 假设使用第一个 provider 作为新的默认
      this.updateLLMDefaultConfig(null, { provider: newDefaultProvider });
      if (default_model[newDefaultProvider]) {
        this.updateLLMDefaultConfig("base", {
          model: default_model[newDefaultProvider],
        });
      } else {
        console.warn(
          `基础配置中未找到 Provider "${newDefaultProvider}" 的默认模型。`
        );
        // 可以考虑设置一个通用的后备模型
      }
    } else {
      console.warn("基础配置中未定义 LLM providers。");
      // 可能需要重置 provider 和 model?
    }

    // 保存更新后的配置 (包括 baseConfig 和可能更新的 LLMDefaultConfig)
    this._saveStrogeConfig(); // setBaseConfig 后立即保存

    // 副作用 2: 调用注册的回调函数
    if (this.baseConfigCallback) {
      try {
        this.baseConfigCallback(this.baseConfig);
      } catch (error) {
        console.error("执行 baseConfig 回调函数时出错:", error);
      }
    }
  }

  /**
   * 注册一个当 baseConfig 改变时被调用的回调函数
   * @param {function | null} callback - 回调函数或 null
   */
  setBaseConfigCallback(callback) {
    this.baseConfigCallback = callback;
  }

  /**
   * 更新基础配置的一部分。
   * @param {object} patch - 包含要更新的键值对的对象
   */
  updateBaseConfig(patch) {
    console.log("准备使用 patch 更新 baseConfig:", patch);
    const newBaseConfig = {
      ...this.baseConfig,
      ...patch,
    };
    // 调用 setBaseConfig 来应用更改并触发副作用
    this.setBaseConfig(newBaseConfig);
  }

  /** 获取可用的 LLM Providers 列表 (用于 UI 选择) */
  getLLMProviders() {
    const providers = this.baseConfig?.llm_providers ?? [];
    return providers.map((provider) => ({
      value: provider,
      label: provider, // 可以根据需要提供更友好的标签
    }));
  }

  /** 获取指定 Provider 的默认模型名称 */
  getDefaultModel(provider) {
    return this.baseConfig?.default_model?.[provider];
  }

  /** 获取工具调用模式列表 (用于 UI 选择) */
  getToolCallModes() {
    return Object.entries(TOOL_CALL_MODEDS).map(([key, value]) => ({
      value: value,
      label: key, // 使用 key 作为标签通常更易读
    }));
  }

  /** 获取所有已加载的 LLM 模型信息 */
  getLlmModels(provider) {
    if (!provider) {
      return this.llmModels ?? {};
    }
    return this.llmModels?.[provider] ?? [];
  }

  /** 设置 LLM 模型信息 (通常在从 API 加载后调用) */
  setLlmModels(models) {
    this.llmModels = models;
    console.log("设置 LLM 模型列表:", this.llmModels);
    this._saveStrogeConfig();
  }

  /** 获取基础配置中定义的默认模型映射 { provider: model } */
  getDefaultLLMModel() {
    return this.baseConfig?.default_model ?? {};
  }

  /** 检查指定模型是否在指定 Provider 的可用模型列表中 */
  isModelAvailable(provider, model) {
    const providerModels = this.llmModels?.[provider] ?? [];
    return providerModels.some((modelGroup) =>
      modelGroup.models.includes(model)
    );
  }

  /** 根据模型名称查找其所有者 (owner) */
  getModelOwner(model) {
    for (const provider in this.llmModels) {
      const providerModels = this.llmModels[provider] ?? [];
      const group = providerModels.find((modelGroup) =>
        modelGroup.models.includes(model)
      );
      if (group) return group.owner;
    }
    return undefined; // 或 null
  }

  /** 获取安全设置的可选参数 (用于 UI 选择) */
  getSafetySettingsParams() {
    // 返回格式 { NONE: "BLOCK_NONE", LOW: "BLOCK_ONLY_HIGH", ... }
    return GEMINI_SAFETY_BLOCK_SETTINGS;
  }

  /** 获取当前的安全设置状态对象 */
  getSafetyConfig() {
    return this.safetyConfig;
  }

  /**
   * 设置当前的安全设置状态，并同步更新 LLMDefaultConfig 中的对应部分。
   * @param {object} newSafetyConfig - 新的安全设置对象
   */
  setSafetyConfig(newSafetyConfig) {
    // 可以在这里添加验证逻辑，确保 newSafetyConfig 的格式和值有效
    this.safetyConfig = { ...newSafetyConfig }; // 更新当前状态
    console.log("设置当前 safetyConfig 状态:", this.safetyConfig);

    // 同步更新 LLMDefaultConfig 中的 safetySettings
    // updateLLMDefaultConfig 会处理保存逻辑 (如果检测到变化)
    this.updateLLMDefaultConfig("safetySettings", { ...this.safetyConfig });
  }

  /**
   * 更新 LLM 默认配置 (LLMDefaultConfig) 的一部分或顶层属性。
   * @param {string | null} type - 要更新的顶层键名 (如 'base', 'chatParams')，如果为 null 则更新顶层属性。
   * @param {object} patch - 包含要更新的键值对的对象。
   */
  updateLLMDefaultConfig(type, patch) {
    let configChanged = false;

    if (
      type &&
      this.LLMDefaultConfig[type] &&
      typeof this.LLMDefaultConfig[type] === "object"
    ) {
      // 更新指定类型的嵌套对象
      const originalSubConfigString = JSON.stringify(
        this.LLMDefaultConfig[type]
      );
      this.LLMDefaultConfig[type] = {
        ...this.LLMDefaultConfig[type],
        ...patch,
      };
      // 检查子对象是否有实际变化
      if (
        JSON.stringify(this.LLMDefaultConfig[type]) !== originalSubConfigString
      ) {
        configChanged = true;
      }
    } else if (!type) {
      // 更新顶层属性
      const originalTopLevelConfig = { ...this.LLMDefaultConfig };
      this.LLMDefaultConfig = {
        ...this.LLMDefaultConfig,
        ...patch,
      };
      // 检查顶层是否有变化 (简单比较)
      if (
        JSON.stringify(originalTopLevelConfig) !==
        JSON.stringify(this.LLMDefaultConfig)
      ) {
        configChanged = true;
      }
    } else {
      console.warn(
        `无法更新 LLMDefaultConfig: 类型 "${type}" 不存在或不是对象。`
      );
      return; // 没有做任何更改
    }

    if (configChanged) {
      console.log(
        `更新 LLMDefaultConfig${type ? `[${type}]` : ""} 使用 patch:`,
        patch
      );
      // 只有在检测到实际变化时才保存
      this._saveStrogeConfig();
    } else {
      console.log(`LLMDefaultConfig 更新被跳过，patch 未引起变化:`, patch);
    }
  }

  /**
   * 获取 LLM 默认配置。可以指定 provider 来获取针对该 provider 调整后的配置副本。
   * @param {string} [provider] - 可选。如果提供，会尝试将返回的配置副本调整为使用此 provider 及其默认模型。
   * @returns {object} - LLM 配置的深拷贝副本。
   */
  getLLMDefaultConfig(provider) {
    // 创建深拷贝，防止外部修改影响原始配置
    if (!this.LLMDefaultConfig || typeof this.LLMDefaultConfig !== "object") {
      console.error("LLMDefaultConfig 不是有效对象，无法获取。");
      return {}; // 返回空对象或抛出错误
    }
    let copiedConfig;
    try {
      copiedConfig = JSON.parse(JSON.stringify(this.LLMDefaultConfig));
    } catch (e) {
      console.error("深拷贝 LLMDefaultConfig 失败:", e);
      return {}; // 返回空对象或进行错误处理
    }

    // 如果请求了特定 provider 且与当前默认 provider 不同
    if (provider && provider !== copiedConfig.provider) {
      const defaultModelForProvider = this.getDefaultModel(provider);
      if (defaultModelForProvider) {
        console.log(
          `为 Provider "${provider}" 调整 LLM 配置副本 (模型: ${defaultModelForProvider})。`
        );
        copiedConfig.provider = provider;
        copiedConfig.base.model = defaultModelForProvider;
      } else {
        console.warn(
          `请求了 Provider "${provider}"，但在 baseConfig 中未找到其默认模型。返回的配置将使用原始 Provider 和模型。`
        );
        // 保持 copiedConfig 不变或进行其他处理
      }
    }
    return copiedConfig;
  }

  // --- 公开方法：工具验证 ---

  /**
   * 获取在当前可用工具列表 (this.llmTools) 中有效的工具名称。
   * @param {string[]} selectedToolNames - 用户选择或配置中指定的工具名称列表。
   * @returns {string[]} - 只包含有效的、实际可用的工具名称列表。
   */
  getValidTools(selectedToolNames) {
    if (!selectedToolNames || !Array.isArray(selectedToolNames)) {
      return [];
    }

    const availableToolNames = new Set();

    if (typeof this.llmTools === "object" && this.llmTools !== null) {
      Object.values(this.llmTools).forEach((pluginTools) => {
        // 如果是对象 {plugin: toolsObj}
        if (pluginTools && typeof pluginTools === "object") {
          Object.keys(pluginTools).forEach(
            (toolName) => availableToolNames.add(toolName) // 只取工具名部分
          );
        }
      });
    }

    const validToolNames = [...availableToolNames].filter((name) => {
      for (const toolName of selectedToolNames) {
        if (name.includes(toolName)) {
          return true;
        } else {
          return false;
        }
      }
    });

    if (validToolNames.length < selectedToolNames.length) {
      const invalidTools = selectedToolNames.filter(
        (toolName) => !availableToolNames.has(toolName)
      );
      console.warn("配置中指定的以下工具当前不可用或未加载:", invalidTools);
    }

    return validToolNames;
  }

  /**
   * 获取一个经过验证的 LLM 配置对象副本。
   * 主要验证其中的工具列表是否有效。
   * @param {object} config - 原始的 LLM 配置对象。
   * @returns {object} - 经过验证和清理的配置对象深拷贝副本。
   */
  getVerifiedLLMConfig(config) {
    if (!config || typeof config !== "object") {
      console.warn("getVerifiedLLMConfig 接收到的输入无效，按原样返回。");
      return config;
    }

    // 创建深拷贝以避免修改原始对象
    let verifiedConfig;
    try {
      verifiedConfig = JSON.parse(JSON.stringify(config));
    } catch (e) {
      console.error("深拷贝配置失败 (getVerifiedLLMConfig):", e);
      return config; // 返回原始配置或进行错误处理
    }

    this._mergeDefaultsRecursive(verifiedConfig, this.LLMDefaultConfig);

    // 验证工具列表
    if (
      verifiedConfig.toolCallSettings &&
      Array.isArray(verifiedConfig.toolCallSettings.tools)
    ) {
      verifiedConfig.toolCallSettings.tools = this.getValidTools(
        verifiedConfig.toolCallSettings.tools
      );
    } else if (verifiedConfig.toolCallSettings) {
      // 如果 toolCallSettings 存在但 tools 不存在或不是数组，则设置为空数组
      verifiedConfig.toolCallSettings.tools = [];
    }

    return verifiedConfig;
  }

  // --- 公开方法：异步加载外部数据 ---

  /**
   * 从后端 API 加载可用的 LLM 工具列表。
   */
  async loadllmTools() {
    try {
      const response = await fetch("/api/openai/tools"); // 示例端点
      if (!response.ok) {
        throw new Error(
          `请求 LLM 工具失败: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();

      // 假设 API 返回的数据结构是 { data: { tools: ... } }
      if (data && data.data && data.data.tools) {
        this.llmTools = data.data.tools;
        console.log("LLM 工具已加载:", this.llmTools);
        // 考虑是否需要在加载后立即保存。如果工具列表不常变动，可能不需要。
        // this._saveStrogeConfig();
      } else {
        console.warn("从 API 收到的 LLM 工具数据格式不符合预期:", data);
        this.llmTools = []; // 或保持旧数据？
      }
    } catch (error) {
      console.error("加载 LLM 工具时发生网络或解析错误:", error);
      // 可以考虑加载失败时的回退逻辑，比如使用缓存的旧列表
      // this.llmTools = this._getLocalStorage('cached_llm_tools') ?? [];
    }
  }

  /**
   * 从后端 API 加载 OneBot 相关配置。
   */
  async loadonebotConfig() {
    try {
      const response = await fetch(`/api/onebot/plugins`); // 示例端点
      if (!response.ok) {
        throw new Error(
          `请求 OneBot 配置失败: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();

      // 假设 API 返回的数据结构是 { data: { options: ... } }
      if (data && data.data && data.data.options) {
        this.onebotConfig = data.data.options;
        console.log("OneBot 配置已加载:", this.onebotConfig);
        // 加载后立即保存
        this._saveStrogeConfig();
      } else {
        console.warn("从 API 收到的 OneBot 配置数据格式不符合预期:", data);
        this.onebotConfig = null; // 或保持旧数据？
      }
    } catch (error) {
      console.error("加载 OneBot 配置时发生网络或解析错误:", error);
      // 可以考虑加载失败时的回退逻辑
    }
  }
}
