import { ref } from "vue";

export function useInputCursorAndTextarea({ textareaRef }) {
  const cursorPosition = ref([]);

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

  const textToHtml = (text) => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    return escaped
      .replace(/  /g, "&nbsp;&nbsp;")
      .replace(/\n/g, "<br>");
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

  const insertHtmlAtCursor = (html) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      textareaRef.value.innerHTML += html;
      setCursorToEnd(textareaRef.value);
      return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();

    const tempEl = document.createElement("div");
    tempEl.innerHTML = html;

    const frag = document.createDocumentFragment();
    while (tempEl.firstChild) {
      frag.appendChild(tempEl.firstChild);
    }

    range.insertNode(frag);

    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
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

  const getSafeText = (text) => text;

  return {
    cursorPosition,
    adjustTextareaHeight,
    updateCursorPosition,
    getCaretCoordinates,
    textToHtml,
    setCursorToEnd,
    insertHtmlAtCursor,
    getPureTextOfTextNodes,
    replaceTextRangeWithElements,
    updateEditorText,
    getSafeText,
  };
}
