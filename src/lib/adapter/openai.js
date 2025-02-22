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

    if (!settings.enable_tool_call) settings.tools = [];

    // Correct the spelling and add default value for model:
    const validSettingKeys = [
      "top_p",
      "temperature",
      "stream",
      "model",
      "tools",
    ];

    const validSettings = settings
      ? Object.fromEntries(
          Object.entries(settings).filter(([key]) =>
            validSettingKeys.includes(key),
          ),
        )
      : {};
    const data = {
      ...validSettings, // Use the filtered settings
      messages,
    };

    console.log(data);

    for await (const chunk of client.socket.streamCompletions(data)) {
      const chunkDataHandlers = {
        reasoning_content: (data) =>
          this.emit(`updateReasoning`, {
            reasoning_content: data.reasoning_content,
            index: index,
          }),
        chunk: (data) =>
          this.emit(`updateMessage`, { chunk: data.chunk, index: index }),
        tool_call: (data) =>
          this.emit(`updateToolCall`, {
            tool_call: data.tool_call,
            index: index,
          }),
      };

      for (const key in chunkDataHandlers) {
        if (chunk.data && chunk.data[key]) {
          chunkDataHandlers[key](chunk.data);
        }
      }

      const chunkMessageHandlers = {
        completed: () => this.emit(`completeMessage`, { index: index }),
        failed: () =>
          this.emit(`failedMessage`, { error: chunk.data.error, index: index }),
      };

      if (chunk.message && chunkMessageHandlers[chunk.message]) {
        chunkMessageHandlers[chunk.message]();
      }
    }
  }

  updateSettings(settings) {
    this.settings = settings;
  }
}
