/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-15 16:44:27
 */

import Socket from "./websocket.js"
import { client } from "./runtime.js"

export default class Auth {
    constructor() {

    }

    async login(code) {
        return new Promise((resolve, reject) => {
            const socket = new Socket(client.url, client.id, code)
            // 1秒内没有成功建立链接，则认为登录失败
            const timer = setTimeout(() => {
                reject(new Error('登录超时'))
            }, 1000)
            socket.on('connect', () => {
                clearTimeout(timer)
                resolve(socket)
            })

            socket.connect()
        })
    }
}
