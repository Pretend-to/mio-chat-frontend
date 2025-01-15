/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-25 06:25:30
 */

import Client from "./client.js";
import Config from "./config.js";

const config = new Config();
const client = new Client(config);

export { config, client };
