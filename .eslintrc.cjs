module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    "plugin:vue/vue3-recommended",
    "eslint:recommended",
    "@vue/eslint-config-prettier", // Uses eslint-config-prettier which disables ESLint rules that would conflict with prettier
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-unused-vars": "warn",
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    semi: "off", // Let Prettier handle semicolons
    "vue/no-unused-components": "warn",
    "vue/component-name-in-template-casing": ["warn", "PascalCase"],
    "vue/multi-word-component-names": "off",
  },
  ignorePatterns: ["node_modules/", "dist/", "**/dist/**"],
  overrides: [
    {
      files: ["*.vue"],
      rules: {
        "no-unused-vars": "off", // Disable no-unused-vars in Vue files - often necessary due to template usage
      },
    },
  ],
  globals: {
    io: "readonly",
  },
};
