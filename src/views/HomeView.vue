<template>
    <div id="main" v-if="!onPhone">
        <friendlist></friendlist>
        <router-view></router-view>
    </div>
    <div id="main-mobile" v-else-if="pagePath === '/'">
        <friendlist></friendlist>
    </div>
    <div id="main-mobile" class="mobile-chat" v-else>
        <router-view></router-view>
    </div>
</template>

<script>
import friendlist from '@/components/FriendList.vue'
import { client } from '@/lib/runtime.js'

export default {
    data() {
        return {
            onPhone: client.onPhone,
            client: client,
            pagePath: this.$route.path
        }
    },
    components: {
        friendlist,
    },
    methods: {
    },mounted(){

    },computed:{
    },
    watch: {
        '$route': function (newVal) {
            this.pagePath = newVal.path
        }
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

#main-mobile {
    width: 100%;
    max-height: calc(100vh - 4rem);
    background-color: rgb(255, 255, 255);
    flex-grow: 1;
    display: flex;
}

.mobile-chat#main-mobile {
    max-height: 100%;
}
</style>