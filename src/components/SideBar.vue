<script>
import { client } from "@/lib/runtime.js";
import {
  processAvatarWithStatusHole,
  getAdminAvatarUrl,
} from "@/utils/avatar.js";
import StatusDot from "@/components/StatusDot.vue";
import { useConnectionStore } from "@/stores/connectionStore";
import { mapState } from "pinia";

const PageStatus = {
  CHAT: "chat",
  PROFILE: "profile",
  SETTINGS: "settings",
  NONE: "none",
};
export default {
  components: {
    StatusDot,
  },
  data() {
    return {
      processedImage: "/p/qava?q=1099834705",
      activePage: PageStatus.NONE,
    };
  },
  computed: {
    ...mapState(useConnectionStore, ["isConnected"]),
    isChatActive() {
      return this.activePage === PageStatus.CHAT;
    },
    isProfileActive() {
      return this.activePage === PageStatus.PROFILE;
    },
  },
  watch: {
    $route: {
      handler(newRoute) {
        this.activePage = this.getPageStatusFromRoute(newRoute);
      },
      immediate: true,
    },
  },
  mounted() {
    this.activePage = this.getPageStatusFromRoute();
    const adminId = client.admin_qq;
    if (adminId) {
      this.loadAvatar(adminId);
    } else {
      client.on(
        "loaded",
        () => {
          const adminId = client.admin_qq;
          this.loadAvatar(adminId);
        },
        false,
      );
    }
  },
  methods: {
    async toChat() {
      this.activePage = PageStatus.CHAT;
      this.$router.push({ name: "blank" });
    },
    async toProfile() {
      this.activePage = PageStatus.PROFILE;
      this.$router.push({ name: "contactors" });
    },
    async toConfig() {
      this.activePage = PageStatus.SETTINGS;
      this.$router.push({ name: "settings" });
    },
    async loadAvatar(adminId) {
      const adminAvatar = getAdminAvatarUrl(adminId);
      try {
        this.processedImage = await processAvatarWithStatusHole(adminAvatar);
      } catch (error) {
        console.error(
          "Error processing avatar, falling back to original:",
          error,
        );
        this.processedImage = adminAvatar;
      }
    },
    getPageStatusFromRoute(route = this.$route) {
      if (route.path === "/" || route.path.includes("/chat/")) {
        return PageStatus.CHAT;
      } else if (
        route.path === "/contactors" ||
        route.path.includes("/profile/")
      ) {
        return PageStatus.PROFILE;
      } else if (route.path.startsWith("/settings")) {
        return PageStatus.SETTINGS;
      }
      return PageStatus.NONE;
    },
  },
};
</script>

<template>
  <div id="sidebar">
    <div class="admin-avatar">
      <StatusDot size="0.75rem" class="status-dot-pos" />
      <img :src="processedImage" alt="admin-avatar" />
    </div>
    <div id="side" class="options">
      <div class="up-half">
        <div
          class="icon-back rail-tab-messages"
          :class="{ active: isChatActive }"
          @click="toChat"
        >
          <span class="rail-tab-icon">
            <svg
              class="lucide lucide-message-circle"
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </svg>
          </span>
          <span class="tab-label">消息</span>
        </div>
        <div
          class="icon-back rail-tab-contacts"
          :class="{ active: isProfileActive }"
          @click="toProfile"
        >
          <span class="rail-tab-icon">
            <svg
              class="rail-contact-icon"
              viewBox="0 0 28 28"
              aria-hidden="true"
            >
              <circle class="rail-contact-head" cx="14" cy="7.1" r="5.4" />
              <path
                class="rail-contact-body-fill"
                d="M3.8 24.5a10.2 8.2 0 0 1 20.4 0H3.8Z"
              />
              <path class="rail-contact-collar" d="M10.8 16.8h6.4L14 21.1Z" />
              <path
                class="rail-contact-body-line"
                d="M3.8 24.5a10.2 8.2 0 0 1 20.4 0"
              />
            </svg>
          </span>
          <span class="tab-label">联系人</span>
        </div>
      </div>
      <div class="down-half">
        <a
          href="https://github.com/Pretend-to/mio-chat-backend"
          target="_blank"
          class="side-icon"
        >
          <span class="rail-tab-icon">
            <svg
              class="lucide lucide-github"
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
              />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </span>
          <span class="tab-label">开源</span>
        </a>
        <div class="side-icon" @click="toConfig">
          <span class="rail-tab-icon">
            <svg
              class="lucide lucide-settings"
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <span class="tab-label">设置</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#sidebar {
  display: flex;
  flex-basis: 3.8rem;
  flex-shrink: 0;
  flex-direction: column;
  background-color: transparent;
  -webkit-app-region: drag;
}
.options {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  flex-grow: 1;
}

.up-half,
.down-half {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem 0;
}

.icon-back,
.side-icon {
  width: 2.8rem;
  height: 2.8rem;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 0.6rem;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--mio-text-regular);
  text-decoration: none;
}

.icon-back:hover,
.side-icon:hover {
  background-color: var(--mio-bg-hover);
  color: var(--mio-text-primary);
}

.icon-back.active {
  background-color: var(--mio-bg-active);
  color: var(--mio-color-primary);
}

.icon-back svg,
.down-half svg {
  transition: all 0.2s ease;
}

.admin-avatar {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
  height: 4.5rem;
  position: relative;
  z-index: 10;
}
.admin-avatar img {
  border-radius: 50%;
  width: 60%;
}
.status-dot-pos {
  position: absolute;
  left: 68%;
  top: 71%;
  transform: translate(-50%, -50%);
  z-index: 11;
}

@media screen and (max-width: 768px) {
  #sidebar {
    width: 100%;
    flex-direction: row;
    height: calc(4.2rem + env(safe-area-inset-bottom, 0px)) !important;
    max-height: calc(4.2rem + env(safe-area-inset-bottom, 0px)) !important;
    flex-basis: calc(4.2rem + env(safe-area-inset-bottom, 0px)) !important;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px)) !important;
    background-color: var(--mio-mobile-bg-navbar);
    backdrop-filter: blur(15px);
    border-top: 1px solid var(--mio-border-color-light);
    border-right: none;
    box-sizing: border-box; /* Crucial to prevent safe-area padding from adding to height */
  }
  .admin-avatar {
    display: none;
  }
  .options {
    flex-direction: row;
    width: 100%;
    padding: 0;
    display: flex;
    justify-content: space-evenly;
    align-items: center;
  }
  .up-half,
  .down-half {
    display: contents;
  }
  .icon-back,
  .side-icon {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    width: 3.5rem !important;
    height: 100% !important;
    border-radius: 0.5rem !important;
  }
  .icon-back.active {
    background-color: transparent;
  }
}
</style>
