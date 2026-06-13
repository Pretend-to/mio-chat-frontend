import { ref, computed, nextTick } from "vue";
import { config } from "@/lib/runtime.js";

export function useInputCommandPopup({
  textareaRef,
  activeContactor,
  isMobileDevice,
  getCaretCoordinates,
  getPureTextOfTextNodes,
  replaceTextRangeWithElements,
  adjustTextareaHeight,
  updateEditorText,
  availableSkills,
  onebotPresets,
  scopeId,
  ElMessage,
}) {
  const showCommandPopup = ref(false);
  const commandSearchQuery = ref("");
  const commandIndex = ref(0);
  const popupDismissed = ref(false);
  const commandPopupStyle = ref({
    left: "1rem",
    bottom: "calc(100% + 4px)",
  });

  const availableCommands = computed(() => {
    const contactor = activeContactor.value;
    if (!contactor) return [];
    const list = [];
    if (contactor.platform === "onebot") {
      onebotPresets.value.forEach((cat) => {
        if (cat.children && Array.isArray(cat.children)) {
          cat.children.forEach((child) => {
            if (child.preset) {
              list.push({
                type: "preset",
                label: child.label,
                preset: child.preset,
                value: child.value,
                description: child.description || "",
              });
            }
          });
        }
      });
      if (list.length === 0) {
        list.push({
          type: "preset",
          label: "help",
          preset: "help",
          value: "help",
          description: "显示帮助信息",
        });
      }
    } else if (contactor.platform === "openai") {
      if (typeof config.llmTools === "object" && config.llmTools !== null) {
        Object.keys(config.llmTools).forEach((pluginName) => {
          const pluginTools = config.llmTools[pluginName];
          if (pluginTools && typeof pluginTools === "object") {
            const toolNames = Object.keys(pluginTools);
            if (toolNames.length > 0) {
              list.push({
                type: "plugin",
                label: pluginName,
                preset: pluginName,
                value: pluginName,
                toolNames: toolNames,
                description: `包含工具: ${toolNames.join(", ")}`,
              });
            }
            toolNames.forEach((tName) => {
              const tool = pluginTools[tName];
              let displayName = tool.name;
              let hash = "";
              if (tool.name.includes("_mid_")) {
                const parts = tool.name.split("_mid_");
                displayName = parts[0];
                hash = parts[1];
              }
              list.push({
                type: "tool",
                label: displayName,
                hash: hash,
                value: tool.name,
                preset: tool.name,
                description: tool.description,
              });
            });
          }
        });
      }
      const skills = availableSkills.value || [];
      skills.forEach((skill) => {
        let displayName = skill.name;
        let hash = "";
        if (skill.name.includes("_mid_")) {
          const parts = skill.name.split("_mid_");
          displayName = parts[0];
          hash = parts[1];
        }
        list.push({
          type: "skill",
          label: displayName,
          hash: hash,
          value: skill.name,
          preset: skill.name,
          description: skill.description,
        });
      });
    }
    return list;
  });

  const filteredCommands = computed(() => {
    if (!commandSearchQuery.value) return availableCommands.value;
    const query = commandSearchQuery.value.toLowerCase();
    return availableCommands.value.filter(
      (c) =>
        c.label.toLowerCase().includes(query) ||
        c.value.toLowerCase().includes(query) ||
        c.preset.toLowerCase().includes(query),
    );
  });

  const updateCommandPopupPosition = () => {
    if (isMobileDevice.value) return;
    nextTick(() => {
      const caretRect = getCaretCoordinates();
      if (!caretRect || !textareaRef.value) return;
      
      const inputBar = textareaRef.value.closest(".input-bar");
      if (!inputBar) return;
      
      const inputBarRect = inputBar.getBoundingClientRect();

      let left = caretRect.left - inputBarRect.left;
      const popupWidth = 320;
      const margin = 10;
      const maxLeft = Math.max(
        margin,
        inputBarRect.width - popupWidth - margin,
      );
      left = Math.min(Math.max(margin, left), maxLeft);

      const bottom = inputBarRect.bottom - caretRect.top + 4;

      commandPopupStyle.value = {
        position: "absolute",
        left: `${left}px`,
        bottom: `${bottom}px`,
      };
    });
  };

  const confirmCommand = (cmd) => {
    const text = getPureTextOfTextNodes(textareaRef.value);
    const regex = /(?:^|\s)[/#](?!\/)/g;
    let match;
    let lastSlashIdx = -1;
    let triggerChar = "/";
    while ((match = regex.exec(text)) !== null) {
      const isTriggerAtStart = match[0] === "/" || match[0] === "#";
      lastSlashIdx = match.index + (isTriggerAtStart ? 0 : 1);
      triggerChar = text.charAt(lastSlashIdx);
    }

    if (lastSlashIdx !== -1) {
      const badgeEl = document.createElement("span");
      badgeEl.className = "command-badge";
      badgeEl.setAttribute("contenteditable", "false");
      badgeEl.setAttribute("data-preset", cmd.preset);
      badgeEl.setAttribute("data-type", cmd.type || "command");
      badgeEl.setAttribute("data-label", cmd.label);

      const labelText = triggerChar + cmd.label;
      if (cmd.type === "tool") {
        badgeEl.innerHTML = `<i class="mio-icon mio-icon-tool" style="margin-right: 4px; vertical-align: middle;"></i><span>${labelText}</span>`;
      } else if (cmd.type === "skill") {
        badgeEl.innerHTML = `<i class="mio-icon mio-icon-skill" style="margin-right: 4px; vertical-align: middle;"></i><span>${labelText}</span>`;
      } else if (cmd.type === "plugin") {
        badgeEl.setAttribute("data-tool-names", JSON.stringify(cmd.toolNames));
        badgeEl.innerHTML = `<span class="cmd-plugin-icon" style="margin-right: 4px; vertical-align: middle;"><i class="mio-icon mio-icon-tool"></i><sup class="plugin-plus">+</sup></span><span>${labelText}</span>`;
      } else {
        badgeEl.innerText = labelText;
      }

      if (scopeId.value) {
        badgeEl.setAttribute(scopeId.value, "");
      }

      const spaceNode = document.createTextNode("\u00A0");

      replaceTextRangeWithElements(
        textareaRef.value,
        lastSlashIdx,
        lastSlashIdx + 1 + commandSearchQuery.value.length,
        badgeEl,
        spaceNode,
      );

      const range = document.createRange();
      const sel = window.getSelection();
      range.setStartAfter(spaceNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    showCommandPopup.value = false;
    commandSearchQuery.value = "";
    commandIndex.value = 0;
    popupDismissed.value = false;

    nextTick(() => {
      adjustTextareaHeight();
    });
  };

  const scrollActiveCommandIntoView = (inputBarEl) => {
    nextTick(() => {
      const activeItem = inputBarEl.querySelector(".command-item.active");
      if (activeItem) {
        activeItem.scrollIntoView({ block: "nearest" });
      }
    });
  };

  const checkSlashCommand = () => {
    if (
      activeContactor.value?.platform !== "onebot" &&
      activeContactor.value?.platform !== "openai"
    ) {
      showCommandPopup.value = false;
      return;
    }

    const isOneBot = activeContactor.value.platform === "onebot";
    const badge = textareaRef.value.querySelector(".command-badge");

    const clone = textareaRef.value.cloneNode(true);
    clone.querySelectorAll(".command-badge").forEach((b) => b.remove());
    const textWithoutBadge = clone.innerText || clone.textContent || "";

    const occurrences = [];
    let match;
    const regex = /(?:^|\s)[/#](?!\/)/g;
    while ((match = regex.exec(textWithoutBadge)) !== null) {
      const isTriggerAtStart = match[0] === "/" || match[0] === "#";
      const slashIdx = match.index + (isTriggerAtStart ? 0 : 1);
      occurrences.push(slashIdx);
    }

    if (isOneBot) {
      if (badge && occurrences.length > 0) {
        ElMessage.warning("指令不可重复，已自动清除先前的指令");
        badge.remove();

        const text = textareaRef.value.innerText || textareaRef.value.textContent || "";
        const newOccurrences = [];
        let newMatch;
        const newRegex = /(?:^|\s)[/#](?!\/)/g;
        while ((newMatch = newRegex.exec(text)) !== null) {
          const isTriggerAtStart = newMatch[0] === "/" || newMatch[0] === "#";
          const slashIdx = newMatch.index + (isTriggerAtStart ? 0 : 1);
          newOccurrences.push(slashIdx);
        }

        if (newOccurrences.length === 1) {
          showCommandPopup.value = true;
          commandSearchQuery.value = text.substring(newOccurrences[0] + 1).trim();
          commandIndex.value = 0;
          popupDismissed.value = false;
        } else {
          showCommandPopup.value = false;
          commandSearchQuery.value = "";
        }

        adjustTextareaHeight();
        return;
      }

      if (occurrences.length > 1) {
        ElMessage.warning("指令不可重复，已自动清除先前的指令");
        let endOfCmd = textWithoutBadge.indexOf(" ", occurrences[0]);
        if (endOfCmd === -1 || endOfCmd > occurrences[1]) {
          endOfCmd = occurrences[0] + 1;
        } else {
          endOfCmd = endOfCmd + 1;
        }

        const newText =
          textWithoutBadge.substring(0, occurrences[0]) +
          textWithoutBadge.substring(endOfCmd);
        updateEditorText(newText);

        const newOccurrences = [];
        let newMatch;
        const newRegex = /(?:^|\s)[/#](?!\/)/g;
        while ((newMatch = newRegex.exec(newText)) !== null) {
          const isTriggerAtStart = newMatch[0] === "/" || newMatch[0] === "#";
          const slashIdx = newMatch.index + (isTriggerAtStart ? 0 : 1);
          newOccurrences.push(slashIdx);
        }

        if (newOccurrences.length === 1) {
          showCommandPopup.value = true;
          commandSearchQuery.value = newText.substring(newOccurrences[0] + 1).trim();
          commandIndex.value = 0;
          popupDismissed.value = false;
        } else {
          showCommandPopup.value = false;
          commandSearchQuery.value = "";
        }
        return;
      }
    }

    if (occurrences.length > 0) {
      const lastSlashIdx = occurrences[occurrences.length - 1];
      const queryStart = lastSlashIdx + 1;
      commandSearchQuery.value = textWithoutBadge.substring(queryStart).trim();
      if (!popupDismissed.value) {
        showCommandPopup.value = true;
      }
    } else {
      showCommandPopup.value = false;
      commandSearchQuery.value = "";
      popupDismissed.value = false;
    }
  };

  const handleKeyDown = (event, inputBarEl, sendCallback) => {
    if (event.isComposing || event.keyCode === 229) {
      return false;
    }
    if (showCommandPopup.value && filteredCommands.value.length > 0) {
      const list = filteredCommands.value;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        commandIndex.value = (commandIndex.value + 1) % list.length;
        scrollActiveCommandIntoView(inputBarEl);
        return true;
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        commandIndex.value = (commandIndex.value - 1 + list.length) % list.length;
        scrollActiveCommandIntoView(inputBarEl);
        return true;
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const cmd = list[commandIndex.value];
        if (cmd) {
          confirmCommand(cmd);
        }
        return true;
      } else if (event.key === "Escape") {
        event.preventDefault();
        showCommandPopup.value = false;
        popupDismissed.value = true;
        return true;
      }
    }

    if (event.key === "Enter") {
      if (event.ctrlKey) {
        event.preventDefault();
        sendCallback();
        return true;
      } else {
        document.execCommand("insertHTML", false, "\n");
        event.preventDefault();
        return true;
      }
    }
    return false;
  };

  return {
    showCommandPopup,
    commandSearchQuery,
    commandIndex,
    popupDismissed,
    commandPopupStyle,
    availableCommands,
    filteredCommands,
    updateCommandPopupPosition,
    confirmCommand,
    scrollActiveCommandIntoView,
    checkSlashCommand,
    handleKeyDown,
  };
}
