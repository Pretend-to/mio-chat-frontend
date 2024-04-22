<script>
import { MdPreview } from 'md-editor-v3'
import 'emoji-picker-element'
import { client } from '@/lib/runtime.js'

export default {
    data() {
        const currentId = parseInt(this.$route.params.id)
        const contactor = client.getContactor(currentId)
        console.log(contactor)
        return {
            acting: contactor,
            showwindow: true,
            showemoji: false,
            userInput: '',
            todld: false,
            client: client,
            warperOptions: [],
            warperPresets: {},
            selectedWarper: null
        }
    },
    methods: {
        getSafeText(text) {
            return text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        },
        handleKeyDown(event) {
            if (event.ctrlKey && event.key === 'Enter') {
                if (this.userInput && this.isValidInput(this.userInput)) this.send()
                else this.$message({ message: '不能发送空消息', type: 'warning' })
                // 处理按下 Ctrl+Enter 键的逻辑
            }
        },
        async send() {
            this.$refs.textarea.focus()

            const msg = this.getSafeText(this.userInput)
            const warpedMessage = this.warpText(msg)
            this.userInput = this.textareaRef.value = ''

            const container = {
                role: 'user',
                time: new Date().getTime(),
                content: {
                    voice: [],
                    image: [],
                    text: [warpedMessage]
                }
            }

            const message_id = await this.acting.webSend(container) //发送消息
            container.id = message_id
            setTimeout(this.tobuttom, 0)
            client.setLocalStorage() //持久化存储
        },
        eemoji() {
            this.showemoji = !this.showemoji
        },
        getemoji(e) {
            const unicode = e.detail.unicode
            const textarea = this.$refs.textarea
            const startPos = textarea.selectionStart
            const endPos = textarea.selectionEnd
            const textBeforeCursor = this.userInput.substring(0, startPos)
            const textAfterCursor = this.userInput.substring(endPos)
            this.userInput = textBeforeCursor + unicode + textAfterCursor
            const newCursorPos = startPos + unicode.length
            textarea.selectionStart = newCursorPos
            textarea.selectionEnd = newCursorPos
            textarea.focus()
            this.showemoji = !this.showemoji
        },
        updateCursorPosition() {
            const textarea = this.$refs.textarea
            this.cursorPosition = textarea.selectionStart
        },
        tobuttom(clicked) {
            if (clicked) this.$message('已滑至底部')
            const chatWindow = this.$refs.chatWindow
            //console.log("滑动条位置顶部与元素顶部间距："+ chatWindow.scrollTop + "元素高度" + chatWindow.scrollHeight)
            chatWindow.scrollTop = chatWindow.scrollHeight
            //console.log(chatWindow.scrollHeight)
        },
        cleanScreen() {
            this.acting.messageChain = []
            this.global.stroge() //持久化存储
            this.toupdate = true
        },
        async reset() {
            this.one.init()
        },
        isValidInput(input) {
            // 使用正则表达式检查用户输入是否只包含换行符和空格
            const regex = /^[ \n]+$/
            const result = !regex.test(input)
            return result
        },
        waiting() {
            this.$message({ message: '此功能尚未开放', type: 'warning' })
        },
        async voiceList() {
            let data = ['关闭']
            const list = await this.one.getVoices()
            this.tochoose.list = data.concat(list)
            this.listype = 1
            this.tochoose.chosen =
                this.crtvoice === '关闭' ? 0 : 1 + list.findIndex((item) => item === this.crtvoice)
            this.showchose = true
        },
        async activeBotTools() {
            const testMessage = 'text'
            const testMessage2 = 'test'
            const warpedMessage = this.warpText(testMessage)
            const warpedMessage2 = this.warpText(testMessage2)
            if (warpedMessage2 === warpedMessage) {
                this.userInput = this.textareaRef.value = warpedMessage
                await this.send()
            }
        },
        changevoice(data) {
            console.log(data)
            const result = data.list[data.chosen]
            this.crtvoice = result
            this.userInput = '切换语音 ' + result
            this.send()
        },
        async revmsg(task) {
            const response = await this.one.getResponse(task.reqid)
            const content = response.container.content
            if (content.text.length || content.image.length || content.voice.length) {
                const theone = this.global.friend.find((item) => item.uin === task.uin)
                theone.addmsg(response.container) //存储于store
                this.global.stroge() //持久化存储
            }
            if (response.continue) this.revmsg(task)
            else console.log(content)
            this.toupdate = true
        },
        tolist() {
            this.$router.push({ name: 'toChat' })
        },
        toplay(time) {
            const audioId = `voice-${ time }`
            const audio = document.getElementById(audioId)
            if (audio.paused) {
                audio.play()
                this.playing = true
            } else {
                audio.pause()
                this.playing = false
            }

        },
        pickmsg(index) {
            const list = ['复制文本', '删除消息']
            this.listype = 3
            this.tochoose.list = list
            this.tochoose.chosen = null
            this.showchose = true
            this.pickedmsg = index
            console.log(this.acting.history[index])
        },
        readmsg(data) {
            console.log(data)
            if (data.chosen === 0) {
                var textarea = document.createElement('textarea')
                textarea.value = this.acting.history[this.pickedmsg].content.text[0]
                document.body.appendChild(textarea)
                textarea.select()
                document.execCommand('copy')
                document.bodyNaNpxoveChild(textarea)
                this.$message('已复制')
            } else {
                this.acting.history.splice(this.pickedmsg, 1)
                this.$message('已删除')
                this.global.stroge() //持久化存储
            }
        },
        showTime(index) {
            const thisTime = this.acting.messageChain[index].time
            if (index === 0) {
                return {
                    show: true,
                    time: this.acting.getShownTime(thisTime)
                }
            } else {
                const earlyTime = this.acting.messageChain[index - 1].time
                if (thisTime - earlyTime > 600000) {
                    return {
                        show: true,
                        time: this.acting.getShownTime(thisTime)
                    }
                } else {
                    return {
                        show: false,
                        time: ''
                    }
                }
            }
        },
        getBotTools() {
            const warper = this.acting.options.textWarper
            this.warperOptions = warper.options
            this.warperPresets = warper.presets
        },
        warpText(rawText) {
            if (!this.selectedWarper) return rawText
            const warper = this.selectedWarper[this.selectedWarper.length - 1]
            if (!warper) return rawText
            const testText = '{xxx}'
            const preset = this.warperPresets[warper]
            const result = preset.replace(testText, rawText)
            return result
        },
        getWarperName() {
            if (!this.selectedWarper) return ''
            const warper = this.selectedWarper[this.selectedWarper.length - 1]
            if (!warper) return ''
            const preset = this.warperPresets[warper]
            const name = preset.replace('#', '').replace('{xxx}', '')
            return name
        }
    },
    mounted() {
        this.textareaRef = this.$refs.textarea
        this.textareaRef.addEventListener('input', this.adjustTextareaHeight)

        console.log(this.acting)
        setTimeout(this.tobuttom, 50)

        this.getBotTools()

        this.acting.on('revMessage', (message) => {
            this.acting.messageChain.push(message)
            this.toupdate = true
        })
        this.acting.on('delMessage', (index) => {
            console.log(`删除消息${ index }`)
            // 从消息链中删除消息
            this.acting.messageChain.splice(index, 1)
            this.toupdate = true
        })
    },
    updated() {
        if (this.toupdate) {
            setTimeout(this.tobuttom, 0)
            this.toupdate = false
        }
    },
    components: {
        MdPreview
    },
    watch: {}
}
</script>

