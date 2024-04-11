/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor Mio-FCIP <1099834705@qq.com>
 * @lastEditTime 2024-04-11 11:39:45
 */
import EventEmitter from "../event.js"

export default class Openai extends EventEmitter {
    constructor(config) {
        super()
        this.apikey = config.apikey
        this.baseUrl = config.baseUrl
        this.settings = config.settings || {}
        this.tools = this.getTools()
    }
}
