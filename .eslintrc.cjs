/* eslint-env node */
// eslint-disable-next-line no-undef
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    "plugin:vue/vue3-recommended", // 使用 recommended 规则集
    "eslint:recommended",
    "@vue/eslint-config-prettier", // 移除 skip-formatting
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module", // 明确指定为 module
  },
  plugins: [
    // 插件列表
  ],
  rules: {
    "no-unused-vars": "warn", // 警告未使用的变量
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off", // 生产环境警告 console
    semi: "off", // 关闭 semi 规则 (由 Prettier 处理)

    // Vue 规则
    "vue/no-unused-components": "warn",
    "vue/component-name-in-template-casing": ["warn", "PascalCase"], // 组件名称使用 PascalCase
    "vue/multi-word-component-names": "off", // 关闭多单词组件名称的要求
  },

  ignorePatterns: ["node_modules/", "dist/", "**/dist/**"],
  overrides: [
    {
      files: ["*.vue"],
      rules: {
        "no-unused-vars": "off", // 在 Vue 文件中关闭 no-unused-vars 规则
      },
    },
  ],
};
