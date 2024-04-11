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