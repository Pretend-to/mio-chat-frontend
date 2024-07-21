import Socket from './websocket.js'
import Contactor from './contactor.js'
import localforage from 'localforage'

localforage.config({
  name: 'mio-chat'
})

export default class Client {
  constructor() {
    this.everLogin = false
    this.id = null
    this.code = null
    this.isLogin = false
    this.isConnected = false
    this.url = null
    this.contactList = []
    this.socket = null
    this.qq = null
    this.botqq = null
    this.avatar = null
    this.onPhone = null
    this.models = []
    this.beian = ""
    this.fullScreen = false
    this.title = "人工"
    this.name = "user"
    this.webTitle = ""
  }

  /**
   * 预初始化
   * @returns {object} 初始化信息
   */
  async beforeInit() {

    const localConfig = await this.getLocalStorage()
    console.log(localConfig)

    if (localConfig) {
      localConfig.isConnected = false
      this.loadLocalStorage(localConfig)
      console.log('从缓存加载客户端信息')
      console.log(this)

    } else {
      // 使用者初次使用
      this.id = this.genFakeId()
      this.code = null
      console.log('生成默认信息')

      const base_info = await this.getBaseInfo()
      this.beian = base_info.beian
      this.fullScreen = base_info.fullScreen
      this.admin_qq = base_info.admin_qq
      this.webTitle = base_info.title

      this.setLocalStorage()

    }
  }

  async genDefaultConctor() {
    const onebotOptionsData = await fetch(`/api/onebot/plugins`)
    const onebotOptionsJson = await onebotOptionsData.json()

    const onebotDefaultConfig = {
      id: this.genFakeId(),
      name: 'OneBot',
      avatar: `/api/qava?q=${this.botqq}`,
      title: '云崽',
      priority: 0,
      options: onebotOptionsJson.data.options
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

    const openaiDefaultConfig = {
      id: this.genFakeId(),
      name: this.default_model,
      activeModel: this.default_model,
      avatar: '/api/avatar/openai.png',
      title: 'gpt',
      priority: 1,
      options: {
        models: this.models,
        modelsOptions: options,
        textWraper: {
          options: options,
          presets: {
            "default": ""
          }
        }
      }
    }
    console.log(openaiDefaultConfig)
    this.addConcator('openai', openaiDefaultConfig)

  }

  addConcator(platform, config) {
    const bot = new Contactor(platform, config)
    if (platform == 'openai')
      bot.avatar = bot.getAvatar(bot.activeModel)
    this.contactList.push(bot)
  }

  rmConcator() {

  }

  reset(){
    localforage.clear()
    // 刷新页面
    window.location.reload()
  }

  async init() {
    if (this.everLogin) {
      console.log('检测到缓存，尝试自动重连')
      this.isLogin = false
      this.isConnected = false
      const connected = await this.login(this.code)
      return connected
    } else {
      console.log('没登陆过，请先登录')
    }
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
    // 把client对象的所有属性附加到this上
    Object.assign(this, client)
    console.log(this)
    // 如果联系人列表存在，那么实例化为联系人对象
    if (this.contactList.length != 0) {
      console.log('从缓存加载联系人列表')
      console.log(client.contactList)
      this.contactList = []
      this.contactList = client.contactList.map((item) => new Contactor(item.platform, item))
    }else{
      console.log(client.contactList)
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
    return new Promise((resolve, reject) => {
      const socket = new Socket(this.id, this.code)
      // 3秒内没有成功建立链接，则认为登录失败
      const timer = setTimeout(() => {
        reject('登录超时，网络链接错误或存在已连接的标签页')
      }, 3000)
      socket.on('connect', async (info) => {
        console.log('登录成功')
        console.log(info)
        clearTimeout(timer)
        this.qq = info.admin_qq
        this.avatar = `/api/qava?q=${this.qq}`
        this.botqq = info.bot_qq
        this.default_model = info.default_model
        this.isLogin = true
        this.everLogin = true
        this.isConnected = true
        this.socket = socket
        this.models = info.models
        this.setLocalStorage()
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
    this.socket.on('system_message', (e) => {
      if(e.type != 'heartbeat') console.log(e)
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

  /**
   * 获取联系人
   * @param {number} id 联系人ID
   * @returns {Contactor} 联系人对象
   */
  getContactor(id) {
    return this.contactList.find((item) => item.id == id) ?? this.contactList[0]
  }

  async getBaseInfo() {
    let info = await fetch('/api/base_info')
    info = await info.json()
    console.log(info)
    return {
      beian:info.data.beian || "",
      fullScreen:info.data.full_screen || false,
      title:info.data.title || "Mio-Chat",
      admin_qq:info.data.admin_qq || "",
    }
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
