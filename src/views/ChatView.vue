<script setup>
import {
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onUpdated,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { ElMessage } from "element-plus";
import { snapdom } from "@zumer/snapdom";

// Components
import ChatHeader from "@/components/chat/ChatHeader.vue";
import MessageItem from "@/components/chat/MessageItem.vue";
import ScreenshotPreview from "@/components/chat/ScreenshotPreview.vue";
import InputEditor from "@/components/InputEditor.vue";
import ContextMenu from "@/components/ContextMenu.vue";

// Composables
import { useChatSelection } from "@/composables/useChatSelection.js";
import { useChatScreenshot } from "@/composables/useChatScreenshot.js";

// Stores & Libs
import { useConnectionStore } from "@/stores/connectionStore";
import { useContactorsStore, getShownTime } from "@/stores/contactorsStore.js";
import { client } from "@/lib/runtime.js";
import { shareOrCopy } from "@/utils/tools.js";
import { gateway } from "@/lib/gateway.js";
import { numberString } from "@/utils/generate.js";

// Markdown plugins
import {
  mermaidPlugin,
  codeBlockPlugin,
  cursorPlugin,
  imageViewerPlugin,
} from "mio-previewer/plugins/custom";
import { katexPlugin } from "mio-previewer/plugins/markdown-it";
import { CollectionTag, Close } from "@element-plus/icons-vue";

const route = useRoute();
const router = useRouter();

// Pinia stores
const connectionStore = useConnectionStore();
const { isConnected } = storeToRefs(connectionStore);
const contactorsStore = useContactorsStore();

// State definitions
let previewVal = false;
let scrollVal = true;

const url = new URL(window.location.href);
const params = url.searchParams;
if (params.has("preview")) {
  previewVal = params.get("preview") === "true";
}
if (params.has("scroll")) {
  scrollVal = params.get("scroll") !== "false";
}

const preview = ref(previewVal);
const scroll = ref(scrollVal);

// Speech Synthesis State & Functions
const currentSpeakingMessageId = ref(null);

const getSpeechText = (message) => {
  if (!message || !message.content) return "";
  return message.content
    .filter(elm => elm.type === "text")
    .map(elm => elm.data?.text || "")
    .join("\n")
    .trim();
};

const speakMessage = (message) => {
  if (!window.speechSynthesis) {
    ElMessage.warning("当前浏览器不支持语音合成");
    return;
  }

  if (currentSpeakingMessageId.value === message.id) {
    window.speechSynthesis.cancel();
    currentSpeakingMessageId.value = null;
    return;
  }

  window.speechSynthesis.cancel();
  const text = getSpeechText(message);
  if (!text) {
    ElMessage.info("没有可朗读的文本内容");
    return;
  }

  currentSpeakingMessageId.value = message.id;

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Find a good Chinese voice
  const voices = window.speechSynthesis.getVoices();
  const cnVoice = voices.find(v => v.lang.includes("zh-CN") || v.lang.includes("zh-"));
  if (cnVoice) {
    utterance.voice = cnVoice;
  }

  utterance.onend = () => {
    if (currentSpeakingMessageId.value === message.id) {
      currentSpeakingMessageId.value = null;
    }
  };

  utterance.onerror = () => {
    if (currentSpeakingMessageId.value === message.id) {
      currentSpeakingMessageId.value = null;
    }
  };

  window.speechSynthesis.speak(utterance);
};

// Sending message logic
const sendMessage = async (msg, toServer = true) => {
  const store = useContactorsStore();
  const contactor = store.activeContactor;
  if (!contactor) return;

  autoScroll.value = false;
  contactor.lastUpdate = Date.now();

  const exists = contactor.messageChain.some((m) => m.id === msg.id);
  if (!exists) {
    contactor.messageChain.push(msg);
  }

  const msgInChain = contactor.messageChain.find((m) => m.id === msg.id);

  if (contactor.platform === "onebot") {
    store.updateContactorSummary(contactor);
    client.setLocalStorage();

    toButtom();

    if (!toServer) return msg.id;

    try {
      const messageId = await gateway.send(
        "onebot",
        contactor.id,
        contactor.messageChain,
        msg.id,
      );
      if (msgInChain) {
        msgInChain.id = messageId;
      }
      msg.id = messageId;
      store.completeMessage(contactor.id, messageId);
      return messageId;
    } catch (e) {
      ElMessage.error(e.message || "发送失败");
      if (msgInChain) {
        msgInChain.status = "failed";
      }
      store.failedMessage(contactor.id, msg.id, e.message || "发送失败");
      throw e;
    }
  } else {
    // OpenAI platform
    toButtom();

    if (!toServer) {
      store.updateContactorSummary(contactor);
      client.setLocalStorage();
      return msg.id;
    }

    // Create assistant response placeholder
    const assistantMsgId = numberString(16);
    const assistantMsg = store.getOrCreateMessage(
      contactor.id,
      assistantMsgId,
      {
        role: "other",
        status: "pending",
        content: [{ type: "blank", data: {} }],
      },
    );

    store.updateContactorSummary(contactor);
    client.setLocalStorage();

    toButtom();

    if (msgInChain) {
      msgInChain.status = "pending";
    }
    try {
      await gateway.send(
        "openai",
        contactor.id,
        contactor.messageChain,
        assistantMsgId,
        contactor.options,
      );
      store.completeMessage(contactor.id, msg.id);
      return msg.id;
    } catch (e) {
      ElMessage.error(e.message || "请求失败");
      if (msgInChain) {
        msgInChain.status = "failed";
      }
      store.failedMessage(contactor.id, msg.id, e.message || "请求失败");
      store.failedMessage(
        contactor.id,
        assistantMsgId,
        e.message || "请求失败",
      );
      throw e;
    }
  }
};

const activeContactor = computed(() => {
  const contactor = contactorsStore.activeContactor;
  if (!contactor) return null;

  return new Proxy(contactor, {
    get(target, prop, receiver) {
      if (prop === "webSend") {
        return (container, toServer = true) => {
          return sendMessage(container, toServer);
        };
      }
      if (prop === "getBaseUserContainer") {
        return () => {
          return {
            role: "user",
            time: Date.now(),
            content: [],
            id: numberString(16),
            status: "pending",
          };
        };
      }
      if (prop === "emit") {
        return (event, ...args) => {
          if (event === "updateMessageSummary") {
            contactorsStore.updateContactorSummary(target);
          }
        };
      }
      if (prop === "getShownTime") {
        return (timestamp) => {
          return getShownTime(timestamp);
        };
      }
      if (prop === "loadName") {
        return () => {
          contactorsStore.loadContactorName(target);
        };
      }
      if (prop === "loadAvatar") {
        return () => {
          contactorsStore.loadContactorAvatar(target);
        };
      }
      if (prop === "getMessageById") {
        return (messageId) => {
          return target.messageChain.find((m) => m.id === messageId);
        };
      }
      if (prop === "delMessage") {
        return (messageId) => {
          contactorsStore.deleteMessageById(target.id, messageId);
        };
      }
      if (prop === "interruptMessage") {
        return (messageId) => {
          gateway.interrupt(target.platform, target.id, messageId);
        };
      }
      if (prop === "makeSystemMessage") {
        return (text) => {
          const systemMsg = {
            role: "mio_system",
            time: Date.now(),
            content: [
              {
                type: "text",
                data: { text },
              },
            ],
            id: numberString(16),
            status: "completed",
          };
          target.messageChain.push(systemMsg);
          client.setLocalStorage();
        };
      }
      if (prop === "updateFirstMessage") {
        return () => {
          target.firstMessageIndex = target.messageChain.length;
          client.setLocalStorage();
        };
      }

      const value = Reflect.get(target, prop, receiver);
      return value;
    },
    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      if (prop === "draft" || prop === "priority") {
        client.setLocalStorage();
      }
      return result;
    },
  });
});

