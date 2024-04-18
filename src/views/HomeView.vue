<template>
    <div id="main" v-if="!client.onPhone">
        <friendlist></friendlist>
        <router-view></router-view>
    </div>
    <div id="main-mobile" v-else-if="onList || this.$route.name === 'home'">
        <friendlist></friendlist>
    </div>
    <div id="main-mobile" v-else>
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
        friendlist
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
        '$route': function (to) {
            console.log('route changed')
            if (to.name === 'toChat' || to.name === 'toProfile') {
                this.onList = true
            }else if(to.name === 'privateChat'){
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
    height: 100vh;
    background-color: rgb(255, 255, 255);
    flex-grow: 1;
    display: flex;
}
</style>