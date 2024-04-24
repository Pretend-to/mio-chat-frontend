<style lang="sass" scoped>
.auth-view
    background-color: white
    flex-grow: 1
    display: grid
    place-items: center

    .container
        width: 50%
        margin: 0 auto
        text-align: center
        animation: fly-into 1s

        @keyframes fly-into
            from 
                transform: translateX(-150px)
                opacity: 0
            to
                transform: translateX(0)
                opacity: 1
        .icon
            font-size: 46px
            border-radius: 10px
            background: lightcyan
            animation: rotation 5s infinite linear

            @keyframes rotation
                from
                    transform: rotate(0)
                50%
                    transform: rotate(180deg)
                to
                    transform: rotate(360deg)

        .title
            font-size: 50px
            letter-spacing: 5px
            color: transparent
            -webkit-text-stroke: 2px cyan
            margin: 25px

        .hint
            font-size: 15px
            font-weight: 300

        input
            margin: 25px
            border: 1px solid cyan
            border-radius: 6px
            height: 35px
            padding: 0 10px
            outline: 1px solid lightcyan
            caret-color: cyan
            text-align: center
            letter-spacing: 1px

            &:focus
                outline: 1px solid cyan

            &::placeholder
                text-align: center

        .controls
            display: flex
            justify-content: space-around

            .later
                background: transparent

            .login
                color: white
                padding: 10px 15px
                border-radius: 8px
                background: rgb(29, 147, 171)
</style>

<template>
    <div class="auth-view">
        <div class="container">
            <svg class="icon" aria-hidden="true">
                <use xlink:href="#icon-ChatGPT"></use>
            </svg>
            <h1 class="title">登录验证</h1>
            <p class="hint">管理员开启了密码验证，请在下方填入访问码</p>
            <input type="password" v-model="accessCode" placeholder="在此处填写访问码">
            <div class="controls">
                <button class="later" @click="login">游客登录</button>
                <button class="login" @click="login">Login</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import router from '@/router'
import { client } from '@/lib/runtime.js'

const accessCode = ref()
const requesting = ref(false)

const login = async () => {
    if (requesting.value) {
        return
    } else {
        requesting.value = true
        try {
            const code = accessCode.value
            const result = await client.login(code)
            if (result) {
                await router.push('/home')
            }
        } catch (error) {
            console.error(error)
        }
        requesting.value = false
    }
}
</script>