const currentId = route.params.id;
try {
  const contactor = client.getContactor(currentId);
  if (!contactor) {
    throw new Error("找不到联系人");
  }
  contactorsStore.selectContactor(currentId);
} catch (e) {
  const defaultId = client.contactList[0]?.id || 0;
  router.push({
    path: `/chat/${defaultId}`,
    query: {
      preview: previewVal,
    },
  });
  contactorsStore.selectContactor(defaultId);
}

const showwindow = ref(true);
const showemoji = ref(false);
const userInput = ref("");
const extraOptions = ref([]);
const wraperPresets = ref({});
const selectedOption = ref(null);

const seletedText = ref("");
const seletedImage = ref("");
const retryList = ref([]);
const showMenu = ref(false);
const menuTop = ref(0);
const menuLeft = ref(0);
const lastClickTime = ref(0);
const validMessageIndex = ref(-1);
const inputEditor = ref(null);
const autoScroll = ref(false);
const fullScreen = ref(false);
const chatWindow = ref(null);
const prevScrollTop = ref(0);
const showRollDown = ref(false);
const inputBarTop = ref(0);
const clearMessageTip = "以上的对话记录已清除";
const loadingIcon = "<span id='message-loading-icon'></span>";
const katexPluginList = [{ plugin: katexPlugin }];

const mioPlugins = [
  { plugin: codeBlockPlugin },
  { plugin: mermaidPlugin },
  {
    plugin: cursorPlugin,
    options: { shape: "circle" },
  },
  { plugin: imageViewerPlugin },
];

// updateTrigger, forceUpdate and messageVersions are no longer needed —
// since activeContactor.value comes from Pinia reactive state, Vue 3 will
// automatically re-render whenever messageChain changes.
// We keep a toupdate flag for auto-scroll signalling only.

// Computed Properties
const getDelayStatus = computed(() => {
  return isConnected.value ? "ultra" : "offline";
});

const mdOptions = computed(() => {
  return { breaks: activeContactor.value?.platform === "onebot" };
});

const renderedCount = ref(20);

watch(
  () => [activeContactor.value?.id, activeContactor.value?.messageChain?.length],
  ([newId, newLength], [oldId, oldLength]) => {
    if (newId !== oldId) {
      renderedCount.value = 20;
    } else if (newLength !== undefined && oldLength !== undefined) {
      renderedCount.value = Math.max(20, renderedCount.value + (newLength - oldLength));
    }
  }
);

const activeMessageChain = computed(() => {
  const chain = activeContactor.value?.messageChain || [];
  if (chain.length <= renderedCount.value) {
    return chain;
  }
  return chain.slice(chain.length - renderedCount.value);
});

const openingMessage = computed(() => {
  const opening = activeContactor.value?.options?.presetSettings?.opening;
  if (!opening) return null;
  return {
    id: "opening-message",
    role: "other",
    content: [
      {
        type: "text",
        data: {
          text: opening,
        },
      },
    ],
    time: activeContactor.value.createTime,
  };
});

const openingTime = computed(() => {
  if (!activeContactor.value) return "";
  return activeContactor.value.getShownTime(activeContactor.value.createTime);
});

const getMenuStyle = computed(() => {
  if (window.innerWidth < 768) {
    const basicHeight = 160;
    if (menuTop.value - basicHeight < 0) {
      return {
        top: basicHeight + "px",
      };
    }
    return {
      bottom: window.innerHeight - menuTop.value + 16 + "px",
    };
  } else {
    const estimatedHeight = 340;
    const isUp = menuTop.value + estimatedHeight > window.innerHeight;
    const horizontalOffset = 150;

    const style = {};
    if (isUp) {
      style.bottom = window.innerHeight - menuTop.value + "px";
    } else {
      style.top = menuTop.value + "px";
    }

    if (menuLeft.value + horizontalOffset > window.innerWidth) {
      style.left = menuLeft.value - horizontalOffset + "px";
    } else {
      style.left = menuLeft.value + "px";
    }
    return style;
  }
});

// Selection & Screenshot states
const selectedMessages = ref([]);
const isMultiSelect = ref(false);
const isMobileDevice = ref(window.innerWidth < 768);

