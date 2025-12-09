基于后端配置 API 文档，我为您整理了前端开发文档和组件设计方案：

---

# Mio Chat Frontend - 配置管理前端开发文档

## 一、功能模块划分

### 1.1 核心功能模块

#### 1️⃣ **配置概览页面** (`SettingsView.vue` 扩展)
- 展示当前所有配置分类（服务器、Web、OneBot、LLM 适配器）
- 快速操作入口（重置全部、清理缓存、刷新模型列表）
- 配置状态指示器（是否需要重启服务）

#### 2️⃣ **LLM 适配器管理** (新增核心模块)
- **适配器列表视图**
  - 按类型分组显示（OpenAI / Gemini / Vertex AI）
  - 每个实例的状态卡片（启用/禁用、模型数量、健康状态）
  - 快速操作：启用/禁用、编辑、删除、刷新模型

- **适配器实例编辑器**
  - 表单验证（API Key、Base URL、模型选择）
  - 动态表单（根据适配器类型显示不同字段）
  - 实时验证反馈

- **模型选择器**
  - 支持关键词匹配和完整名称匹配
  - 访客模型配置
  - 默认模型设置

#### 3️⃣ **通用配置编辑器**
- 服务器配置（端口、主机、限流）
- Web 配置（标题、备案、全屏、验证码）
- OneBot 配置（WebSocket URL、QQ 号）

#### 4️⃣ **配置备份与恢复**
- 导出当前配置（JSON 格式）
- 导入配置文件
- 配置版本历史（可选）

---

## 二、页面结构设计

### 2.1 路由规划

```javascript
// src/router/index.js
{
  path: '/settings',
  name: 'Settings',
  component: SettingsView,
  children: [
    {
      path: '',
      name: 'SettingsOverview',
      component: () => import('@/views/settings/OverviewView.vue')
    },
    {
      path: 'llm-adapters',
      name: 'LLMAdapters',
      component: () => import('@/views/settings/LLMAdaptersView.vue')
    },
    {
      path: 'server',
      name: 'ServerConfig',
      component: () => import('@/views/settings/ServerConfigView.vue')
    },
    {
      path: 'web',
      name: 'WebConfig',
      component: () => import('@/views/settings/WebConfigView.vue')
    },
    {
      path: 'onebot',
      name: 'OnebotConfig',
      component: () => import('@/views/settings/OnebotConfigView.vue')
    }
  ]
}
```

### 2.2 页面层级关系

```
SettingsView (主容器)
├── Sidebar (侧边导航)
│   ├── 概览
│   ├── LLM 适配器 ⭐
│   ├── 服务器配置
│   ├── Web 配置
│   └── OneBot 配置
└── RouterView (内容区域)
    ├── OverviewView (概览页)
    ├── LLMAdaptersView (适配器管理) ⭐
    │   ├── AdapterCard (适配器卡片组件)
    │   ├── AdapterEditor (编辑器组件)
    │   └── ModelSelector (模型选择器)
    ├── ServerConfigView
    ├── WebConfigView
    └── OnebotConfigView
```

---

## 三、核心组件设计

### 3.1 LLM 适配器管理组件

#### **组件 A: `LLMAdaptersView.vue`** (页面主视图)

**功能**：
- 分类展示所有适配器实例（OpenAI / Gemini / Vertex AI）
- 添加新实例按钮
- 全局刷新模型列表按钮
- 批量操作（启用/禁用）

**数据结构**：
```javascript
{
  adapters: {
    openai: [...],
    gemini: [...],
    vertex: [...]
  },
  models: {
    'openai-1': [...],
    'gemini-1': [...]
  },
  loading: false,
  needRestart: false
}
```

**主要方法**：
```javascript
methods: {
  async fetchAdapters(),        // 获取所有适配器配置
  async refreshAllModels(),     // 刷新所有模型列表
  async addAdapter(type),       // 打开添加适配器对话框
  async deleteAdapter(type, index), // 删除适配器实例
  async toggleAdapter(type, index)  // 启用/禁用适配器
}
```