<template>
    <div id="chatwindow">
        <div class="upsidebar" id="chat" v-show="showwindow">
            <div class="return" @click="tolist()">
                <i class="iconfont icon-return"></i>
            </div>
            <div class="somebody" v-if="acting.name">{{ acting.name }}</div>
            <div class="options">
                <ul class="window-controls">
                    <li class="button" @click="waiting()">
                        <span class="window-min">—</span>
                    </li>
                    <li class="button" @click="waiting()">
                        <span class="window-max">▢</span>
                    </li>
                    <li class="button" @click="waiting()" id="close">
                        <span class="window-close">x</span>
                    </li>
                </ul>
                <div class="share" @click="toimg()">
                    <i class="iconfont icon-share"></i>
                </div>
            </div>
        </div>
        <div class="message-window" ref="chatWindow" v-show="showwindow">
            <div v-for="(item, index) of acting.messageChain" :key="index" class="message-container" ref="message">
                <div class="message-time" v-if="showTime(index).show">
                    {{ showTime(index).time }}
                </div>
                <div class="message-body" :id="item.role">
                    <div class="avatar" v-if="item.role !== 'system'">
                        <img v-if="item.role === 'other'" :src="acting.avatar" :alt="acting.name"/>
                        <img v-else :src="client.avatar" :alt="client.name"/>
                    </div>
                    <div class="msg" v-if="item.role !== 'system'">
                        <div class="wholename">
                            <div class="title">{{ item.role === 'other' ? acting.title : client.title }}</div>
                            <div class="name">{{ item.role === 'other' ? acting.name : client.name }}</div>
                        </div>
                        <div v-if="item.content.text.length" class="content">
                            <MdPreview v-for="(msg, index) of item.content.text" previewTheme="github" :key="index"
                                       editorId="preview-only" :modelValue="msg"/>
                        </div>
                        <div v-if="item.content.image.length" class="content">
                            <!-- <MdPreview v-for="(img, index) of item.content.image" previewTheme="github" :key="index" editorId="preview-only"
                                :modelValue="'![pics](' + img + ')'" /> -->
                            <el-image v-for="(img, index) of item.content.image"
                                      style="margin: 8px 0; max-width: 20rem; border-radius: 1rem" :src="img"
                                      :zoom-rate="1.2" :max-scale="7" :min-scale="0.2" :preview-src-list="[img]"
                                      :initial-index="4" :key="index" fit="cover"/>
                        </div>
                        <div v-if="item.content.voice.length" class="content">
                            <div class="voice-box">
                                <div class="icon" @click="toplay(item.time)">
                                    <svg v-if="!playing" t="1698576153001" viewBox="0 0 1024 1024" version="1.1"
                                         xmlns="http://www.w3.org/2000/svg" p-id="7815" width="13" height="13">
                                        <path
                                            d="M889.18 512.01c-128.19 94.47-241.09 167.88-338.7 220.25S326.29 839.69 170.75 897.44c-23.95-128.25-35.92-256.65-35.92-385.2s11.97-257.11 35.92-385.67c111.17 33.95 228.05 83.81 350.65 149.58 122.59 65.78 245.18 144.4 367.78 235.86z"
                                            fill="#ffffff" p-id="7816"></path>
                                        <path
                                            d="M170.75 940.27c-7.32 0-14.6-1.88-21.1-5.56a42.8 42.8 0 0 1-20.99-29.4C104.34 775.07 92 642.79 92 512.24c0-130.53 12.34-262.94 36.66-393.51a42.708 42.708 0 0 1 19.89-28.77c10.43-6.32 23-7.95 34.71-4.35 113.38 34.65 233.95 86.05 358.37 152.8 123.96 66.5 249.47 147.01 373.14 239.29A42.806 42.806 0 0 1 932 512.14a42.816 42.816 0 0 1-17.4 34.36c-129.02 95.08-244.74 170.28-343.86 223.52-98.81 52.99-228.37 109.37-385.08 167.58a42.848 42.848 0 0 1-14.91 2.67z m33.73-757.78c-17.82 109.74-26.83 220.45-26.83 329.75 0 108.47 8.89 218.21 26.41 326.86 131.47-50.31 241.02-98.87 326.17-144.54 83.41-44.79 179.52-106.14 286.29-182.68C711.55 436.46 605.7 370 501.15 313.9c-102.61-55.06-202.19-99.14-296.67-131.41z"
                                            fill="#ffffff" p-id="7817"></path>
                                    </svg>
                                    <svg v-else t="1698574343186" viewBox="0 0 1024 1024" version="1.1"
                                         xmlns="http://www.w3.org/2000/svg" p-id="5329" id="mx_n_1698574343188"
                                         width="16" height="16">
                                        <path
                                            d="M312.89 960a99.55 99.55 0 0 0 99.55-99.56V163.56A99.55 99.55 0 0 0 312.89 64a99.56 99.56 0 0 0-99.56 99.56v696.88A99.56 99.56 0 0 0 312.89 960z m298.67-796.44v696.88A99.55 99.55 0 0 0 711.11 960a99.56 99.56 0 0 0 99.56-99.56V163.56A99.56 99.56 0 0 0 711.11 64a99.55 99.55 0 0 0-99.55 99.56z"
                                            p-id="5330" fill="#ffffff"></path>
                                    </svg>
                                </div>
                                <div class="wave">
                                    <svg t="1698574454596" viewBox="0 0 5939 1024" version="1.1"
                                         xmlns="http://www.w3.org/2000/svg" p-id="6750">
                                        <path
                                            d="M665.6 358.4c28.16 0 51.2 21.504 51.2 47.7696v262.8608c0 26.2656-23.04 47.7696-51.2 47.7696s-51.2-21.504-51.2-47.7696V406.1696C614.4 379.904 636.9792 358.4 665.6 358.4z m1843.2 0c28.16 0 51.2 21.504 51.2 47.7696v262.8608c0 26.2656-23.04 47.7696-51.2 47.7696s-51.2-21.504-51.2-47.7696V406.1696C2457.6 379.904 2480.64 358.4 2508.8 358.4z m1536 0c28.16 0 51.2 21.504 51.2 47.7696v262.8608c0 26.2656-23.04 47.7696-51.2 47.7696s-51.2-21.504-51.2-47.7696V406.1696C3993.1392 379.904 4016.2304 358.4 4044.8 358.4z m1843.2 0c28.16 0 51.2 21.504 51.2 47.7696v262.8608c0 26.2656-23.04 47.7696-51.2 47.7696s-51.2-21.504-51.2-47.7696V406.1696c0-26.2656 22.5792-47.7696 51.2-47.7696zM2816 307.2c28.16 0 51.2 19.7632 51.2 43.8784v373.0432c0 24.1152-23.04 43.8784-51.2 43.8784s-51.2-19.7632-51.2-43.8784V351.0784c0-24.1152 23.04-43.8784 51.2-43.8784z m921.6-51.2c28.16 0 51.2 20.2752 51.2 45.056v473.088c0 24.7808-23.04 45.056-51.2 45.056s-51.2-20.2752-51.2-45.056V301.056c0-24.7808 23.04-45.056 51.2-45.056zM3123.2 358.4c28.16 0 51.2 23.04 51.2 51.2v204.8c0 28.16-23.04 51.2-51.2 51.2s-51.2-23.04-51.2-51.2V409.6c0-28.6208 23.04-51.2 51.2-51.2z m307.2-51.2c28.16 0 51.2 21.7088 51.2 48.128v313.344c0 26.4192-23.04 48.128-51.2 48.128s-51.2-21.7088-51.2-48.128V355.328c-0.4608-26.88 22.6304-48.128 51.2-48.128zM358.4 256c28.16 0 51.2 20.2752 51.2 45.056v473.088c0 24.7808-23.04 45.056-51.2 45.056s-51.2-20.2752-51.2-45.056V301.056C307.2 276.2752 330.24 256 358.4 256zM51.2 358.4c28.16 0 51.2 23.04 51.2 51.2v204.8c0 28.16-23.04 51.2-51.2 51.2s-51.2-23.04-51.2-51.2V409.6c0-28.6208 22.5792-51.2 51.2-51.2z m921.6-102.4c28.16 0 51.2 20.992 51.2 46.4896v419.0208c0 25.5488-23.04 46.4896-51.2 46.4896s-51.2-20.992-51.2-46.4896V302.4896C921.6 276.992 944.64 256 972.8 256z m1228.8 0c28.16 0 51.2 20.992 51.2 46.4896v419.0208c0 25.5488-23.04 46.4896-51.2 46.4896s-51.2-20.992-51.2-46.4896V302.4896C2150.4 276.992 2173.44 256 2201.6 256z m2150.4 0c28.16 0 51.2 22.016 51.2 48.9472v465.3056c0 26.88-23.04 48.9472-51.2 48.9472s-51.2-22.016-51.2-48.9472V304.9472c0-26.88 23.04-48.9472 51.2-48.9472z m1228.8 0c28.16 0 51.2 20.992 51.2 46.4896v419.0208c0 25.5488-23.04 46.4896-51.2 46.4896s-51.2-20.992-51.2-46.4896V302.4896c0-25.5488 23.04-46.4896 51.2-46.4896zM1280 204.8c28.16 0 51.2 21.2992 51.2 47.2064v519.9872c0 25.9072-23.04 47.2064-51.2 47.2064s-51.2-21.2992-51.2-47.2064V252.0064c0-25.9072 23.04-47.2064 51.2-47.2064z m614.4 0c28.16 0 51.2 20.6336 51.2 45.8752v573.8496c0 25.2416-23.04 45.8752-51.2 45.8752s-51.2-20.6336-51.2-45.8752V250.6752c0-25.2416 23.04-45.8752 51.2-45.8752z m2764.8-51.2c28.16 0 51.2 21.504 51.2 47.7696v621.2608c0 26.2656-23.04 47.7696-51.2 47.7696s-51.2-21.504-51.2-47.7696V201.3696C4607.5392 175.104 4630.6304 153.6 4659.2 153.6z m614.4 0c28.16 0 51.2 21.504 51.2 47.7696v621.2608c0 26.2656-23.04 47.7696-51.2 47.7696s-51.2-21.504-51.2-47.7696V201.3696c0-26.2656 22.5792-47.7696 51.2-47.7696zM1587.2 0c28.16 0 51.2 20.992 51.2 46.4896v931.0208c0 25.5488-23.04 46.4896-51.2 46.4896s-51.2-20.992-51.2-46.4896V46.4896C1536 20.992 1559.04 0 1587.2 0z m3379.2 51.2c28.16 0 51.2 20.736 51.2 46.08v829.44c0 25.344-23.04 46.08-51.2 46.08s-51.2-20.736-51.2-46.08V97.28c0-25.344 23.04-46.08 51.2-46.08z"
                                            fill="#333333" p-id="6751"></path>
                                    </svg>
                                </div>
                            </div>
                            <audio :src="item.content.voice[0]" :id="'voice-' + item.time"></audio>
                        </div>
                    </div>
                    <div class="system-message" v-if="item.role === 'system'">
                        {{ item.content.text[0] }}
                    </div>
                </div>
            </div>
        </div>
        <div class="inputbar" v-show="showwindow">
            <div class="options">
                <div class="bu-emoji">
                    <emoji-picker v-show="showemoji" ref="emojiPicker" @emoji-click="getemoji"></emoji-picker>
                    <p id="ho-emoji">表情</p>
                    <svg @click="eemoji" t="1695146956319" class="chat-icon" viewBox="0 0 1024 1024" version="1.1"
                         xmlns="http://www.w3.org/2000/svg" p-id="3988">
                        <path
                            d="M512 74.666667C270.933333 74.666667 74.666667 270.933333 74.666667 512S270.933333 949.333333 512 949.333333 949.333333 753.066667 949.333333 512 753.066667 74.666667 512 74.666667z m0 810.666666c-204.8 0-373.333333-168.533333-373.333333-373.333333S307.2 138.666667 512 138.666667 885.333333 307.2 885.333333 512 716.8 885.333333 512 885.333333z"
                            p-id="3989"></path>
                        <path
                            d="M674.133333 608c-46.933333 57.6-100.266667 85.333333-162.133333 85.333333s-115.2-27.733333-162.133333-85.333333c-10.666667-12.8-32-14.933333-44.8-4.266667-12.8 10.666667-14.933333 32-4.266667 44.8 59.733333 70.4 130.133333 106.666667 211.2 106.666667s151.466667-36.266667 211.2-106.666667c10.666667-12.8 8.533333-34.133333-4.266667-44.8-12.8-10.666667-34.133333-8.533333-44.8 4.266667zM362.666667 512c23.466667 0 42.666667-19.2 42.666666-42.666667v-64c0-23.466667-19.2-42.666667-42.666666-42.666666s-42.666667 19.2-42.666667 42.666666v64c0 23.466667 19.2 42.666667 42.666667 42.666667zM661.333333 512c23.466667 0 42.666667-19.2 42.666667-42.666667v-64c0-23.466667-19.2-42.666667-42.666667-42.666666s-42.666667 19.2-42.666666 42.666666v64c0 23.466667 19.2 42.666667 42.666666 42.666667z"
                            p-id="3990"></path>
                    </svg>
                </div>
                <div class="bu-emoji">
                    <p id="ho-emoji">滑到底部</p>
                    <svg @click="tobuttom(1)" t="1695147151930" class="chat-icon" viewBox="0 0 1024 1024" version="1.1"
                         xmlns="http://www.w3.org/2000/svg" p-id="4438" width="20" height="20">
                        <path
                            d="M896 864H128c-17.066667 0-32 14.933333-32 32s14.933333 32 32 32h768c17.066667 0 32-14.933333 32-32s-14.933333-32-32-32zM488.533333 727.466667c6.4 6.4 14.933333 8.533333 23.466667 8.533333s17.066667-2.133333 23.466667-8.533333l213.333333-213.333334c12.8-12.8 12.8-32 0-44.8-12.8-12.8-32-12.8-44.8 0l-157.866667 157.866667V170.666667c0-17.066667-14.933333-32-32-32s-34.133333 14.933333-34.133333 32v456.533333L322.133333 469.333333c-12.8-12.8-32-12.8-44.8 0-12.8 12.8-12.8 32 0 44.8l211.2 213.333334z"
                            p-id="4439"></path>
                    </svg>
                </div>
                <div class="bu-emoji">
                    <p id="ho-emoji">重置人格</p>
                    <svg @click="waiting" t="1695146872454" class="chat-icon" viewBox="0 0 1024 1024" version="1.1"
                         xmlns="http://www.w3.org/2000/svg" p-id="3849">
                        <path
                            d="M934.4 206.933333c-17.066667-4.266667-34.133333 6.4-38.4 23.466667l-23.466667 87.466667C797.866667 183.466667 654.933333 96 497.066667 96 264.533333 96 74.666667 281.6 74.666667 512s189.866667 416 422.4 416c179.2 0 339.2-110.933333 398.933333-275.2 6.4-17.066667-2.133333-34.133333-19.2-40.533333-17.066667-6.4-34.133333 2.133333-40.533333 19.2-51.2 138.666667-187.733333 232.533333-339.2 232.533333C298.666667 864 138.666667 706.133333 138.666667 512S300.8 160 497.066667 160c145.066667 0 277.333333 87.466667 330.666666 217.6l-128-36.266667c-17.066667-4.266667-34.133333 6.4-38.4 23.466667-4.266667 17.066667 6.4 34.133333 23.466667 38.4l185.6 49.066667c2.133333 0 6.4 2.133333 8.533333 2.133333 6.4 0 10.666667-2.133333 17.066667-4.266667 6.4-4.266667 12.8-10.666667 14.933333-19.2l49.066667-185.6c0-17.066667-8.533333-34.133333-25.6-38.4z"
                            p-id="3850"></path>
                    </svg>
                </div>
                <div class="bu-emoji">
                    <p id="ho-emoji">清除记录</p>
                    <svg @click="cleanScreen" t="1695147353549" class="chat-icon" viewBox="0 0 1024 1024" version="1.1"
                         xmlns="http://www.w3.org/2000/svg" p-id="4763" width="20" height="20">
                        <path
                            d="M874.666667 241.066667h-202.666667V170.666667c0-40.533333-34.133333-74.666667-74.666667-74.666667h-170.666666c-40.533333 0-74.666667 34.133333-74.666667 74.666667v70.4H149.333333c-17.066667 0-32 14.933333-32 32s14.933333 32 32 32h53.333334V853.333333c0 40.533333 34.133333 74.666667 74.666666 74.666667h469.333334c40.533333 0 74.666667-34.133333 74.666666-74.666667V305.066667H874.666667c17.066667 0 32-14.933333 32-32s-14.933333-32-32-32zM416 170.666667c0-6.4 4.266667-10.666667 10.666667-10.666667h170.666666c6.4 0 10.666667 4.266667 10.666667 10.666667v70.4h-192V170.666667z m341.333333 682.666666c0 6.4-4.266667 10.666667-10.666666 10.666667H277.333333c-6.4 0-10.666667-4.266667-10.666666-10.666667V309.333333h490.666666V853.333333z"
                            p-id="4764"></path>
                        <path
                            d="M426.666667 736c17.066667 0 32-14.933333 32-32V490.666667c0-17.066667-14.933333-32-32-32s-32 14.933333-32 32v213.333333c0 17.066667 14.933333 32 32 32zM597.333333 736c17.066667 0 32-14.933333 32-32V490.666667c0-17.066667-14.933333-32-32-32s-32 14.933333-32 32v213.333333c0 17.066667 14.933333 32 32 32z"
                            p-id="4765"></path>
                    </svg>
                </div>
                <div class="bu-emoji">
                    <p id="ho-emoji">语音</p>
                    <svg @click="voiceList" t="1697536440024" class="chat-icon" viewBox="0 0 1024 1024" version="1.1"
                         xmlns="http://www.w3.org/2000/svg" p-id="7282" width="24" height="24">
                        <path
                            d="M544 851.946667V906.666667a32 32 0 0 1-64 0v-54.72C294.688 835.733333 149.333333 680.170667 149.333333 490.666667v-21.333334a32 32 0 0 1 64 0v21.333334c0 164.949333 133.717333 298.666667 298.666667 298.666666s298.666667-133.717333 298.666667-298.666666v-21.333334a32 32 0 0 1 64 0v21.333334c0 189.514667-145.354667 345.066667-330.666667 361.28zM298.666667 298.56C298.666667 180.8 394.165333 85.333333 512 85.333333c117.781333 0 213.333333 95.541333 213.333333 213.226667v192.213333C725.333333 608.533333 629.834667 704 512 704c-117.781333 0-213.333333-95.541333-213.333333-213.226667V298.56z m64 0v192.213333C362.666667 573.12 429.557333 640 512 640c82.496 0 149.333333-66.805333 149.333333-149.226667V298.56C661.333333 216.213333 594.442667 149.333333 512 149.333333c-82.496 0-149.333333 66.805333-149.333333 149.226667z"
                            p-id="7283"></path>
                    </svg>
                </div>
                <div class="bu-emoji">
                    <p id="ho-emoji">模型选择</p>
                    <svg t="1697536322502" class="chat-icon" viewBox="0 0 1024 1024"
                         version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6223" width="24" height="24">
                        <path
                            d="M618.666667 106.666667H405.333333v85.333333h64v42.666667H149.333333v661.333333h725.333334V234.666667H554.666667V192h64V106.666667zM234.666667 810.666667V320h554.666666v490.666667H234.666667zM21.333333 448v234.666667h85.333334V448H21.333333z m896 0v234.666667h85.333334V448h-85.333334z m-469.333333 64h-106.666667v106.666667h106.666667v-106.666667z m234.666667 0h-106.666667v106.666667h106.666667v-106.666667z"
                            p-id="6224"></path>
                    </svg>
                    <el-cascader v-model="selectedWarper" :options="warperOptions"
                                 style="position: absolute; right: 0.5rem; width:1.5rem; opacity: 0; " @change="activeBotTools"/>
                </div>
            </div>
            <div class="input-box">
                <div class="input-content">
                    <textarea @keydown="handleKeyDown" ref="textarea" v-model="userInput"
                              @click="updateCursorPosition"></textarea>
                </div>
                <button @click.prevent="send" :disabled="!userInput || !isValidInput(userInput)" id="sendButton">
                    发送{{ getWarperName() ? ` |  ${ getWarperName() }` : '' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style lang="sass" scoped>
$mobile: 600px
$icon-hover: #09f

#chatwindow
    z-index: 1
    min-width: 0.0625rem
    position: relative
    display: flex
    flex-grow: 1
    background-color: #f1f1f1
    flex-direction: column

.upsidebar#chat
    flex-basis: 3.75rem
    flex-shrink: 0
    height: 3.75rem
    display: flex
    align-items: flex-end
    justify-content: space-between
    border-bottom: 0.0625rem solid rgba(161, 154, 154, 0.626)

.upsidebar
    .return
        display: none

        &:hover
            color: $icon-hover

        @media (max-width: $mobile)
            display: block
            margin-left: 1rem
            margin-bottom: .8rem

    .somebody
        margin-left: 1.5rem
        margin-bottom: 0.5rem
        font-size: 1rem

    .options
        flex-basis: 6rem
        display: flex
        height: 100%
        flex-wrap: wrap
        flex-direction: row-reverse

        .window-controls
            display: flex
            flex-basis: 100%

            .button
                display: flex
                justify-content: center
                align-items: flex-start

                .window-min
                    font-size: .6rem
                    margin-top: .2rem

                .window-max
                    font-size: .9rem

                .window-close
                    margin-top: -.1rem

            @media (max-width: $mobile)
                display: none

        .share
            .iconfont
                font-size: 1.1rem
                margin-right: 1rem

                &:hover
                    color: $icon-hover

            @media (max-width: $mobile)
                display: flex
                align-items: flex-end
                margin-bottom: .6rem

                .iconfont
                    font-size: 1.5rem

.message-window
    flex-grow: 3
    overflow: auto
    overflow-x: hidden
    background-color: #f1f1f1

    .message-time
        width: 100%
        display: flex
        justify-content: center
        align-items: center
        font-size: 0.75rem
        color: rgb(120, 124, 127)
        margin: 0.5rem 0

.message-body
    padding: 0.625rem 0.625rem
    display: flex
    align-items: flex-start
    /* border: .0625rem solid black; */
    overflow: hidden

    &#user
        flex-direction: row-reverse

        & > .msg > .content > *
            background-color: rgb(0, 153, 255)

        & > .msg > .content
            background-color: rgb(0, 153, 255)

        .loader
            left: -2rem
            top: calc(45% - 0.3125rem)

    &#other
        flex-direction: row

        & > .msg > .content
            background-color: rgb(255, 255, 255)

.inputbar
    flex-shrink: 0
    display: flex
    flex-direction: column
    border: 0 solid rgba(161, 154, 154, 0.626)
    flex-basis: 11rem

    .options
        display: flex
        border-top: 0.0625rem solid rgba(128, 128, 128, 0.502)
        padding: 0.25rem 0.5rem

.chat-icon
    padding: 0.25rem 0.5rem 0 0
    width: 1.5rem
    height: 1.5rem

.input-box
    flex-grow: 1
    padding: 0 0.5rem
    display: flex
    flex-direction: column
    align-items: end
    border: 0 solid black

    button
        white-space: nowrap
        color: #f0f8ff
        border-radius: 0.3125rem
        border: 0
        background-color: #09f
        padding: 0.25rem 1rem
        margin-bottom: 0.8rem
        margin-right: 0.5rem

.input-content
    flex-wrap: wrap
    display: flex
    background-color: #f1f1f1
    border: 0
    flex-grow: 1
    width: 100%

    textarea
        overflow-y: auto
        resize: none
        font-size: 1rem
        background-color: #f1f1f1
        border: 0
        flex-grow: 1
        width: 100%

        &:focus
            border: 0
            outline: none

p#ho-emoji
    text-wrap: nowrap
    display: none
    font-size: 0.75rem
    padding: 0.125rem 0.25rem
    background-color: #fff
    border: none
    box-shadow: 0 0.125rem 0.25rem #0003
    position: absolute
    top: 80%
    left: 50%
    transform: translate(-60%)

.bu-emoji
    position: relative

.black-overlay
    position: fixed
    top: 0
    left: 0
    width: 100%
    height: 100%
    background-color: rgba(0, 0, 0, 0.4)
    z-index: 1001
/* z-index 属性设置元素的堆叠顺序。*/

#theimg
    position: fixed
    top: 50%
    left: 50%
    transform: translate(-50%, -50%)
    max-height: 75%
    max-width: 50%

.background img
    position: absolute
    top: 50%
    left: 50%
    transform: translate(-50%, -50%)

.window-controls
    display: flex
    flex-basis: 100%

    .button
        display: flex
        justify-content: center
        padding-top: 0.5rem
        flex: 0 0 2rem

        &:hover
            background-color: rgb(231, 231, 231)

        #close:hover
            background-color: rgb(255, 0, 0)

.button#close:hover svg path
    fill: #fff

.upsidebar .options
    flex-basis: 6rem
    display: flex
    height: 100%
    flex-wrap: wrap
    flex-direction: row-reverse

svg:hover
    fill: rgb(0, 153, 255)

.voice-box
    display: flex
    width: 11.25rem
    height: 1.5rem
    margin: 0.25rem 0

emoji-picker
    position: absolute
    top: -25.75rem
    right: -20rem

.voice-box .icon
    flex-basis: 1.5rem
    background-color: rgb(0, 0, 0)
    display: flex
    justify-content: center
    align-items: center
    border-radius: 50%

.voice-box .wave
    display: flex
    justify-content: center
    align-items: center
    flex-grow: 1

.wave svg
    height: 1.25rem
    width: 80%

.loader
    width: 0.625rem
    padding: 0.25rem
    aspect-ratio: 1
    border-radius: 50%
    background: rgb(0, 153, 255)
    --_m: conic-gradient(#0000 10%, #000), linear-gradient(#000 0 0) content-box
    -webkit-mask: var(--_m)
    mask: var(--_m)
    -webkit-mask-composite: source-out
    mask-composite: subtract
    animation: l3 1s infinite linear
    position: absolute

.avatar
    min-width: 2.5rem
    min-height: 2.5rem
    max-width: 2.5rem
    max-height: 2.5rem
    border-radius: 50%

    img
        width: 100%
        border-radius: 50%

.msg
    max-width: calc(100% - 5rem)
    flex-grow: 1
    display: flex
    flex-direction: column

#other .msg
    align-items: flex-start

#user .msg
    align-items: flex-end

.wholename
    margin: 0 0.5rem
    display: flex
    flex-direction: row
    justify-content: flex-start

.wholename > .name,
.wholename > .title
    margin: 0.25rem
    text-wrap: nowrap
    font-size: 0.375rem
    font-family: Arial, sans-serif
    color: rgb(0, 153, 255)
    padding: 0.0625rem 0.125rem 0.125rem 0.125rem
    background-color: rgb(194, 225, 245)
    border-radius: 0.3125rem

.wholename > .name
    padding-top: 0.0625rem
    font-family: Arial, sans-serif
    color: rgb(120, 124, 127)

.content
    max-width: calc(100% - 1.25rem)
    padding: 0.25rem 0.75rem
    border-radius: 0.5rem
    margin: 0.5rem

.system-message
    width: 100%
    display: flex
    justify-content: center
    align-items: center
    font-size: 0.75rem
    color: rgb(120, 124, 127)

.message-container
    display: flex
    flex-direction: column
    width: 100%

.content img
    margin: 0.5rem 0
    max-width: 20rem
    border-radius: 16px

@keyframes l
    to
        transform: rotate(1turn)

@media (max-width: 600px)
    #chatwindow
        height: 100%

    .upsidebar
        background: #00a8ff linear-gradient(to right, #00d2f8, #00a8ff)

    .upsidebar *
        color: white
        fill: white

    .window-controls
        display: none

    .somebody
        padding-bottom: 0.25rem

    textarea
        overflow-y: auto

    .inputbar
        flex-basis: 4rem
</style>