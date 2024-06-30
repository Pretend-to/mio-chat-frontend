<template>
    <div class="input-bar">
        <div class="options">
            <div class="bu-emoji">
                <emoji-picker v-show="showemoji" ref="emojiPicker" @emoji-click="getemoji"></emoji-picker>
                <p id="ho-emoji">表情</p>
                <svg @click="showemoji = !showemoji" t="1695146956319" class="chat-icon" viewBox="0 0 1024 1024"
                    version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3988">
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
                <svg @click="$emit('toButtom',1)" t="1695147151930" class="chat-icon" viewBox="0 0 1024 1024" version="1.1"
                    xmlns="http://www.w3.org/2000/svg" p-id="4438" width="20" height="20">
                    <path
                        d="M896 864H128c-17.066667 0-32 14.933333-32 32s14.933333 32 32 32h768c17.066667 0 32-14.933333 32-32s-14.933333-32-32-32zM488.533333 727.466667c6.4 6.4 14.933333 8.533333 23.466667 8.533333s17.066667-2.133333 23.466667-8.533333l213.333333-213.333334c12.8-12.8 12.8-32 0-44.8-12.8-12.8-32-12.8-44.8 0l-157.866667 157.866667V170.666667c0-17.066667-14.933333-32-32-32s-34.133333 14.933333-34.133333 32v456.533333L322.133333 469.333333c-12.8-12.8-32-12.8-44.8 0-12.8 12.8-12.8 32 0 44.8l211.2 213.333334z"
                        p-id="4439"></path>
                </svg>
            </div>
            <div class="bu-emoji">
                <p id="ho-emoji">重置人格</p>
                <svg @click="$emit('cleanHistory')" t="1695146872454" class="chat-icon" viewBox="0 0 1024 1024" version="1.1"
                    xmlns="http://www.w3.org/2000/svg" p-id="3849">
                    <path
                        d="M934.4 206.933333c-17.066667-4.266667-34.133333 6.4-38.4 23.466667l-23.466667 87.466667C797.866667 183.466667 654.933333 96 497.066667 96 264.533333 96 74.666667 281.6 74.666667 512s189.866667 416 422.4 416c179.2 0 339.2-110.933333 398.933333-275.2 6.4-17.066667-2.133333-34.133333-19.2-40.533333-17.066667-6.4-34.133333 2.133333-40.533333 19.2-51.2 138.666667-187.733333 232.533333-339.2 232.533333C298.666667 864 138.666667 706.133333 138.666667 512S300.8 160 497.066667 160c145.066667 0 277.333333 87.466667 330.666666 217.6l-128-36.266667c-17.066667-4.266667-34.133333 6.4-38.4 23.466667-4.266667 17.066667 6.4 34.133333 23.466667 38.4l185.6 49.066667c2.133333 0 6.4 2.133333 8.533333 2.133333 6.4 0 10.666667-2.133333 17.066667-4.266667 6.4-4.266667 12.8-10.666667 14.933333-19.2l49.066667-185.6c0-17.066667-8.533333-34.133333-25.6-38.4z"
                        p-id="3850"></path>
                </svg>
            </div>
            <div class="bu-emoji">
                <p id="ho-emoji">清除记录</p>
                <svg @click="$emit('cleanScreen')" t="1695147353549" class="chat-icon" viewBox="0 0 1024 1024" version="1.1"
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
                <svg @click="waiting" t="1697536440024" class="chat-icon" viewBox="0 0 1024 1024" version="1.1"
                    xmlns="http://www.w3.org/2000/svg" p-id="7282" width="24" height="24">
                    <path
                        d="M544 851.946667V906.666667a32 32 0 0 1-64 0v-54.72C294.688 835.733333 149.333333 680.170667 149.333333 490.666667v-21.333334a32 32 0 0 1 64 0v21.333334c0 164.949333 133.717333 298.666667 298.666667 298.666666s298.666667-133.717333 298.666667-298.666666v-21.333334a32 32 0 0 1 64 0v21.333334c0 189.514667-145.354667 345.066667-330.666667 361.28zM298.666667 298.56C298.666667 180.8 394.165333 85.333333 512 85.333333c117.781333 0 213.333333 95.541333 213.333333 213.226667v192.213333C725.333333 608.533333 629.834667 704 512 704c-117.781333 0-213.333333-95.541333-213.333333-213.226667V298.56z m64 0v192.213333C362.666667 573.12 429.557333 640 512 640c82.496 0 149.333333-66.805333 149.333333-149.226667V298.56C661.333333 216.213333 594.442667 149.333333 512 149.333333c-82.496 0-149.333333 66.805333-149.333333 149.226667z"
                        p-id="7283"></path>
                </svg>
            </div>
            <div class="bu-emoji">
                <p id="ho-emoji">{{ acting.platform == 'openai' ? '模型选择' : '工具选择' }}</p>
                <el-cascader v-model="selectedWraper" :options="wraperOptions" id="wraper-selector"
                    @change="activeBotTools" />
                <svg t="1697536322502" class="chat-icon" viewBox="0 0 1024 1024" version="1.1"
                    xmlns="http://www.w3.org/2000/svg" p-id="6223" width="24" height="24">
                    <path
                        d="M618.666667 106.666667H405.333333v85.333333h64v42.666667H149.333333v661.333333h725.333334V234.666667H554.666667V192h64V106.666667zM234.666667 810.666667V320h554.666666v490.666667H234.666667zM21.333333 448v234.666667h85.333334V448H21.333333z m896 0v234.666667h85.333334V448h-85.333334z m-469.333333 64h-106.666667v106.666667h106.666667v-106.666667z m234.666667 0h-106.666667v106.666667h106.666667v-106.666667z"
                        p-id="6224"></path>
                </svg>
            </div>
        </div>
        <div class="input-box">
            <div class="input-content">
                <div @keydown="handleKeyDown" @input="handleInput" class="input-area" ref="textarea"
                    :v-html="userInput" contenteditable="true" placeholder="按 Ctrl + Enter 以发送消息" @click="updateCursorPosition">
                </div>
            </div>
            <button @click.prevent="send" :disabled="!userInput || !isValidInput(userInput)" id="sendButton">
                发送{{ getWraperName() ? ` | ${getWraperName()}` : '' }}
            </button>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            userInput: '',
            selectedWraper: null,
            wraperOptions: [],
            cursorPosition: [],
            showemoji: false,
            uploadedFiles: [],
        }
    },
    props: {
        acting: {
            type: Object,
            required: true
        }
    },
    methods: {
        setModel(name){
            this.$emit('setModel', name)
        },
        getBotTools() {
            this.selectedWraper = ['']
            const wraper = this.acting.options.textwraper
            this.wraperOptions = wraper.options
        },
        getBotModels() {
            this.selectedWraper = this.acting.activeModel ? [this.acting.activeModel] : ['gpt-3.5-turbo']
            this.wraperOptions = this.acting.options.modelsOptions
            this.setModel(this.selectedWraper[0])
        },
        wrapText(rawText) {
            if (!this.selectedWraper) return rawText
            const wraper = this.selectedWraper[this.selectedWraper.length - 1]
            if (!wraper) return rawText
            const testText = '{xxx}'

            const childrens = this.wraperOptions.find(item => item.value == this.selectedWraper[0]).children
            const preset = childrens.find(child => child.value == this.selectedWraper[1]).preset

            const result = preset.replace(testText, rawText)
            return result
        },
        adjustTextareaHeight() {
            const textarea = this.$refs.textarea
            textarea.style.height = 'auto'
            textarea.style.height = textarea.scrollHeight + 'px'
        },
        getWraperName() {
            if (this.acting.platform === 'onebot') {
                if (!this.selectedWraper) return ''
                const wraper = this.selectedWraper[this.selectedWraper.length - 1]
                if (!wraper) return ''
                const childrens = this.wraperOptions.find(item => item.value == this.selectedWraper[0]).children
                const preset = childrens.find(child => child.value == this.selectedWraper[1]).preset
                const name = preset.replace('#', '').replace('{xxx}', '')
                return name
            } else {
                return this.selectedWraper ? this.selectedWraper[this.selectedWraper.length - 1] : ''
            }
        },
        waiting() {
            this.$message({ message: '此功能尚未开放', type: 'warning' })
        },
        getemoji(e) {
            const inputer = this.$refs.textarea
            const range = document.createRange()
            const sel  = window.getSelection()
            if (!sel) return;

            const unicode = e.detail.unicode
            const startPos = this.cursorPosition[0]
            const endPos = this.cursorPosition[1]
            const textBeforeCursor = this.userInput.substring(0, startPos)
            console.log(textBeforeCursor)
            const textAfterCursor = this.userInput.substring(endPos)
            console.log(textAfterCursor)
            this.userInput = textBeforeCursor + unicode + textAfterCursor

            // 移动光标位置到表情符号之后
            setTimeout(() => {
                range.selectNodeContents(inputer)
                range.setStart(inputer.firstChild, startPos + unicode.length)
                range.setEnd(inputer. firstChild, startPos + unicode.length)
                sel.removeAllRanges()
                sel.addRange(range)
            }, 0);

            this.showemoji = !this.showemoji
        },
        updateCursorPosition() {
            const selection = window.getSelection();
            if (!selection) return;

            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);

                this.cursorPosition[0] = range.startOffset
                this.cursorPosition[1] = range.endOffset

            }
        },
        presend() {
            // console.log(this.userInput)
            this.$refs.textarea.focus()

            let msg = this.getSafeText(this.userInput)

            const wrappedMessage = this.acting.platform === 'onebot' ? this.wrapText(msg) : msg

            this.userInput = this.$refs.textarea.innerHTML = ''

            this.adjustTextareaHeight();

            const container = {
                role: 'user',
                time: new Date().getTime(),
                status: 'completed',
                content: [{
                    type: 'text',
                    data: {
                        text: wrappedMessage
                    }
                }]
            }

            this.uploadedFiles.forEach(file => {
                if (file.type === 'image') {
                    container.content.push({
                        type: 'image',
                        data: {
                            file: file.data
                        }
                    })
                }else if (file.type === 'doc'){
                    container.content.push({
                        type: 'doc',
                        data: {
                            file: file.data
                        }
                    })
                }


            })

            if (this.repliedMessage) {
                const replyData = {
                    type: 'reply',
                    data: {
                        id: this.repliedMessage.id
                    }
                }
                container.content.push(replyData)
            }
            return container
        },
        async send() {
            this.$emit('sendMessage')
            const container = this.presend()
            this.userInput = ""
            const message_id = await this.acting.webSend(container) //发送消息
            container.id = message_id
            this.$emit('stroge')
        },
        getSafeText(text) {
            return text.replace(/<script>/g, '&lt;script&gt;').replace(/<\/script>/g, '&lt;/script&gt;')
                .replace(/<style>/g, '&lt;style&gt;').replace(/<\/style>/g, '&lt;/style&gt;');
        },
        cleanScreen() {
            this.$emit('cleanScreen')
        },
        async activeBotTools() {
            if (this.acting.platform === 'onebot') {
                const testMessage = 'text'
                const testMessage2 = 'test'
                const wrappedMessage = this.wrapText(testMessage)
                const wrappedMessage2 = this.wrapText(testMessage2)
                if (wrappedMessage2 === wrappedMessage) {
                    this.userInput = this.textareaRef.value = wrappedMessage
                    await this.send()
                }
            } else {
                this.setModel(this.selectedWraper[this.selectedWraper.length - 1]) 
                this.$message({ message: '已切换到' + this.acting.activeModel + '模型', type: 'success' })
            }
        },
        isValidInput(input) {
            return input.trim().length > 0
        },
        handleKeyDown(event) {

            if (event.ctrlKey && event.key === 'Enter') {
                this.userInput = this.replaceDivTags(this.userInput)
                if (this.userInput && this.isValidInput(this.userInput)) this.send()
                else this.$message({ message: '不能发送空消息', type: 'warning' })
                // 处理按下 Ctrl+Enter 键的逻辑
            }
            setTimeout(() => {
                this.updateCursorPosition()
            }, 0);
            
        }, replaceDivTags(inputText) {
            // 使用正则表达式匹配并替换指定的div标签
            // 第一个div标签
            let result = inputText.replace(/<div>/, "\n");

            // 所有的成对div标签
            result = result.replace(/<div><\/div>/g, "\n");

            // 末尾的div标签
            result = result.replace(/<\/div>$/, "\n");

            return result;
        },
        handleInput() {
            this.userInput = this.$refs.textarea.innerHTML
            console.log(this.userInput)
        },
    }, mounted() {
        if (this.acting.platform === 'onebot') this.getBotTools()
        else this.getBotModels()
        this.textareaRef = this.$refs.textarea
        this.textareaRef.addEventListener('input', this.adjustTextareaHeight)
        document.addEventListener('paste', function (e) {
            e.preventDefault();
            var text = (e.originalEvent || e).clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });
     
    },unmounted() {
        this.textareaRef.removeEventListener('input', this.adjustTextareaHeight)
        this.textareaRef = null
        document.removeEventListener('paste', this.adjustTextareaHeight)
    },
    watch: {
        '$route.params.id'() {
            if (this.acting.platform === 'onebot') this.getBotTools()
            else this.getBotModels()
        }
    }
}
</script>

<style lang="sass" scoped>
$mobile: 600px
$icon-hover: #09f

svg:hover
    fill: rgb(0, 153, 255)

.input-bar
    flex-shrink: 0
    display: flex
    flex-direction: column
    border: 0 solid rgba(161, 154, 154, 0.626)
    flex-basis: 11rem

    .options
        display: flex
        border-top: 0.0625rem solid rgba(128, 128, 128, 0.502)
        padding: 0.25rem 0.5rem

.bu-emoji
    position: relative

    &:hover p#ho-emoji
        display: block

emoji-picker
    position: absolute
    top: -25.75rem
    right: -20rem

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




    .input-area
        overflow-y: auto
        max-height: 20rem
        resize: none
        font-size: 1rem
        background-color: #f1f1f1
        border: 0
        flex-grow: 1
        width: 100%

        moz-user-select: -moz-none
        -moz-user-select: none
        -o-user-select: none
        -khtml-user-select: none
        -webkit-user-select: none
        -ms-user-select: none
        user-select: none

        &:focus
            border: 0
            outline: none
</style>