---

#### **组件 B: `AdapterCard.vue`** (适配器实例卡片)

**Props**：
```javascript
{
  adapter: Object,      // 适配器配置对象
  type: String,         // 'openai' | 'gemini' | 'vertex'
  index: Number,        // 实例索引
  models: Array,        // 模型列表
  modelCount: Number    // 模型数量
}
```

**UI 元素**：
```vue
<template>
  <el-card class="adapter-card">
    <!-- 头部 -->
    <div class="card-header">
      <el-tag :type="adapter.enable ? 'success' : 'info'">
        {{ adapter.enable ? '已启用' : '已禁用' }}
      </el-tag>
      <h3>{{ adapter.name }}</h3>
      <el-switch v-model="adapter.enable" @change="onToggle" />
    </div>
    
    <!-- 配置信息 -->
    <div class="card-body">
      <p><strong>API Key:</strong> {{ maskedApiKey }}</p>
      <p><strong>Base URL:</strong> {{ adapter.base_url }}</p>
      <p><strong>默认模型:</strong> {{ adapter.default_model }}</p>
      <p><strong>可用模型:</strong> {{ modelCount }} 个</p>
    </div>
    
    <!-- 操作按钮 -->
    <div class="card-actions">
      <el-button @click="onEdit" size="small">编辑</el-button>
      <el-button @click="onRefresh" size="small">刷新模型</el-button>
      <el-button @click="onDelete" type="danger" size="small">删除</el-button>
    </div>
  </el-card>
</template>
```

**计算属性**：
```javascript
computed: {
  maskedApiKey() {
    // sk-kQK***xtBA
    const key = this.adapter.api_key;
    return `${key.slice(0, 6)}***${key.slice(-4)}`;
  }
}
```

---

#### **组件 C: `AdapterEditor.vue`** (适配器编辑器对话框)

**Props**：
```javascript
{
  visible: Boolean,
  mode: String,        // 'add' | 'edit'
  type: String,        // 'openai' | 'gemini' | 'vertex'
  adapter: Object,     // 编辑模式下传入现有配置
  index: Number        // 编辑模式下传入索引
}
```

**表单字段**（根据类型动态渲染）：

**OpenAI**:
```javascript
{
  name: '',
  enable: true,
  api_key: '',
  base_url: 'https://api.openai.com/v1',
  default_model: '',
  guest_models: {
    keywords: [],
    full_name: []
  }
}
```

**Gemini**:
```javascript
{
  name: '',
  enable: true,
  api_key: '',
  base_url: 'https://generativelanguage.googleapis.com/v1beta',
  default_model: '',
  guest_models: { ... }
}
```

**Vertex AI** (更复杂):
```javascript
{
  name: '',
  enable: true,
  region: 'us-central1',
  service_account_json: '',  // JSON 字符串
  auth_file_path: '',        // 或文件路径
  models: [],                // 自定义模型列表
  default_model: '',
  guest_models: { ... }
}
```

**验证规则**：
```javascript
rules: {
  api_key: [
    { required: true, message: '请输入 API Key' },
    { min: 10, message: 'API Key 长度不足' }
  ],
  base_url: [
    { required: true, message: '请输入 Base URL' },
    { type: 'url', message: '请输入有效的 URL' }
  ],
  default_model: [
    { required: true, message: '请选择默认模型' }
  ]
}
```

**主要方法**：
```javascript
methods: {
  async onSubmit() {
    // 验证表单
    await this.$refs.form.validate();
    
    // 调用 API
    if (this.mode === 'add') {
      await this.addAdapter();
    } else {
      await this.updateAdapter();
    }
    
    // 刷新父组件
    this.$emit('success');
  },
  
  async addAdapter() {
    const response = await fetch(`/api/config/llm/${this.type}`, {
      method: 'POST',
      headers: {
        'X-Admin-Code': this.adminCode,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(this.form)
    });
    // 处理响应...
  },
  
  async updateAdapter() {
    // PUT /api/config/llm/:type/:index
  }
}
```

