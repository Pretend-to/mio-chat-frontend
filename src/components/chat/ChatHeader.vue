<template>
  <div class="upside-bar">
    <div class="return" @click="$emit('back')">
      <svg
        class="lucide lucide-chevron-left header-icon-btn"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </div>
    <div class="name-area">
      <div
        class="name-content"
        :class="{ readonly: activeContactor.readOnly }"
        @click="activeContactor.readOnly ? null : $emit('to-profile')"
      >
        <div class="contactor-name">{{ activeContactor.name }}</div>
        <StatusDot size="0.8rem" class="status-dot-chat" />
      </div>
    </div>
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

defineEmits(["back", "to-profile"]);
</script>

<style lang="sass" scoped>
$mobile: 768px

.upside-bar
    flex-basis: 4rem
    flex-shrink: 0
    width: 100%
    display: flex
    align-items: flex-end
    justify-content: flex-start
    border-bottom: 0.0625rem solid var(--mio-border-color-light)
    color: var(--mio-text-primary)
    -webkit-app-region: drag

    @media (max-width: $mobile)
      position: fixed
      top: 0
      left: 0
      height: 3rem
      z-index: 1000
      align-items: center
      background-color: var(--mio-bg-statusbar-friendlist)

    .return
        display: none
        color: var(--mio-text-regular)

        .header-icon-btn
            width: 1.25rem
            height: 1.25rem
            display: block

        &:hover
            color: var(--mio-color-primary)

        @media (max-width: $mobile)
            display: block
            margin-left: 1rem
            margin-bottom: .8rem

    .name-area
        position: relative
        display: flex
        align-items: center
        flex: 0 1 auto
        max-width: calc(100% - 6rem)
        justify-content: flex-start
        margin: 0 0 .5rem 1rem
        min-width: 0

        .name-content
            cursor: pointer
            display: inline-flex
            align-items: center
            max-width: 100%
            min-width: 0
            -webkit-app-region: no-drag

            &.readonly
                cursor: default

            .contactor-name
                text-overflow: ellipsis
                white-space: nowrap
                overflow: hidden
                max-width: 12rem

            .status-dot-chat
                margin-left: .5rem
                position: relative
                top: .1rem
                flex-shrink: 0

                @media screen and (max-width: $mobile)
                    display: none

@media (max-width: $mobile)
    .upside-bar
        color: var(--mio-text-primary)

        .return
            color: var(--mio-text-primary)
            margin-bottom: 0.5rem
            .header-icon-btn
                width: 1.8rem
                height: 1.8rem
                color: var(--mio-text-primary)

        .name-area
            color: var(--mio-text-primary)
            margin: 0 0 0.65rem 0.8rem
            padding-bottom: 0
            max-width: calc(100% - 6rem)

            .name-content
                .contactor-name
                    color: var(--mio-text-primary)
                    font-size: 1rem
                    font-weight: 600
                    max-width: min(12rem, calc(100vw - 7rem))
</style>
