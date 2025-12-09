/**
 * 配置管理 API 服务
 * 用于对接后端配置管理接口
 */

class ConfigAPI {
  constructor() {
    this.adminCode = '';
    this._initialized = false;
  }

  /**
   * 初始化 API 配置
   * 从 localStorage 获取管理员访问码
   */
  init() {
    if (this._initialized) return;
    
    // 从本地存储获取管理员访问码
    this.adminCode = localStorage.getItem('admin_code') || '';
    
    this._initialized = true;
  }

  /**
   * 设置管理员验证码
   * @param {string} code - 管理员验证码
   */
  setAdminCode(code) {
    this.adminCode = code;
    localStorage.setItem('admin_code', code);
  }

  /**
   * 通用请求方法
   * @param {string} endpoint - API 端点
   * @param {object} options - fetch 选项
   * @returns {Promise<object>} 响应数据
   */
  async request(endpoint, options = {}) {
    // 确保已初始化
    if (!this._initialized) {
      this.init();
    }

    const headers = {
      'X-Admin-Code': this.adminCode,
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json();

      // 检查响应状态
      if (!response.ok) {
        // 如果是认证失败，清除本地存储的验证码
        if (response.status === 403) {
          this.adminCode = '';
          localStorage.removeItem('admin_code');
        }
        throw new Error(data.message || data.error || '请求失败');
      }

      // 检查业务错误码
      if (data.code !== 0 && data.code !== undefined) {
        throw new Error(data.message || '请求失败');
      }

      return data;
    } catch (error) {
      console.error(`API 请求失败 [${endpoint}]:`, error);
      throw error;
    }
  }

  // ========== 配置查询 ==========

  /**
   * 获取完整配置
   * @returns {Promise<object>} 配置数据
   */
  async getConfig() {
    return this.request('/api/config');
  }

  /**
   * 获取指定配置节点
   * @param {string} section - 配置节点名称 (server/web/onebot/llm_adapters)
   * @returns {Promise<object>} 配置节点数据
   */
  async getConfigSection(section) {
    return this.request(`/api/config/${section}`);
  }

  // ========== 配置修改 ==========

