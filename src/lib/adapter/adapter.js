import EventEmitter from "../event.js";
import { client } from "@/lib/runtime.js";

export default class Adapter extends EventEmitter {
    constructor() {
        super();

    }

    async init() {
        this.client = client;
        if (this.client.isConnected) return true;
    }
}