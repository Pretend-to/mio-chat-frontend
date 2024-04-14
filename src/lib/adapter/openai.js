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
