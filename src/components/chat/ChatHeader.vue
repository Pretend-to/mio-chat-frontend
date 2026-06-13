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
    <div class="name-area" @click="$emit('to-profile')">
      <div class="contactor-name">{{ activeContactor.name }}</div>
      <StatusDot size="0.8rem" class="status-dot-chat" />
    </div>
    <ul class="options">
      <li class="share" @click="$emit('share')">
        <svg
          class="lucide lucide-share-2 header-icon-btn"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
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
            color: var(--mio-text-regular)
            font-weight: 580

            &:hover
              color: var(--mio-color-primary)

            i, .header-icon-btn
                width: 1.25rem
                height: 1.25rem
                display: block

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
            .contactor-name
                color: var(--mio-text-primary)
                font-size: 1rem
                font-weight: 600
                max-width: 12rem

        .options
            color: var(--mio-text-primary)
            margin: 0 1rem 0.65rem 0
            li
                color: var(--mio-text-primary)
                i, .header-icon-btn
                    width: 1.5rem
                    height: 1.5rem
                    color: var(--mio-text-primary)
</style>
