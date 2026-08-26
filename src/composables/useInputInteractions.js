import { ref, watch, computed } from "vue";
import { useInteraction } from "@/composables/useInteraction.js";
/**
 * 输入框交互态（审批交互）
 *
 * 2026-08 重构：删除前端 localStorage 自动批准名单（mio_auto_approved_commands / _prefixes）。
 * Shell 自动审批已下沉为后端权威名单（ShellPolicyService + shell_policy 工具），
 * 前端 REQUEST_APPROVAL 现在只承担"真正需要人工介入"的二次审批。
 */
export function useInputInteractions({ activeContactor }) {
  const contactorId = computed(() => activeContactor.value?.id);
  const { activeInteraction, hasActiveInteraction, submitResponse } =
    useInteraction(contactorId);
  const rejectReasonText = ref("");

  watch(
    () => activeInteraction.value,
    () => {
      rejectReasonText.value = "";
    },
    { immediate: true },
  );

  return {
    activeInteraction,
    hasActiveInteraction,
    submitResponse,
    rejectReasonText,
  };
}