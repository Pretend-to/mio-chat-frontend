import { computed } from "vue";
import { client, config } from "@/lib/runtime.js";

export function useInputSend({
  textareaRef,
  activeContactor,
  pendingImageFiles,
  compressAndUploadImage,
  clearDraft,
  adjustTextareaHeight,
  getSafeText,
  availableCommands,
  wrapText,
  ElMessage,
  emit,
}) {
  const hasInput = () => {
    if (!textareaRef.value) return false;
    const clone = textareaRef.value.cloneNode(true);
    clone
      .querySelectorAll(".command-badge, .reply-badge")
      .forEach((b) => b.remove());
    const hasText = clone.innerText.trim().length > 0;
    const hasImage = textareaRef.value.querySelector("img") !== null;
    const hasCommand =
      textareaRef.value.querySelector(".command-badge") !== null;
    return hasText || hasImage || hasCommand;
  };

  const isUploading = computed(() => {
    return activeContactor.value?.messageChain.some(
      (m) => m.status === "uploading",
    );
  });

  const presend = () => {
    if (!textareaRef.value) return null;
    textareaRef.value.focus();
    const images = textareaRef.value.querySelectorAll("img");
    const ImageSrcs = Array.from(images).map((img) => img.src);

    let msg = "";
    let isCommand = false;
    let openaiCmdElements = [];
    let repliedIdFromBadge = null;

    const replyBadge = textareaRef.value.querySelector(".reply-badge");
    if (replyBadge) {
      repliedIdFromBadge = replyBadge.getAttribute("data-reply-id");
    }

    const clone = textareaRef.value.cloneNode(true);
    clone
      .querySelectorAll(".command-badge, .reply-badge")
      .forEach((b) => b.remove());
    const remainingText = getSafeText(clone.innerText).trim();

    const badges = textareaRef.value.querySelectorAll(".command-badge");
    if (badges.length > 0) {
      if (activeContactor.value.platform === "onebot") {
        const badge = badges[0];
        const preset = badge.getAttribute("data-preset");
        if (preset.includes("{xxx}")) {
          msg = preset.replace("{xxx}", remainingText);
        } else {
          msg = remainingText ? `${preset} ${remainingText}` : preset;
        }
        isCommand = true;
      } else if (activeContactor.value.platform === "openai") {
        let hasConfigChanged = false;
        badges.forEach((badge) => {
          const preset = badge.getAttribute("data-preset");
          const type = badge.getAttribute("data-type");
          const label = badge.getAttribute("data-label") || preset;

          if (type === "tool") {
            if (!activeContactor.value.options)
              activeContactor.value.options = {};
            if (!activeContactor.value.options.toolCallSettings)
              activeContactor.value.options.toolCallSettings = {};
            if (
              !Array.isArray(
                activeContactor.value.options.toolCallSettings.tools,
              )
            )
              activeContactor.value.options.toolCallSettings.tools = [];
            if (
              !activeContactor.value.options.toolCallSettings.tools.includes(
                preset,
              )
            ) {
              activeContactor.value.options.toolCallSettings.tools.push(preset);
              hasConfigChanged = true;
            }
            openaiCmdElements.push({
              type: "prompt_hint",
              data: {
                subtype: "tool",
                name: label,
                prompt: `please call tool ${preset}`,
              },
            });
          } else if (type === "skill") {
            let skillToolFullNames = [];
            let terminalToolFullNames = [];
            if (
              typeof config.llmTools === "object" &&
              config.llmTools !== null
            ) {
              Object.keys(config.llmTools).forEach((pName) => {
                const pTools = config.llmTools[pName];
                if (pTools && typeof pTools === "object") {
                  const isTerminal = pName.toLowerCase().includes("terminal");
                  Object.keys(pTools).forEach((tName) => {
                    if (
                      tName.toLowerCase() === "skill" ||
                      tName.toLowerCase().startsWith("skill_mid_")
                    ) {
                      skillToolFullNames.push(tName);
                    }
                    if (isTerminal) {
                      terminalToolFullNames.push(tName);
                    }
                  });
                }
              });
            }

            if (!activeContactor.value.options)
              activeContactor.value.options = {};
            if (!activeContactor.value.options.toolCallSettings)
              activeContactor.value.options.toolCallSettings = {};
            if (
              !Array.isArray(
                activeContactor.value.options.toolCallSettings.tools,
              )
            )
              activeContactor.value.options.toolCallSettings.tools = [];

            skillToolFullNames.forEach((stName) => {
              if (
                !activeContactor.value.options.toolCallSettings.tools.includes(
                  stName,
                )
              ) {
                activeContactor.value.options.toolCallSettings.tools.push(
                  stName,
                );
                hasConfigChanged = true;
              }
            });

            if (skillToolFullNames.length > 0) {
              terminalToolFullNames.forEach((ttName) => {
                if (
                  !activeContactor.value.options.toolCallSettings.tools.includes(
                    ttName,
                  )
                ) {
                  activeContactor.value.options.toolCallSettings.tools.push(
                    ttName,
                  );
                  hasConfigChanged = true;
                }
              });
            }

            openaiCmdElements.push({
              type: "prompt_hint",
              data: {
                subtype: "skill",
                name: label,
                prompt: `please call skill tool 2 load ${preset} skill`,
              },
            });
          } else if (type === "plugin") {
            const toolNamesAttr = badge.getAttribute("data-tool-names");
            const toolNames = JSON.parse(toolNamesAttr || "[]");
            if (!activeContactor.value.options)
              activeContactor.value.options = {};
            if (!activeContactor.value.options.toolCallSettings)
              activeContactor.value.options.toolCallSettings = {};
            if (
              !Array.isArray(
                activeContactor.value.options.toolCallSettings.tools,
              )
            )
              activeContactor.value.options.toolCallSettings.tools = [];
            toolNames.forEach((tName) => {
              if (
                !activeContactor.value.options.toolCallSettings.tools.includes(
                  tName,
                )
              ) {
                activeContactor.value.options.toolCallSettings.tools.push(
                  tName,
                );
                hasConfigChanged = true;
              }
            });
            openaiCmdElements.push({
              type: "prompt_hint",
              data: {
                subtype: "plugin",
                name: label,
                prompt: "",
              },
            });
          }
        });

        if (hasConfigChanged) {
          client.setLocalStorage();
        }
        msg = remainingText;
        isCommand = true;
      }
    } else {
      msg = remainingText;
      if (activeContactor.value.platform === "onebot") {
        availableCommands.value.forEach((cmd) => {
          const slashLabel = `/${cmd.label}`;
          const slashValue = `/${cmd.value}`;
          if (msg.startsWith(slashLabel)) {
            msg = msg.replace(slashLabel, cmd.preset);
            isCommand = true;
          } else if (msg.startsWith(slashValue)) {
            msg = msg.replace(slashValue, cmd.preset);
            isCommand = true;
          }
        });
      }
    }

    const wrappedMessage =
      activeContactor.value.platform === "onebot" && !isCommand
        ? wrapText(msg)
        : msg;
    textareaRef.value.innerHTML = "";
    adjustTextareaHeight();
    const container = activeContactor.value.getBaseUserContainer();

    if (openaiCmdElements.length > 0) {
      openaiCmdElements.forEach((elm) => {
        container.content.push(elm);
      });
    }

    if (wrappedMessage.trim()) {
      container.content.push({
        type: "text",
        data: { text: wrappedMessage },
      });
    }
    ImageSrcs.forEach((imgUrl) => {
      container.content.unshift({
        type: "image",
        data: { file: imgUrl },
      });
    });
    if (repliedIdFromBadge) {
      const targetId = isNaN(Number(repliedIdFromBadge))
        ? repliedIdFromBadge
        : Number(repliedIdFromBadge);
      container.content.push({
        type: "reply",
        data: { id: targetId },
      });

      const repliedMsg = activeContactor.value.messageChain.find(
        (m) => m.id === targetId || String(m.id) === String(targetId),
      );
      if (repliedMsg) {
        let plainText = "";
        if (Array.isArray(repliedMsg.content)) {
          repliedMsg.content.forEach((elm) => {
            if (elm.type === "text") {
              plainText += elm.data.text + "\n";
            } else if (elm.type === "image") {
              plainText += "[图片]\n";
            } else if (elm.type === "file") {
              plainText += "[文件]\n";
            }
          });
        } else if (typeof repliedMsg.content === "string") {
          plainText = repliedMsg.content;
        }
        if (plainText.trim()) {
          container.content.push({
            type: "prompt_hint",
            data: {
              subtype: "reply",
              prompt: `[引用消息]\n${plainText.trim()}\n`,
            },
          });
        }
      }
    }
    return container;
  };

  const send = async () => {
    if (!hasInput()) return;
    emit("toButtom");

    const container = presend();
    if (!container) return;

    const localImageElements = container.content.filter(
      (elm) => elm.type === "image" && elm.data.file.startsWith("blob:"),
    );

    const hasLocalImages = localImageElements.length > 0;

    container.status = hasLocalImages ? "uploading" : "pending";
    activeContactor.value.messageChain.push(container);
    clearDraft();
    emit("stroge");
    emit("toButtom");

    if (hasLocalImages) {
      try {
        const uploadPromises = localImageElements.map(async (elm) => {
          const localUrl = elm.data.file;
          const fileObj = pendingImageFiles.get(localUrl);
          if (!fileObj) {
            throw new Error("找不到本地图片缓存文件");
          }

          const remoteUrl = await compressAndUploadImage(fileObj);

          await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = remoteUrl;
          });

          pendingImageFiles.delete(localUrl);
          elm.data.file = remoteUrl;
        });

        await Promise.all(uploadPromises);

        const msgInChain = activeContactor.value.messageChain.find(
          (m) => m.id === container.id,
        );
        if (msgInChain) {
          msgInChain.status = "pending";
        }
        container.status = "pending";
        emit("stroge");

        await activeContactor.value.webSend(container);
      } catch (error) {
        console.error("图片上传失败:", error);
        ElMessage.error(error.message || "图片上传失败");
        const msgInChain = activeContactor.value.messageChain.find(
          (m) => m.id === container.id,
        );
        if (msgInChain) {
          msgInChain.status = "failed";
        }
        container.status = "failed";
        emit("stroge");
      }
    } else {
      try {
        await activeContactor.value.webSend(container);
      } catch {
        // Handled inside sendMessage
      }
    }
  };

  return {
    hasInput,
    isUploading,
    presend,
    send,
  };
}
