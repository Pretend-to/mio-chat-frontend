import { ref, computed, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";

/**
 * 聊天界面滚动、自动吸底、分页加载与消息定位跳转
 */
export function useChatScroll({ activeContactor, scrollDefault = true }) {
  const route = useRoute();
  const router = useRouter();

  const chatWindow = ref(null);
  const messagesInner = ref(null);
  const prevScrollTop = ref(0);
  const autoScroll = ref(scrollDefault);
  const showRollDown = ref(false);
  const isLoadingHistory = ref(false);
  const renderedCount = ref(20);
  const isLocatingMessage = ref(false);
  const currentScrollTargetId = ref(null);

  let isObservingResize = false;
  let oldInnerHeight = 0;
  let observeTimer = null;

  const renderedMessages = computed(() => {
    const chain = activeContactor.value?.messageChain || [];
    if (chain.length <= renderedCount.value) {
      return chain;
    }
    return chain.slice(chain.length - renderedCount.value);
  });

  const toBottom = (behavior = "instant") => {
    nextTick(() => {
      const elm = chatWindow.value;
      if (elm) {
        elm.scrollTo({
          top: elm.scrollHeight,
          behavior,
        });
        autoScroll.value = true;
        showRollDown.value = false;
      }
    });
  };

  const locateMessage = (messageId, shouldFlash = true) => {
    if (!messageId) return;
    isLocatingMessage.value = true;

    const chain = activeContactor.value?.messageChain || [];
    const msgIndex = chain.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) {
      isLocatingMessage.value = false;
      return;
    }

    const currentRenderedStartIndex = chain.length - renderedCount.value;
    if (msgIndex < currentRenderedStartIndex) {
      renderedCount.value = Math.min(chain.length, chain.length - msgIndex + 10);
    }

    if (shouldFlash) {
      currentScrollTargetId.value = messageId;
    }

    const scrollContainer =
      chatWindow.value || document.getElementById("main-messages-window");

    const scrollToElement = (behavior = "smooth") => {
      const elm = scrollContainer;
      if (!elm) return false;
      const element = elm.querySelector(`[data-id="${messageId}"]`);
      if (!element) return false;

      const getElementOffsetTop = (el, container) => {
        let top = 0;
        let curr = el;
        while (curr && curr !== container) {
          top += curr.offsetTop;
          curr = curr.offsetParent;
        }
        return top;
      };
      const offsetTop = getElementOffsetTop(element, elm);
      elm.scrollTo({
        top: Math.max(0, offsetTop - elm.clientHeight * 0.3),
        behavior,
      });
      if (shouldFlash) {
        element.classList.add("highlight-flash");
      }
      return true;
    };

    let mutationObs = null;
    let resizeObs = null;
    let fallbackTimer = null;
    let stabilizeTimer = null;

    const cleanup = () => {
      mutationObs?.disconnect();
      mutationObs = null;
      resizeObs?.disconnect();
      resizeObs = null;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (stabilizeTimer) {
        clearTimeout(stabilizeTimer);
        stabilizeTimer = null;
      }
      scrollContainer?.removeEventListener("wheel", onUserInteract, {
        passive: true,
      });
      scrollContainer?.removeEventListener("touchstart", onUserInteract, {
        passive: true,
      });
      scrollContainer?.removeEventListener("mousedown", onUserInteract, {
        passive: true,
      });
      if (currentScrollTargetId.value === messageId) {
        currentScrollTargetId.value = null;
      }
      isLocatingMessage.value = false;
    };

    const onUserInteract = () => cleanup();

    const waitForElementAndScroll = () => {
      if (scrollToElement("smooth")) {
        startResizeTracking();
        return;
      }

      const innerContainer = messagesInner.value || scrollContainer;
      if (!innerContainer) {
        startResizeTracking();
        return;
      }

      mutationObs = new MutationObserver(() => {
        if (scrollToElement("instant")) {
          mutationObs?.disconnect();
          mutationObs = null;
          startResizeTracking();
        }
      });
      mutationObs.observe(innerContainer, { childList: true, subtree: true });
    };

    const startResizeTracking = () => {
      if (!scrollContainer) {
        cleanup();
        return;
      }

      const innerContainer = messagesInner.value || scrollContainer;
      resizeObs = new ResizeObserver(() => {
        scrollToElement("instant");
        if (stabilizeTimer) clearTimeout(stabilizeTimer);
        stabilizeTimer = setTimeout(() => {
          scrollToElement("instant");
          cleanup();
        }, 400);
      });
      resizeObs.observe(innerContainer);

      scrollContainer.addEventListener("wheel", onUserInteract, {
        passive: true,
      });
      scrollContainer.addEventListener("touchstart", onUserInteract, {
        passive: true,
      });
      scrollContainer.addEventListener("mousedown", onUserInteract, {
        passive: true,
      });

      fallbackTimer = setTimeout(() => {
        scrollToElement("instant");
        cleanup();
      }, 5000);
    };

    nextTick(() => {
      waitForElementAndScroll();

      if (shouldFlash) {
        router.replace({
          query: { ...route.query, scrollTo: undefined, t: undefined },
        });

        setTimeout(() => {
          const elm = scrollContainer;
          elm
            ?.querySelector(`[data-id="${messageId}"]`)
            ?.classList.remove("highlight-flash");
        }, 1200);

        setTimeout(() => {
          if (currentScrollTargetId.value === messageId) {
            currentScrollTargetId.value = null;
          }
        }, 5000);
      }
    });
  };

  const scrollHandler = (onMenuClose) => {
    const elm = chatWindow.value;
    if (!elm) return;

    const currentScrollTop = elm.scrollTop;
    const isScrollingUp = currentScrollTop < prevScrollTop.value;
    prevScrollTop.value = currentScrollTop;

    if (onMenuClose) onMenuClose();

    const distanceFromBottom =
      elm.scrollHeight - currentScrollTop - elm.clientHeight;
    const isAtBottom = distanceFromBottom <= 15;

    if (isAtBottom) {
      autoScroll.value = true;
      showRollDown.value = false;
    } else {
      if (isScrollingUp) {
        autoScroll.value = false;
        showRollDown.value = true;
      }
    }

    // 触顶加载更多历史
    if (
      currentScrollTop === 0 &&
      !isLoadingHistory.value &&
      !isLocatingMessage.value
    ) {
      const chain = activeContactor.value?.messageChain || [];
      if (renderedCount.value < chain.length) {
        isLoadingHistory.value = true;

        const currentElm = chatWindow.value;
        if (!currentElm) {
          isLoadingHistory.value = false;
          return;
        }

        const nextCount = Math.min(chain.length, renderedCount.value + 20);
        const startIndex = chain.length - nextCount;
        const endIndex = chain.length - renderedCount.value;
        const messagesToLoad = chain.slice(startIndex, endIndex);

        const imageUrls = [];
        const mdImageRegex = /!\[.*?\]\((.*?)\)/g;
        const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/g;

        for (const msg of messagesToLoad) {
          if (!msg || !msg.content) continue;
          for (const element of msg.content) {
            if (element.type === "image" && element.data && element.data.file) {
              imageUrls.push(element.data.file);
            } else if (
              element.type === "text" &&
              element.data &&
              element.data.text
            ) {
              let match;
              while ((match = mdImageRegex.exec(element.data.text)) !== null) {
                imageUrls.push(match[1]);
              }
              let htmlMatch;
              while (
                (htmlMatch = htmlImgRegex.exec(element.data.text)) !== null
              ) {
                imageUrls.push(htmlMatch[1]);
              }
            } else if (
              element.type === "tool_call" &&
              element.data &&
              element.data.extraRender
            ) {
              const extra = element.data.extraRender || [];
              for (const r of extra) {
                if (r.placement === "outer" && r.type === "image" && r.url) {
                  imageUrls.push(r.url);
                }
              }
            }
          }
        }

        const preloadImages = (urls) => {
          const promises = urls.map((url) => {
            return new Promise((resolve) => {
              const img = new Image();
              img.src = url;
              const timer = setTimeout(() => {
                resolve({ url, success: false, timeout: true });
              }, 6000);
              img.onload = () => {
                clearTimeout(timer);
                resolve({ url, success: true });
              };
              img.onerror = () => {
                clearTimeout(timer);
                resolve({ url, success: false });
              };
            });
          });
          return Promise.all(promises);
        };

        const delayPromise = new Promise((resolve) => setTimeout(resolve, 500));

        Promise.all([preloadImages(imageUrls), delayPromise]).then(() => {
          const currentElmAfterLoad = chatWindow.value;
          if (!currentElmAfterLoad) {
            isLoadingHistory.value = false;
            return;
          }

          const prevScrollPosFromBottom =
            currentElmAfterLoad.scrollHeight - currentElmAfterLoad.scrollTop;

          renderedCount.value = nextCount;
          isLoadingHistory.value = false;

          nextTick(() => {
            currentElmAfterLoad.scrollTop =
              currentElmAfterLoad.scrollHeight - prevScrollPosFromBottom;

            if (messagesInner.value) {
              oldInnerHeight = messagesInner.value.offsetHeight;
              isObservingResize = true;
              if (observeTimer) clearTimeout(observeTimer);
              observeTimer = setTimeout(() => {
                isObservingResize = false;
              }, 4000);
            }
          });
        });
      }
    }
  };

  return {
    chatWindow,
    messagesInner,
    autoScroll,
    showRollDown,
    isLoadingHistory,
    renderedCount,
    isLocatingMessage,
    currentScrollTargetId,
    renderedMessages,
    toBottom,
    locateMessage,
    scrollHandler,
  };
}
