<template>
    <div>
        转发消息
    </div>
</template>

<script>
    export default{
        data(){
            return{

            }
        },
        props:{
            messages:Array,
            contactor:Object
        },
        mounted(){
            console.log(this.messages)
            console.log(this.contactor)
        }
    }
</script>