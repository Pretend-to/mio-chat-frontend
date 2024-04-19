/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-19 11:10:54
 */

import EventEmitter from "../event.js";
import { client } from "@/lib/runtime.js";

export default class Adapter extends EventEmitter {
    constructor() {
        super();

    }

    async fetch(url,data){
        return await client.socket.fetch(url,data);
    }

}
