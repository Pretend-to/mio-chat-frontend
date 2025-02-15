import Socket from './websocket.js'
import Contactor from './contactor.js'
import localforage from 'localforage'
import EventEmitter from './event.js'
import { reactive } from 'vue'

localforage.config({
  name: 'mio-chat'
})

export default class Client extends EventEmitter {
  constructor(config) {
    super()
    this.everLogin = false // 读取
    this.id = null // 读取
    this.code = null // 读取
    this.isConnected = false // 动态
    this.contactList = [] // 读取
    this.socket = null // 动态
    this.qq = null // web
    this.botqq = null // web
    this.avatar = null // web
    this.onPhone = null // 动态
    this.models = [] 
    this.title = "Mio" // 固定
    this.name = "user" // 固定
    this.displaySettings = null // web
    this.config = config //传参
  }

  /**
   * 预初始化
   * @returns {object} 初始化信息
   */
  async beforeInit() {

    await this.setDisplayInfo()
    const localConfig = await this.getLocalStorage()
    await this.config.loadOnebotDefaultConfig()

    if (localConfig) {
      localConfig.isConnected = false
      this.loadLocalStorage(localConfig)
    } else {
      // 使用者初次使用
      this.id = this.genFakeId()
      this.code = null
    }

    this.emit('loaded')
  }

  async genDefaultConctor() {

    const onebotDefaultConfig = {
      id: this.genFakeId(),
      name: 'OneBot',
      namePolicy: 1,
      avatarPolicy: 1,
      avatar: `/api/qava?q=${this.botqq}`,
      title: '云崽',
      priority: 0,
      options: this.config.onebotDefaultConfig,
      lastUpdate: -Infinity
    }
    
    this.addConcator('onebot', onebotDefaultConfig)
    const models = this.models
    const options = models.map(modelGroup => {
      return {
        value: modelGroup.owner,
        label: modelGroup.owner,
        children: modelGroup.models.map(model => {
          return {
            value: model,
            label: model,
          }
        })

      }
    })
    console.log(options)

    this.config.updateOpenaiDefaultConfig({
      model: this.default_model
    })

    const openaiDefaultConfig = {
      id: this.genFakeId(),
      name: 'MioBot',
      avatar: '/static/avatar/miobot.png',
      namePolicy: 1,
      avatarPolicy: 1,
      title: 'chat',
      priority: 0,
      lastUpdate: -Infinity,
      options: {...this.config.openaiDefaultConfig}
    }

    openaiDefaultConfig.options.tools = this.config.openaiTools.map(tool=>tool.name)
    openaiDefaultConfig.options.enable_tool_call = true

    this.addConcator('openai', openaiDefaultConfig)

  }

  async addConcator(platform, config) {
    const bot = new Contactor(platform, config)
    bot.loadName()
    bot.loadAvatar()
    const list = reactive(this.contactList)
    list.push(bot)
    await this.setLocalStorage();
    return bot
  }

  rmContactor(id) {
    const list = reactive(this.contactList)
    const index = list.findIndex((item) => item.id == id)
    if (index != -1) {
      list.splice(index, 1)
      this.setLocalStorage()
    }
  }

  reset(){
    localforage.clear()
    localStorage.clear()
    // 刷新页面
    window.location.reload()
  }
  async init() {
    if (this.everLogin) {
      console.log('检测到缓存，尝试自动重连')
      this.isConnected = false
      await this.login(this.code)
    } else {
      console.log('没登陆过，请先登录')
    }
  }

  getContactors() {
    return this.contactList
  }

  /**
   * 生成一个以1开头的5位随机ID
   * @returns {number} 1开头的5位随机ID
   */
  genFakeId() {
    // 生成5位随机数
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    // 将随机数转换为字符串
    const randomNumStr = `1${randomNum}`
    if (!this.id) {
      // 将拼接后的字符串转换为数字并返回
      return parseInt(randomNumStr)
    } else {
      // 生成5位随机数
      const subRandomNum = Math.floor(1000 + Math.random() * 9000)
      // 将随机数转换为字符串
      const randomNumStr = `${this.id}${subRandomNum}`
      return parseInt(randomNumStr)
    }
  }

