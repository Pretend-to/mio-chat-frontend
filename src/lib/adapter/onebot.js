import Adapter from "./adapter.js";

export default class Onebot extends Adapter {
    constructor() {
        super();
    }

    /**
     * Send message to server
     * @param {OnebotMessage} message 
     */
    async send(message) {
        this.client.send(message)
    }
}
