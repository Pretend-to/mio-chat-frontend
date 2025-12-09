<template>
  <div class="auth-view">
    <div class="container">
      <div ref="iconContainer" class="icon-container">
        <i class="iconfont ChatGPT"></i>
      </div>
      <h1 class="title">登录验证</h1>
      <p class="hint">管理员开启了密码验证，请在下方填入访问码</p>
      <input
        v-model="accessCode"
        type="password"
        placeholder="在此处填写访问码"
      />
      <div class="controls">
        <button class="later" @click="login()">游客登录</button>
        <button class="login" @click="login(accessCode)">登录</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onUnmounted, onMounted, ref } from "vue";
import router from "@/router";
import { client } from "@/lib/runtime.js";
import { ElMessage } from "element-plus";
import { useConfigStore } from '@/stores/configStore.js';

const configStore = useConfigStore();

const accessCode = ref();
const requesting = ref(false);
const iconContainer = ref();

const login = async (code) => {
  console.log("触发login了");

  // 激活图标
  await nextTick(() => iconContainer.value.classList.add("active"));

  if (requesting.value) {
    return;
  } else {
    requesting.value = true;
    try {
      const result = await client.login(code);
      if (result) {
        ElMessage.success(
          `成功以${result.is_admin ? "管理员身份" : "游客身份"}登录，欢迎使用!`,
        );

        // 如果是使用访问码且为管理员，保存到 store（并存 localStorage）
        if (code && result.is_admin) {
          configStore.setAdminCode(code);
        }

        // 先看看url里有没有query
        if (router.currentRoute.value.query.redirect) {
          router.push(router.currentRoute.value.query.redirect);
        } else {
          router.push("/");
        }
      }
    } catch (error) {
      ElMessage.error(error);
    } finally {
      // 移除激活图标
      await nextTick(() => iconContainer.value.classList.remove("active"));
      requesting.value = false;
    }
  }
};

// 定义一个命名函数供事件监听和移除使用
function handleEnter(e) {
  if (e.key === "Enter") {
    login(accessCode.value);
  }
}

// 在unmounted时移除监听
onUnmounted(() => {
  console.log("unmounted");
  removeEventListener("keydown", handleEnter); // 使用相同的函数引用进行移除
});

onMounted(() => {
  addEventListener("keydown", handleEnter);
  // 看看query里有没有key
  if (router.currentRoute.value.query.key) {
    login(router.currentRoute.value.query.key);
  }
});
</script>

<style lang="sass" scoped>
$baseColor: #1d93ab

.auth-view
    background-color: white
    flex-grow: 1
    display: grid
    place-items: center

    .container
        display: flex
        flex-direction: column
        align-items: center
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
            white-space: nowrap
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
                width: 10rem
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