// Composable invocation
const {
  dragSelect,
  hasSelectedAbove,
  hasSelectedBelow,
  firstVisibleIndex,
  lastVisibleIndex,
  minSelectedIndex,
  maxSelectedIndex,
  toggleSelect,
  cancelMultiSelect,
  updateVisibilitySelectionState,
  handleMouseDown,
  handleMouseUpDrag,
  selectToTopHere,
  selectToBottomHere,
  handleMultiDelete,
  handleMultiCopy,
  handleMultiShareMD,
  handleMultiShareLink,
} = useChatSelection({
  chatWindowRef: chatWindow,
  activeMessageChain,
  selectedMessages,
  isMultiSelect,
  isMobileDevice,
});

const {
  showImagePreview,
  previewImageUrl,
  previewShareUrl,
  generatingImage,
  exportWidthMode,
  qrUrl,
  handleMultiShareImage,
  onExportWidthModeChange,
  generateScreenshot,
  downloadPreviewImage,
  shareMobilePreviewLink,
  copyPreviewImage,
} = useChatScreenshot({
  chatWindowRef: chatWindow,
  selectedMessages,
});

// Watchers
watch(
  () => activeContactor.value,
  (newVal) => {
    if (!newVal) {
      router.push("/");
    }
  },
);

watch(
  () => route.params.id,
  (newVal, oldVal) => {
    if (!newVal) return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      currentSpeakingMessageId.value = null;
    }

    // 清空上一个会话中残留的待处理交互浮层，防止跨会话串屏
    import("@/stores/interactionStore.js").then(({ useInteractionStore }) => {
      useInteractionStore().clearInteraction();
    });

    // Deactivate old contactor
    if (oldVal) {
      const oldContactor = contactorsStore.contactors[oldVal];
      if (oldContactor) {
        oldContactor.active = false;
      }
    }

    // Switch to new contactor in store
    contactorsStore.selectContactor(newVal);

    autoScroll.value = false;
    nextTick(() => {
      if (route.query.scrollTo) {
        performScrollToMessage(route.query.scrollTo);
      } else {
        toButtom();
        setTimeout(() => {
          toButtom();
        }, 100);
      }
    });

    // Sync with socket for the new contactor
    trySync();
  },
);

watch(
  () => route.query.scrollTo,
  (newVal) => {
    if (newVal) {
      performScrollToMessage(newVal);
    }
  },
);

watch(
  () => [activeMessageChain.value.length, activeContactor.value?.lastUpdate],
  () => {
    if (autoScroll.value) {
      toButtom();
    }
  }
);

watch(showImagePreview, (val) => {
  if (!val) {
    cancelMultiSelect();
  }
});

watch(isMultiSelect, (val) => {
  if (val) {
    nextTick(() => {
      updateVisibilitySelectionState();
    });
  } else {
    hasSelectedAbove.value = false;
    hasSelectedBelow.value = false;
  }
});

// Methods
const handlePluginsUpdated = () => {
  ElMessage.success("插件系统已同步，对话能力已实时刷新");
};

const handleBeforeUnload = () => {
  client.saveNow();
};

const handleMouseUp = () => {
  const selectedText = window.getSelection().toString();
  if (selectedText) {
    seletedText.value = selectedText;
    console.log("选中的文本：" + selectedText);
  }
};

const toButtom = (clicked) => {
  const execScroll = () => {
    const elm =
      chatWindow.value || document.getElementById("main-messages-window");
    if (!elm) return;

    elm.scrollTo({
      top: elm.scrollHeight,
      behavior: clicked === true ? "smooth" : "instant",
    });
  };

  if (clicked === true) {
    execScroll();
  }
  nextTick(() => requestAnimationFrame(execScroll));
};

const currentScrollTargetId = ref(null);

const performScrollToMessage = (messageId, shouldFlash = true) => {
  if (!messageId) return;
  autoScroll.value = false;

  const chain = activeContactor.value?.messageChain || [];
  const msgIndex = chain.findIndex(m => m.id === messageId);
  if (msgIndex !== -1) {
    const currentRenderedStartIndex = chain.length - renderedCount.value;
    if (msgIndex < currentRenderedStartIndex) {
      renderedCount.value = Math.min(chain.length, chain.length - msgIndex + 10);
    }
  }

  if (shouldFlash) {
    currentScrollTargetId.value = messageId;
  }

  const scrollAction = (behaviorOverride = null) => {
    const elm =
      chatWindow.value || document.getElementById("main-messages-window");
    if (!elm) return false;
    const element = elm.querySelector(`[data-id="${messageId}"]`);
    if (element) {
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
      const targetScrollTop = offsetTop - (elm.clientHeight * 0.3);
      
      const behavior = behaviorOverride || (shouldFlash ? "smooth" : "instant");
      elm.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: behavior,
      });
      if (shouldFlash) {
        element.classList.add("highlight-flash");
      }
      return true;
    }
    return false;
  };

  // Try scrolling immediately first
  const scrolledImmediately = scrollAction();

  nextTick(() => {
    if (!scrolledImmediately) {
      const scrolledInNextTick = scrollAction();
      if (!scrolledInNextTick) {
        setTimeout(scrollAction, 50);
      }
    }

    // 用 ResizeObserver 监听滚动容器 scrollHeight 变化
    // （Markdown/LaTeX 渲染会使任意消息高度变化，进而改变 target 在容器中的位置）
    const scrollContainer = chatWindow.value || document.getElementById("main-messages-window");
    if (scrollContainer) {
      let stabilizeTimer = null;
      let fallbackTimer = null;
      let observer = null;

      const cleanup = () => {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (stabilizeTimer) {
          clearTimeout(stabilizeTimer);
          stabilizeTimer = null;
        }
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        scrollContainer.removeEventListener("wheel", handleUserInteraction, { passive: true });
        scrollContainer.removeEventListener("touchstart", handleUserInteraction, { passive: true });
        scrollContainer.removeEventListener("mousedown", handleUserInteraction, { passive: true });
        
        if (currentScrollTargetId.value === messageId) {
          currentScrollTargetId.value = null;
        }
      };

      const handleUserInteraction = () => {
        // 用户手动滚动、点击或触控了，立即停止自动定位
        cleanup();
      };

      const prevScrollHeight = scrollContainer.scrollHeight;
      observer = new ResizeObserver(() => {
        // 只有 scrollHeight 变了才说明有内容渲染完成
        if (scrollContainer.scrollHeight === prevScrollHeight) return;
        scrollAction("instant");
        if (stabilizeTimer) clearTimeout(stabilizeTimer);
        // 连续 400ms 无变化 → 认为渲染稳定
        stabilizeTimer = setTimeout(() => {
          scrollAction("instant");
          cleanup();
        }, 400);
      });

      observer.observe(scrollContainer);

      // 监听用户交互事件以取消自动定位，避免覆盖用户手动操作
      scrollContainer.addEventListener("wheel", handleUserInteraction, { passive: true });
      scrollContainer.addEventListener("touchstart", handleUserInteraction, { passive: true });
      scrollContainer.addEventListener("mousedown", handleUserInteraction, { passive: true });

      // 安全兜底：最多等 5s
      fallbackTimer = setTimeout(() => {
        scrollAction("instant");
        cleanup();
      }, 5000);
    }

    if (shouldFlash) {
      // Consumed parameters: clear from URL query
      router.replace({
        query: { ...route.query, scrollTo: undefined, t: undefined },
      });

      // Release target lock and remove flash highlight after animation completes
      setTimeout(() => {
        const elm =
          chatWindow.value || document.getElementById("main-messages-window");
        const element = elm?.querySelector(`[data-id="${messageId}"]`);
        if (element) {
          element.classList.remove("highlight-flash");
        }
      }, 1200);
      
      // Keep scroll target id active for 5s to adjust to late image loading
      setTimeout(() => {
        if (currentScrollTargetId.value === messageId) {
          currentScrollTargetId.value = null;
        }
      }, 5000);
    }
  });
};

