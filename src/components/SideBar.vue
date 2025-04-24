<script>
import { client } from "@/lib/runtime.js";

const PageStatus = {
  CHAT: "chat",
  PROFILE: "profile",
  SETTINGS: "settings",
  NONE: "none",
};
export default {
  data() {
    return {
      processedImage: "/p/qava?q=1099834705",
      activePage: PageStatus.NONE,
    };
  },
  computed: {
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
    async processImage(imageUrl) {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          // 绘制原始图片
          ctx.drawImage(img, 0, 0);
          // 创建透明的缺口
          let centerX = img.width * 0.8; // 圆心X坐标
          let centerY = img.height * 0.86; // 圆心Y坐标
          let radius = (5 / 24) * img.width; // 圆的半径
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
          ctx.clip();
          ctx.clearRect(0, 0, img.width, img.height);
          // 将处理后的图片转换为base64
          canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            resolve(url);
          }, "image/png");
        };
        img.onerror = (error) => {
          reject(error);
        };
      });
    },
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
      const adminAvatar = `/p/qava?q=${adminId}`;
      try {
        this.processedImage = await this.processImage(adminAvatar);
      } catch (error) {
        console.error("Error loading avatar:", error);
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
      } else if (route.path === "/settings") {
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
      <div class="status"></div>
      <img :src="processedImage" alt="admin-avatar" />
    </div>
    <div id="side" class="options">
      <div class="up-half">
        <div class="icon-back" :class="{ active: isChatActive }">
          <div id="chatting" @click="toChat">
            <i class="iconfont chat"></i>
          </div>
        </div>
        <div class="icon-back" :class="{ active: isProfileActive }">
          <div id="editing" @click="toProfile">
            <i class="iconfont user"></i>
          </div>
        </div>
      </div>
      <div class="down-half">
        <a
          href="https://github.com/Pretend-to/mio-chat-backend"
          target="_blank"
          class="side-icon"
        >
          <i class="iconfont github"></i>
        </a>
        <div class="side-icon" @click="toConfig">
          <i class="iconfont menu"></i>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
#sidebar {
  display: flex;
  flex-basis: 3.8rem;
  flex-direction: column;
  background-color: hsla(0, 0%, 100%, 0.8);
  backdrop-filter: blur(10px);
  -webkit-app-region: drag;
}
.options {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  flex-grow: 1;
  /* margin: 1.2rem 1.2rem; */
}

.logo img {
  width: 2.5rem;
}
.up-half,
.down-half {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex-basis: 8rem;
  justify-content: center;
}
.icon-back {
  height: 2.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0.5rem 0rem;
  border-radius: 0.5rem;
}
.icon-back.active {
  padding: 0 0.5rem;
  background-color: rgba(113, 113, 113, 0.1);
}

.icon-back i,
.down-half i {
  margin: 0.5rem 0rem;
  width: 1.8rem;
  height: 1.8rem;
  font-size: 1.6rem;
  color: black;
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
.status {
  position: absolute;
  left: 68%;
  top: 71%;
  transform: translate(-50%, -50%);
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: linear-gradient(to bottom, rgb(52, 238, 143), rgb(54, 221, 150));
}
.side-icon {
  display: flex;
  justify-content: center;
  align-items: center;
}
.icon-back.active i {
  color: #007bff;
}

@media screen and (max-width: 600px) {
  .options {
    justify-content: space-evenly;
  }
  #sidebar {
    width: 100%;
    flex-direction: row;
    flex-basis: 4rem;
    background-color: #f5f4f9;
  }
  .admin-avatar {
    display: none;
  }
  .options {
    flex-direction: row;
    width: 100%;
  }
  .up-half,
  .down-half {
    flex-basis: 50%;
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
  }
  .icon-back.active {
    background-color: transparent;
  }
}
</style>
