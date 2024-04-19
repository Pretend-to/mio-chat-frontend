<template>
    <div id="settings-view">
        <button @click="reset()">点我重置</button>
    </div>
</template>

<script>
import {client} from '@/lib/runtime.js'


export default {
    name: 'SettingsView',
    data() {
        return {
            
        }
    },
    methods: {
        reset() {
            client.reset()
        }
    }
}
</script>

<style scoped>
#settings-view {
    width: 100%;
    height: 100%;
    background-color: #f2f2f2;
}

</style>