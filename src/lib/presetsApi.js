/**
 * 预设管理 API 服务
 * 用于对接后端预设管理接口
 */

import { configAPI } from './configApi.js';

class PresetsAPI {
  constructor() {
    this.configAPI = configAPI;
  }

  /**
   * 获取预设管理列表
   * @param {object} params - 查询参数
   * @param {number} params.nums - 返回数量限制
   * @param {number} params.start - 起始位置
   * @param {string} params.keyword - 搜索关键词
   * @returns {Promise<object>} 预设列表数据
   */
  async getPresets(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/api/config/presets${queryString ? '?' + queryString : ''}`;
    return this.configAPI.request(endpoint);
  }

  /**
   * 获取特定预设详情
   * @param {string} presetId - 预设ID（名称）
   * @returns {Promise<object>} 预设详情数据
   */
  async getPreset(presetId) {
    return this.configAPI.request(`/api/config/presets/${encodeURIComponent(presetId)}`);
  }

  /**
   * 创建新预设
   * @param {object} data - 预设数据
   * @param {string} data.name - 预设名称
   * @param {Array} data.history - 对话历史
   * @param {string} data.opening - 开场白
   * @param {Array} data.tools - 工具列表
   * @returns {Promise<object>} 响应数据
   */
  async createPreset(data) {
    return this.configAPI.request('/api/config/presets', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * 更新预设
   * @param {string} presetId - 预设ID（名称）
   * @param {object} data - 更新的预设数据
   * @returns {Promise<object>} 响应数据
   */
  async updatePreset(presetId, data) {
    return this.configAPI.request(`/api/config/presets/${encodeURIComponent(presetId)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * 删除预设
   * @param {string} presetId - 预设ID（名称）
   * @returns {Promise<object>} 响应数据
   */
  async deletePreset(presetId) {
    return this.configAPI.request(`/api/config/presets/${encodeURIComponent(presetId)}`, {
      method: 'DELETE'
    });
  }

  /**
   * 重新加载所有预设
   * @returns {Promise<object>} 响应数据
   */
  async reloadPresets() {
    return this.configAPI.request('/api/config/presets/reload', {
      method: 'POST'
    });
  }

  /**
   * 导入预设文件
   * @param {File} file - 预设JSON文件
   * @returns {Promise<object>} 响应数据
   */
  async importPreset(file) {
    const formData = new FormData();
    formData.append('file', file);

    // 使用特殊的请求方法，不设置 Content-Type 让浏览器自动设置
    const headers = {
      'X-Admin-Code': this.configAPI.adminCode
    };

    try {
      const response = await fetch('/api/config/presets/import', {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          this.configAPI.adminCode = '';
          localStorage.removeItem('admin_code');
        }
        throw new Error(data.message || data.error || '导入失败');
      }

      if (data.code !== 0 && data.code !== undefined) {
        throw new Error(data.message || '导入失败');
      }

      return data;
    } catch (error) {
      console.error('导入预设失败:', error);
      throw error;
    }
  }

  /**
   * 导出预设文件
   * @param {string} presetId - 预设ID（名称）
   */
  async exportPreset(presetId) {
    try {
      const headers = {
        'X-Admin-Code': this.configAPI.adminCode
      };

      const response = await fetch(`/api/config/presets/${encodeURIComponent(presetId)}/export`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || '导出失败');
      }

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${presetId}.json`;
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename[*]?=['"]?([^'";\n]+)['"]?/);
        if (matches) {
          filename = matches[1];
        }
      }

      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a); // 添加到 DOM 中确保兼容性
      a.click();
      document.body.removeChild(a); // 清理 DOM
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出预设失败:', error);
      // 如果导出失败，提供一个备用方案：获取预设详情并手动创建下载
      try {
        console.warn('尝试备用导出方案...');
        const presetData = await this.getPreset(presetId);
        const exportData = {
          name: presetData.data.name,
          category: presetData.data.category,
          history: presetData.data.history,
          opening: presetData.data.opening,
          tools: presetData.data.tools
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${presetId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (fallbackError) {
        console.error('备用导出方案也失败:', fallbackError);
        throw error; // 抛出原始错误
      }
    }
  }

  /**
   * 批量删除预设
   * @param {Array<string>} presetIds - 预设ID列表
   * @returns {Promise<Array>} 删除结果
   */
  async batchDeletePresets(presetIds) {
    const results = [];

    for (const presetId of presetIds) {
      try {
        const result = await this.deletePreset(presetId);
        results.push({ success: true, presetId, result });
      } catch (error) {
        results.push({ success: false, presetId, error: error.message });
      }
    }

    return results;
  }

  /**
   * 验证预设数据
   * @param {object} data - 预设数据
   * @returns {Promise<object>} 验证结果
   */
  async validatePreset(data) {
    return this.configAPI.request('/api/config/presets/validate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

// 导出单例实例
export const presetsAPI = new PresetsAPI();