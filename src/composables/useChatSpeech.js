import { ref } from "vue";
import { ElMessage } from "element-plus";
import { client } from "@/lib/runtime.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";

/**
 * 语音朗读（TTS / Web Speech API）合成与状态管理
 */
export function useChatSpeech() {
  const contactorsStore = useContactorsStore();
  const currentSpeakingMessageId = ref(null);

  let _activeSpeechChunksCount = 0;
  let _streamingReadMsgId = null;
  let _spokenCharIndex = 0;

  const getSpeechText = (message) => {
    if (!message || !message.content) return "";
    return message.content
      .filter((elm) => elm.type === "text")
      .map((elm) => elm.data?.text || "")
      .join("\n")
      .trim();
  };

  const applyVoiceToUtterance = (utterance) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return;

    const cs = client._clientSettings || {};
    const selectedVoiceUri = cs.chat?.readAloudVoice || "auto";

    if (selectedVoiceUri && selectedVoiceUri !== "auto") {
      const matchedVoice = voices.find(
        (v) => v.voiceURI === selectedVoiceUri || v.name === selectedVoiceUri,
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
        return;
      }
    }

    // 默认查找中文音色
    const cnVoice = voices.find(
      (v) => v.lang.includes("zh-CN") || v.lang.includes("zh-"),
    );
    if (cnVoice) {
      utterance.voice = cnVoice;
    }
  };

  const cancelSpeech = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    _activeSpeechChunksCount = 0;
    _streamingReadMsgId = null;
    _spokenCharIndex = 0;
    currentSpeakingMessageId.value = null;
  };

  const speakTextChunk = (text, messageId) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;

    currentSpeakingMessageId.value = messageId;
    _activeSpeechChunksCount++;

    const utterance = new SpeechSynthesisUtterance(text);
    applyVoiceToUtterance(utterance);

    const cleanupChunk = () => {
      _activeSpeechChunksCount = Math.max(0, _activeSpeechChunksCount - 1);
      if (
        _activeSpeechChunksCount === 0 &&
        currentSpeakingMessageId.value === messageId
      ) {
        const activeMsg = contactorsStore.activeContactor?.messageChain?.find(
          (m) => m.id === messageId,
        );
        if (!activeMsg || activeMsg.status !== "pending") {
          currentSpeakingMessageId.value = null;
          _streamingReadMsgId = null;
          _spokenCharIndex = 0;
        }
      }
    };

    utterance.onend = cleanupChunk;
    utterance.onerror = cleanupChunk;

    window.speechSynthesis.speak(utterance);
  };

  const speakMessage = (message) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      ElMessage.warning("当前浏览器不支持语音合成");
      return;
    }

    if (currentSpeakingMessageId.value === message.id) {
      cancelSpeech();
      return;
    }

    cancelSpeech();

    const text = getSpeechText(message);
    if (!text) {
      ElMessage.info("没有可朗读的文本内容");
      return;
    }

    currentSpeakingMessageId.value = message.id;

    const punctuationRegex = /[^。！？\n!?]+[。！？\n!?]+/g;
    let match;
    let processedLength = 0;

    while ((match = punctuationRegex.exec(text)) !== null) {
      const sentence = match[0].trim();
      processedLength += match[0].length;
      if (sentence) {
        speakTextChunk(sentence, message.id);
      }
    }

    const remaining = text.slice(processedLength).trim();
    if (remaining) {
      speakTextChunk(remaining, message.id);
    }
  };

  return {
    currentSpeakingMessageId,
    speakMessage,
    cancelSpeech,
    speakTextChunk,
  };
}