  /**
   * 获取localstorage中的用户信息
   * @returns {object} 用户信息
   */
  async getLocalStorage() {
    const client = await localforage.getItem('client')
    if (client) {
      return JSON.parse(client)
    } else {
      return false
    }
  }

  /**
   * 从localstorage中加载用户信息
   * @param {object} client 用户信息
   */
  loadLocalStorage(client) {
    this.everLogin = client.everLogin
    this.id = client.id
    this.code = client.code
    this.avatar = client.avatar
    this.models = client.models
    // 如果联系人列表存在，那么实例化为联系人对象
    if (client.contactList.length != 0) {
      this.contactList = []
      this.contactList = client.contactList.map((item) => new Contactor(item.platform, item))
    }
  }

  /**
   * 设置localstorage中的用户信息
   */
  async setLocalStorage() {
    await localforage.setItem('client', JSON.stringify(this))
  }

  /**
   * 登录
   * @param {string} code 访问码
   * @returns {Promise} 登录结果
   */
  async login(code) {
    this.code = code
    return new Promise((resolve) => {
      const socket = new Socket(this.id, this.code)
      socket.on('connect', async (info) => {
        console.log('登录成功')
        this.qq = info.admin_qq
        this.avatar = `/api/qava?q=${this.qq}`
        this.botqq = info.bot_qq
        this.default_model = info.default_model
        this.models = info.models

        this.everLogin = true
        this.isConnected = true

        this.socket = socket
        this.addMsgListener()
        if(this.contactList.length == 0) await this.genDefaultConctor()
        this.setLocalStorage()
        resolve(info)
      })
      socket.connect()
    })
  }

  addMsgListener() {
    this.socket.on('onebot_message', (e) => {
      console.log(e)
      const data = e.data
      const id = data.id
      const content = data.content
      const type = data.type

      if (type == 'message') {
        const contactor = this.getContactor(id)
        if (contactor) {
          contactor.revMessage(content)
          this.setLocalStorage()
        }
      }else if (type == 'del_msg'){
        const onebotContactors = this.contactList.filter((item) => item.platform == 'onebot')
        for(const onebotContactor of onebotContactors){
          const deleted = onebotContactor.delMessage(content.message_id)
          if(deleted){
            this.setLocalStorage()
            console.log('删除消息成功')
            break
          }
        }
      } 
    })
  }

  /**
   * 登出
   */
  async logout() {
    this.isConnected = false
    this.socket.disconnect()
    this.socket = null
    this.setLocalStorage()
  }

  /**
   * 获取联系人
   * @param {number} id 联系人ID
   * @returns {Contactor} 联系人对象
   */
  getContactor(id) {
    return this.contactList.find((item) => item.id == id) ?? this.contactList[0]
  }

  async setDisplayInfo() {
    const res = await fetch('/api/base_info')
    const { data } = await res.json()

    const stroged = this.config.getDisplayConfig()
    if (!stroged) {
      this.config.setDisplayConfig(data)
    }

    this.admin_qq = data.admin_qq
    this.bot_qq = data.bot_qq

    this.displaySettings = data

    const keyWidth = 600
    this.onPhone = window.innerWidth < keyWidth 
    const handleResize = () => {
       if ((window.innerWidth < keyWidth) && !this.onPhone) {
         this.emit('device-change','mobile')
         this.onPhone = true
       }else if ((window.innerWidth >= keyWidth) && this.onPhone) {
         this.emit('device-change','desktop')
         this.onPhone = false 
       }
    }
    window.addEventListener("resize", handleResize);
  }

  getDisplaySettings() {
    return this.displaySettings
  }

  async getLoginHistory() {
    const myclient = await this.getLocalStorage()
    return myclient.everLogin
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file); // 将文件添加到 FormData

    try {
      const response = await fetch('/api/upload/file', {
          method: 'POST',
          body: formData
      });

      return await response.json();
  } catch (error) {
      console.error('Error uploading file:', error);
  }

  }

  async uploadImage(image) {
    const body = {
      image : image
    }

    try {
      const response = await fetch('/api/upload/image', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
      });

      return await response.json();
    }
    catch (error) {
      console.error('Error uploading image:', error);
    }
  }
}