---

#### **组件 D: `ModelSelector.vue`** (模型选择器)

**Props**：
```javascript
{
  models: Array,         // 可选模型列表
  value: Object,         // v-model 绑定的 guest_models 对象
  showDefault: Boolean   // 是否显示默认模型选择
}
```

**UI 结构**：
```vue
<template>
  <div class="model-selector">
    <!-- 默认模型选择 -->
    <el-form-item label="默认模型" v-if="showDefault">
      <el-select v-model="defaultModel" filterable>
        <el-option
          v-for="model in models"
          :key="model"
          :label="model"
          :value="model"
        />
      </el-select>
    </el-form-item>
    
    <!-- 访客模型 - 关键词匹配 -->
    <el-form-item label="访客模型（关键词）">
      <el-tag
        v-for="keyword in guestModels.keywords"
        :key="keyword"
        closable
        @close="removeKeyword(keyword)"
      >
        {{ keyword }}
      </el-tag>
      <el-input
        v-model="newKeyword"
        @keyup.enter="addKeyword"
        placeholder="输入关键词后回车"
        size="small"
        style="width: 200px"
      />
    </el-form-item>
    
    <!-- 访客模型 - 完整名称 -->
    <el-form-item label="访客模型（完整名称）">
      <el-select
        v-model="guestModels.full_name"
        multiple
        filterable
        placeholder="选择模型"
      >
        <el-option
          v-for="model in models"
          :key="model"
          :label="model"
          :value="model"
        />
      </el-select>
    </el-form-item>
  </div>
</template>
```

---

### 3.2 配置管理服务封装

#### **服务层: `src/lib/configApi.js`**

