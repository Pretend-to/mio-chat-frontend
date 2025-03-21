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
      defaultAvatar: "/api/qava?q=1099834705",
      processedImage: "",
      activePage: PageStatus.NONE,
      adminAvatar: "",
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
        img.crossOrigin = "anonymous"; // 设置跨域属性
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
        img.onerror = (error) => reject(error);
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
      this.adminAvatar = `/api/qava?q=${adminId}`;
      try {
        this.processedImage = await this.processImage(this.adminAvatar);
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
            <svg
              t="1695149921092"
              class="icon"
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              p-id="6286"
            >
              <path
                d="M512 64c259.2 0 469.333333 200.576 469.333333 448s-210.133333 448-469.333333 448a484.48 484.48 0 0 1-232.725333-58.88l-116.394667 50.645333a42.666667 42.666667 0 0 1-58.517333-49.002666l29.76-125.013334C76.629333 703.402667 42.666667 611.477333 42.666667 512 42.666667 264.576 252.8 64 512 64z m0 64C287.488 128 106.666667 300.586667 106.666667 512c0 79.573333 25.557333 155.434667 72.554666 219.285333l5.525334 7.317334 18.709333 24.192-26.965333 113.237333 105.984-46.08 27.477333 15.018667C370.858667 878.229333 439.978667 896 512 896c224.512 0 405.333333-172.586667 405.333333-384S736.512 128 512 128z m-157.696 341.333333a42.666667 42.666667 0 1 1 0 85.333334 42.666667 42.666667 0 0 1 0-85.333334z m159.018667 0a42.666667 42.666667 0 1 1 0 85.333334 42.666667 42.666667 0 0 1 0-85.333334z m158.997333 0a42.666667 42.666667 0 1 1 0 85.333334 42.666667 42.666667 0 0 1 0-85.333334z"
                p-id="6287"
              ></path>
            </svg>
          </div>
        </div>
        <div class="icon-back" :class="{ active: isProfileActive }">
          <div id="editing" @click="toProfile">
            <svg
              t="1695150310032"
              class="icon"
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              p-id="11383"
            >
              <path
                d="M800 384c0-160-128-288-288-288S224 224 224 384c0 108.8 57.6 201.6 147.2 249.6-121.6 48-214.4 153.6-240 288-3.2 16 6.4 35.2 25.6 38.4h6.4c16 0 28.8-9.6 32-25.6C224 784 355.2 675.2 508.8 672h6.4C672 672 800 544 800 384z m-512 0c0-124.8 99.2-224 224-224s224 99.2 224 224c0 121.6-99.2 220.8-220.8 224h-9.6C384 604.8 288 505.6 288 384z m435.2 291.2c-16-9.6-35.2-6.4-44.8 9.6-9.6 16-6.4 35.2 9.6 44.8 73.6 51.2 124.8 121.6 140.8 204.8 3.2 16 16 25.6 32 25.6h6.4c16-3.2 28.8-19.2 25.6-38.4-19.2-99.2-80-185.6-169.6-246.4z"
                p-id="11384"
              ></path>
            </svg>
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
  flex-basis: 4.5rem;
  flex-direction: column;
  background-color: hsla(0, 0%, 100%, 0.8);
  backdrop-filter: blur(0.5rem);
  /* 添加模糊效果，值可以根据需要调整 */
}
.options {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  flex-grow: 1;
  /* margin: 1.2rem 1.2rem; */
}
.up-half,
.down-half {
  width: 50%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex-basis: 8rem;
  justify-content: center;
}
.icon-back {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0.5rem 0rem;
  border-radius: 0.5rem;
}
.icon-back.active {
  background-color: rgba(113, 113, 113, 0.1);
}
.icon-back svg,
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
.icon-back.active svg {
  fill: #007bff;
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
