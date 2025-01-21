<template>
    <div class="presets-list">
        <div v-for="(message, index) of presetMessages" :key="index" class="preset-message">
            <div class="preset-message-block">
                <div class="message-avatar" @mouseover="hoveredIndex = index" @mouseleave="hoveredIndex = null">
                    <div v-if="hoveredIndex!=index" class="avatar-emoji">
                        {{ getMessageAvatar(message.role) }}
                    </div>
                    <div v-else @click="delPresetMessage" title="删除消息" class="avatar-emoji hovered">🗑️</div>
                </div>
                <div class="message-content" :ref="`message-${index}`" @input="handleMessageUpdate(index)" contenteditable="true">
                    {{ presetMessages[index].content }}
                </div>
            </div>
        </div>
        <div class="messages-buttons">
            <el-button @click="addPresetMessage('system')" title="添加系统消息" plain>➕ ⚙️</el-button>
            <el-button @click="addPresetMessage('assistant')" title="添加助手消息" plain>➕ 🤖</el-button>
            <el-button @click="addPresetMessage('user')" title="添加用户消息" plain>➕ 👤</el-button>
        </div>
    </div>
</template>
<script>
export default {
    data() {
        const presetMessages = [
            ...this.presetsHistory
        ]
        return {
            presetMessages,
            hoveredIndex: undefined,
        };
    },
    methods: {
        delPresetMessage() {
            this.presetMessages.splice(this.hoveredIndex, 1)
            this.$emit('updatePresetsHistory', this.presetMessages)
        },
        addPresetMessage(role) {
            if (role == 'system' && this.presetMessages.length > 0) {
                this.$message.warning('系统消息必须是第一条消息')
                return
            }
            this.presetMessages.push({
                role,
                content: '',
            }) 
            this.$emit('updatePresetsHistory', this.presetMessages)

        },
        getMessageAvatar(role) {
            return role == 'assistant' ? '🤖' : role == 'system' ? '⚙️' : '👤';
        },
        handleMessageUpdate(index) {
            // console.log(this.presetMessages[index].content)
            this.presetMessages[index].content = this.$refs[`message-${index}`][0].innerText
            this.$emit('updatePresetsHistory', this.presetMessages)
        }
    },
    props: {
        presetsHistory: {
            type: Array,
            default: () => [],
        }
    },
    watch: {
        presetsHistory(newVal) {
            this.presetMessages = [...newVal] 
        }
    }
}
</script>
<style scoped>

.presets-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}

.messages-buttons {
    width: 100%;
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    margin: .5rem;
}

.preset-message {
    width: 100%;
}

.preset-message-block {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin: .5rem;
    justify-content: space-between;
    align-items: flex-start;
}

.preset-message-block .message-avatar {
    flex-basis: 2rem;
    font-size: 2rem;
    border: 1px solid #ccc;
    border-radius: 10%;
}

.message-avatar .hovered {
    cursor: pointer; 
    box-shadow: inset 0px 0px 10px rgba(0, 0, 0, 0.493); /* 内阴影 */
}

.preset-message-block .message-content {
    margin-left: .5rem;
    font-size: .8rem;
    border: 1px solid #5A9CF8;
    border-radius: .5rem;
    flex-grow: 1;
    max-height: 10rem;
    overflow-y: auto;
    padding: .5rem;
    min-height: 2rem;
}

.message-content input {
    width: 100%;
    border: none;
    outline: none; 
}

</style>