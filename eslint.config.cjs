// eslint.config.js (CommonJS format)

// 1. 导入必要的模块
const js = require('@eslint/js'); // 提供了 eslint:recommended 配置
const pluginVue = require('eslint-plugin-vue'); // Vue ESLint 插件
const parserVue = require('vue-eslint-parser'); // 用于解析 .vue 文件
const prettierConfig = require('eslint-config-prettier'); // 禁用与 Prettier 冲突的规则

// 2. 定义 ESLint 扁平化配置数组
/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // -------------------------------------------------------------
  // 1. 全局忽略文件配置 (ignores)
  // 相当于旧配置中的 `ignorePatterns`
  {
    ignores: ['node_modules/', 'dist/', '**/dist/**'],
  },

  // -------------------------------------------------------------
  // 2. 基本 JavaScript/Node.js/Browser 配置
  // 相当于旧配置中的 `env`, `extends: ["eslint:recommended"]`, `parserOptions`
  // 和通用 `rules`
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs', '**/*.jsx'], // 作用于这些文件类型
    languageOptions: {
      ecmaVersion: 'latest', // 相当于 `parserOptions.ecmaVersion: "latest"`
      sourceType: 'module',  // 相当于 `parserOptions.sourceType: "module"`
      globals: {             // 相当于 `env`
        browser: true,
        node: true,
        es2021: true, // `es2021: true` 在 languageOptions 中通常通过 ecmaVersion 表达，这里保留以便理解原意
      },
    },
    // 扩展 ESLint 推荐规则
    ...js.configs.recommended, // 相当于 `extends: ["eslint:recommended"]`
    rules: {
      // 通用规则
      'no-unused-vars': 'warn',
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      // 'semi': 'off', // Prettier 会处理这个，在 Prettier 配置部分再禁用一次，确保它覆盖所有
    },
  },

  // -------------------------------------------------------------
  // 3. Vue 文件特定配置
  // 相当于旧配置中的 `extends: ["plugin:vue/vue3-recommended"]` 和 `overrides`
  {
    files: ['**/*.vue'], // 作用于所有的 .vue 文件
    languageOptions: {
      // Vue 文件需要特殊的解析器
      parser: parserVue,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // 如果你在 Vue SFCs 的 <script> 标签中使用 TypeScript，这里需要配置 TypeScript 解析器
        // parser: require('@typescript-eslint/parser'),
      },
    },
    plugins: {
      vue: pluginVue, // 注册 Vue 插件
    },
    // 扩展 Vue 推荐规则
    ...pluginVue.configs['vue3-recommended'], // 相当于 `extends: ["plugin:vue/vue3-recommended"]`
    rules: {
      // Vue 特定的规则
      'vue/no-unused-components': 'warn',
      'vue/component-name-in-template-casing': ['warn', 'PascalCase'],
      'vue/multi-word-component-names': 'off',

      // 来自旧配置 `overrides` 部分的规则，现在直接应用到 .vue 文件的配置中
      'no-unused-vars': 'off', // 在 Vue 文件中禁用 `no-unused-vars`
    },
  },

  // -------------------------------------------------------------
  // 4. Prettier 集成 (最后放置，以确保规则被正确禁用)
  // 相当于旧配置中的 `extends: ["@vue/eslint-config-prettier"]`
  prettierConfig, // 禁用所有与 Prettier 冲突的 ESLint 规则

  // 5. 其他被 Prettier 管理的规则（如果 `eslint-config-prettier` 没有完全覆盖，或者需要显式声明）
  {
      files: ['**/*.js', '**/*.cjs', '**/*.mjs', '**/*.jsx', '**/*.vue'],
      rules: {
          'semi': 'off', // 明确关闭分号规则，让 Prettier 处理
      }
  }
];