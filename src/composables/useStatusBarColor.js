import { onMounted, onUnmounted, watch } from "vue";

export function useStatusBarColor(colorSource, onPhoneOnly = true) {
  const updateColor = () => {
    const isMobile = onPhoneOnly ? (window.innerWidth < 768) : true;
    if (isMobile) {
      const color = typeof colorSource === "function" ? colorSource() : (colorSource?.value || colorSource);
      document.documentElement.style.backgroundColor = color || "";
      document.body.style.backgroundColor = color || "";
    } else {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    }
  };

  onMounted(() => {
    updateColor();
    window.addEventListener("resize", updateColor);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", updateColor);
    document.documentElement.style.backgroundColor = "";
    document.body.style.backgroundColor = "";
  });

  // If colorSource is a function, we watch the getter
  if (typeof colorSource === "function") {
    watch(colorSource, () => {
      updateColor();
    });
  } 
  // If colorSource is a ref
  else if (typeof colorSource === "object" && colorSource !== null && "value" in colorSource) {
    watch(colorSource, () => {
      updateColor();
    });
  }
}
