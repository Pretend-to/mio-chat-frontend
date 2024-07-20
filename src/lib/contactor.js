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
        this.firstMessageIndex = 0;
        this.messageChain = config.messageChain || [];
        this.active = false;
        this.activeModel = undefined;
        this.lastUpdate = undefined;

        this.kernel = this.platform == 'onebot' ?
            new Onebot(config) :
            new Openai(config) ;

        if(this.platform == 'openai')
            this.enableOpenaiListener()
    }

    enableOpenaiListener() {
        this.kernel.on('updateMessage', (e) => {
            let updatedMessage
            const messageIndex = e.index
            const chunk = e.chunk
            const rawMessage = this.messageChain[messageIndex]
            if(rawMessage){
                if(rawMessage.content[0].data.text == '`正在思考如何回复，请稍等...`') 
                    rawMessage.content[0].data.text = ''
                // 拼接
                updatedMessage = rawMessage.content[0].data.text += chunk
            }
            if(this.active) this.emit('updateMessage', {messageIndex: messageIndex, updatedMessage: updatedMessage});
            else this.messageChain[messageIndex].content[0].data.text = updatedMessage
        });


        this.kernel.on('completeMessage', (e) => {
            const messageIndex = e.index
            const rawMessage = this.messageChain[messageIndex]
            if(rawMessage){
                if(this.active) this.emit('completeMessage',{text:rawMessage.content[0].data.text,index:messageIndex});
            }
        })
        this.kernel.on('failedMessage', (e) => {
            console.log(e)
            const messageIndex = e.index
            const rawMessage = this.messageChain[messageIndex]
            if(rawMessage){
                this.emit('completeMessage', {text:"请求发生错误！\n" + JSON.stringify(e.error.error.message) + "\n",index:messageIndex});
            }
        })
    }

    /**
     * Send message to contactor
     * @param {OnebotMessage} message 
     */
    async send(message) {
        await this.kernel.send(message);
    }

    /**
     * 从网页前端发来的消息
     */
    async webSend(message){
        console.log(message)
        this.messageChain.push(message)
        if(this.platform == 'onebot'){
            return await this.kernel.send(this.id,message.content)
        }else{
            const messages = []

            // 截取从this.firstMessageIndex到结尾的消息
            const cuttedMessageList = this.messageChain.slice(this.firstMessageIndex)
            const validMessageList = cuttedMessageList.filter(msg => msg.role!= 'system')


            for(const msg of validMessageList){
                messages.push({
                    role: msg.role == 'user'? 'user' : 'assistant',
                    content: msg.content.length == 1 ? msg.content[0].data.text : 
                        msg.content[1].type == 'image' ? 
                        msg.content.map((item) =>  {
                        const obj = {}
                        obj.type = item.type == 'text' ? 'text' : 'image_url',
                        obj[((item.type == 'text')||(item.type == 'file')) ? 'text' : 'image_url' ] = item.data?.text || {url: item.data.file}
                        return obj
                    }) :
                    msg.content[0].data.text + msg.content[1].data.file
                }) 
            }

            console.log(messages)

            // 立即发生回复消息
            this.revMessage({content:[]}) 

            const settings = {
                model: this.activeModel,
            }

            const replyIndex = this.messageChain.length - 1
            this.kernel.send(messages,replyIndex,settings)

            return Math.floor(Math.random() * 100000000).toString().padStart(8, '0')
        }
    }
        

    /**
     * 接收到消息
     * @param {string} id - ID of the contactor
     * @param {object} message - Message received from contactor
     */
    revMessage(message) {
        const webMessage = this.kernel.convertMessage(message)
        console.log(`收到消息，id:${this.id},激活状态:${this.active}`)
        console.log(webMessage)
        
        if(!this.active) this.messageChain.push(webMessage)
        else this.emit('revMessage', webMessage)
        
        console.log(this.messageChain)
        return webMessage
    }

    /**
     * 删除消息
     * @param {string} message_id - ID of the message to be deleted
     * @returns {boolean} - Whether the message is successfully deleted
     */
    delMessage(message_id){
        for (let i = 0; i < this.messageChain.length; i++) {
            if (this.messageChain[i].id === message_id) {
                if(this.active) this.emit('delMessage',i)
                else this.acting.messageChain.splice(i, 1)
                this.makeSystemMessage(`${this.name}撤回了一条消息`)
                return true;   // 删除成功
            }
        }
        return false;  // 没有找到要删除的消息
    }

    makeSystemMessage(text) {
        const container = {
            role: "system",
            time: new Date().getTime(),
            id: new Date().getTime(),
            content: [{
                type: "text",
                data: {
                    text: text
                }
            }]
        }
        if(this.active) this.emit('revMessage',container)
        else this.messageChain.push(container)
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

    getShownTime(timestamp) {
        const currentTime = new Date().getTime();
        // 如果传入时间和当前时间差在24h以内，则显示时间

        const timeDiff = currentTime - timestamp;
        if (timeDiff < 24 * 60 * 60 * 1000) {
            const hours = new Date(timestamp).getHours().toString().padStart(2, '0');
            const minutes = new Date(timestamp).getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        } else if (timeDiff < 48 * 60 * 60 * 1000) {
            // 小于48小时，显示昨天+时间
            const hours = new Date(timestamp).getHours().toString().padStart(2, '0');
            const minutes = new Date(timestamp).getMinutes().toString().padStart(2, '0');
            return `昨天${hours}:${minutes}`;
        }else if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
            // 小于7天，返回星期x+时间
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekday = new Date(timestamp).getDay();
            const hours = new Date(timestamp).getHours().toString().padStart(2, '0');
            const minutes = new Date(timestamp).getMinutes().toString().padStart(2, '0');
            return `星期${weekdays[weekday]}${hours}:${minutes}`;
        } else {
            // 7天以上，返回xxxx/xx/xx（年/月/日）+时间
            const year = new Date(timestamp).getFullYear();
            const month = (new Date(timestamp).getMonth() + 1).toString().padStart(2, '0');
            const day = new Date(timestamp).getDate().toString().padStart(2, '0');
            const hours = new Date(timestamp).getHours().toString().padStart(2, '0');
            const minutes = new Date(timestamp).getMinutes().toString().padStart(2, '0');
            return `${year}/${month}/${day} ${hours}:${minutes}`;
        }
    }

    getMessageSummary(message) {
        let shownMsg = ''
        if (!message) {
            const msg = this.messageChain[this.messageChain.length - 1]
            if (!msg) return ''
    
            msg.content.forEach(element => {
                if(element.type == 'text') shownMsg += element.data.text
                else if(element.type == 'image') shownMsg += ('[图片]')
                else if(element.type == 'record') shownMsg += ('[语音]')
                else if(element.type == 'video') shownMsg += ('[视频]')
                else shownMsg += ('[未知消息类型]') 
            });
        }else{
            message.forEach(element => {
                if(element.type == 'text') shownMsg += element.data.text
                else if(element.type == 'image') shownMsg += ('[图片]')
                else if(element.type == 'record') shownMsg += ('[语音]')
                else if(element.type == 'video') shownMsg += ('[视频]')
                else if(element.type == 'file') shownMsg += ('[文件]')
                else if(element.type == 'reply') shownMsg += ('')
                else shownMsg += ('[未知消息类型]' + element.type) 
            });
        }

        return shownMsg
    }

    updateFirstMessage(){
        this.firstMessageIndex = this.messageChain.length
    }

    updateKey(){
        this.lastUpdate = new Date().getTime()
    }

}