```javascript
import { config } from './config.js';

class ConfigAPI {
  constructor() {
    this.baseURL = config.serverUrl || 'http://localhost:3080';
    this.adminCode = config.adminCode || '';
  }

  // 通用请求方法
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'X-Admin-Code': this.adminCode,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '请求失败');
    }

    return response.json();
  }

  // ========== 配置查询 ==========
  
  // 获取完整配置
  async getConfig() {
    return this.request('/api/config');
  }

  // 获取指定配置节点
  async getConfigSection(section) {
    return this.request(`/api/config/${section}`);
  }

  // ========== 配置修改 ==========
  
  // 更新完整配置
  async updateConfig(data) {
    return this.request('/api/config', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // 更新指定配置节点
  async updateConfigSection(section, data) {
    return this.request(`/api/config/${section}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // ========== LLM 适配器管理 ==========
  
  // 添加适配器实例
  async addAdapter(type, data) {
    return this.request(`/api/config/llm/${type}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // 更新适配器实例
  async updateAdapter(type, index, data) {
    return this.request(`/api/config/llm/${type}/${index}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // 删除适配器实例
  async deleteAdapter(type, index) {
    return this.request(`/api/config/llm/${type}/${index}`, {
      method: 'DELETE'
    });
  }

  // ========== 模型列表刷新 ==========
  
  // 刷新所有适配器模型列表
  async refreshAllModels() {
    return this.request('/api/config/refresh-models', {
      method: 'POST'
    });
  }

  // 刷新单个适配器实例模型列表
  async refreshAdapterModels(type, index) {
    return this.request(`/api/config/llm/${type}/${index}/refresh-models`, {
      method: 'POST'
    });
  }

  // ========== 配置验证与重置 ==========
  
  // 验证配置
  async validateConfig(data) {
    return this.request('/api/config/validate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // 重置配置
  async resetConfig() {
    return this.request('/api/config/reset', {
      method: 'POST'
    });
  }
}

export const configAPI = new ConfigAPI();
```

---

### 3.3 状态管理 (Pinia Store)

#### **Store: `src/stores/configStore.js`**

```javascript
import { defineStore } from 'pinia';
import { configAPI } from '@/lib/configApi.js';

export const useConfigStore = defineStore('config', {
  state: () => ({
    // 完整配置
    config: null,
    
    // LLM 适配器
    adapters: {
      openai: [],
      gemini: [],
      vertex: []
    },
    
    // 模型列表
    models: {},
    
    // 加载状态
    loading: false,
    
    // 是否需要重启服务
    needRestart: false,
    
    // 管理员验证码
    adminCode: localStorage.getItem('admin_code') || ''
  }),

  getters: {
    // 获取所有启用的适配器
    enabledAdapters(state) {
      const result = [];
      Object.entries(state.adapters).forEach(([type, instances]) => {
        instances.forEach((adapter, index) => {
          if (adapter.enable) {
            result.push({ type, index, ...adapter });
          }
        });
      });
      return result;
    },

    // 获取适配器总数
    totalAdapters(state) {
      return Object.values(state.adapters)
        .reduce((sum, arr) => sum + arr.length, 0);
    }
  },

  actions: {
    // 设置管理员验证码
    setAdminCode(code) {
      this.adminCode = code;
      localStorage.setItem('admin_code', code);
      configAPI.adminCode = code;
    },

    // 获取完整配置
    async fetchConfig() {
      this.loading = true;
      try {
        const response = await configAPI.getConfig();
        this.config = response.data;
        this.adapters = response.data.llm_adapters;
        return response.data;
      } catch (error) {
        console.error('获取配置失败:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // 添加适配器实例
    async addAdapter(type, data) {
      try {
        const response = await configAPI.addAdapter(type, data);
        
        // 更新本地状态（热更新，无需重启）
        this.adapters[type] = this.config.llm_adapters[type];
        this.models = response.data.models;
        
        return response.data;
      } catch (error) {
        console.error('添加适配器失败:', error);
        throw error;
      }
    },

    // 更新适配器实例
    async updateAdapter(type, index, data) {
      try {
        const response = await configAPI.updateAdapter(type, index, data);
        
        // 更新本地状态
        this.adapters[type][index] = data;
        this.models = response.data.models;
        
        return response.data;
      } catch (error) {
        console.error('更新适配器失败:', error);
        throw error;
      }
    },

    // 删除适配器实例
    async deleteAdapter(type, index) {
      try {
        const response = await configAPI.deleteAdapter(type, index);
        
        // 更新本地状态
        this.adapters[type].splice(index, 1);
        this.models = response.data.models;
        
        return response.data;
      } catch (error) {
        console.error('删除适配器失败:', error);
        throw error;
      }
    },

    // 刷新所有模型列表
    async refreshAllModels() {
      try {
        const response = await configAPI.refreshAllModels();
        this.models = response.data.models;
        return response.data;
      } catch (error) {
        console.error('刷新模型列表失败:', error);
        throw error;
      }
    },

    // 更新服务器配置
    async updateServerConfig(data) {
      try {
        await configAPI.updateConfigSection('server', data);
        this.config.server = data;
        this.needRestart = true; // 标记需要重启
      } catch (error) {
        console.error('更新服务器配置失败:', error);
        throw error;
      }
    }
  }
});
```

---

## 四、开发计划建议

### 阶段一：基础框架搭建 ✅ **已完成**

**任务清单**：
1. ✅ 创建配置管理服务 `configApi.js`
2. ✅ 创建 Pinia Store `configStore.js` (组合式 API)
3. ✅ 配置 main.js 注册 Pinia
4. ✅ 重构 `SettingsView.vue`，添加侧边导航 (组合式 API)
5. ✅ 创建概览页面 `OverviewView.vue` (组合式 API)
6. ✅ 配置路由嵌套结构
7. ✅ 创建占位页面 (LLMAdaptersView, ServerConfigView, WebConfigView, OnebotConfigView)

**验收标准**：
- ✅ 可以从后端获取完整配置并展示
- ✅ 侧边导航可以切换不同配置页面
- ✅ 管理员验证码输入和本地存储
- ✅ 概览页面展示统计信息和快速操作
- ✅ 全部采用组合式 API (Composition API)

**已完成功能**：
- 配置管理 API 服务层 (`configApi.js`)
- Pinia Store 状态管理 (`configStore.js`)
- 设置页面主框架 (侧边导航 + 路由视图)
- 概览页面 (统计卡片 + 快速操作 + 适配器概览)
- 管理员验证码认证
- 配置导出功能
- 模型列表刷新功能

---

### 阶段二：LLM 适配器管理（核心功能，3-4 天）

**任务清单**：
1. ✅ 创建配置管理服务 `configApi.js`
2. ✅ 创建 Pinia Store `configStore.js`
3. ✅ 重构 `SettingsView.vue`，添加侧边导航
4. ✅ 创建概览页面 `OverviewView.vue`
5. ✅ 配置路由嵌套结构

**验收标准**：
- 可以从后端获取完整配置并展示
- 侧边导航可以切换不同配置页面
- 管理员验证码输入和本地存储

---

### 阶段二：LLM 适配器管理（核心功能，3-4 天）

**任务清单**：
1. ✅ 创建 `LLMAdaptersView.vue` 主页面
2. ✅ 实现 `AdapterCard.vue` 组件
3. ✅ 实现 `AdapterEditor.vue` 编辑器
4. ✅ 实现 `ModelSelector.vue` 模型选择器
5. ✅ 集成添加、编辑、删除、刷新功能
6. ✅ 错误处理和用户反馈（Toast 提示）

**验收标准**：
- 可以查看所有适配器实例
- 可以添加 OpenAI、Gemini、Vertex AI 实例
- 可以编辑和删除实例
- 可以刷新单个或全部模型列表
- 表单验证正常工作

---

### 阶段三：通用配置编辑器 ✅ **已完成**

**任务清单**：
1. ✅ 创建 `ServerConfigView.vue` (组合式 API)
2. ✅ 创建 `WebConfigView.vue` (组合式 API)
3. ✅ 创建 `OnebotConfigView.vue` (组合式 API)
4. ✅ 实现配置保存和验证
5. ✅ 添加"需要重启服务"提示

**验收标准**：
- ✅ 可以编辑服务器、Web、OneBot 配置
- ✅ 保存后正确提示是否需要重启
- ✅ 表单验证完整
- ✅ 所有配置页面采用组合式 API

**已完成功能**：
- **ServerConfigView**: 端口、主机、限流、调试模式
- **WebConfigView**: 网站标题、备案号、验证码、全屏模式
- **OnebotConfigView**: 启用开关、WebSocket URL、Token、QQ 配置
- 完整的表单验证
- 二次确认对话框
- 重置功能

---

### 阶段四：高级功能和优化 (2-3 天)

**任务清单**：
1. ✅ 创建 `ServerConfigView.vue`
2. ✅ 创建 `WebConfigView.vue`
3. ✅ 创建 `OnebotConfigView.vue`
4. ✅ 实现配置保存和验证
5. ✅ 添加"需要重启服务"提示

**验收标准**：
- 可以编辑服务器、Web、OneBot 配置
- 保存后正确提示是否需要重启
- 表单验证完整

---

### 阶段四：高级功能和优化 (2-3 天)

**任务清单**：
1. ✅ 配置备份和导出（JSON 下载）
2. ✅ 配置导入（上传 JSON 文件）
3. ✅ 批量操作（批量启用/禁用适配器）
4. ✅ 配置对比功能（可选）
5. ✅ UI/UX 优化（加载动画、过渡效果）
6. ✅ 错误边界和异常处理

**验收标准**：
- 可以导出和导入配置
- 批量操作流畅
- 用户体验良好

---

### 阶段五：测试和文档 (1-2 天)

**任务清单**：
1. ✅ 单元测试（关键组件）
2. ✅ 集成测试（API 调用）
3. ✅ 浏览器兼容性测试
4. ✅ 编写用户文档
5. ✅ 代码审查和重构

---

## 五、技术选型和依赖

### 5.1 UI 组件库

推荐使用 **Element Plus**（项目已有依赖）：
- `el-card`: 适配器卡片
- `el-form`: 表单组件
- `el-dialog`: 编辑器对话框
- `el-select`: 模型选择器
- `el-switch`: 启用/禁用开关
- `el-tag`: 状态标签
- `el-button`: 操作按钮
- `el-message`: 提示消息

### 5.2 额外依赖（可选）

```bash
pnpm add axios                # HTTP 客户端（可替代 fetch）
pnpm add dayjs                # 日期处理（配置历史）
pnpm add file-saver           # 配置导出
```

---

## 六、UI/UX 设计建议

### 6.1 配置概览页面布局

```
┌─────────────────────────────────────────────────┐
│  配置概览                    [刷新模型] [重置全部] │
├─────────────────────────────────────────────────┤
│                                                 │
│  📊 统计信息                                     │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐      │
│  │ 12 个 │ │ 8 个  │ │ 156个 │ │ 正常  │      │
│  │适配器 │ │已启用 │ │ 模型  │ │ 状态  │      │
│  └───────┘ └───────┘ └───────┘ └───────┘      │
│                                                 │
│  🔧 快速操作                                     │
│  [LLM 适配器管理] [服务器配置] [Web 配置]        │
│                                                 │
│  ⚠️ 待处理事项                                   │
│  • 服务器配置已更改,需要重启服务                  │
│  • OpenAI-2 实例模型列表为空,请检查 API Key      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 6.2 LLM 适配器管理页面布局

```
┌─────────────────────────────────────────────────┐
│  LLM 适配器管理          [+ 添加适配器] [刷新全部] │
├─────────────────────────────────────────────────┤
│                                                 │
│  OpenAI (3 个实例)                              │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────┐│
│  │ ✅ 已启用    │ │ ❌ 已禁用    │ │ ✅ 已启用  ││
│  │ openai-1    │ │ 备用 OpenAI │ │ 测试实例  ││
│  │ 45 个模型   │ │ 0 个模型    │ │ 32 个模型 ││
│  │ gpt-4o      │ │ gpt-4-turbo │ │ gpt-4o    ││
│  │ [编辑][刷新]│ │ [编辑][删除]│ │ [编辑]    ││
│  └─────────────┘ └─────────────┘ └───────────┘│
│                                                 │
│  Gemini (1 个实例)                              │
│  ┌─────────────┐                                │
│  │ ✅ 已启用    │                                │
│  │ gemini-1    │                                │
│  │ 12 个模型   │                                │
│  │ gemini-2.0  │                                │
│  │ [编辑][刷新]│                                │
│  └─────────────┘                                │
│                                                 │
│  Vertex AI (0 个实例)                           │
│  [+ 添加 Vertex AI 实例]                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 6.3 适配器编辑器对话框

```
┌─────────────────────────────────────────────┐
│  添加 OpenAI 适配器实例               [×]   │
├─────────────────────────────────────────────┤
│                                             │
│  基本信息                                   │
│  ┌───────────────────────────────────────┐ │
│  │ 实例名称: [openai-1____________]      │ │
│  │           提示: 留空自动生成           │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  认证信息                                   │
│  ┌───────────────────────────────────────┐ │
│  │ API Key:  [sk-xxxxxxxxxxxx____] [👁️] │ │
│  │ Base URL: [https://api.openai.com/v1]│ │
│  └───────────────────────────────────────┘ │
│                                             │
│  模型配置                                   │
│  ┌───────────────────────────────────────┐ │
│  │ 默认模型: [gpt-4o ▼]                  │ │
│  │                                        │ │
│  │ 访客模型（关键词）:                    │ │
│  │ [gpt] [4o] [+ 添加]                   │ │
│  │                                        │ │
│  │ 访客模型（完整名称）:                  │ │
│  │ [gpt-4o, gpt-4o-mini ▼]               │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ☑️ 启用此实例                               │
│                                             │
│         [取消]  [保存并测试连接]            │
└─────────────────────────────────────────────┘
```

---

## 七、关键交互流程

### 7.1 添加适配器实例流程

```
用户点击"添加适配器"
    ↓
选择适配器类型（OpenAI / Gemini / Vertex）
    ↓
打开编辑器对话框，填写配置
    ↓
点击"保存并测试连接"
    ↓
前端验证表单 → 调用 POST /api/config/llm/:type
    ↓
后端返回结果（包含模型列表）
    ↓
成功: 关闭对话框，刷新列表，显示成功提示
失败: 显示错误信息（如 API Key 无效）
```

### 7.2 刷新模型列表流程

```
用户点击"刷新模型"按钮
    ↓
显示加载动画
    ↓
调用 POST /api/config/refresh-models
    ↓
后端从 LLM 提供商获取最新模型（3-10 秒）
    ↓
返回更新后的模型列表
    ↓
更新前端显示，关闭加载动画
    ↓
显示成功提示："已刷新 12 个适配器的模型列表"
```

### 7.3 配置保存流程（需要重启）

```
用户修改服务器配置（如端口）
    ↓
点击"保存"
    ↓
调用 PUT /api/config/server
    ↓
后端保存配置，返回"需要重启服务"提示
    ↓
前端显示警告横幅:
"⚠️ 配置已保存，但需要重启服务才能生效"
    ↓
提供"重启服务"按钮（可选）
```

---

## 八、待讨论问题

### 🤔 问题 1: 管理员验证码的获取方式

**方案 A**: 在设置页面入口要求输入验证码
```vue
<el-dialog title="请输入管理员验证码" :visible="!adminCode">
  <el-input v-model="inputCode" type="password" />
  <el-button @click="submitCode">确认</el-button>
</el-dialog>
```

**方案 B**: 在 `ProfileView.vue` 或全局设置中配置

您更倾向哪种方案？

---

### 🤔 问题 2: Vertex AI 服务账号 JSON 的上传方式

**方案 A**: 直接粘贴 JSON 字符串（文本框）
```vue
<el-input
  type="textarea"
  v-model="form.service_account_json"
  :rows="6"
  placeholder='{"type": "service_account", ...}'
/>
```

**方案 B**: 上传 JSON 文件，转换为字符串
```vue
<el-upload
  :before-upload="handleFileUpload"
  accept=".json"
>
  <el-button>上传服务账号 JSON</el-button>
</el-upload>
```

**方案 C**: 两者都支持

建议方案 C，提供更灵活的选择。

---

### 🤔 问题 3: 配置变更后的用户提示

对于**需要重启服务**的配置（服务器、OneBot），是否需要：

1. ✅ 在页面顶部显示持久化横幅
2. ✅ 提供"重启服务"按钮（调用后端 API）
3. ⚠️ 在保存时二次确认对话框

您的偏好？

---

### 🤔 问题 4: 模型列表的缓存策略

刷新模型需要 3-10 秒，是否需要：

1. ✅ 本地缓存模型列表（LocalStorage）
2. ✅ 定时自动刷新（可选，如每小时）
3. ⚠️ 离线模式（使用缓存的模型列表）

---

### 🤔 问题 5: 适配器实例的批量操作

是否需要支持：

1. ✅ 批量启用/禁用
2. ✅ 批量删除
3. ⚠️ 批量导出/导入
4. ⚠️ 适配器实例排序（拖拽调整顺序）

---

## 九、下一步行动

请您针对以上方案提出意见：

1. **功能优先级**：您认为哪些功能最重要，应该优先开发？
2. **UI/UX 调整**：布局和交互设计是否符合预期？
3. **技术选型**：是否使用 Axios 替代 Fetch？是否需要其他依赖？
4. **待讨论问题**：对 5 个问题的决策
5. **开发计划**：是否按照五阶段计划进行？时间安排是否合理？

我们可以先从**阶段一**开始实现基础框架，边开发边调整方案。您觉得如何？ 🚀

问题1的话不需要特殊处理，直接用访问码就行，访问码其实就是文档里的管理员验证码问题二方案C。问题三需要，都搞上 问题4 不需要 问题五需要的兄弟