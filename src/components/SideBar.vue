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
          <svg
            t="1695150961459"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="16393"
          >
            <path
              d="M512 42.666667A464.64 464.64 0 0 0 42.666667 502.186667 460.373333 460.373333 0 0 0 363.52 938.666667c23.466667 4.266667 32-9.813333 32-22.186667v-78.08c-130.56 27.733333-158.293333-61.44-158.293333-61.44a122.026667 122.026667 0 0 0-52.053334-67.413333c-42.666667-28.16 3.413333-27.733333 3.413334-27.733334a98.56 98.56 0 0 1 71.68 47.36 101.12 101.12 0 0 0 136.533333 37.973334 99.413333 99.413333 0 0 1 29.866667-61.44c-104.106667-11.52-213.333333-50.773333-213.333334-226.986667a177.066667 177.066667 0 0 1 47.36-124.16 161.28 161.28 0 0 1 4.693334-121.173333s39.68-12.373333 128 46.933333a455.68 455.68 0 0 1 234.666666 0c89.6-59.306667 128-46.933333 128-46.933333a161.28 161.28 0 0 1 4.693334 121.173333A177.066667 177.066667 0 0 1 810.666667 477.866667c0 176.64-110.08 215.466667-213.333334 226.986666a106.666667 106.666667 0 0 1 32 85.333334v125.866666c0 14.933333 8.533333 26.88 32 22.186667A460.8 460.8 0 0 0 981.333333 502.186667 464.64 464.64 0 0 0 512 42.666667"
              p-id="16394"
            ></path>
          </svg>
        </a>
        <div class="side-icon" @click="toConfig">
          <svg
            t="1695150463577"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="15301"
          >
            <path
              d="M904.533333 422.4l-85.333333-14.933333-17.066667-38.4 49.066667-70.4c14.933333-21.333333 12.8-49.066667-6.4-68.266667l-53.333333-53.333333c-19.2-19.2-46.933333-21.333333-68.266667-6.4l-70.4 49.066666-38.4-17.066666-14.933333-85.333334c-2.133333-23.466667-23.466667-42.666667-49.066667-42.666666h-74.666667c-25.6 0-46.933333 19.2-53.333333 44.8l-14.933333 85.333333-38.4 17.066667L296.533333 170.666667c-21.333333-14.933333-49.066667-12.8-68.266666 6.4l-53.333334 53.333333c-19.2 19.2-21.333333 46.933333-6.4 68.266667l49.066667 70.4-17.066667 38.4-85.333333 14.933333c-21.333333 4.266667-40.533333 25.6-40.533333 51.2v74.666667c0 25.6 19.2 46.933333 44.8 53.333333l85.333333 14.933333 17.066667 38.4L170.666667 727.466667c-14.933333 21.333333-12.8 49.066667 6.4 68.266666l53.333333 53.333334c19.2 19.2 46.933333 21.333333 68.266667 6.4l70.4-49.066667 38.4 17.066667 14.933333 85.333333c4.266667 25.6 25.6 44.8 53.333333 44.8h74.666667c25.6 0 46.933333-19.2 53.333333-44.8l14.933334-85.333333 38.4-17.066667 70.4 49.066667c21.333333 14.933333 49.066667 12.8 68.266666-6.4l53.333334-53.333334c19.2-19.2 21.333333-46.933333 6.4-68.266666l-49.066667-70.4 17.066667-38.4 85.333333-14.933334c25.6-4.266667 44.8-25.6 44.8-53.333333v-74.666667c-4.266667-27.733333-23.466667-49.066667-49.066667-53.333333z m-19.2 117.333333l-93.866666 17.066667c-10.666667 2.133333-19.2 8.533333-23.466667 19.2l-29.866667 70.4c-4.266667 10.666667-2.133333 21.333333 4.266667 29.866667l53.333333 76.8-40.533333 40.533333-76.8-53.333333c-8.533333-6.4-21.333333-8.533333-29.866667-4.266667L576 768c-10.666667 4.266667-17.066667 12.8-19.2 23.466667l-17.066667 93.866666h-57.6l-17.066666-93.866666c-2.133333-10.666667-8.533333-19.2-19.2-23.466667l-70.4-29.866667c-10.666667-4.266667-21.333333-2.133333-29.866667 4.266667l-76.8 53.333333-40.533333-40.533333 53.333333-76.8c6.4-8.533333 8.533333-21.333333 4.266667-29.866667L256 576c-4.266667-10.666667-12.8-17.066667-23.466667-19.2l-93.866666-17.066667v-57.6l93.866666-17.066666c10.666667-2.133333 19.2-8.533333 23.466667-19.2l29.866667-70.4c4.266667-10.666667 2.133333-21.333333-4.266667-29.866667l-53.333333-76.8 40.533333-40.533333 76.8 53.333333c8.533333 6.4 21.333333 8.533333 29.866667 4.266667L448 256c10.666667-4.266667 17.066667-12.8 19.2-23.466667l17.066667-93.866666h57.6l17.066666 93.866666c2.133333 10.666667 8.533333 19.2 19.2 23.466667l70.4 29.866667c10.666667 4.266667 21.333333 2.133333 29.866667-4.266667l76.8-53.333333 40.533333 40.533333-53.333333 76.8c-6.4 8.533333-8.533333 21.333333-4.266667 29.866667L768 448c4.266667 10.666667 12.8 17.066667 23.466667 19.2l93.866666 17.066667v55.466666z"
              p-id="15302"
            ></path>
            <path
              d="M512 394.666667c-64 0-117.333333 53.333333-117.333333 117.333333s53.333333 117.333333 117.333333 117.333333 117.333333-53.333333 117.333333-117.333333-53.333333-117.333333-117.333333-117.333333z m0 170.666666c-29.866667 0-53.333333-23.466667-53.333333-53.333333s23.466667-53.333333 53.333333-53.333333 53.333333 23.466667 53.333333 53.333333-23.466667 53.333333-53.333333 53.333333z"
              p-id="15303"
            ></path>
          </svg>
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
  background-color: rgba(0, 0, 0, 0.1);
}
.icon-back svg,
.down-half svg {
  margin: 0.5rem 0rem;
  width: 1.8rem;
  height: 1.8rem;
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
