<template>
    <div id="profile">
        <div class="profile-container">
            <div class="base-info">
                <div class="base-info-avatar">
                    <img :src="activeContactor.avatar" />
                </div>
                <div class="base-info-content">
                    <div class="name">{{ activeContactor.name }}</div>
                    <div class="id">ID {{ activeContactor.id }}</div>
                    <div class="status">
                        <span :class="'delay-status ' + getDelayStatus"></span>
                        在线
                    </div>
                </div>
            </div>
            <div class="more-info">

            </div>
            <div class="extra-info"></div>
            <div class="action-bar"></div>
        </div>
    </div>
</template>
<script>
import { client } from "@/lib/runtime.js";

export default {
    data() {
        const currentId = parseInt(this.$route.params.id);
        const contactor = client.getContactor(currentId);

        return {
            activeContactor: contactor,
            currentDelay: 0,
        }
    },
    mounted() {
        setInterval(() => {
            this.currentDelay = client.socket.delay;
        }, 3000);
    },
    computed: {
        getDelayStatus() {
            return this.currentDelay > 1000
                ? "high"
                : this.currentDelay > 500
                    ? "mid"
                    : this.currentDelay > 100
                        ? "low"
                        : "ultra";
        },

    },
    watch: {
        "$route.params.id"(newVal) {
            this.activeContactor = client.getContactor(newVal);
        }
    }
}
</script>

<style scoped>
#profile {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
}

.profile-container {
    margin: 4rem;
    width: calc(100% - 8rem);
    min-width: 20rem;
    max-width: 30rem;
    display: flex;
    flex-direction: column;
}

.profile-container>* {
    width: 100%;
    flex-basis: 1rem;
}

.base-info {
    /* border: 1px solid #000000; */
    display: flex;
    padding-bottom: 1rem;
    border-bottom: 1px solid #88888888;
}

.base-info-avatar {
    flex-basis: 6rem;
    height: 6rem;
}

.base-info-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
}

.base-info-content {
    margin-left: 1rem;
    margin-top: .5rem;
    display: flex;
    flex-direction: column;
}

.base-info-content .name {
    font-size: 1.25rem;
}

.base-info-content .id {
    margin-top: .25rem;
    font-size: 0.75rem;
    color: dimgrey;
}

.base-info-content .status {
    margin-top: .25rem;
}

.more-info {
    display:flex;
    flex-direction: column;
    justify-content: space-between;
}

.extra-info {
    border: 1px solid #000000;
}

.action-bar {
    border: 1px solid #000000;
}
</style>
<style lang="sass">
.delay-status
    display: inline-block
    width: 1rem
    height: 1rem
    border-radius: 50%
    transform: translateY(.25rem)
    margin-right: .25rem

    &:hover + .delay-num
        display: inline-block

    &.ultra
        background-color: rgb(53, 233, 146)

    &.low
        background-color: rgb(255, 204, 0)

    &.mid
        background-color: rgb(255, 102, 102)

    &.high
        background-color: #ccc
</style>