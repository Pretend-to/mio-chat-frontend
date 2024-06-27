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
        this.heartBeat = null;
        this.delay = null;
    }   

    /**
     * 在浏览器端获取当前host:port
     * @returns {String}
     */
    getURL() {
        // 获取当前页面的主机名和端口号
        const url = new URL(window.location.href);
        const host = url.host;
        return url.protocol === 'https:' ? `wss://${host}/api/gateway` : `ws://${host}/api/gateway`;
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
            const loginPromise = this.fetch('/api/system/login', headers);
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => {
                    resolve('WebSocket连接超时');
                }, 1000); // 1秒后超时
            });
            
            Promise.race([loginPromise, timeoutPromise])
                .then(result => {
                    if (result === 'WebSocket连接超时') {
                        console.log('WebSocket连接超时，不执行emit操作');
                    } else {
                        if (this.socket.readyState === WebSocket.OPEN) {
                            console.log('WebSocket登录成功', result);
                            this.emit('connect', result);
                        } else {
                            console.log('WebSocket连接已断开，不执行emit操作');
                        }
                    }
                });

            // 每隔3秒发送心跳包
            this.heartBeat = setInterval(async () => {
                if (this.socket.readyState === WebSocket.OPEN) {
                    const res = await this.fetch('/api/system/heartbeat',{timestamp:Date.now()})
                    const serverRevTime = res.revTime
                    const cuurentTime = Date.now()
                    const delayTo = res.delay
                    const delayBack = cuurentTime - serverRevTime
                    this.delay = delayTo + delayBack
                }
            }, 3000);
        };
        this.socket.onclose = () => {
            this.available = false;
            this.disconnect();
            console.error('WebSocket连接断开，将在5秒后尝试重新连接...');
            setTimeout(()=>this.connect(), 5000); // 5秒后尝试重新连接
        };
        this.socket.onerror = (error) => {
            console.error('WebSocket连接出错', error);
        };
        this.socket.onmessage = (event) => {
            this.messageHandler(event.data);
        };
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.available = false;
            clearInterval(this.heartBeat);
            console.log('WebSocket连接已断开');
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
            if (!e.type == 'heartbeat') console.log('WebSocket收到事件，原始数据：', e);

            this.emit(e.request_id, e);

            if(e.protocol == 'onebot'){
                this.emit('onebot_message',e)
            }else if(e.protocol == 'system'){
                this.emit('system_message',e)
            }

            // console.log('WebSocket触发事件', e.request_id.toString, e.data);
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
            const protocol = pathArray[1];
            const type = pathArray[2];
            const id = pathArray[3];
            let request_id = this.genRequestID();

            const request = {
                request_id: request_id,
                protocol: protocol,
                type: type,
                id: id,
                data: data,
            }

            this.requests.push(request_id);

            const timeOut = new Promise(reject => {
                setTimeout(() => {
                    reject('timeout')
                }, 60000)
            })

            const response = new Promise(resolve => {
                this.on(request_id, (res) => {
                    this.requests.splice(this.requests.indexOf(request_id), 1)
                    resolve(res.data)
                })
            })


            Promise.race([timeOut, response]).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })


            this.sendObject(request)
            if(type !== 'heartbeat')console.log('WebSocket发送请求', url, request);

        })
    }

    async *streamCompletions(data) {
        console.log('WebSocket开始流式获取补全数据')
        const request = {
            request_id: this.genRequestID(),
            protocol: 'openai',
            type: 'completions',
            data: data,
        }
    
        this.requests.push(request.request_id);

        this.sendObject(request)
    
        let resolve;
        let reject;
        let promise = new Promise((r, j) => { resolve = r; reject = j; });
    
        this.on(request.request_id, (data) => {
            // console.log('WebSocket收到补全数据', data);
            if (data.message === 'update') {
                // resolve(data.data.chunk);
                resolve(data);
                promise = new Promise((r, j) => { resolve = r; reject = j; }); // Create a new promise for the next data chunk
            } else if (data.message === 'completed' || data.message === 'failed') {
                console.log('WebSocket流式获取补全数据结束', data.message);
                reject({ done: true,data: data }); // Reject the promise to stop the iteration
            }
        });
    
        try {
            while(true) {
                const chunk = await promise; // Wait for the 'on' callback to be called
                yield chunk; // Yield the data chunk
            }
        } catch(e) {
            if (e.done) {
                yield e.data;
                return; // Stop the iteration
            }
            throw e; // If it's another error, rethrow it
        }
    }    
    
}
