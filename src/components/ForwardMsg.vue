<template>
    <div @click="showBox = true" :class="onPhone ? 'on-phone' : ''" id="forward-msg-preview">
        <div id="forward-msg-head">
            转发的聊天消息
        </div>
        <div id="forward-msg-body">
            <div id="forward-msg-summary" v-for="(message, index) in messages" :key="index">
                {{ contactor.name }}: {{ contactor.getMessageSummary([message]) }}
            </div>
        </div>
        <div id="forward-msg-foot">
            查看{{ messages.length }}条转发消息
        </div>
    </div>
    <div v-if="showBox" id="forward-msg-box" :class="onPhone ? 'on-phone' : ''">
        <div class="head">
            <span>转发消息</span>
            <span class="close" @click="showBox = false">&times;</span>
        </div>
        <div class="body">
            <div v-for="(message, index) of messages" :key="index" class="message-container">
                <div class="message-body" id="other">
                    <div class="avatar">
                        <img :src="contactor.avatar" :alt="contactor.name" />
                    </div>
                    <div class="msg">
                        <div class="wholename">
                            <div class="title">{{ contactor.title }}</div>
                            <div class="name">{{ contactor.name }}</div>
                        </div>
                        <div class="content">
                            <div>
                                <MdPreview v-if="message.type === 'text'" previewTheme="github" editorId="preview-only"
                                    :modelValue="message.data.text" />
                                <el-image v-else-if="message.type === 'image'"
                                    style="margin: 8px 0; max-width: 20rem; border-radius: 1rem"
                                    :src="message.data.file" :zoom-rate="1.2" :preview-teleported="true" :max-scale="7" :min-scale="0.2"
                                    :preview-src-list="[message.data.file]" :initial-index="4" :key="index"
                                    fit="cover" />
                                <MdPreview v-else previewTheme="github" editorId="preview-only"
                                    :modelValue="`尚未支持的消息类型：${message.type}`" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { MdPreview } from 'md-editor-v3'

export default {
    data() {
        return {
            showBox: false,
            onPhone: false
        }
    },
    props: {
        messages: Array,
        contactor: Object
    },
    mounted() {
        console.log(this.messages)
        console.log(this.contactor)
    },
    components: {
        MdPreview
    },
    created() {
        if (window.innerWidth < 600 ) this.onPhone = true
        else if(window.innerWidth >= 600 ) this.onPhone = false

        window.addEventListener('resize', () => {
            if (window.innerWidth < 600) {
                this.onPhone = true
            } else if (window.innerWidth >= 600) {
                this.onPhone = false
            }
        })
    },
}
</script>

<style>
#forward-msg-preview {
    width: 15rem;
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
}

#forward-msg-preview.on-phone {
    transform: translateX(-0.35rem);
}

#forward-msg-body {
    margin: 0.5rem 0;
    width: 100%;
    text-overflow: ellipsis;
}

#forward-msg-summary {
    width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    font-size: 0.8rem;
    font-weight: 300
}

#forward-msg-foot {
    border-top: 1px solid #ccc;
    padding-top: .2rem;
    width: 100%;
    font-size: 0.7rem;
    color: rgb(150, 150, 150);
}

#forward-msg-box {
    border: 1px solid black;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 24rem;
    height: 30rem;
    z-index: 9999;
    background-color: rgb(241, 241, 241);
    border-radius: 0.25rem;
    overflow: hidden;
}

#forward-msg-box.on-phone {
    border: null;
    border-radius: null;
    position: fixed;
    width: 100%;
    height: 100%;
    z-index: 9999;
    background-color: rgb(241, 241, 241);
    overflow: hidden;
}

.head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 2rem;
    padding-left: 1rem;
    border-bottom: 1px solid #ccc;
    color: black;
}

.close {
    width: 1.5rem;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
}

.close:hover {
    color: aliceblue;
    background-color: rgb(196, 43, 28);
}

.body {
    height: auto;
    max-height: calc(100% - 2rem);
    overflow: auto;
}
</style>