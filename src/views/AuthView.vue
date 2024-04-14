<template>
    <div id="auth-view">
        <h1>Auth View</h1>
        <input type="text" v-model="code">
        <button @click="login">Login</button>
        <button @click="logout">Logout</button>
        <div>{{ client.id }}</div>
    </div>
</template>

<script>
import { client } from '@/lib/runtime.js'
import router from '@/router'

export default {
    name: 'AuthView',
    data() {
        return {
            code: '',
            client: client
        }
    },
    methods: {
        async login() {
            try {
                const code = this.code
                const result = await client.login(code)
                if (result) {
                    router.push('/home')
                }
            } catch (error) {
                console.error(error)
            }

        },
        async logout() {
            try {
                const result = await client.logout()
                if (result) {
                    router.push('/auth')
                }
            } catch (error) {
                console.error(error)
            }
        }
    }
}
</script>

<style scoped>
#auth-view {
    background-color: white;
    flex-grow: 1;
}
</style>