/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor Mio-FCIP <1099834705@qq.com>
 * @lastEditTime 2024-04-11 14:30:48
 */

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
    constructor(url, id, code) {
        super();
        this.available = null;
        this.url = url;
        this.socket = null;
        this.code = code;
        this.id = id;
    }

    /**
     * 连接websocket
     */
    connect() {
        this.socket = new WebSocket(this.url, { headers: { "fake-qq-id": this.id, "authorization": "Bearer " + this.code } });
        this.socket.onopen = () => {
            this.available = true;
            console.log('WebSocket连接成功');
            this.emit('open');
        };
        this.socket.onclose = () => {
            this.available = false;
            console.log('WebSocket连接断开');
        };
        this.socket.onerror = (error) => {
            console.log('WebSocket连接出错', error);
        };
        this.socket.onmessage = (event) => {
            console.log('WebSocket收到消息', event.data);
        };
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
}
