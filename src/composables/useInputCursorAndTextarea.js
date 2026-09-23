import { onMounted, onUnmounted, ref } from "vue";

/** 取纯文本时视为「独立成行」的块级标签 */
const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TR",
  "UL",
]);

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
   * 取编辑器纯文本（<br> 与块级边界映射成换行）。
   *
   * 不能用 innerText：它依赖渲染盒，实测 iOS 上（镜像 width:0px 时）会返回空串，
   * 而同一节点的 textContent 是完整的 —— 移动端"发出去变成 blank 块"就是这么来的
   * （presend 取到空串 → 容器没有 text → store 兜底成 [blank]）。
   * 这里改成纯 DOM 遍历：跨端确定，完全不看布局。
   * .command-badge 不计入正文（入链前徽章已由 presend 处理）。
   */
  const getSafeText = (element) => {
    if (typeof element === "string") return element;
    if (!element?.childNodes) return String(element ?? "");

    let text = "";
    const walk = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          text += child.nodeValue;
          return;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        if (child.classList?.contains("command-badge")) return;
        if (child.tagName === "BR") {
          text += "\n";
          return;
        }
        const isBlock = BLOCK_TAGS.has(child.tagName);
        if (isBlock && text && !text.endsWith("\n")) text += "\n";
        walk(child);
        if (isBlock && !text.endsWith("\n")) text += "\n";
      });
    };
    walk(element);
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
