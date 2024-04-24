import Adapter from "./adapter.js";

export default class Onebot extends Adapter {
    constructor() {
        super();
    }


    convertMessage(data) {

        data.message.forEach(element => {
            if(element.type === "image") {
                const base64Data = element.data.file.replace(/^base64:\/\//, "data:image/jpeg;base64,");
                element.data.file = base64Data;
            }
        });
        const webMessage = {
            role:'other',
            time: new Date().getTime(),
            content: data.message,
            id: data.message_id,
        }
        return webMessage
    }

    /**
     * Send message to server
     * @param {id} string
     * @param {WebMessage} message 
     * @returns {Promise<number>} message_id
     */
    async send(id,message) {
        const response = await this.fetch('/api/onebot/message' + `/${id}`,message)
        return response.message_id
    }
}
