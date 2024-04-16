<template>
    <div id="main">
        <friendlist></friendlist>
        <router-view></router-view>
    </div>
</template>

<script>
import friendlist from '@/components/FriendList.vue'

export default {
    data() {
        return {

        }
    },
    components: {
        friendlist
    }
}
</script>

<style>
#main {
    background-color: rgb(255, 255, 255);
    flex-grow: 1;
    display: flex;
    width: calc(100% - 4.5rem);
}
</style>