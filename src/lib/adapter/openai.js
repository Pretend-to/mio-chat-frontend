/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import Adapter from "./adapter.js";
import { client, config } from "../runtime.js";
import { numberString } from "../../utils/generate.js";

export default class Openai extends Adapter {
  constructor(config) {
    super();
    this.settings = config.settings || {};
  }

  convertMessage(message) {
    const webMessage = {
      role: "other",
      time: new Date().getTime(),
      content: [{ type: "blank", data: {} }],
      status: "pending",
      id: numberString(16),
    };
    const mergedMessage = { ...webMessage, ...message };
    return mergedMessage;
  }

  async getMessagesSummary(messageChain) {
    const query = `请你根据以下对话的内容\n${JSON.stringify(messageChain)}\n，总结出一个简短的对话主题,不得超出10个字。`;
    const settings = config.getLLMDefaultConfig();
    settings.base.stream = false;
    const messages = {
      settings,
      messages: [{ role: "user", content: query }],
    };

    const response = await this.fetch(`/api/llm/completions`, messages);
    // debugger;
    const { content } = response;
    return content || "未命名会话";
  }

  async send(messages, messageId, settings) {
    console.log("send message to openai");

    const emitEvent = (eventName, detail) => {
      this.emit(eventName, { ...detail, messageId });
    };

    const handleUpdateChunk = (chunk) => {
      const updateHandlers = {
        reasoningContent: (content) =>
          emitEvent("updateReasoning", { reasoning_content: content }),
        content: (content) => emitEvent("updateMessage", { chunk: content }),
        toolCall: (tool_call) => emitEvent("updateToolCall", { tool_call }),
      };

      const data = chunk.data;
      const handler = updateHandlers[data.type];
      if (handler) {
        handler(data.content);
      }
    };

    const handleCompletionChunk = (chunk) => {
      const completionHandlers = {
        complete: () => emitEvent("completeMessage", {}),
        failed: () => emitEvent("failedMessage", { error: chunk.data }),
      };

      const handler = completionHandlers[chunk.message];
      if (handler) {
        handler();
      }
    };

    try {
      // Apply settings defaults
      const data = {
        settings, // Default to empty object
        messages,
      };

      console.log("Data sent to LLM:", data);

      for await (const chunk of client.socket.streamCompletions(data)) {
        console.log("Received chunk from LLM:", chunk);
        if (chunk.message === "update") {
          handleUpdateChunk(chunk);
        } else if (["complete", "failed"].includes(chunk.message)) {
          handleCompletionChunk(chunk);
          break;
        }
      }
    } catch (error) {
      console.error("Error in send:", error);
      emitEvent("failedMessage", { error: "Stream processing error" });
    }
  }

  updateSettings(settings) {
    this.settings = settings;
  }
}
