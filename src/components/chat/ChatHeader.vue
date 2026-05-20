<template>
  <div class="upside-bar">
    <div class="return" @click="$emit('back')">
      <i class="iconfont icon-return"></i>
    </div>
    <div class="name-area" @click="$emit('to-profile')">
      <div class="contactor-name">{{ activeContactor.name }}</div>
      <StatusDot size="0.8rem" class="status-dot-chat" />
    </div>
    <ul class="options">
      <li class="share" @click="$emit('share')">
        <i class="iconfont icon-share"></i>
      </li>
    </ul>
  </div>
</template>

<script setup>
import StatusDot from "@/components/StatusDot.vue";

defineProps({
  activeContactor: {
    type: Object,
    required: true,
  },
});

defineEmits(["back", "to-profile", "share"]);
</script>

<style lang="sass" scoped>
$mobile: 768px
$icon-hover: #09f

.upside-bar
    flex-basis: 4rem
    flex-shrink: 0
    width: 100%
    display: flex
    align-items: flex-end
    justify-content: flex-start
    border-bottom: 0.0625rem solid #ebebeb
    -webkit-app-region: drag

    @media (max-width: $mobile)
      position: fixed
      height: 4rem
      z-index: 1000
      background-color: hsla(0, 0%, 100%, 0.8)
      backdrop-filter: blur(0.5rem)

    .return
        display: none

        &:hover
            color: $icon-hover

        @media (max-width: $mobile)
            display: block
            margin-left: 1rem
            margin-bottom: .8rem

    .name-area
        cursor: pointer
        position: relative
        display: flex
        align-items: center
        flex-basis: 10rem
        flex-grow: 1
        justify-content: flex-start
        margin: 0 0 .5rem 1rem

        .contactor-name
            text-overflow: ellipsis
            white-space: nowrap
            overflow: hidden
            max-width: 10rem

        .status-dot-chat
            margin-left: .5rem
            position: relative
            top: .1rem

            @media screen and (max-width: $mobile)
              display: none

    .options
        flex-basis: 10rem
        display: flex
        height: 2rem
        flex-wrap: nowrap
        flex-direction: row-reverse
        align-items: flex-end
        margin: 0 1rem .5rem 0

        li
            margin-left: 0.5rem
            color: #000
            font-weight: 580

            &:hover
              color: $icon-hover

            i
                font-size: 1.25rem

@media (max-width: $mobile)
    .name-area
        padding-bottom: 0.25rem
</style>

