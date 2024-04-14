import EventEmitter from "./event.js";

/**
 * websocket连接类
 */
export default class Socket extends EventEmitter {
    /**
     * @param {String} url websocket地址
     * @param {String} id 机器人QQ号
     * @param {String} code 机器人QQ登录令牌
     */
    constructor(id, code) {
        super();
        this.available = null;
        this.url = this.getURL();
        this.socket = null;
        this.code = code;
        this.id = id;
        this.requests = [];
    }

    /**
     * 在浏览器端获取当前host:port
     * @returns {String}
     */
    getURL() {
        // 获取当前页面的主机名和端口号
        const url = new URL(window.location.href);
        const host = url.host;
        const wsURL = `ws://${host}/api/gateway`;

        console.log(wsURL);
        return wsURL;
    }

    /**
     * 连接websocket
     */
    async connect() {
        const headers = { "mio-chat-id": this.id, "mio-chat-token": this.code }
        this.socket = new WebSocket(this.url);
        this.socket.onopen = async () => {
            console.log('WebSocket连接中...');

            this.available = true;
            console.log('WebSocket连接成功');

            // 发送登录信息
            const loginRes = await this.fetch('/api/system/login', headers);
            console.log('WebSocket登录成功', loginRes);
            this.emit('login', loginRes);


            setTimeout(() => {
                if (this.socket.readyState === WebSocket.OPEN) {
                    console.log('WebSocket仍然连接中，执行emit操作');
                    this.emit('connect', loginRes);
                } else {
                    console.log('WebSocket连接已断开，不执行emit操作');
                }
            }, 1000); // 1秒后检查连接状态
        };
        this.socket.onclose = () => {
            this.available = false;
            console.log('WebSocket连接断开');
        };
        this.socket.onerror = (error) => {
            console.log('WebSocket连接出错', error);
        };
        this.socket.onmessage = (event) => {
            this.messageHandler(event.data);
            console.log('WebSocket收到消息', event.data);
        };
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }

    /**
     * 发送消息
     * @param {String} message 消息内容
     */
    send(message) {
        if (this.available) {
            this.socket.send(message);
        } else {
            console.log('WebSocket连接不可用');
        }
    }

    messageHandler(message) {
        try {
            const e = JSON.parse(message);
            console.log('WebSocket收到消息', e);
            this.emit(e.request_id.toString(), e.data)
            console.log('WebSocket触发事件', e.request_id.toString, e.data);
        } catch (error) {
            console.error('JSON解析失败:', error);
            // 进行错误处理，例如给出默认值或者其他操作
        }
    }

    /**
     * 发送对象类型消息
     * @param {Object} message 消息对象
     */
    sendObject(message) {
        if (this.available) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.log('WebSocket连接不可用');
        }
    }

    genRequestID() {
        return Math.random().toString(36).substr(2, 9);
    }

    fetch(url, data) {
        return new Promise((resolve, reject) => {
            const pathArray = url.split('/').filter(Boolean);
            const proctol = pathArray[1];
            const type = pathArray[2];
            let requestID = this.genRequestID();

            const request = {
                requestID: requestID,
                proctol: proctol,
                type: type,
                data: data,
            }

            this.requests.push(request.requestID);

            const timeOut = new Promise(reject => {
                setTimeout(() => {
                    reject('timeout')
                }, 60000)
            })

            const response = new Promise(resolve => {
                this.on(requestID, (res) => {
                    resolve(res)
                })
            })


            Promise.race([timeOut, response]).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })


            this.sendObject(request)
            console.log('WebSocket发送请求', url, request);

        })
    }
}
