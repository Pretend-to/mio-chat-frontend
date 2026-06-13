import { ref, computed } from "vue";
import { client, config } from "@/lib/runtime.js";

export function useInputLLMOptions({ activeContactor }) {
  const selectedOption = ref(null);
  const openaiModels = ref(null);
  const onebotPresets = ref(config.onebotConfig?.textwraper?.options || []);

  const initLLMExtraOptions = () => {
    const allModels = client.config.getLlmModels();
    openaiModels.value = Object.entries(allModels).map(([provider, models]) => {
      return {
        value: provider,
        label: provider,
        children: models.map((modelGroup) => {
          return {
            value: modelGroup.owner,
            label: modelGroup.owner,
            children: modelGroup.models.map((model) => {
              return { value: model, label: model };
            }),
          };
        }),
      };
    });
  };

  const getOpenaiModelArray = (model) => {
    const owner = client.config.getModelOwner(model);
    return [owner, model];
  };

  const getOnebotPreset = () => {
    const preset = onebotPresets.value
      .reduce((acc = [], item) => {
        const arr = item.children ?? [item];
        return [...acc, ...arr];
      }, [])
      .find((child) => child.value == selectedOption.value)?.preset;
    return preset;
  };

  const wrapText = (rawText) => {
    const preset = getOnebotPreset();
    if (!selectedOption.value || !preset) return rawText;
    const testText = "{xxx}";
    return preset.replace(testText, rawText);
  };

  const loadSelected = () => {
    const contactor = activeContactor.value;
    if (!contactor) return;
    if (contactor.platform === "onebot") {
      if (contactor.preset) {
        selectedOption.value = contactor.preset;
      } else {
        selectedOption.value = null;
      }
    } else {
      initLLMExtraOptions();
      selectedOption.value = contactor.options?.base?.model;
    }
  };

  const getWraperName = () => {
    const contactor = activeContactor.value;
    if (!contactor) return "";
    const preset = getOnebotPreset();
    if (contactor.platform === "onebot" && preset) {
      if (!selectedOption.value) return "";
      return preset.replace("#", "").replace("{xxx}", "");
    }
    return "";
  };

  const extraOptions = computed(() => {
    const contactor = activeContactor.value;
    if (!contactor) return [];
    if (contactor.platform == "openai") {
      return openaiModels.value || [];
    } else {
      return onebotPresets.value || [];
    }
  });

  return {
    selectedOption,
    openaiModels,
    onebotPresets,
    extraOptions,
    initLLMExtraOptions,
    getOpenaiModelArray,
    getOnebotPreset,
    wrapText,
    loadSelected,
    getWraperName,
  };
}