const cleanScreen = () => {
  activeContactor.value.messageChain = [];
  activeContactor.value.updateFirstMessage();
  client.setLocalStorage();
  activeContactor.value.emit("updateMessageSummary");

  autoScroll.value = false;
  ElMessage.success("已清除会话记录");
};

const cleanHistory = () => {
  activeContactor.value.updateFirstMessage();
  ElMessage.success("上下文信息已清除，之后的请求将不再记录上文记录");

  for (let i = activeContactor.value.messageChain.length - 1; i >= 0; i--) {
    const message = activeContactor.value.messageChain[i];
    if (
      message.role === "mio_system" &&
      message.content[0].type === "text" &&
      message.content[0].data.text === clearMessageTip
    ) {
      activeContactor.value.messageChain.splice(i, 1);
    }
  }
  activeContactor.value.makeSystemMessage(clearMessageTip);
  client.setLocalStorage();
};

const delSystemMessage = (index) => {
  const message = activeContactor.value.messageChain[index];
  if (
    message.content[0].type === "text" &&
    message.content[0].data.text === clearMessageTip
  ) {
    activeContactor.value.firstMessageIndex = 0;
  }
  activeContactor.value.messageChain.splice(index, 1);
  client.setLocalStorage();
};

const isValidInput = (input) => {
  const regex = /^[ \n]+$/;
  return !regex.test(input);
};

const waiting = () => {
  ElMessage.warning("此功能尚未开放");
};

const tolist = () => {
  router.push({ name: "home" });
};

const setModel = async (list) => {
  const provider = list[0];
  const model = list[2];
  activeContactor.value.options.provider = provider;
  activeContactor.value.options.base.model = model;
  activeContactor.value.loadAvatar();
  await client.setLocalStorage();
};

const toimg = async () => {
  const result = await snapdom(chatWindow.value);
  await result.download({ format: "png", filename: "chat.png" });
};

const share = async () => {
  const shareResult = await client.shareContactor(activeContactor.value.id);
  if (shareResult && shareResult.shareUrl) {
    const { shareUrl } = shareResult;
    const { success, message } = shareOrCopy(shareUrl);
    if (success) {
      ElMessage.success(message);
    } else {
      ElMessage.error(message);
    }
  }
};

const showTime = (index) => {
  const list = activeMessageChain.value;
  const thisTime = list[index].time;
  if (index === 0) {
    return {
      show: true,
      time: activeContactor.value.getShownTime(thisTime),
    };
  } else {
    const earlyTime = list[index - 1].time;
    if (thisTime - earlyTime > 600000) {
      return {
        show: true,
        time: activeContactor.value.getShownTime(thisTime),
      };
    } else {
      return {
        show: false,
        time: "",
      };
    }
  }
};

const separateTextAndImages = (markdownText) => {
  const regex = /!\[([^\]]*)\]\((.*)\)/g;
  let result = [];
  let lastIndex = 0;

  let matches;
  while ((matches = regex.exec(markdownText)) !== null) {
    if (matches.index > lastIndex) {
      const textContent = markdownText.slice(lastIndex, matches.index).trim();
      if (textContent) {
        result.push({
          type: "text",
          data: {
            text: textContent,
          },
        });
      }
    }

    result.push({
      type: "image",
      data: {
        file: matches[2],
      },
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < markdownText.length) {
    const textContent = markdownText.slice(lastIndex).trim();
    if (textContent) {
      result.push({
        type: "text",
        data: {
          text: textContent,
        },
      });
    }
  }

  return result;
};

const getChatwindowScrollheight = () => {
  if (!chatWindow.value) return 0;
  const scrollTop = chatWindow.value.scrollTop;
  const clientHeight = chatWindow.value.clientHeight;
  const scrollHeight = chatWindow.value.scrollHeight;

  const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
  const height = scrollPercentage * scrollHeight;

  return scrollHeight - height;
};

const trySync = () => {
  const contactor = activeContactor.value;
  if (!contactor) return;

  if (client.socket && client.socket.available) {
    client.socket.enterChat(contactor.id);
    if (contactor.hasPendingTask) {
      contactor.hasPendingTask = false;
      client.setLocalStorage();
    }
  }
};

const getReplyText = (id) => {
  let content = "";
  const message = activeContactor.value.messageChain.find(
    (item) => item.id === id || String(item.id) === String(id),
  );
  if (message) {
    message.content.forEach((element) => {
      if (element.type === "text") {
        content += element.data.text;
      } else if (element.type === "image") {
        content += "[图片]";
      }
    });
    return content.trim().slice(0, 20);
  } else {
    return "[消息已删除] ";
  }
};

const showMessageMenu = (event, messageIndex) => {
  if (
    event.target &&
    event.target.tagName &&
    event.target.tagName.toLowerCase() === "img"
  ) {
    const imgElement = event.target;
    seletedImage.value = imgElement.src;
  }
  validMessageIndex.value = messageIndex;
  if (event.preventDefault) event.preventDefault();
  showMenu.value = true;
  menuTop.value = event.clientY;
  menuLeft.value = event.clientX;

  const currentSelectedText = window.getSelection().toString();
  if (currentSelectedText) {
    seletedText.value = currentSelectedText;
  } else {
    seletedText.value = "";
  }
};

const handleTouchStart = (event, index) => {
  const now = Date.now();
  const delay = now - lastClickTime.value;

  if (delay < 300 && delay > 0) {
    if (event.cancelable) event.preventDefault();
    const touch = event.touches[0];
    const syntheticEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      target: event.target,
      preventDefault: () => {
        if (event.preventDefault) event.preventDefault();
      },
    };
    showMessageMenu(syntheticEvent, index);
    lastClickTime.value = 0;
  } else {
    lastClickTime.value = now;
  }
};

