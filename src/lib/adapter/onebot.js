import Adapter from "./adapter.js";

export default class Onebot extends Adapter {
    constructor() {
        super();
    }


    convertMessage(data) {
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
            id: data.message_id,
        }
        return webMessage
    }

    /**
     * Send message to server
     * @param {WebtMessage} message 
     * @returns {Promise<number>} message_id
     */
    async send(id,message) {
        let onebotMessage = []
        
        message.voice.forEach(element => {
            onebotMessage.push({
                type: "record",
                data: {
                    file: element
                }
            })
        });

        message.image.forEach(element => {
            onebotMessage.push({
                type: "image",
                data: {
                    image: element
                }
            })
        });

        message.text.forEach(element => {
            onebotMessage.push({
                type: "text",
                data: {
                    text: element
                }
            })
        });
        
        const response = await this.fetch('/api/onebot/message' + `/${id}`,onebotMessage)
        return response.message_id
    }
}
