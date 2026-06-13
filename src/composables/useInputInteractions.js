import { ref, watch, computed } from "vue";
import { useInteraction } from "@/composables/useInteraction.js";

export function useInputInteractions({ activeContactor }) {
  const contactorId = computed(() => activeContactor.value?.id);
  const { activeInteraction, hasActiveInteraction, submitResponse } = useInteraction(contactorId);
  const rejectReasonText = ref("");

  const isHighRiskCommand = (command) => {
    if (!command) return true;
    const trimmed = command.trim();
    const stripQuotesRegex =
      /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/g;
    const commandWithoutQuotes = trimmed.replace(stripQuotesRegex, " ");
    const subCommands = commandWithoutQuotes.split(/&&|\|\||\||;/);
    const highRiskExecutables = [
      "rm", "rmdir", "node", "python", "python3", "pip", "pip3", "npm", "yarn", "pnpm",
      "sh", "bash", "zsh", "sudo", "curl", "wget", "docker", "mv", "chmod", "chown", "unlink",
    ];
    for (let subCmd of subCommands) {
      subCmd = subCmd.trim();
      if (!subCmd) continue;
      const words = subCmd
        .split(/\s+/)
        .filter((w) => !w.includes("=") && w.length > 0);
      if (words.length === 0) continue;
      const executable = words[0]
        .replace(/^[^a-zA-Z0-9_\-/]+|[^a-zA-Z0-9_\-/]+$/g, "")
        .toLowerCase();
      const isRisk = highRiskExecutables.some((exec) => {
        return executable === exec || executable.endsWith("/" + exec);
      });
      if (isRisk) return true;
    }
    return false;
  };

  const getCommandPrefix = (command) => {
    if (!command) return "";
    const trimmed = command.trim();
    const words = trimmed
      .split(/\s+/)
      .filter((w) => !w.includes("=") && w.length > 0);
    if (words.length === 0) return "";
    return words[0]
      .replace(/^[^a-zA-Z0-9_\-/]+|[^a-zA-Z0-9_\-/]+$/g, "")
      .toLowerCase();
  };

  const checkAutoApproval = (interaction) => {
    if (!interaction || interaction.actionType !== "REQUEST_APPROVAL") return;
    const command = interaction.meta?.command;
    if (!command) return;
    if (isHighRiskCommand(command)) return;
    try {
      const listStr = localStorage.getItem("mio_auto_approved_commands") || "[]";
      const list = JSON.parse(listStr);
      if (Array.isArray(list) && list.includes(command)) {
        console.log(`[Auto Approval] 自动批准具体命令: ${command}`);
        submitResponse({ approved: true });
        return;
      }
      const prefixListStr = localStorage.getItem("mio_auto_approved_command_prefixes") || "[]";
      const prefixList = JSON.parse(prefixListStr);
      const prefix = getCommandPrefix(command);
      if (prefix && Array.isArray(prefixList) && prefixList.includes(prefix)) {
        console.log(`[Auto Approval] 根据前缀 "${prefix}" 自动批准命令: ${command}`);
        submitResponse({ approved: true });
      }
    } catch (err) {
      console.error("Failed to process auto-approval check:", err);
    }
  };

  const handleApproveAndRememberSpecific = () => {
    const interaction = activeInteraction.value;
    if (!interaction) return;
    const command = interaction.meta?.command;
    if (command && !isHighRiskCommand(command)) {
      try {
        const listStr = localStorage.getItem("mio_auto_approved_commands") || "[]";
        const list = JSON.parse(listStr);
        if (Array.isArray(list) && !list.includes(command)) {
          list.push(command);
          localStorage.setItem("mio_auto_approved_commands", JSON.stringify(list));
        }
      } catch (err) {
        console.error("Failed to save auto-approved command:", err);
      }
    }
    submitResponse({ approved: true });
  };

  const handleApproveAndRememberPrefix = () => {
    const interaction = activeInteraction.value;
    if (!interaction) return;
    const command = interaction.meta?.command;
    const prefix = getCommandPrefix(command);
    if (prefix && !isHighRiskCommand(command)) {
      try {
        const prefixListStr = localStorage.getItem("mio_auto_approved_command_prefixes") || "[]";
        const prefixList = JSON.parse(prefixListStr);
        if (Array.isArray(prefixList) && !prefixList.includes(prefix)) {
          prefixList.push(prefix);
          localStorage.setItem("mio_auto_approved_command_prefixes", JSON.stringify(prefixList));
        }
      } catch (err) {
        console.error("Failed to save auto-approved command prefix:", err);
      }
    }
    submitResponse({ approved: true });
  };

  watch(
    () => activeInteraction.value,
    (newVal) => {
      rejectReasonText.value = "";
      if (newVal) {
        checkAutoApproval(newVal);
      }
    },
    { immediate: true },
  );

  return {
    activeInteraction,
    hasActiveInteraction,
    submitResponse,
    rejectReasonText,
    isHighRiskCommand,
    getCommandPrefix,
    handleApproveAndRememberSpecific,
    handleApproveAndRememberPrefix,
  };
}
