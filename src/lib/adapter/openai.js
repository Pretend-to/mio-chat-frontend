/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import Adapter from "./adapter.js";
import { client, config } from "../runtime.js";

export default class Openai extends Adapter {
  constructor(config) {
    super();
    this.settings = config.settings || {};
  }

  convertMessage() {
    const webMessage = {
      role: "other",
      time: new Date().getTime(),
      content: [{ type: "blank", data: {} }],
      status: "pending",
      id: this.genRequestID(),
    };
    return webMessage;
  }

  genRequestID() {
    return Math.random().toString(36).substr(2, 9);
  }

  async getMessagesSummary(messageChain) {
    const query = `请你根据以下对话的内容\n${JSON.stringify(messageChain)}\n，总结出一个简短的对话主题,不得超出10个字。`;
    const messages = {
      model: config.openaiDefaultConfig.model,
      messages: [{ role: "user", content: query }],
    };

    const response = await this.fetch(`/api/openai/completions`, messages);
    const { chunk } = response;
    return chunk;
  }

  async send(messages, index, settings) {
    console.log("send message to openai");

    const emitEvent = (eventName, detail) => {
      this.emit(eventName, { ...detail, index });
    };

    const handleUpdateChunk = (chunk) => {
      const updateHandlers = {
        reasoningContent: (content) =>
          emitEvent("updateReasoning", { reasoning_content: content }),
        content: (content) => emitEvent("updateMessage", { chunk: content }),
        toolCall: (tool_call) => emitEvent("updateToolCall", { tool_call }),
      };

      const handler = updateHandlers[chunk.type];
      if (handler) {
        handler(chunk.content);
      }
    };

    const handleCompletionChunk = (chunk) => {
      const completionHandlers = {
        completed: () => emitEvent("completeMessage", {}),
        failed: () => emitEvent("failedMessage", { error: chunk.data.error }),
      };

      const handler = completionHandlers[chunk.message];
      if (handler) {
        handler();
      }
    };
    const filterValidSettings = (settings) => {
      const validSettingKeys = [
        "top_p",
        "temperature",
        "stream",
        "model",
        "tools",
        "frequency_penalty",
        "presence_penalty",
      ];

      return settings
        ? Object.fromEntries(
            Object.entries(settings).filter(([key]) =>
              validSettingKeys.includes(key),
            ),
          )
        : {};
    };

    try {
      // Apply settings defaults
      const data = {
        ...filterValidSettings(settings || {}), // Default to empty object
        messages,
      };

      if (!settings?.enable_tool_call) {
        // Use optional chaining
        data.tools = [];
      }

      console.log("Data sent to OpenAI:", data);

      for await (const chunk of client.socket.streamCompletions(data)) {
        if (chunk.message === "update") {
          handleUpdateChunk(chunk);
        } else if (["completed", "failed"].includes(chunk.message)) {
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
