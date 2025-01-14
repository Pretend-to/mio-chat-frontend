<template>
    <div id="profile">
        <div class="profile-container">
            <div class="base-info">
                <div class="base-info-avatar">
                    <img :src="activeContactor.avatar" />
                </div>
                <div class="base-info-content">
                    <div class="name">{{ activeContactor.name }}</div>
                    <div class="id">ID {{ activeContactor.id }}</div>
                    <div class="status">
                        <span :class="'delay-status ' + getDelayStatus"></span>
                        在线
                    </div>
                </div>
            </div>
            <div class="info-blocks">
                <div class="openai-settings" v-if="activeContactor.platform == 'openai'">
                    <div class="block-title">OpenAI 协议配置</div>
                    <div class="block-content">
                        <div class="block-content-item">
                            <div class="item-title">模型</div>
                            <div class="item-content">
                                <el-input v-model="activeContactor.activeModel"></el-input>
                            </div>
                        </div>
                        <div class="block-content-item">
                            <div class="item-title">最长历史条数</div>
                            <div class="item-content">
                                <el-input v-model="activeContactor.activeModel"></el-input>
                            </div>
                        </div>
                        <div class="block-content-item">
                            <div class="item-title">流式响应</div>
                            <div class="item-content">
                                <el-input v-model="activeContactor.activeModel"></el-input>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="extra-info"></div>
            <div class="action-bar">
                <el-button @click="$router.push(`/chat/${activeContactor.id}`)" type="primary">发送消息</el-button>
                <el-button @click="centerDialogVisible = true" type="danger">删除好友</el-button>
                <el-dialog v-model="centerDialogVisible" title="警告" width="300" center>
                    <span>
                        确认要删除此好友吗？该操作不可逆。
                    </span>
                    <template #footer>
                        <div class="dialog-footer">
                            <el-button @click="centerDialogVisible = false">取消</el-button>
                            <el-button type="primary" @click="delContactor">
                                确认
                            </el-button>
                        </div>
                    </template>
                </el-dialog>
            </div>
        </div>
    </div>
</template>
<script>
import { client } from "@/lib/runtime.js";

export default {
    data() {
        const currentId = parseInt(this.$route.params.id);
        const contactor = client.getContactor(currentId);

        
        return {
            activeContactor: contactor,
            currentDelay: 0,
            centerDialogVisible: false
   }
    },
    mounted() {
        console.log(this.activeContactor);
        setInterval(() => {
            this.currentDelay = client.socket.delay;
        }, 3000);
    },
    computed: {
        getDelayStatus() {
            return this.currentDelay > 1000
                ? "high"
                : this.currentDelay > 500
                    ? "mid"
                    : this.currentDelay > 100
                        ? "low"
                        : "ultra";
        },

    },
    watch: {
        "$route.params.id"(newVal) {
            this.activeContactor = client.getContactor(newVal);
        }
    },
    methods: {
        delContactor() {
            this.centerDialogVisible = false;
            client.rmContactor(this.activeContactor.id);
            this.$router.push("/contactors");
        }
    }
}
</script>

<style scoped>
#profile {
    background-color: #F2F2F2;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
}

.profile-container {
    margin: 4rem;
    width: calc(100% - 8rem);
    min-width: 20rem;
    max-width: 30rem;
    display: flex;
    flex-direction: column;
}

.profile-container>* {
    width: 100%;
    flex-basis: 1rem;
}

.base-info {
    /* border: 1px solid #000000; */
    background-color: #fff;
    border-radius: .5rem;
    display: flex;
    padding-bottom: 1rem;
    border-bottom: 1px solid #88888888;
}

.base-info-avatar {
    margin-top: 1rem;
    margin-left: 1rem;
    flex-basis: 5.5rem;
    height: 5.5rem;
}

.base-info-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
}

.block-title {
    font-size: .8rem;
}

.block-content {
    margin-top: .5rem;
    width: 100%;
    display: flex;
    background-color: #fff;
    min-height: 1rem;
    border-radius: .5rem;
    flex-direction: column;
}

.block-content-item {
    position: relative;
    display: flex;
    width: 100%;
    justify-content: space-between;
    flex-basis: 2.5rem;
}

.block-content-item::after {
    content: ""; /* 必须要有 content 属性 */
    position: absolute;
    bottom: 0; /* 定位到元素底部 */
    left: 5%; /* 距离左边的长度，可以根据需要调整 */
    width: 90%; /* 短一些的边框长度 */
    height: 1px; /* 边框的高度 */
    background-color: rgba(145, 145, 145, 0.155); /* 边框的颜色 */
}

.item-title {
    font-size:.8rem;
    margin-left: 1rem;
    display: flex;
    align-items: center;
    justify-content: flex-start;
}

.item-content{
    display: flex;
    align-items: center;
    justify-content: flex-end;
}

.item-content > .el-input {
    transform: scale(.9);
}

.base-info-content {
    margin-left: 1.5rem;
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
}

.base-info-content .name {
    font-size: 1.25rem;
}

.base-info-content .id {
    margin-top: .25rem;
    font-size: 0.75rem;
    color: dimgrey;
}

.base-info-content .status {
    margin-top: .25rem;
}

.info-blocks > * {
    margin-top: 1rem;
}

.info-blocks {
    display:flex;
    flex-direction: column;
    justify-content: space-between;
}

.extra-info {
    border: 1px solid #000000;
}

.action-bar {
    display: flex;
    justify-content: space-around;
    margin-top: 1rem;
}
</style>
<style lang="sass">
.delay-status
    display: inline-block
    width: 1rem
    height: 1rem
    border-radius: 50%
    transform: translateY(.25rem)
    margin-right: .25rem

    &:hover + .delay-num
        display: inline-block

    &.ultra
        background-color: rgb(53, 233, 146)

    &.low
        background-color: rgb(255, 204, 0)

    &.mid
        background-color: rgb(255, 102, 102)

    &.high
        background-color: #ccc
</style>