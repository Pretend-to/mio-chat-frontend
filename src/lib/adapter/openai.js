/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <118327380+ZY16263646566679@users.noreply.github.com>
 * @lastEditTime 2024-04-15 16:13:30
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