  /**
   * 更新完整配置
   * @param {object} data - 配置数据
   * @returns {Promise<object>} 响应数据
   */
  async updateConfig(data) {
    return this.request('/api/config', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * 更新指定配置节点
   * @param {string} section - 配置节点名称
   * @param {object} data - 配置数据
   * @returns {Promise<object>} 响应数据
   */
  async updateConfigSection(section, data) {
    return this.request(`/api/config/${section}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // ========== LLM 适配器管理 ==========

  /**
   * 添加适配器实例
   * @param {string} type - 适配器类型 (openai/gemini/vertex)
   * @param {object} data - 适配器配置数据
   * @returns {Promise<object>} 响应数据
   */
  async addAdapter(type, data) {
    return this.request(`/api/config/llm/${type}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * 更新适配器实例
   * @param {string} type - 适配器类型
   * @param {number} index - 实例索引
   * @param {object} data - 适配器配置数据
   * @returns {Promise<object>} 响应数据
   */
  async updateAdapter(type, index, data) {
    return this.request(`/api/config/llm/${type}/${index}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * 删除适配器实例
   * @param {string} type - 适配器类型
   * @param {number} index - 实例索引
   * @returns {Promise<object>} 响应数据
   */
  async deleteAdapter(type, index) {
    return this.request(`/api/config/llm/${type}/${index}`, {
      method: 'DELETE'
    });
  }

  /**
   * 批量删除适配器实例
   * @param {Array<{type: string, index: number}>} adapters - 要删除的适配器列表
   * @returns {Promise<Array>} 删除结果
   */
  async batchDeleteAdapters(adapters) {
    // 按索引降序排序，避免删除后索引变化
    const sorted = [...adapters].sort((a, b) => b.index - a.index);
    const results = [];

    for (const adapter of sorted) {
      try {
        const result = await this.deleteAdapter(adapter.type, adapter.index);
        results.push({ success: true, adapter, result });
      } catch (error) {
        results.push({ success: false, adapter, error: error.message });
      }
    }

    return results;
  }

  // ========== 模型列表刷新 ==========

  /**
   * 刷新所有适配器模型列表
   * @returns {Promise<object>} 响应数据
   */
  async refreshAllModels() {
    return this.request('/api/config/refresh-models', {
      method: 'POST'
    });
  }

  /**
   * 刷新单个适配器实例模型列表
   * @param {string} type - 适配器类型
   * @param {number} index - 实例索引
   * @returns {Promise<object>} 响应数据
   */
  async refreshAdapterModels(type, index) {
    return this.request(`/api/config/llm/${type}/${index}/refresh-models`, {
      method: 'POST'
    });
  }

  // ========== 配置验证与重置 ==========

  /**
   * 验证配置
   * @param {object} data - 配置数据
   * @returns {Promise<object>} 验证结果
   */
  async validateConfig(data) {
    return this.request('/api/config/validate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * 重置配置到示例配置
   * @returns {Promise<object>} 响应数据
   */
  async resetConfig() {
    return this.request('/api/config/reset', {
      method: 'POST'
    });
  }

  // ========== 配置导出/导入 ==========

  /**
   * 导出配置为 JSON 文件
   * @param {string} filename - 文件名
   */
  async exportConfig(filename = 'mio-chat-config.json') {
    const response = await this.getConfig();
    const configData = response.data;
    
    const blob = new Blob([JSON.stringify(configData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 导入配置从 JSON 文件
   * @param {File} file - JSON 文件
   * @returns {Promise<object>} 导入的配置数据
   */
  async importConfig(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target.result);
          resolve(config);
        } catch {
          reject(new Error('无效的 JSON 文件'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };
      
      reader.readAsText(file);
    });
  }
}

/**
 * 插件管理 API
 */
class PluginAPI {
  constructor(configAPI) {
    this.configAPI = configAPI;
  }

  /**
   * 获取所有插件列表
   * @returns {Promise<object>} 插件列表数据
   */
  async listPlugins() {
    return this.configAPI.request('/api/plugins');
  }

  /**
   * 获取单个插件详情
   * @param {string} pluginName - 插件名称
   * @returns {Promise<object>} 插件详情数据
   */
  async getPluginDetail(pluginName) {
    return this.configAPI.request(`/api/plugins/${pluginName}`);
  }

  /**
   * 获取插件配置
   * @param {string} pluginName - 插件名称
   * @returns {Promise<object>} 插件配置数据
   */
  async getPluginConfig(pluginName) {
    return this.configAPI.request(`/api/plugins/${pluginName}/config`);
  }

  /**
   * 更新插件配置
   * @param {string} pluginName - 插件名称
   * @param {object} config - 新配置数据
   * @returns {Promise<object>} 响应数据
   */
  async updatePluginConfig(pluginName, config) {
    return this.configAPI.request(`/api/plugins/${pluginName}/config`, {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  }

  /**
   * 获取插件工具列表
   * @param {string} pluginName - 插件名称
   * @returns {Promise<object>} 工具列表数据
   */
  async getPluginTools(pluginName) {
    return this.configAPI.request(`/api/plugins/${pluginName}/tools`);
  }

  /**
   * 调试工具执行
   * @param {string} pluginName - 插件名称
   * @param {string} toolName - 工具名称
   * @param {object} parameters - 工具参数
   * @param {object} user - 用户上下文（可选）
   * @returns {Promise<object>} 执行结果
   */
  async debugTool(pluginName, toolName, parameters, user = null) {
    return this.configAPI.request(`/api/plugins/${pluginName}/tools/${toolName}/debug`, {
      method: 'POST',
      body: JSON.stringify({ parameters, user })
    });
  }

  /**
   * 重载单个插件
   * @param {string} pluginName - 插件名称
   * @returns {Promise<object>} 响应数据
   */
  async reloadPlugin(pluginName) {
    return this.configAPI.request(`/api/plugins/${pluginName}/reload`, {
      method: 'POST'
    });
  }

  /**
   * 重载所有插件
   * @returns {Promise<object>} 响应数据
   */
  async reloadAllPlugins() {
    return this.configAPI.request('/api/plugins/reload-all', {
      method: 'POST'
    });
  }

  /**
   * 启用/禁用插件
   * @param {string} pluginName - 插件名称
   * @param {boolean} enabled - 启用状态
   * @returns {Promise<object>} 响应数据
   */
  async togglePlugin(pluginName, enabled) {
    return this.configAPI.request(`/api/plugins/${pluginName}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
  }
}

// 导出单例实例
export const configAPI = new ConfigAPI();
export const pluginAPI = new PluginAPI(configAPI);
