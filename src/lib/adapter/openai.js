/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-19 11:10:54
 */

import Adapter from "./adapter.js";
import { client } from "../runtime.js";

export default class Openai extends Adapter {
    constructor(config) {
        super()
        this.settings = config.settings || {}

    }

    convertMessage(data){
        let voiceList = [];
        let imageList = [];
        let textList = [];
        data.message.forEach(element => {
            if(element.type === "record") {
                voiceList.push(element.data.file)
            } else if(element.type === "image") {
                const base64Data = element.data.file.replace(/^base64:\/\//, "data:image/jpeg;base64,");
                imageList.push(base64Data)
            } else if(element.type === "text") {
                textList.push(element.data.text)
            }
        });
        const webMessage = {
            role:'other',
            time: new Date().getTime(),
            content:{
                image: imageList,
                voice: voiceList,
                text: textList
            },
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
        // warp the message with prompt
        const data = {
            // model: this.models[this.activeModelIndex],
            model: "gpt-3.5-turbo",
            ...settings,
            messages:messages
        }
        console.log(data)
        for await (const chunk of client.socket.streamCompletions(data)) {
            if (chunk.data.chunk) this.emit(`updateMessage`,{chunk:chunk.data.chunk,index:index})
            else if (chunk.message == 'completed') this.emit(`completeMessage`,{index:index}) 
            else if (chunk.message == 'failed') this.emit(`failedMessage`,{error:chunk.data.error,index:index})
        }
        console.log("send message to openai end")
    }

    updateSettings(settings) {
        this.settings = settings
    }

}