const toProfile = () => {
  router.push({
    name: "profile_view",
    params: {
      id: activeContactor.value.id,
    },
  });
};

const handleRetryMessage = async (item) => {
  const contactor = activeContactor.value;
  if (!contactor) return;

  if (contactor.platform === "onebot") {
    item.status = "pending";
    item.time = Date.now();
    client.setLocalStorage();
    try {
      await contactor.webSend(item);
      ElMessage.success("消息已重新发送");
    } catch (e) {
      // Error handled in sendMessage
    }
  } else {
    // OpenAI platform retry
    const idx = contactor.messageChain.findIndex((m) => m.id === item.id);
    if (idx === -1) return;

    item.status = "pending";
    item.time = Date.now();

    const targetIndex = idx + 1;
    let assistantMsg = contactor.messageChain[targetIndex];
    if (!assistantMsg || assistantMsg.role !== "other") {
      assistantMsg = {
        role: "other",
        time: Date.now(),
        content: [{ type: "blank", data: {} }],
        id: numberString(16),
        status: "pending",
      };
      contactor.messageChain.splice(targetIndex, 0, assistantMsg);
    } else {
      assistantMsg.content = [{ type: "blank", data: {} }];
      assistantMsg.time = Date.now();
      assistantMsg.status = "pending";
    }

    client.setLocalStorage();
    autoScroll.value = false;
    toButtom();

    try {
      await gateway.send(
        contactor.platform,
        contactor.id,
        contactor.messageChain,
        assistantMsg.id,
        contactor.options,
      );
      item.status = "completed";
      client.setLocalStorage();
    } catch (error) {
      ElMessage.error(error.message || "重试失败");
      item.status = "failed";
      assistantMsg.status = "failed";
      client.setLocalStorage();
    }
  }
};

const handleDeleteMessage = (item) => {
  activeContactor.value.delMessage(item.id);
  client.setLocalStorage();
  ElMessage.success("消息已删除");
};

const scrollHandler = () => {
  const elm = chatWindow.value;
  if (!elm) return;

  const currentScrollTop = elm.scrollTop;
  const isScrollingUp = currentScrollTop < prevScrollTop.value;
  prevScrollTop.value = currentScrollTop;

  showMenu.value = false;
  if (showemoji.value) showemoji.value = false;

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

  if (currentScrollTop === 0) {
    const chain = activeContactor.value?.messageChain || [];
    if (renderedCount.value < chain.length) {
      const prevScrollHeight = elm.scrollHeight;
      renderedCount.value = Math.min(chain.length, renderedCount.value + 20);
      nextTick(() => {
        elm.scrollTop = elm.scrollHeight - prevScrollHeight;
      });
    }
  }

  if (isMultiSelect.value) {
    updateVisibilitySelectionState();
  }
};

const getseletedMessage = () => {
  return activeContactor.value.messageChain[validMessageIndex.value];
};

const handleMessageOption = async (option) => {
  const message = getseletedMessage();
  switch (option) {
    case "multi-select":
      isMultiSelect.value = true;
      if (message && message.id) {
        selectedMessages.value.push(message.id);
      }
      break;
    case "retry":
      if (activeContactor.value.platform === "onebot") {
        const msgToSend = {
          ...message,
          role: "user",
          id: numberString(16),
          status: "pending",
          time: Date.now(),
        };
        activeContactor.value.webSend(msgToSend);
        ElMessage.success("消息已重新发送");
      } else {
        const contactor = contactorsStore.activeContactor;
        const targetIndex =
          message.role === "user"
            ? validMessageIndex.value + 1
            : validMessageIndex.value;
        let validMessage = contactor.messageChain[targetIndex];
        if (!validMessage || validMessage.role !== "other") {
          // Insert a fresh assistant placeholder at the target index
          validMessage = {
            role: "other",
            time: Date.now(),
            content: [{ type: "blank", data: {} }],
            id: numberString(16),
            status: "pending",
          };
          contactor.messageChain.splice(targetIndex, 0, validMessage);
          client.setLocalStorage();
        } else {
          // make the existing assistant message editable and reset its content
          validMessage.content = [{ type: "blank", data: {} }];
          validMessage.time = Date.now();
        }
        if (validMessage.status === "retrying") {
          ElMessage.warning("该消息正在重试中");
          return;
        }
        validMessage.status = "retrying";
        retryList.value.push(validMessage.id);
        try {
          await gateway.send(
            contactor.platform,
            contactor.id,
            contactor.messageChain,
            validMessage.id,
            contactor.options,
          );
          client.saveNow();
        } catch (error) {
          ElMessage.error(error.message || "重试失败");
          validMessage.status = "failed";
          return;
        }
      }
      autoScroll.value = false;
      toButtom();
      break;
    case "reply":
      if (inputEditor.value) {
        inputEditor.value.insertReplyBadge(message);
        ElMessage.success("已引用该消息");
      }
      break;
    case "delete":
      activeContactor.value.delMessage(message.id);
      client.setLocalStorage();
      break;
    case "stop":
      activeContactor.value.interruptMessage(message.id);
      break;
    case "toggle-pin":
      if (message) {
        message.isPinned = !message.isPinned;
        client.setLocalStorage();
        ElMessage.success(message.isPinned ? "消息已钉住" : "已取消钉住");
      }
      break;
    case "read-aloud":
      speakMessage(message);
      break;
  }
  showMenu.value = false;
};

