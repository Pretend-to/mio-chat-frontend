<style lang="sass" scoped>
$baseColor: #1d93ab

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

        .icon-container
            transition: 1s linear

            .iconfont.ChatGPT
                font-size: 46px
                border-radius: 10px

            &.active
                transform: rotate(180deg)
                color: $baseColor

        .title
            font-size: 50px
            letter-spacing: 5px
            color: black
            margin: 25px

        .hint
            font-size: 15px
            font-weight: 300

        input
            margin-top: 30px
            border: 2px solid $baseColor
            border-radius: 12px
            width: 250px
            height: 40px
            padding: 0 10px
            text-align: center
            letter-spacing: 1px

            &:focus
                outline: 1px solid $baseColor

                &::placeholder
                    color: transparent

            &::placeholder
                text-align: center

        .controls
            display: flex
            flex-direction: column
            align-items: center

            button
                width: 300px
                margin-top: 20px
                padding: 10px 15px
                border-radius: 8px

                &:hover
                    box-shadow: 0 0 2px black

            .later
                background: transparent

            .login
                color: white
                background: $baseColor
</style>

<template>
    <div class="auth-view">
        <div class="container">
            <div class="icon-container" ref="iconContainer">
                <i class="iconfont ChatGPT"></i>
            </div>
            <h1 class="title">登录验证</h1>
            <p class="hint">管理员开启了密码验证，请在下方填入访问码</p>
            <input type="password" v-model="accessCode" placeholder="在此处填写访问码">
            <div class="controls">
                <button class="later">游客登录</button>
                <button class="login" @click="login">Login</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import router from '@/router'
import { client } from '@/lib/runtime.js'

const accessCode = ref()
const iconContainer = ref()

const login = async () => {
    // 激活图标
    await nextTick(() => iconContainer.value.classList.add('active'))

    try {
        const code = accessCode.value
        const result = await client.login(code)
        if (result) {
            await router.push('/home')
        }
    } catch (error) {
        console.error(error)
    }
}
</script>