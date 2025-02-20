<template>
    <div class="reason-block">
        <div class="head-bar">
            <div class="reason-info">{{ getReasonInfo }}</div>
            <button @click="toggleShow">
                {{ show ? '隐藏内容' : '显示内容' }}
            </button>
        </div>
        <pre class="content" v-if="show">
            {{ content }}
        </pre>
    </div>
</template>

<script>
export default {
    data() {
        return {
            show: true,
        };
    },
    computed: {
        getReasonInfo() {
            if (this.finishTime) {
                const timeDiff = this.finishTime - this.startTime;
                return `思考完成，耗时：${timeDiff / 1000} 秒`;
            } else {
                return `正在深度思考......`;
            }
        },
    },
    props: {
        content: {
            required: true,
            type: String,
            default: '',
        },
        startTime:{
            required: true,
            type: Number
        },
        finishTime: {
            required: false,
            type: Number,
            default: 0
        },
    },
    methods: {
        toggleShow() {
            this.show = !this.show;
        },
    },
};
</script>

<style scoped>
.reason-block {
    border: 1px solid #ccc;
    margin-bottom: 10px;
}

.head-bar {
    background-color: #f0f0f0;
    padding: 5px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.content {
    padding: 10px;
}
</style>