const handleMessageClick = (item) => {
  if (isMultiSelect.value && item.role !== "mio_system") {
    toggleSelect(item.id);
  }
};

const handleImageLoad = (e) => {
  if (e.target.tagName === "IMG") {
    const elm = chatWindow.value;
    if (!elm) return;

    // Recalculate and re-adjust scroll position when any image finishes loading
    if (currentScrollTargetId.value) {
      performScrollToMessage(currentScrollTargetId.value, false);
    }

    const isNearBottom =
      elm.scrollHeight - elm.scrollTop - elm.clientHeight < 150;
    if (isNearBottom) {
      toButtom();
    }
  }
};

// Lifecycle Hooks
const resizeHandler = ref(null);
const focusHandler = ref(null);

onMounted(() => {
  document.addEventListener("click", () => {
    showMenu.value = false;
    seletedText.value = "";
    seletedImage.value = "";
  });

  if (chatWindow.value) {
    chatWindow.value.addEventListener("scroll", scrollHandler);
    chatWindow.value.addEventListener("mousedown", handleMouseDown);
    chatWindow.value.addEventListener("load", handleImageLoad, true);
  }

  autoScroll.value = false;
  if (!preview.value && scroll.value) {
    nextTick(() => {
      if (route.query.scrollTo) {
        performScrollToMessage(route.query.scrollTo);
      } else {
        toButtom();
        setTimeout(() => {
          toButtom();
        }, 100);
      }
    });
  }

  // Sync with socket on mount
  trySync();
  if (client.socket) {
    client.socket.on("connect", trySync);
  }
  client.on("socket_ready", (socket) => {
    socket.on("connect", trySync);
    trySync();
  });

  fullScreen.value = client.socket?.fullScreen;

  resizeHandler.value = () => {
    isMobileDevice.value = window.innerWidth < 768;
  };
  window.addEventListener("resize", resizeHandler.value);

  focusHandler.value = () => {
    if (dragSelect.isDown) {
      handleMouseUpDrag();
    }
  };
  window.addEventListener("blur", focusHandler.value);

  const element = document.querySelector(".input-bar");
  if (element) {
    const pageHeight = window.innerHeight;
    inputBarTop.value = pageHeight - element.offsetTop;
  }

  client.on("plugins_updated", handlePluginsUpdated);
  client.on("scroll_to_message", performScrollToMessage);
  window.addEventListener("beforeunload", handleBeforeUnload);
});

onBeforeUnmount(() => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  client.off("plugins_updated", handlePluginsUpdated);
  client.off("scroll_to_message", performScrollToMessage);
  client.off("socket_ready");
  window.removeEventListener("beforeunload", handleBeforeUnload);

  if (client.socket) {
    client.socket.off("connect", trySync);
  }

  // Mark contactor as inactive on leave
  const contactor = contactorsStore.activeContactor;
  if (contactor) {
    contactor.active = false;
  }

  client.saveNow();

  if (chatWindow.value) {
    chatWindow.value.removeEventListener("scroll", scrollHandler);
    chatWindow.value.removeEventListener("mousedown", handleMouseDown);
    chatWindow.value.removeEventListener("load", handleImageLoad, true);
  }

  window.removeEventListener("resize", resizeHandler.value);
  window.removeEventListener("blur", focusHandler.value);
});
</script>

