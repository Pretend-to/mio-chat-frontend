/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-22 12:12:28
 */

import Adapter from "./adapter.js";

export default class Openai extends Adapter {
    constructor(config) {
        super()
        this.apikey = config.apikey
        this.baseUrl = config.baseUrl
        this.settings = config.settings || {}
        this.tools = this.getTools()
    }
}
