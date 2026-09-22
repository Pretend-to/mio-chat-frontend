import { onMounted, onUnmounted, ref } from "vue";

/**
 * 编辑区（contenteditable）光标与插入逻辑。
 *
 * 两条硬约定：
 * 1. 所有「往编辑区塞内容」的动作都必须走 insertAtCursor()。它内部优先用
 *    execCommand —— 只有走浏览器的编辑管线，内容才会落在光标处、才会进
 *    undo 栈（Ctrl+Z 可撤销）；手工 insertNode / innerHTML += 两样都做不到。
 * 2. 点击表情面板等会让焦点离开编辑区，window.getSelection() 就跑偏了，
 *    所以要用 selectionchange 持续记住编辑区内的最后一段 Range。
 */
export function useInputCursorAndTextarea({ textareaRef }) {
  const cursorPosition = ref([]);
  // 编辑区内最近一次光标/选区（焦点跑到面板后仍然有效）
  let savedRange = null;

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.value;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };

  const updateCursorPosition = () => {
    const selection = window.getSelection();
    if (!selection) return;
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      cursorPosition.value[0] = range.startOffset;
      cursorPosition.value[1] = range.endOffset;
    }
  };

  /** 当前选区，仅在它确实落在编辑区内时返回 */
  const getRangeInEditor = () => {
    const editor = textareaRef.value;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer) ? range : null;
  };

  const rememberSelection = () => {
    const range = getRangeInEditor();
    if (range) savedRange = range.cloneRange();
  };

  const getCaretCoordinates = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();

    if (!rect || (rect.width === 0 && rect.height === 0)) {
      const rects = range.getClientRects();
      if (rects && rects.length > 0) {
        rect = rects[0];
      }
    }

    if (!rect || (rect.width === 0 && rect.height === 0)) {
      const node = selection.anchorNode;
      if (node) {
        const element =
          node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (element) {
          rect = element.getBoundingClientRect();
        }
      }
    }

    return rect;
  };

  const setCursorToEnd = (element) => {
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /** 把光标拉回编辑区：当前选区可用就用它，否则还原记住的 Range，最后兜底到末尾 */
  const focusEditorAtCursor = () => {
    const editor = textareaRef.value;
    if (!editor) return false;
    editor.focus({ preventScroll: true });
    if (getRangeInEditor()) return true;

    const selection = window.getSelection();
    if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
      return true;
    }
    setCursorToEnd(editor);
    return true;
  };

  /** execCommand 不可用时的等价手工插入（同时保住光标） */
  const insertManually = (content, { html }) => {
    const editor = textareaRef.value;
    let range = getRangeInEditor();
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.deleteContents();

    const frag = document.createDocumentFragment();
    if (html) {
      const temp = document.createElement("div");
      temp.innerHTML = String(content);
      while (temp.firstChild) frag.appendChild(temp.firstChild);
    } else {
      // 纯文本按段落 + <br> 原样插入，不改任何字符（markdown 符号/缩进必须保留）
      String(content)
        .split("\n")
        .forEach((line, index) => {
          if (index > 0) frag.appendChild(document.createElement("br"));
          if (line) frag.appendChild(document.createTextNode(line));
        });
    }

    range.insertNode(frag);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /**
   * 在光标处插入内容（文本或 HTML），并保持可撤销。
   * @param {string} content 要插入的内容
   * @param {{html?: boolean}} options html=true 时按 HTML 解析插入
   */
  const insertAtCursor = (content, { html = false } = {}) => {
    if (content === undefined || content === null || content === "") return;
    if (!textareaRef.value) return;
    focusEditorAtCursor();

    let inserted = false;
    if (typeof document.execCommand === "function") {
      try {
        inserted = document.execCommand(
          html ? "insertHTML" : "insertText",
          false,
          String(content),
        );
      } catch {
        inserted = false;
      }
    }
    if (!inserted) insertManually(content, { html });

    rememberSelection();
  };

  /**
   * 取渲染后的纯文本。
   * detached 节点的 innerText 会退化成 textContent —— <br> 与块级边界带来的
   * 换行会全部丢失，所以必须先挂到离屏位置渲染再读。
   */
  const getSafeText = (element) => {
    if (typeof element === "string") return element;
    if (!element?.cloneNode) return String(element ?? "");

    const mirror = element.cloneNode(true);
    mirror.style.position = "fixed";
    mirror.style.left = "-9999px";
    mirror.style.top = "0";
    mirror.style.width = `${element.offsetWidth || 0}px`;
    mirror.style.height = "auto";
    mirror.style.maxHeight = "none";
    // 用 opacity 而非 visibility：innerText 只在元素"确实生成盒"时才按渲染结果取文本
    mirror.style.opacity = "0";
    mirror.style.pointerEvents = "none";
    mirror.setAttribute("aria-hidden", "true");
    document.body.appendChild(mirror);
    const text = mirror.innerText;
    mirror.remove();
    return text;
  };

  const getPureTextOfTextNodes = (container) => {
    let text = "";
    const walk = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    let textNode;
    while ((textNode = walk.nextNode())) {
      let isInsideBadge = false;
      let p = textNode.parentNode;
      while (p && p !== container) {
        if (p.classList && p.classList.contains("command-badge")) {
          isInsideBadge = true;
          break;
        }
        p = p.parentNode;
      }
      if (!isInsideBadge) {
        text += textNode.nodeValue;
      }
    }
    return text;
  };

  const replaceTextRangeWithElements = (
    container,
    startIdx,
    endIdx,
    badgeEl,
    spaceNode,
  ) => {
    let currentIdx = 0;
    const walk = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    let textNode;
    while ((textNode = walk.nextNode())) {
      let isInsideBadge = false;
      let p = textNode.parentNode;
      while (p && p !== container) {
        if (p.classList && p.classList.contains("command-badge")) {
          isInsideBadge = true;
          break;
        }
        p = p.parentNode;
      }
      if (isInsideBadge) {
        continue;
      }

      const nodeLen = textNode.nodeValue.length;
      if (currentIdx + nodeLen > startIdx) {
        const offsetInNode = startIdx - currentIdx;
        const lengthToRemove = endIdx - startIdx;

        const parent = textNode.parentNode;
        const textVal = textNode.nodeValue;

        const beforeText = textVal.substring(0, offsetInNode);
        const afterText = textVal.substring(offsetInNode + lengthToRemove);

        if (beforeText) {
          parent.insertBefore(document.createTextNode(beforeText), textNode);
        }
        parent.insertBefore(badgeEl, textNode);
        parent.insertBefore(spaceNode, textNode);
        if (afterText) {
          parent.insertBefore(document.createTextNode(afterText), textNode);
        }

        parent.removeChild(textNode);
        return true;
      }
      currentIdx += nodeLen;
    }
    return false;
  };

  const updateEditorText = (newText) => {
    const imgElements = Array.from(textareaRef.value.querySelectorAll("img"));
    textareaRef.value.innerText = newText;
    imgElements.forEach((img) => {
      textareaRef.value.appendChild(img);
    });
    setCursorToEnd(textareaRef.value);
  };

  // 焦点进出编辑区都会触发 selectionchange：只要选区在编辑区内就记下来，
  // 之后点表情面板、点预设按钮都不会丢掉插入位置。
  const handleSelectionChange = () => rememberSelection();

  onMounted(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
  });

  onUnmounted(() => {
    document.removeEventListener("selectionchange", handleSelectionChange);
  });

  return {
    cursorPosition,
    adjustTextareaHeight,
    updateCursorPosition,
    getCaretCoordinates,
    insertAtCursor,
    rememberSelection,
    getPureTextOfTextNodes,
    replaceTextRangeWithElements,
    updateEditorText,
    getSafeText,
  };
}
