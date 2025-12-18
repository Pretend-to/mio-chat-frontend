/**
 * 配置管理 Store
 * 用于管理后端配置的状态
 * 使用 Composition API 风格
 */

import { configAPI } from '@/lib/configApi.js';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useConfigStore = defineStore('config', () => {
  // ========== State ==========
  
  // 完整配置
  const config = ref(null);
  
  // 适配器类型信息
  const adapterTypes = ref({
    types: [],
    adapters: [],
    count: 0
  });
  
  // LLM 适配器
  const adapters = ref({});
  
  // 模型列表 { provider: [{ owner, models }] }
  const models = ref({}); 
  
  // 加载状态
  const loading = ref(false);
  
  // 是否需要重启服务
  const needRestart = ref(false);
  
  // 管理员验证码
  const adminCode = ref(localStorage.getItem('admin_code') || '');
  
  // 选中的适配器（用于批量操作）
  const selectedAdapters = ref([]);

  // ========== Getters ==========
  
  /**
   * 获取所有启用的适配器
   */
  const enabledAdapters = computed(() => {
    const result = [];
    Object.entries(adapters.value).forEach(([type, instances]) => {
      instances.forEach((adapter, index) => {
        if (adapter.enable) {
          result.push({ type, index, ...adapter });
        }
      });
    });
    return result;
  });

  /**
   * 获取适配器总数
   */
  const totalAdapters = computed(() => {
    return Object.values(adapters.value)
      .reduce((sum, arr) => sum + arr.length, 0);
  });

  /**
   * 获取启用的适配器数量
   */
  const enabledAdaptersCount = computed(() => {
    let count = 0;
    Object.values(adapters.value).forEach(instances => {
      instances.forEach(adapter => {
        if (adapter.enable) count++;
      });
    });
    return count;
  });

  /**
   * 获取总模型数量
   */
  const totalModelsCount = computed(() => {
    let count = 0;
    Object.values(models.value).forEach(providerModels => {
      if (Array.isArray(providerModels)) {
        providerModels.forEach(group => {
          if (group.models && Array.isArray(group.models)) {
            count += group.models.length;
          }
        });
      }
    });
    return count;
  });

  /**
   * 检查是否已认证（有管理员验证码）
   */
  const isAuthenticated = computed(() => !!adminCode.value);

  // ========== Actions ==========
  
  /**
   * 设置管理员验证码
   */
  function setAdminCode(code) {
    adminCode.value = code;
    configAPI.setAdminCode(code);
  }

  /**
   * 获取适配器类型信息
   */
  async function fetchAdapterTypes() {
    try {
      const response = await configAPI.getAdapterTypes();
      adapterTypes.value = response.data;
      return response.data;
    } catch (error) {
      console.error('获取适配器类型失败:', error);
      throw error;
    }
  }

  /**
   * 清除管理员验证码
   */
  function clearAdminCode() {
    adminCode.value = '';
    localStorage.removeItem('admin_code');
    configAPI.adminCode = '';
  }

  /**
   * 获取完整配置
   */
  async function fetchConfig() {
    loading.value = true;
    try {
      const response = await configAPI.getConfig();
      config.value = response.data;
      adapters.value = response.data.llm_adapters || {};
      // 同时获取 models 数据
      models.value = response.data.models || {};
      return response.data;
    } catch (error) {
      console.error('获取配置失败:', error);
      // 如果是认证失败，清除验证码
      if (error.message.includes('验证码') || error.message.includes('访问被拒绝')) {
        clearAdminCode();
      }
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取指定配置节点
   */
  async function fetchConfigSection(section) {
    try {
      const response = await configAPI.getConfigSection(section);
      if (config.value) {
        config.value[section] = response.data;
      }
      return response.data;
    } catch (error) {
      console.error(`获取配置节点 ${section} 失败:`, error);
      throw error;
    }
  }

  /**
   * 更新完整配置
   */
  async function updateConfig(data) {
    try {
      const response = await configAPI.updateConfig(data);
      
      // 标记需要重启（非 LLM 适配器配置）
      needRestart.value = true;
      
      // 重新获取配置
      await fetchConfig();
      
      return response.data;
    } catch (error) {
      console.error('更新配置失败:', error);
      throw error;
    }
  }

  /**
   * 更新指定配置节点
   */
  async function updateConfigSection(section, data) {
    try {
      const response = await configAPI.updateConfigSection(section, data);
      
      // 更新本地状态
      if (config.value) {
        config.value[section] = data;
      }
      
      // 非 LLM 适配器配置需要重启
      if (section !== 'llm_adapters') {
        needRestart.value = true;
      }
      
      return response.data;
    } catch (error) {
      console.error(`更新配置节点 ${section} 失败:`, error);
      throw error;
    }
  }

  /**
   * 添加适配器实例
   */
  async function addAdapter(type, data) {
    try {
      const response = await configAPI.addAdapter(type, data);
      
      // 更新本地状态（热更新，无需重启）
      await fetchConfig();
      models.value = response.data.models || {};
      
      return response.data;
    } catch (error) {
      console.error('添加适配器失败:', error);
      throw error;
    }
  }

  /**
   * 更新适配器实例
   */
  async function updateAdapter(type, index, data) {
    try {
      const response = await configAPI.updateAdapter(type, index, data);
      // 用接口返回的完整适配器列表和模型列表直接更新本地状态
      if (response.data.llm_adapters) {
        adapters.value = response.data.llm_adapters;
      }
      if (response.data.models) {
        models.value = response.data.models;
      }
      // 可选：同步 providers 等其他字段
      return response.data;
    } catch (error) {
      console.error('更新适配器失败:', error);
      throw error;
    }
  }

  /**
   * 删除适配器实例
   */
  async function deleteAdapter(type, index) {
    try {
      const response = await configAPI.deleteAdapter(type, index);
      
      // 更新本地状态
      if (adapters.value[type]) {
        adapters.value[type].splice(index, 1);
      }
      models.value = response.data.models || {};
      
      return response.data;
    } catch (error) {
      console.error('删除适配器失败:', error);
      throw error;
    }
  }

  /**
   * 批量删除适配器实例
   */
  async function batchDeleteAdapters(adaptersList) {
    try {
      const results = await configAPI.batchDeleteAdapters(adaptersList);
      
      // 重新获取配置
      await fetchConfig();
      
      return results;
    } catch (error) {
      console.error('批量删除适配器失败:', error);
      throw error;
    }
  }

  /**
   * 批量启用/禁用适配器
   */
  async function batchToggleAdapters(adaptersList, enable) {
    const results = [];
    
    for (const adapter of adaptersList) {
      try {
        const adapterData = adapters.value[adapter.type][adapter.index];
        const updatedData = { ...adapterData, enable };
        
        await updateAdapter(adapter.type, adapter.index, updatedData);
        results.push({ success: true, adapter });
      } catch (error) {
        results.push({ success: false, adapter, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * 刷新所有模型列表
   */
  async function refreshAllModels() {
    try {
      const response = await configAPI.refreshAllModels();
      models.value = response.data.models || {};
      return response.data;
    } catch (error) {
      console.error('刷新模型列表失败:', error);
      throw error;
    }
  }

  /**
   * 刷新单个适配器实例模型列表
   */
  async function refreshAdapterModels(type, index) {
    try {
      const response = await configAPI.refreshAdapterModels(type, index);
      models.value = response.data.models || {};
      return response.data;
    } catch (error) {
      console.error('刷新适配器模型列表失败:', error);
      throw error;
    }
  }

  /**
   * 验证配置
   */
  async function validateConfig(data) {
    try {
      const response = await configAPI.validateConfig(data);
      return response.data;
    } catch (error) {
      console.error('验证配置失败:', error);
      throw error;
    }
  }

  /**
   * 重置配置
   */
  async function resetConfig() {
    try {
      const response = await configAPI.resetConfig();
      needRestart.value = true;
      await fetchConfig();
      return response.data;
    } catch (error) {
      console.error('重置配置失败:', error);
      throw error;
    }
  }

  /**
   * 导出配置
   */
  async function exportConfig(filename) {
    try {
      await configAPI.exportConfig(filename);
    } catch (error) {
      console.error('导出配置失败:', error);
      throw error;
    }
  }

  /**
   * 导入配置
   */
  async function importConfig(file) {
    try {
      const configData = await configAPI.importConfig(file);
      return configData;
    } catch (error) {
      console.error('导入配置失败:', error);
      throw error;
    }
  }

  /**
   * 切换适配器选中状态
   */
  function toggleAdapterSelection(type, index) {
    const key = `${type}-${index}`;
    const idx = selectedAdapters.value.findIndex(a => `${a.type}-${a.index}` === key);
    
    if (idx > -1) {
      selectedAdapters.value.splice(idx, 1);
    } else {
      selectedAdapters.value.push({ type, index });
    }
  }

  /**
   * 清空选中的适配器
   */
  function clearAdapterSelection() {
    selectedAdapters.value = [];
  }

  /**
   * 检查适配器是否被选中
   */
  function isAdapterSelected(type, index) {
    const key = `${type}-${index}`;
    return selectedAdapters.value.some(a => `${a.type}-${a.index}` === key);
  }

  // ========== 返回公开的 API ==========
  
  return {
    // State
    config,
    adapterTypes,
    adapters,
    models,
    loading,
    needRestart,
    adminCode,
    selectedAdapters,
    
    // Getters
    enabledAdapters,
    totalAdapters,
    enabledAdaptersCount,
    totalModelsCount,
    isAuthenticated,
    
    // Actions
    setAdminCode,
    clearAdminCode,
    fetchAdapterTypes,
    fetchConfig,
    fetchConfigSection,
    updateConfig,
    updateConfigSection,
    addAdapter,
    updateAdapter,
    deleteAdapter,
    batchDeleteAdapters,
    batchToggleAdapters,
    refreshAllModels,
    refreshAdapterModels,
    validateConfig,
    resetConfig,
    exportConfig,
    importConfig,
    toggleAdapterSelection,
    clearAdapterSelection,
    isAdapterSelected
  };
});
