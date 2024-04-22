<script>
import { client } from '@/lib/runtime.js';
import Contactor from '@/lib/contactor.js';
// import addcontactor from '@/components/AddContactor.vue';

export default {
    data() {
        const contactorList = client.contactList
        const onPhone = client.onPhone

        return {
            onPhone: onPhone,
            contactorList: contactorList,
        }
    },
    methods: {
        showChat(id) {
            // 如果当前路径是 /home 或 /home/chat 或 /home/chat/:id ,跳转到 /home/chat/:id
            this.$router.push({ path: '/home/chat/' + id })
        },
        getId(index) {
            // 获取当前页面的id
            let currentId = this.$route.params.id
            // 获取当前页面的contactorId
            let contactorId = this.contactorList[index].id
            // 如果当前页面的id和contactorId相同，则返回active
            if (currentId == contactorId) {
                return "active"
            } else {
                return this.contactorList[index].priority == 0 ? "important" : ""
            }
        },
        genOpenaiContactor() {
            const models = client.models
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

            const openaiDefaultConfig = {
                id: this.genFakeId(),
                name: 'OpenAI',
                avatar: '/api/avatar/openai.png',
                title: 'gpt',
                priority: 1,
                options: {
                    models: client.models,
                    modelsOptions: options,
                    textWarper: {
                        options: options,
                        presets: {
                            "default": ""
                        }
                    }
                }
            }
            this.addConcator('openai', openaiDefaultConfig)
        },
        async addConcator(platform, config) {
            const bot = new Contactor(platform, config)
            this.contactorList.push(bot)
            await client.setLocalStorage()
        },
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

    },
    components: {
        // addcontactor
    }
}
</script>

<template>
    <div id="friendlists" :class="onPhone ? 'mobile' : ''">
        <div class="upsidebar" id="friends">
            <div class="search" >
                <svg t="1695130526763" class="listicon" viewBox="0 0 1024 1024" version="1.1"
                    xmlns="http://www.w3.org/2000/svg" p-id="3427">
                    <path
                        d="M945.066667 898.133333l-189.866667-189.866666c55.466667-64 87.466667-149.333333 87.466667-241.066667 0-204.8-168.533333-373.333333-373.333334-373.333333S96 264.533333 96 469.333333 264.533333 842.666667 469.333333 842.666667c91.733333 0 174.933333-34.133333 241.066667-87.466667l189.866667 189.866667c6.4 6.4 14.933333 8.533333 23.466666 8.533333s17.066667-2.133333 23.466667-8.533333c8.533333-12.8 8.533333-34.133333-2.133333-46.933334zM469.333333 778.666667C298.666667 778.666667 160 640 160 469.333333S298.666667 160 469.333333 160 778.666667 298.666667 778.666667 469.333333 640 778.666667 469.333333 778.666667z"
                        p-id="3428"></path>
                </svg>
                <input type="text" id="tosearch" placeholder="搜索">
            </div>
            <div class="bu-add">
                <button id="addcont" @click="genOpenaiContactor">+</button>
            </div>
        </div>
        <div class="people">
            <div @click="showChat(item.id)" v-for="(item, index) of contactorList" :key="index" class="lists"
                :id="getId(index)">
                <div class="avatar">
                    <img :src="item.avatar" :alt="item.name">
                </div>
                <div class="info">
                    <div class="name">{{ item.name }}</div>
                    <div class="msginfo" id="time">{{ item.getLastTime() }}</div>
                    <div class="msginfo" id="msgctt">{{ item.getLastContent() }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
#friendlists {
    height: 100%;
    display: flex;
    width: 13rem;
    flex-direction: column;
    border-left: .0625rem solid rgba(161, 154, 154, 0.626);
    border-right: .0625rem solid rgba(161, 154, 154, 0.626);
}

.people {
    height: calc(100% - 3rem);
    overflow-y: auto;
    overflow-x: hidden;
}
#friendlists.mobile {
    height:100%;
    display: flex;
    flex-direction: column;
    width: 100%;
}

.upsidebar {
    justify-content: space-between;
    display: flex;
    flex-direction: row;
    background-color: rgb(255, 255, 255);
    flex: 0 0 48px;
    padding: 0.375rem .5em .5rem 0.5rem;
    align-items: flex-end;
    border-bottom: .0625rem solid rgba(161, 154, 154, 0.626);
}

input#tosearch {
    width: calc(100% - 1.125rem);
    margin-top: .1875rem;
    padding-left: .3125rem;
    height: 1.125rem;
    background-color: transparent;
    border: 0rem;
}

input#tosearch:focus {
    outline: none;
    border: 0rem;
}

button#searchButton {
    width: 1rem;
    border: 0rem;
    border-radius: .3125rem;
    margin-left: .5rem;
    text-wrap: nowrap;
}

.search {
    flex-grow: 1;
    border-radius: .3125rem;
    background-color: rgb(245 245, 245);
    height: 1.5625rem;
    display: flex;
    padding: .125rem .25rem;
    align-items: center;
}

.bu-add {
    width: 1.8125rem;
    height: 1.8125rem;
    margin-left: .5rem;
}

.listicon {
    padding-top: .0625rem;
    width: 1rem;
    height: 1rem;
}

button#addcont {
    border-radius: .3125rem;
    width: 100%;
    height: 100%;
    border: none;
}

.lists {
    align-items: center;
    min-width: 12rem;
    display: flex;
    padding: .25rem .5rem;
    height: 3.75rem;
    max-height: 3.75rem;
    min-height: 3.75rem;
    /* border: .0625rem solid pink; */
}

.lists#important {
    background-color: rgb(240, 240, 240);
}

.lists:hover {
    background-color: rgb(240, 240, 240)
        /* border: .0625rem solid pink; */
}

.lists#important:hover {
    background-color: rgb(231, 231, 231);
    /* border: .0625rem solid pink; */
}

.lists#active {
    background-color: rgb(0, 153, 255);
}

.lists>.avatar {
    width: 2.750rem;
    height: 2.750rem;
}

.avatar>img {
    width: 100%;
    height: 100%;
    border-radius: 50%;

}


.info {
    height: 100%;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex: 0 0 calc(100% - 2.625rem);
    flex-wrap: wrap;
    width: calc(100% - 2.625rem);
    min-width: calc(100% - 2.625rem);
}

.lists#active * {
    color: #f0f8ff;
}

.lists .name {
    flex-basis: 4rem;
    margin-top: .75rem;
    font-size: .875rem;
    margin-left: .5rem;
}

.info #time {
    font-size: .625rem;
    flex-grow: 1;
    text-align: right;
}

.info #msgctt {
    flex-basis: 100%;
    padding-right: 1rem;
    font-size: .625rem;
    margin-left: .5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>