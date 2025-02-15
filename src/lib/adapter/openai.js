/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import Adapter from "./adapter.js";
import { client,config } from "../runtime.js";

export default class Openai extends Adapter {
    constructor(config) {
        super()
        this.settings = config.settings || {}

    }

    convertMessage(){

        const webMessage = {
            role:'other',
            time: new Date().getTime(),
            content:[{type:'blank',data:{}}],
            status:'pending',
            id: this.genRequestID(),
        }
        return webMessage
    }


    genRequestID() {
        return Math.random().toString(36).substr(2, 9);
    }

    async getMessagesSummary(messageChain) {
        const query = `请你根据以下对话的内容\n${JSON.stringify(messageChain)}\n，总结出一个简短的对话主题,不得超出10个字。`
        const messages = {
            model: config.openaiDefaultConfig.model,
            messages: [
                { role: 'user', content: query }
            ]
        }

        const response = await this.fetch(`/api/openai/completions`, messages)
        const { chunk } = response
        console.log(chunk)
        return chunk
    }

    async send(messages,index,settings){
        console.log("send message to openai")
        // wrap the message with prompt
        const data = {
            ...settings,
            messages
        }
        for await (const chunk of client.socket.streamCompletions(data)) {
            if (chunk.data.chunk) this.emit(`updateMessage`,{chunk:chunk.data.chunk,index:index})
            else if (chunk.data.tool_call) this.emit(`updateToolCall`,{tool_call:chunk.data.tool_call,index:index})
            else if (chunk.message == 'completed') this.emit(`completeMessage`,{index:index}) 
            else if (chunk.message == 'failed') this.emit(`failedMessage`,{error:chunk.data.error,index:index})
        }
    }

    updateSettings(settings) {
        this.settings = settings
    }

}
