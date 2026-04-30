/**
 * 预设管理 Store
 * 用于管理预设的状态
 * 使用 Composition API 风格
 */

import { presetsAPI } from '@/lib/presetsApi.js';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const usePresetsStore = defineStore('presets', () => {
  // ========== State ==========
  
  // 预设数据
  const presets = ref([]);
  
  // 统计数据（来自 API）
  const summary = ref({
    totalCount: 0,
    categoryCount: {
      common: 0,
      recommended: 0,
      hidden: 0
    },
    sourceCount: {
      'built-in': 0,
      custom: 0
    }
  });
  
  // 分页数据
  const pagination = ref({
    total: 0,
    start: 0,
    nums: 50,
    hasMore: false
  });
  
  // 加载状态
  const loading = ref(false);

  // ========== Getters ==========
  
  /**
   * 获取所有预设的扁平化列表
   */
  const allPresets = computed(() => {
    const presetsArray = presets.value || [];
    return presetsArray.map(preset => ({
      ...preset,
      id: preset.name // 根据文档，预设的唯一标识符就是 name 字段
    }));
  });

  /**
   * 获取预设总数（来自 API summary）
   */
  const totalCount = computed(() => {
    return summary.value?.totalCount || 0;
  });

  /**
   * 按分类获取预设数量（来自 API summary）
   */
  const countByCategory = computed(() => {
    return summary.value?.categoryCount || {
      common: 0,
      recommended: 0,
      hidden: 0
    };
  });

  /**
   * 按来源获取预设数量（来自 API summary）
   */
  const countBySource = computed(() => {
    return summary.value?.sourceCount || {
      'built-in': 0,
      custom: 0
    };
  });

  /**
   * 按分类分组的预设
   */
  const presetsByCategory = computed(() => {
    const grouped = { common: [], recommended: [], hidden: [] };
    const presetsArray = presets.value || [];
    presetsArray.forEach(preset => {
      if (preset.category && grouped.hasOwnProperty(preset.category)) {
        grouped[preset.category].push(preset);
      }
    });
    return grouped;
  });

  // ========== Actions ==========
  
  /**
   * 获取预设列表
   */
  async function fetchPresets(params = {}, append = false) {
    loading.value = true;
    try {
      const response = await presetsAPI.getPresets(params);
      const data = response.data || {};
      
      // 更新预设数据
      if (append && params.start > 0) {
        // 追加模式：添加到现有数据
        const newPresets = data.presets || [];
        presets.value = [...presets.value, ...newPresets];
      } else {
        // 替换模式：替换所有数据
        presets.value = data.presets || [];
      }
      
      // 更新统计数据
      if (data.summary) {
        summary.value = {
          totalCount: data.summary.totalCount || 0,
          categoryCount: data.summary.categoryCount || {
            common: 0,
            recommended: 0,
            hidden: 0
          },
          sourceCount: data.summary.sourceCount || {
            'built-in': 0,
            custom: 0
          }
        };
      }
      
      // 更新分页数据
      if (data.pagination) {
        pagination.value = {
          total: data.pagination.total || 0,
          start: data.pagination.start || 0,
          nums: data.pagination.nums || 50,
          hasMore: data.pagination.hasMore || false
        };
      }
      
      return data;
    } catch (error) {
      console.error('获取预设列表失败:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取单个预设详情
   */
  async function getPreset(presetId) {
    try {
      const response = await presetsAPI.getPreset(presetId);
      return response.data;
    } catch (error) {
      console.error(`获取预设详情失败: ${presetId}`, error);
      throw error;
    }
  }

  /**
   * 创建预设
   */
  async function createPreset(data) {
    try {
      const response = await presetsAPI.createPreset(data);
      
      // 重新获取预设列表
      await fetchPresets();
      
      return response.data;
    } catch (error) {
      console.error('创建预设失败:', error);
      throw error;
    }
  }

  /**
   * 更新预设
   */
  async function updatePreset(presetId, data) {
    try {
      const response = await presetsAPI.updatePreset(presetId, data);
      
      // 重新获取预设列表
      await fetchPresets();
      
      return response.data;
    } catch (error) {
      console.error('更新预设失败:', error);
      throw error;
    }
  }

  /**
   * 删除预设
   */
  async function deletePreset(presetId) {
    try {
      const response = await presetsAPI.deletePreset(presetId);
      
      // 从本地状态中移除
      const index = presets.value.findIndex(p => p.name === presetId);
      if (index > -1) {
        presets.value.splice(index, 1);
      }
      
      return response.data;
    } catch (error) {
      console.error('删除预设失败:', error);
      throw error;
    }
  }

  /**
   * 批量删除预设
   */
  async function batchDeletePresets(presetIds) {
    const results = [];
    
    for (const presetId of presetIds) {
      try {
        await deletePreset(presetId);
        results.push({ success: true, presetId });
      } catch (error) {
        results.push({ success: false, presetId, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * 导入预设
   */
  async function importPreset(file) {
    try {
      const response = await presetsAPI.importPreset(file);
      
      // 重新获取预设列表
      await fetchPresets();
      
      return response.data;
    } catch (error) {
      console.error('导入预设失败:', error);
      throw error;
    }
  }

  /**
   * 导出预设
   */
  async function exportPreset(presetId) {
    try {
      await presetsAPI.exportPreset(presetId);
    } catch (error) {
      console.error('导出预设失败:', error);
      throw error;
    }
  }

  /**
   * 重新加载预设
   */
  async function reloadPresets() {
    try {
      const response = await presetsAPI.reloadPresets();
      
      // 重新获取预设列表以更新统计数据
      await fetchPresets();
      
      return response.data;
    } catch (error) {
      console.error('重新加载预设失败:', error);
      throw error;
    }
  }

  /**
   * 搜索预设
   */
  function searchPresets(keyword) {
    const presetsArray = presets.value || [];
    if (!keyword) return presetsArray;

    const lowerKeyword = keyword.toLowerCase();
    return presetsArray.filter(preset => 
      preset.name?.toLowerCase().includes(lowerKeyword) ||
      preset.opening?.toLowerCase().includes(lowerKeyword) ||
      preset.history?.some(h => h.content?.toLowerCase().includes(lowerKeyword))
    );
  }

  /**
   * 根据ID查找预设
   */
  function findPresetById(presetId) {
    const presetsArray = allPresets.value || [];
    return presetsArray.find(preset => preset.id === presetId);
  }

  /**
   * 根据名称查找预设
   */
  function findPresetByName(name) {
    const presetsArray = allPresets.value || [];
    return presetsArray.find(preset => preset.name === name);
  }

  // ========== 返回公开的 API ==========
  
  return {
    // State
    presets,
    summary,
    pagination,
    loading,
    
    // Getters
    allPresets,
    totalCount,
    countByCategory,
    countBySource,
    presetsByCategory,
    
    // Actions
    fetchPresets,
    getPreset,
    createPreset,
    updatePreset,
    deletePreset,
    batchDeletePresets,
    importPreset,
    exportPreset,
    reloadPresets,
    searchPresets,
    findPresetById,
    findPresetByName
  };
});