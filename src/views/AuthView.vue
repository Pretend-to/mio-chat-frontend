<template>
    <div>
        <h1>Auth View</h1>
    </div>
</template>

<script>
import { auth } from '@/lib/runtime.js'

export default {
    name: 'AuthView',
    data() {
        return {
            code: ''
        }
    },
    methods: {
        async login() {
            const code = this.code
            const result = await auth.login(code)
            console.log(result)
        }
    }
}
</script>