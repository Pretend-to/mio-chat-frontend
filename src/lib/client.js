import Socket from "./websocket.js";
import Contactor from "./contactor.js";
export default class Client {
    constructor() {
        this.firstCome = null;
        this.id = null;
        this.code = null;
        this.isLogin = false;
        this.isConnected = false;
        this.url = null;
        this.contactList = [];
        this.socket = null;
        this.beforeInit();
        this.qq = null;
        this.avatar = null;
    }

    beforeInit() {
        const localConfig = this.getLocalStorage();
        if (localConfig) {
            localConfig.isConnected = false
            this.loadLocalStorage(localConfig)
        } else {
            // 使用者初次使用
            this.id = this.genFakeId();
            this.code = null;
            this.genDefaultConctor();
            this.setLocalStorage();
        }
    }

    genDefaultConctor() {
        const onebotDefaultConfig = {
            id: this.genFakeId(),
            name: "OneBot",
            avatar: "/api/avatar/onebot.jpg",
            title: "云崽",
            options: {
                textWarperList: [],
            }
        }
        this.addConcator("onebot", onebotDefaultConfig)

    }

    addConcator(platform, config) {
        const bot = new Contactor(platform, config);
        this.contactList.push(bot)
    }

    rmConcator() {

    }

    async init() {
        if (this.isLogin) {
            console.log("检测到缓存，尝试自动重连")
            this.isLogin = false
            this.isConnected = false
            const connected = await this.login(this.code)
            return connected
        } else {
            console.log("没登陆过，请先登录")
        }

    }
    /**
     * 生成一个以1开头的5位随机ID
     * @returns {number} 1开头的5位随机ID
     */
    genFakeId() {
        // 生成5位随机数
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        // 将随机数转换为字符串
        const randomNumStr = `1${randomNum}`
        if (!this.id) {
            // 将拼接后的字符串转换为数字并返回
            return parseInt(randomNumStr);
        } else {
            // 生成5位随机数
            const subRandomNum = Math.floor(1000 + Math.random() * 9000);
            // 将随机数转换为字符串
            const randomNumStr = `${this.id}${subRandomNum}`
            return parseInt(randomNumStr);
        }



    }

    /**
     * 获取localstorage中的用户信息
     * @returns {object} 用户信息
     */
    getLocalStorage() {
        let client = JSON.parse(localStorage.getItem('client'));
        if (client) {
            return client;
        } else {
            return false;
        }
    }

    /**
     * 从localstorage中加载用户信息
     * @param {object} client 用户信息
     */
    loadLocalStorage(client) {
        // 把client对象的所有属性附加到this上
        Object.assign(this, client);
        // 如果联系人列表存在，那么实例化为联系人对象
        if (client.contactList.length != 0) {
            this.contactList = [];
            this.contactList = client.contactList.map(item => new Contactor(item.platform, item))
        }
    }


    /**
     * 设置localstorage中的用户信息
     */
    setLocalStorage() {
        localStorage.setItem('client', JSON.stringify(this));
    }

    /**
     * 登录
     * @param {string} code 访问码
     * @returns {Promise} 登录结果
     */
    async login(code) {
        this.code = code
        return new Promise((resolve, reject) => {
            const socket = new Socket(this.id, this.code)
            // 5秒内没有成功建立链接，则认为登录失败
            const timer = setTimeout(() => {
                reject("登录超时，请检查网络连接或重新登录")
            }, 5000)
            socket.on('connect', (info) => {
                console.log("登录成功")
                clearTimeout(timer)
                this.qq = info.admin_qq
                this.avatar = `/api/qava?q=${this.qq}`
                this.contactList[0].avatar = `/api/qava?q=${info.bot_qq}`
                this.isLogin = true
                this.isConnected = true
                this.socket = socket
                this.setLocalStorage()
                console.log(this)
                resolve(true)
            })

            socket.connect()

        })
    }

    /**
     * 登出
     */
    async logout() {
        this.isLogin = false
        this.isConnected = false
        this.socket.disconnect()
        this.socket = null
        this.setLocalStorage()
    }
}
