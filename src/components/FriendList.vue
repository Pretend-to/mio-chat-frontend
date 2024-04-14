<script>
import { client } from '@/lib/runtime.js';

export default {
    data() {
        const contactorList = client.contactList

        return {
            contactorList: contactorList,
        }
    },
    methods: {

    }
}
</script>

<template>
    <div id="friendlists">
        <div class="upsidebar" id="friends">
            <div class="search" id="people">
                <svg t="1695130526763" class="listicon" viewBox="0 0 1024 1024" version="1.1"
                    xmlns="http://www.w3.org/2000/svg" p-id="3427">
                    <path
                        d="M945.066667 898.133333l-189.866667-189.866666c55.466667-64 87.466667-149.333333 87.466667-241.066667 0-204.8-168.533333-373.333333-373.333334-373.333333S96 264.533333 96 469.333333 264.533333 842.666667 469.333333 842.666667c91.733333 0 174.933333-34.133333 241.066667-87.466667l189.866667 189.866667c6.4 6.4 14.933333 8.533333 23.466666 8.533333s17.066667-2.133333 23.466667-8.533333c8.533333-12.8 8.533333-34.133333-2.133333-46.933334zM469.333333 778.666667C298.666667 778.666667 160 640 160 469.333333S298.666667 160 469.333333 160 778.666667 298.666667 778.666667 469.333333 640 778.666667 469.333333 778.666667z"
                        p-id="3428"></path>
                </svg>
                <input type="text" id="tosearch" placeholder="搜索">
            </div>
            <div class="bu-add">
                <button id="addcont" @click="addone">+</button>
            </div>
        </div>
        <div class="people">
            <div @click="showChat(item.id)" v-for="(item, index) of contactorList" :key="index" class="lists">
                <div class="avatar">
                    <img :src="item.avatar" :alt="item.name">
                </div>
                <div class="info">
                    <div class="name">{{ item.name }}</div>
                    <div class="msginfo" id="time">{{ item.getLastTime() }}</div>
                    <div class="msginfo" id="msgctt">{{ item.getLastContent() }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
#friendlists {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    max-width: 200px;
    border-left: 1px solid rgba(161, 154, 154, 0.626);
    border-right: 1px solid rgba(161, 154, 154, 0.626);
}

.upsidebar {
    justify-content: space-between;
    display: flex;
    flex-direction: row;
    background-color: rgb(255, 255, 255);
    flex: 0 0 3rem;
    padding: 22px 12px 8px 12px;
    align-items: stretch;
    border-bottom: 1px solid rgba(161, 154, 154, 0.626);
}

input#tosearch {
    width: calc(100% - 18px);
    margin-top: 3px;
    padding-left: 5px;
    height: 18px;
    background-color: transparent;
    border: 0px;
}

input#tosearch:focus {
    outline: none;
    border: 0px;
}

button#searchButton {
    width: 16px;
    border: 0px;
    border-radius: 5px;
    margin-left: 8px;
    text-wrap: nowrap;
}

.search {
    flex-grow: 1;
    border-radius: 5px;
    background-color: rgb(245 245, 245);
    height: 25px;
    display: flex;
    padding: 2px 4px;
    align-items: center;
}

.bu-add {
    width: 29px;
    height: 29px;
    margin-left: 8px;
}

.listicon {
    padding-top: 1px;
    width: 16px;
    height: 16px;
}

button#addcont {
    border-radius: 5px;
    width: 100%;
    height: 100%;
    border: none;
}

.lists {

    display: flex;
    padding: 4px 8px;
    height: 60px;
    max-height: 60px;
    min-height: 60px;
    /* border: 1px solid pink; */
}

.lists#important {
    background-color: rgb(240, 240, 240);
}

.lists:hover {
    background-color: rgb(240, 240, 240)
        /* border: 1px solid pink; */
}

.lists#important:hover {
    background-color: rgb(231, 231, 231);
    /* border: 1px solid pink; */
}

.lists#active {
    background-color: rgb(0, 153, 255);
}

.lists>.avatar {
    margin-top: 10px;
    max-width: 42px;
    min-width: 42px;
    max-height: 42px;
    min-height: 42px;
}

.avatar>img {
    width: 100%;
    height: 100%;
    border-radius: 50%;

}
</style>