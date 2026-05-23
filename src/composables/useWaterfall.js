import { computed, ref } from "vue";

/**
 * 真·瀑布流布局 Composable
 * @param {Ref} itemsRef 数据源响应式引用
 * @param {Ref} containerRef 容器 DOM 元素的引用
 * @param {Object} options 配置项
 */
export function useWaterfall(itemsRef, containerRef, options = {}) {
  const {
    gap = 16,
    minColWidth = 320,
    getId = (item) => item.id || item.name || Math.random(),
    initialHeight = 280,
  } = options;

  const cols = ref(3);
  const waterfallCards = ref([]);
  const containerWidth = ref(0);
  const containerHeight = ref(0);
  const cardHeightMap = new Map();

  // 响应式列数计算
  function calcColumns(w) {
    if (w < 600) return 1;
    if (w < 900) return 2;
    if (w < 1200) return 3;
    return 4;
  }

  // 列宽计算
  const colWidth = computed(() => {
    if (cols.value <= 0) return minColWidth;
    return (containerWidth.value - gap * (cols.value - 1)) / cols.value;
  });

  let ro = null; // 容器监听器
  let itemRo = null; // 卡片监听器

  /**
   * 核心布局算法：最短列优先
   */
  function layoutCards() {
    const items = itemsRef.value;
    if (!items || items.length === 0) {
      waterfallCards.value = [];
      containerHeight.value = 0;
      return;
    }

    const c = cols.value;
    const cw = colWidth.value;
    if (c <= 0 || cw <= 0) return;

    const heights = Array.from({ length: c }).fill(0);
    const cards = [];

    for (let i = 0; i < items.length; i++) {
      // 找到当前高度最短的列
      let minCol = 0;
      let minH = heights[0];
      for (let j = 1; j < c; j++) {
        if (heights[j] < minH) {
          minH = heights[j];
          minCol = j;
        }
      }

      const x = minCol * (cw + gap);
      const y = heights[minCol];
      // 优先从缓存中获取精确高度，否则使用预估高度
      const h = cardHeightMap.get(i) || initialHeight;

      cards.push({
        key: `wf-${i}-${getId(items[i])}`,
        data: items[i],
        style: {
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
          width: `${cw}px`,
        },
      });

      heights[minCol] += h + gap;
    }

    waterfallCards.value = cards;
    containerHeight.value = Math.max(...heights);
  }

  /**
   * 启动尺寸监听
   */
  function startObserve() {
    const el = containerRef.value;
    if (!el) return;

    // 初始宽度获取
    containerWidth.value = el.offsetWidth;
    cols.value = calcColumns(containerWidth.value);

    // 监听容器宽度变化
    ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0 && w !== containerWidth.value) {
        containerWidth.value = w;
        cols.value = calcColumns(w);
        layoutCards();
      }
    });
    ro.observe(el);

    // 监听每个卡片的高度变化
    itemRo = new ResizeObserver((entries) => {
      let changed = false;
      entries.forEach((entry) => {
        const idx = parseInt(entry.target.getAttribute("data-index"));
        const h = entry.contentRect.height;
        if (!isNaN(idx) && h > 0 && h !== cardHeightMap.get(idx)) {
          cardHeightMap.set(idx, h);
          changed = true;
        }
      });
      if (changed) layoutCards();
    });
  }

  /**
   * 停止所有监听
   */
  function stopObserve() {
    ro?.disconnect();
    itemRo?.disconnect();
  }

  /**
   * 批量观察卡片元素
   * @param {Array} elements DOM 元素列表或组件实例列表
   */
  function observeItems(elements) {
    if (!itemRo || !elements) return;
    elements.forEach((el) => {
      const dom = el?.$el || el;
      if (dom instanceof HTMLElement) {
        itemRo.observe(dom);
      }
    });
  }

  return {
    waterfallCards,
    waterfallStyle: computed(() => ({
      position: "relative",
      width: "100%",
      minHeight: containerHeight.value ? `${containerHeight.value}px` : "400px",
    })),
    startObserve,
    stopObserve,
    observeItems,
    layoutCards,
  };
}
