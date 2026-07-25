/**
 * 外观显示管理器 (主题 & 字体大小)
 */

let systemThemeListener = null;
let currentThemeSetting = "auto";

export function applyAppearanceSettings(appearance = {}) {
  const { theme = "auto", fontSize = "medium" } = appearance;
  currentThemeSetting = theme;

  // 1. 处理主题 (auto / light / dark)
  const applyTheme = () => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark =
      currentThemeSetting === "dark" ||
      (currentThemeSetting === "auto" && prefersDark);

    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  };

  applyTheme();

  // 监听系统主题变化（仅在 auto 模式下）
  if (!systemThemeListener) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemThemeListener = () => {
      if (currentThemeSetting === "auto") {
        applyTheme();
      }
    };
    mediaQuery.addEventListener("change", systemThemeListener);
  }

  // 2. 处理字体大小 (small / medium / large)
  document.documentElement.setAttribute("data-font-size", fontSize);
  let sizePx = "16px";
  let scale = "1.0";
  if (fontSize === "small") {
    sizePx = "14px";
    scale = "0.875";
  } else if (fontSize === "large") {
    sizePx = "18px";
    scale = "1.125";
  }

  document.documentElement.style.fontSize = sizePx;
  document.documentElement.style.setProperty("--mio-font-scale", scale);

  // 持久化预缓存一份，确保下次刷新首屏 0ms 生效
  try {
    localStorage.setItem(
      "client_settings_appearance",
      JSON.stringify({ theme, fontSize }),
    );
  } catch (e) {}
}

/**
 * 0ms 阶段从 localStorage 读取预缓存并挂载全局外观
 */
export function initAppearanceFromCache() {
  try {
    const cached = localStorage.getItem("client_settings_appearance");
    if (cached) {
      const parsed = JSON.parse(cached);
      applyAppearanceSettings(parsed);
      return;
    }
  } catch (e) {}
  applyAppearanceSettings({ theme: "auto", fontSize: "medium" });
}
