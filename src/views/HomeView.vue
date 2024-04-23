<template>
    <div id="main" v-if="!client.onPhone">
        <friendlist></friendlist>
        <router-view></router-view>
    </div>
    <div id="main-mobile" v-else-if="onList || this.$route.name === 'home'">
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
            client: client,
            onList: null
        }
    },
    components: {
        friendlist,
    },
    methods: {
    },mounted(){
        const to = this.$route
        if (to.name === 'toChat' || to.name === 'toProfile') {
                this.onList = true
            }else if(to.name === 'privateChat'){
                this.onList = false
            }
    },computed:{
    },
    watch: {
        '$route': function (newVal) {
            if (newVal.name === 'toChat' || newVal.name === 'toProfile') {
                this.onList = true
            }else if(newVal.name === 'privateChat'){
                this.onList = false
            }
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