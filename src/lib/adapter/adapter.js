/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <118327380+ZY16263646566679@users.noreply.github.com>
 * @lastEditTime 2024-04-24 09:28:40
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