<template>
  <div id="chat-window" v-if="activeContactor">
    <ChatHeader
      :active-contactor="activeContactor"
      @back="tolist"
      @to-profile="toProfile"
      @share="share"
    />

    <!-- Selection Banners -->
    <transition name="select-banner-fade">
      <div
        v-if="isMultiSelect && hasSelectedBelow"
        class="select-banner top"
        @click="selectToTopHere"
      >
        <i class="iconfont down1"></i>
        <span>选择到此处</span>
      </div>
    </transition>
    <transition name="select-banner-fade">
      <div
        v-if="isMultiSelect && hasSelectedAbove"
        class="select-banner bottom"
        @click="selectToBottomHere"
      >
        <i
          class="iconfont down1"
          style="transform: rotate(180deg); display: inline-block"
        ></i>
        <span>选择到此处</span>
      </div>
    </transition>

    <div
      id="main-messages-window"
      ref="chatWindow"
      :class="{
        'message-window': true,
        preview: preview,
        'is-dragging': dragSelect.active,
      }"
    >
      <div
        v-if="showRollDown"
        id="roll-buttom-button"
        :style="{ bottom: inputBarTop + 24 + 'px' }"
        @click="toButtom(true)"
      >
        <i class="iconfont down1"></i>
      </div>
      <ContextMenu
        v-if="showMenu"
        type="message"
        :message="getseletedMessage()"
        :seleted-text
        :seleted-image
        :style="getMenuStyle"
        :client-x="menuLeft"
        :current-speaking-message-id="currentSpeakingMessageId"
        @message-option="handleMessageOption"
        @close="showMenu = false"
      />

      <!-- Opening Message -->
      <MessageItem
        v-if="openingMessage"
        :item="openingMessage"
        :index="-1"
        :activeContactor="activeContactor"
        :isOpening="true"
        :mioPlugins="mioPlugins"
        :katexPluginList="katexPluginList"
        :mdOptions="mdOptions"
        @to-profile="toProfile"
      />

      <MessageItem
        v-for="(item, index) of activeMessageChain"
        :key="`${activeContactor.id}-${item.id}`"
        :item="item"
        :index="index"
        :updateTrigger="0"
        :activeContactor="activeContactor"
        :isMultiSelect="isMultiSelect"
        :isSelected="selectedMessages.includes(item.id)"
        :showTimeInfo="showTime(index)"
        :mioPlugins="mioPlugins"
        :katexPluginList="katexPluginList"
        :mdOptions="mdOptions"
        @click-message="handleMessageClick"
        @toggle-checkbox="toggleSelect"
        @to-profile="toProfile"
        @mouseup-content="handleMouseUp"
        @contextmenu-content="showMessageMenu"
        @touchstart-content="handleTouchStart"
        @delete-system="delSystemMessage"
        @retry-message="handleRetryMessage"
        @delete-message="handleDeleteMessage"
      />

      <!-- Selection Rectangle for Desktop Drag-Select -->
      <div
        v-if="dragSelect.active"
        class="drag-select-rect"
        :style="{
          left: dragSelect.left + 'px',
          top: dragSelect.top + 'px',
          width: dragSelect.width + 'px',
          height: dragSelect.height + 'px',
        }"
      ></div>
    </div>

    <InputEditor
      v-if="!isMultiSelect"
      ref="inputEditor"
      :active-contactor="activeContactor"
      @stroge="client.setLocalStorage()"
      @set-model="setModel"
      @clean-screen="cleanScreen"
      @clean-history="cleanHistory"
      @to-buttom="toButtom"
    />

    <div v-else class="multi-select-action-bar">
      <div class="actions">
        <div
          class="action-btn hide-mobile"
          @click="handleMultiShareMD(activeContactor, client.name)"
        >
          <span class="action-icon"><i class="iconfont icon-share"></i></span>
          <span class="action-label">导出MD</span>
        </div>
        <div class="action-btn" @click="handleMultiShareImage(activeContactor)">
          <span class="action-icon"><i class="iconfont icon-share"></i></span>
          <span class="action-label">导出图片</span>
        </div>
        <div
          class="action-btn hide-mobile"
          @click="handleMultiShareLink(activeContactor)"
        >
          <span class="action-icon"><i class="iconfont icon-share"></i></span>
          <span class="action-label">分享链接</span>
        </div>
        <div
          class="action-btn"
          @click="handleMultiCopy(activeContactor, client.name)"
        >
          <span class="action-icon"><i class="iconfont fuzhi"></i></span>
          <span class="action-label">复制</span>
        </div>
        <el-popconfirm
          title="此操作不可撤销"
          confirm-button-text="确定"
          cancel-button-text="取消"
          placement="top"
          @confirm="handleMultiDelete(activeContactor)"
        >
          <template #reference>
            <div class="action-btn">
              <span class="action-icon"><i class="iconfont shanchu"></i></span>
              <span class="action-label">删除</span>
            </div>
          </template>
        </el-popconfirm>
      </div>
      <button
        class="close-btn"
        @click="cancelMultiSelect"
        aria-label="取消多选"
      >
        &times;
      </button>
    </div>

    <!-- Screenshot Preview Dialog & Drawer -->
    <ScreenshotPreview
      v-model="showImagePreview"
      v-model:exportWidthMode="exportWidthMode"
      :generatingImage="generatingImage"
      :previewImageUrl="previewImageUrl"
      :qrUrl="qrUrl"
      :previewShareUrl="previewShareUrl"
      :isMobileDevice="isMobileDevice"
      @close="cancelMultiSelect"
      @copy="copyPreviewImage"
      @download="downloadPreviewImage"
      @share-link="shareMobilePreviewLink"
      @width-mode-change="onExportWidthModeChange"
    />
  </div>
</template>

<style lang="sass" scoped>
$mobile: 768px
$icon-hover: #09f

.preview
    position: fixed
    top: 0
    left: 0
    width: 100vw
    height: 100vh
    z-index: 10000

#chat-window
    z-index: 1
    min-width: 0.0625rem
    position: relative
    display: flex
    flex-grow: 1
    background-color: #f2f2f2
    flex-direction: column




.multi-select-action-bar
    flex-shrink: 0
    flex-basis: 11rem
    border-top: 0.0625rem solid rgba(128, 128, 128, 0.502)
    display: flex
    flex-direction: row
    align-items: center
    justify-content: center
    padding: 0 1.5rem
    position: relative

    @media (max-width: $mobile)
        border-top: none
        height: 5rem
        padding: 0
        width: 100%
        position: fixed
        bottom: 0
        z-index: 1000
        background-color: hsla(0, 0%, 100%, 0.8)
        backdrop-filter: blur(0.5rem)

    .actions
        display: flex
        flex-direction: row
        align-items: center
        justify-content: center
        gap: 2.5rem
        flex: 1

    .action-btn
        display: flex
        flex-direction: column
        align-items: center
        justify-content: center
        cursor: pointer
        color: #333
        flex-shrink: 0
        gap: 0.4rem
        transition: opacity 0.2s

        &.hide-mobile
            @media (max-width: $mobile)
                display: none

        &:hover
            opacity: 0.7

        .action-icon
            width: 2.8rem
            height: 2.8rem
            border-radius: 50%
            background-color: #fff
            display: flex
            align-items: center
            justify-content: center
            transition: background-color 0.2s

            i
                font-size: 1.25rem
                color: #333

        &:hover .action-icon
            background-color: #f2f2f2

        .action-label
            font-size: 0.72rem
            color: #555
            white-space: nowrap

            @media (max-width: $mobile)
                display: none

    .close-btn
        position: absolute
        right: 1.25rem
        top: 50%
        transform: translateY(-50%)
        font-size: 1.4rem
        color: #999
        cursor: pointer
        line-height: 1
        padding: 0.25rem 0.5rem
        border-radius: 50%
        background: transparent
        border: none
        outline: none
        transition: color 0.2s, background-color 0.2s
        user-select: none

        &:hover
            color: #333
            background-color: #f2f2f2




.black-overlay
    position: fixed
    top: 0
    left: 0
    width: 100%
    height: 100%
    background-color: rgba(0, 0, 0, 0.4)
    z-index: 1001
