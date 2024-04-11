import Onebot from './adapter/onebot.js';
import Openai from './adapter/openai.js';
import EventEmmiter from './event.js';

export default class Contactor extends EventEmmiter {
    /**
     * Constructor of Contactor class
     * @param {string} type - Type of contactor
     * @param {object} config - Configuration of contactor
     */
    constructor(type, config) {
        super();
        this.type = type;
        this.config = config;

        this.kernel = type == 'onebot' ?
            new Onebot(config) :
            new Openai(config);
    }

    /**
     * Initialize contactor
     */
    async init() {
        await this.kernel.init();
        this.kernel.on('message', (event) => {
            this.emit('message', event);
        });
    }

    /**
     * Send message to contactor
     * @param {OnebotMessage} message 
     */
    async send(message) {
        await this.kernel.send(message);
    }

}