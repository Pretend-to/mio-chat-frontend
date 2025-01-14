/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import Adapter from "./adapter.js";
import { client } from "../runtime.js";

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


    changeModel(index) {
        this.activeModelIndex = index
    }

    async send(messages,index,settings){
        console.log("send message to openai")
        // wrap the message with prompt
        const data = {
            // model: this.models[this.activeModelIndex],
            ...settings,
            messages
        }
        console.log(data)
        for await (const chunk of client.socket.streamCompletions(data)) {
            if (chunk.data.chunk) this.emit(`updateMessage`,{chunk:chunk.data.chunk,index:index})
            else if (chunk.data.tool_call) this.emit(`updateToolCall`,{tool_call:chunk.data.tool_call,index:index})
            else if (chunk.message == 'completed') this.emit(`completeMessage`,{index:index}) 
            else if (chunk.message == 'failed') this.emit(`failedMessage`,{error:chunk.data.error,index:index})
        }
        console.log("send message to openai end")
    }

    updateSettings(settings) {
        this.settings = settings
    }

}