/* z-index 属性设置元素的堆叠顺序。*/

#roll-buttom-button
    position: fixed
    right: 0.5rem
    cursor: pointer
    display: flex
    z-index: 1000
    background-color: #fff
    width: 4rem
    height: 1.5rem
    border-radius: 0.75rem
    align-items: center
    justify-content: center
    box-shadow: 0 0 0.25rem rgba(0, 0, 0, 0.2)
    transition: background-color 0.3s ease, transform 0.3s ease
    &:hover
        background-color: #f0f0f0
        transform: scale(1.1)

    &:hover
        color: $icon-hover
    i
        font-size: 1rem

#theimg
    position: fixed
    top: 50%
    left: 50%
    transform: translate(-50%, -50%)
    max-height: 75%
    max-width: 50%
.background img
    position: absolute
    top: 50%
    left: 50%
    transform: translate(-50%, -50%)


.window-controls
    display: flex
    flex-basis: 100%

    @media (max-width: $mobile)
        display: none

    .button
        display: flex
        justify-content: center
        padding-top: 0.5rem
        flex: 0 0 2rem

        &:hover
            background-color: rgb(231, 231, 231)

        &#close:hover
            background-color: rgb(255, 0, 0)
            color: white


.button#close:hover svg path
    fill: #fff


.voice-box
    display: flex
    width: 11.25rem
    height: 1.5rem
    margin: 0.25rem 0

    .icon
        flex-basis: 1.5rem
        background-color: rgb(0, 0, 0)
        display: flex
        justify-content: center
        align-items: center
        border-radius: 50%

    .wave
        display: flex
        justify-content: center
        align-items: center
        flex-grow: 1

.wave svg
    height: 1.25rem
    width: 80%

.loader
    width: 0.625rem
    padding: 0.25rem
    aspect-ratio: 1
    border-radius: 50%
    background: rgb(0, 153, 255)
    --_m: conic-gradient(#0000 10%, #000), linear-gradient(#000 0 0) content-box
    -webkit-mask: var(--_m)
    mask: var(--_m)
    -webkit-mask-composite: source-out
    mask-composite: subtract
    animation: l3 1s infinite linear
    position: absolute

@keyframes l
    to
        transform: rotate(1turn)

@media (max-width: 600px)
    .delay-num
        color: black

    .window-controls
        display: none

    .input-area
        overflow-y: auto

    .inputbar
        flex-basis: 4rem

    .delay-status
        position: relative
        top: -.2rem

:deep(.desktop-preview-dialog)
    max-width: 90vw !important
    margin-top: 8vh !important
    margin-bottom: 8vh !important
    display: flex
    flex-direction: column

    .el-dialog__body
        overflow: hidden !important
        padding: 20px 24px !important

.message-window.is-dragging
    user-select: none !important
    *
        user-select: none !important

.drag-select-rect
    position: absolute
    background-color: rgba(9, 168, 255, 0.15)
    border: 1.5px solid #00a8ff
    border-radius: 4px
    z-index: 100
    pointer-events: none

.select-banner
    position: absolute
    left: 0.5rem
    background: rgba(255, 255, 255, 0.95)
    backdrop-filter: blur(8px)
    -webkit-backdrop-filter: blur(8px)
    border: 1px solid rgba(0, 168, 255, 0.2)
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.02)
    border-radius: 20px
    padding: 6px 16px
    display: flex
    align-items: center
    gap: 6px
    color: #00a8ff
    font-size: 0.85rem
    font-weight: 500
    z-index: 100
    cursor: pointer
    transition: opacity 0.3s, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s, box-shadow 0.2s
    transform: translateY(0)

    &:hover
        background: rgba(255, 255, 255, 1)
        box-shadow: 0 6px 16px rgba(0, 168, 255, 0.15)
        transform: scale(1.03)

    &:active
        transform: scale(0.98)

    i
        font-size: 0.9rem
        font-weight: bold
        line-height: 1

    &.top
        top: 4.8rem
        animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)

    &.bottom
        bottom: 5.8rem
        animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)

        @media (min-width: $mobile + 1)
            bottom: 11.8rem

@keyframes slideDown
    from
        transform: translateY(-15px)
        opacity: 0
    to
        transform: translateY(0)
        opacity: 1

@keyframes slideUp
    from
        transform: translateY(15px)
        opacity: 0
    to
        transform: translateY(0)
        opacity: 1

.select-banner-fade-enter-active, .select-banner-fade-leave-active
    transition: opacity 0.3s, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)

.select-banner-fade-enter-from, .select-banner-fade-leave-to
    opacity: 0
    &.top
        transform: translateY(-15px) !important
    &.bottom
        transform: translateY(15px) !important

:global(.is-exporting)
    height: auto !important
    overflow: visible !important
    display: block !important

:global(.is-exporting .message-window)
    height: auto !important
    overflow: visible !important
    padding: 0 !important
    display: block !important

:global(.is-exporting .content)
    max-width: calc(100% - 1.5rem) !important

:global(.is-exporting.is-wide-export .content)
    max-width: calc(100% - 3rem) !important

:global(.is-exporting .content table)
    display: table !important
    width: 100% !important
    table-layout: auto !important
    word-break: break-word !important

:global(.is-exporting .content img), :global(.is-exporting .content > .inner-content img)
    max-width: 100% !important
    height: auto !important
    max-height: 30rem !important

:global(.is-exporting pre), :global(.is-exporting code), :global(.is-exporting .code-block)
    white-space: pre-wrap !important
    word-break: break-all !important
    overflow-x: visible !important

:global(.is-exporting *)
    scrollbar-width: none !important

:global(.is-exporting *::-webkit-scrollbar)
    display: none !important
    width: 0 !important
    height: 0 !important

:global(.highlight-flash)
    animation: flash-animation 1s cubic-bezier(0.25, 0.8, 0.25, 1)

@keyframes flash-animation
    0%
        background-color: transparent
    20%
        background-color: rgba(0, 0, 0, 0.06)
    80%
        background-color: rgba(0, 0, 0, 0.06)
    100%
        background-color: transparent
</style>
