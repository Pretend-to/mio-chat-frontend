import { onMounted, onUnmounted, watch } from "vue";

export function useStatusBarColor(colorSource, onPhoneOnly = true) {
  let observer = null;

  const updateColor = () => {
    const isMobile = onPhoneOnly ? window.innerWidth < 768 : true;
    if (isMobile) {
      const color =
        typeof colorSource === "function"
          ? colorSource()
          : colorSource?.value || colorSource;

      let finalColor = color || "";
      if (finalColor.startsWith("var(")) {
        const varName = finalColor.slice(4, -1).trim();
        // Resolve the actual color value from computed styles of documentElement
        finalColor = getComputedStyle(document.documentElement)
          .getPropertyValue(varName)
          .trim();
      }

      // Convert rgba(...) to solid rgb(...) to avoid browser status bar blending issues
      if (finalColor && finalColor.includes("rgba")) {
        finalColor = finalColor.replace(
          /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\)/,
          "rgb($1, $2, $3)",
        );
      }

      // 1. Set background-color directly
      document.documentElement.style.backgroundColor = finalColor || "";
      document.body.style.backgroundColor = finalColor || "";

      // 2. Set/update <meta name="theme-color"> for device status bar
      let metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (!metaThemeColor) {
        metaThemeColor = document.createElement("meta");
        metaThemeColor.setAttribute("name", "theme-color");
        document.getElementsByTagName("head")[0].appendChild(metaThemeColor);
      }
      metaThemeColor.setAttribute("content", finalColor || "#ffffff");
    } else {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.removeAttribute("content");
      }
    }
  };

  onMounted(() => {
    updateColor();
    window.addEventListener("resize", updateColor);

    // Watch for theme changes on html element (data-theme or class changes)
    if (typeof window !== "undefined" && window.MutationObserver) {
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.type === "attributes" &&
            (mutation.attributeName === "data-theme" ||
              mutation.attributeName === "class")
          ) {
            updateColor();
            break;
          }
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });
    }
  });

  onUnmounted(() => {
    window.removeEventListener("resize", updateColor);
    if (observer) {
      observer.disconnect();
    }
    document.documentElement.style.backgroundColor = "";
    document.body.style.backgroundColor = "";
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.removeAttribute("content");
    }
  });

  // If colorSource is a function, we watch the getter
  if (typeof colorSource === "function") {
    watch(colorSource, () => {
      updateColor();
    });
  }
  // If colorSource is a ref
  else if (
    typeof colorSource === "object" &&
    colorSource !== null &&
    "value" in colorSource
  ) {
    watch(colorSource, () => {
      updateColor();
    });
  }
}
