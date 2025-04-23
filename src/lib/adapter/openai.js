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
    this.id = config.id;
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
    const query = `请你根据以下对话的内容\n${JSON.stringify(messageChain)}\n，总结出一个简短的对话主题,你的回答必须只包含对话主题，不要包含任何其他内容，包括句号。`;
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

  handleMessageEvent(chunk) {
    const data = chunk.data;

    const messageId = data.metaData.messageId;

    delete data.metaData;

    const emitEvent = (eventName, detail) => {
      this.emit(eventName, { ...detail, messageId });
    };

    console.log("Received chunk from LLM:", chunk);
    if (chunk.message === "update") {
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
    } else if (["complete", "failed"].includes(chunk.message)) {
      const completionHandlers = {
        complete: () => emitEvent("completeMessage", {}),
        failed: () => emitEvent("failedMessage", { error: chunk.data }),
      };

      const handler = completionHandlers[chunk.message];
      if (handler) {
        handler();
      }
    }
  }

  async send(messages, messageId, settings) {
    console.log("send message to openai");

    const metaData = {
      contactorId: this.id,
      messageId,
    };
    // Apply settings defaults
    const data = {
      settings, // Default to empty object
      messages,
    };

    console.log("Data sent to LLM:", data);

    if (!client.socket) {
      throw new Error("WebSocket connection not established.");
    }

    client.socket.streamCompletions(data, metaData);
  }
}
