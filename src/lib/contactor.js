import Onebot from './adapter/onebot.js';
import Openai from './adapter/openai.js';
import EventEmmiter from './event.js';

export default class Contactor extends EventEmmiter {
    /**
     * Constructor of Contactor class
     * @param {string} platform - Platform of contactor
     * @param {object} config - Configuration of contactor
     * @param {string} config.id - ID of the contactor
     * @param {string} config.name - Name of the contactor
     * @param {string} config.avatar - Avatar of the contactor
     * @param {string} config.title - Title of the contactor
     * @param {object} config.options - Options of the contactor
     * @param {number} config.priority - Priority of the contactor,from 0 to 1, 0 means highest priority
     */
    constructor(platform, config) {
        super();
        this.platform = platform;
        this.id = config.id;
        this.name = config.name;
        this.avatar = config.avatar;
        this.title = config.title;
        this.options = config.options;
        this.priority = config.priority;
        this.messageChain = [];

        this.kernel = this.platform == 'onebot' ?
            new Onebot(config) :
            new Openai(config);
    }

    /**
     * Send message to contactor
     * @param {OnebotMessage} message 
     */
    async send(message) {

        await this.kernel.send(message);
    }

    getLastTime() {
        const last = this.messageChain[this.messageChain.length - 1]
        if (!last) {
            return '';
        }

        const currentTime = new Date().getTime();
        const lastTime = new Date(last.time);
        const timeDiff = currentTime - lastTime.getTime();

        if (timeDiff < 24 * 60 * 60 * 1000) {
            this.toinit = false
            // 小于24小时，返回 xx:xx (小时:分钟)
            const hours = lastTime.getHours().toString().padStart(2, '0');
            const minutes = lastTime.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        } else if (timeDiff < 48 * 60 * 60 * 1000) {
            // 小于48小时，显示昨天
            return '昨天';
        } else if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
            // 小于7天，返回星期x
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekday = lastTime.getDay();
            return `星期${weekdays[weekday]}`;
        } else {
            // 7天以上，返回xxxx/xx/xx（年/月/日）
            const year = lastTime.getFullYear();
            const month = (lastTime.getMonth() + 1).toString().padStart(2, '0');
            const day = lastTime.getDate().toString().padStart(2, '0');
            return `${year}/${month}/${day}`;
        }
    }

    getLastContent() {
        const msg = this.messageChain[this.messageChain.length - 1]
        if (!msg) return ''
        let type = '';
        if (msg.content.text.length) {
            type = msg.content.text[0]
        } else if (msg.content.image.length) {
            type = "[图片]"
        } else {
            type = '[语音]'
        }
        return type;
    }

}