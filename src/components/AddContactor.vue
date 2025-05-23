<template>
  <div class="add-contactor">
    <div class="head">
      <div class="title">添加机器人</div>
      <div class="close-icon" @click="close">✕</div>
    </div>
    <div class="body">
      <div class="search">
        <i class="iconfont sousuo listicon" />
        <input
          v-model="keyWord"
          type="text"
          placeholder="输入搜索关键词"
          @input="loadSerachPresets"
        />
      </div>
      <div class="info">
        <header class="presets-types">
          <nav
            v-for="(type, index) in avaliablePresetTypes"
            :key="index"
            :class="activeTypeIndex === index ? 'active' : ''"
            @click="changeShownType(index)"
          >
            {{ type }}
          </nav>
        </header>
        <div :style="{ left: buttonTranslate }" class="slide-button"></div>
        <div
          v-if="shownPrestsList.length > 0 || [0, 3].includes(activeTypeIndex)"
          class="presets-list"
        >
          <div
            v-for="(preset, index) in shownPrestsList"
            :key="index"
            class="presets-item"
          >
            <div v-if="preset.avatar" class="preset-avatar custom">
              <img :src="preset.avatar" />
            </div>
            <div v-else-if="preset.model" class="preset-avatar model">
              <img :src="Contactor.getAvatarByModel(preset.model)" />
            </div>
            <div v-else class="preset-avatar">
              {{ preset.name.slice(0, 2) }}
            </div>
            <div class="preset-info">
              <div class="preset-name">{{ preset.name }}</div>
              <div :title="preset.opening" class="preset-description">
                {{ preset.opening }}
              </div>
            </div>
            <el-button @click="addBot(preset)">添加</el-button>
          </div>
          <div v-show="showPresetsLoader" ref="loader" class="loading">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
        <div v-else class="empty-list">
          <el-empty :image-size="200" />
        </div>
      </div>
      <div class="options"></div>
    </div>
  </div>
</template>

<script>
import Contactor from "../lib/contactor";
export default {
  emits: ["addBot", "close"],
  data() {
    const avaliablePresetTypes = ["推荐", "最近", "本地", "系统"];
    return {
      show: false,
      presetsList: [],
      recommendPresets: [],
      recentPresets: [],
      localPresets: [],
      systemPresets: [],
      searchPresets: [],
      systemShownNum: 0,
      recommendShownNum: 0,
      keyWord: "",
      activeTypeIndex: 0,
      buttonTranslate: 0,
      avaliablePresetTypes,
      moreSystemPresets: true,
      moreRecommendPresets: true,
      observer: null, // Store the observer instance
      Contactor,
    };
  },
  computed: {
    showPresetsLoader() {
      return this.activeTypeIndex == 3
        ? this.moreSystemPresets
        : this.activeTypeIndex == 0
          ? this.moreRecommendPresets
          : false;
    },
    shownPrestsList() {
      // 如果 keyWord 不为空，返回 searchPresets
      if (this.keyWord) {
        return this.searchPresets;
      }
      return this.activeTypeIndex === 2
        ? this.localPresets
        : this.activeTypeIndex === 1
          ? this.recentPresets
          : this.activeTypeIndex === 0
            ? this.recommendPresets
            : this.activeTypeIndex === 3
              ? this.systemPresets
              : null; // 或者返回默认值
    },
  },
  async mounted() {
    this.getAddHistory();

    await this.loadSpecificType();

    if ("IntersectionObserver" in window) {
      const callback = (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadMoreData();
          }
        });
      };

      this.observer = new IntersectionObserver(callback);
      const presetsLoader = this.$refs.loader;
      if (presetsLoader) {
        this.observer.observe(presetsLoader);
      }
    } else {
      // Fallback for browsers that do not support IntersectionObserver
      // Use scroll event to detect when the loader is visible.
      window.addEventListener("scroll", this.handleScroll);
    }
  },
  beforeUnmount() {
    if (this.observer) {
      this.observer.disconnect();
    } else {
      window.removeEventListener("scroll", this.handleScroll);
    }
  },
  methods: {
    async addBot(preset) {
      this.strogeAddHistory(preset);
      this.$emit("addBot", preset);
      this.$message.success("添加成功");
    },
    strogeAddHistory(preset) {
      // 先检查现有列表中是否有重复项
      const existingItem = this.recentPresets.find(
        (item) => item.name === preset.name,
      );
      if (existingItem) {
        // 如果有重复项，将其从数组中移除
        this.recentPresets.splice(this.recentPresets.indexOf(existingItem), 1);
      }
      // 添加新项目到数组的最前面
      this.recentPresets.unshift(preset);
      // 检查数组长度并保持在小于或等于 10
      if (this.recentPresets.length > 10) {
        this.recentPresets.pop(); // 移除最后一个元素，即最旧的元素
      }
      // 更新到 localStorage
      localStorage.setItem("addHistory", JSON.stringify(this.recentPresets));
    },
    getAddHistory() {
      const data = localStorage.getItem("addHistory");
      if (data) {
        this.recentPresets = JSON.parse(data);
      }
    },
    async changeShownType(index) {
      this.activeTypeIndex = index;
      this.buttonTranslate = `${49.6 * index}px`;
      await this.loadSpecificType();
    },
    close() {
      this.$emit("close");
    },
    async loadSpecificType() {
      const type = this.avaliablePresetTypes[this.activeTypeIndex];
      this.presetsList = await this.getPresetList(type);
    },
    async getPresetList(type) {
      if (type === "系统") {
        return await this.loadSystemPresets();
      } else if (type === "推荐") {
        return await this.loadRecommendedPresets();
      } else if (type === "最近") {
        return this.recentPresets;
      } else if (type === "本地") {
        return this.localPresets;
      }
    },
    async loadRecommendedPresets() {
      const res = await fetch(
        `/api/openai/presets?type=recommended&start=${this.recommendShownNum}`,
      ).then((res) => res.json());
      for (let i = 0; i < res.data.length; i++) {
        this.recommendPresets.push(res.data[i]);
      }
      this.recommendShownNum += res.data.length;
      if (res.data.length < 9) {
        this.moreRecommendPresets = false;
      }
      return this.recommendPresets;
    },
    async loadSystemPresets() {
      const res = await fetch(
        `/api/openai/presets?type=system&start=${this.systemShownNum}`,
      ).then((res) => res.json());
      for (let i = 0; i < res.data.length; i++) {
        this.systemPresets.push(res.data[i]);
      }
      this.systemShownNum += res.data.length;
      if (res.data.length < 9) {
        this.moreSystemPresets = false;
      }
      return this.systemPresets;
    },
    async loadSerachPresets() {
      const load = async () => {
        const res = await fetch(
          `/api/openai/presets?type=search&keyword=${this.keyWord}`,
        ).then((res) => res.json());
        this.searchPresets = res.data;
      };
      // 添加节流逻辑
      if (this.searchTimer) {
        clearTimeout(this.searchTimer);
      }
      this.searchTimer = setTimeout(() => {
        load();
      }, 500);
    },
    loadMoreData() {
      if (this.showPresetsLoader && this.activeTypeIndex === 3) {
        this.loadSystemPresets();
      } else if (this.showPresetsLoader && this.activeTypeIndex === 0) {
        this.loadRecommendedPresets();
      }
    },
    handleScroll() {
      const loader = this.$refs.loader;
      if (!loader) return;

      const rect = loader.getBoundingClientRect();
      const isVisible =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <=
          (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <=
          (window.innerWidth || document.documentElement.clientWidth);

      if (isVisible) {
        this.loadMoreData();
      }
    },
  },
};
</script>
<style scoped>
.empty-list {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.presets-list {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1rem;
  height: calc(100% - 3rem);
  overflow-y: auto;
}

.preset-description {
  white-space: nowrap;
  /* 不换行 */
  overflow: hidden;
  /* 内容超出隐藏 */
  text-overflow: ellipsis;
  /* 使用省略号 */
  font-size: 0.8rem;
  color: #888;
  width: 100%;
}

.presets-item button {
  flex-basis: 60px;
}

.presets-loader {
  width: 100%;
  height: 1rem;
}

.presets-item {
  position: relative;
  margin-top: 0.5rem;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-basis: 3rem;
  justify-content: space-around;
}

.preset-avatar {
  min-width: 2.8rem;
  max-width: 2.8rem;
  height: 2.8rem;
  background-color: #0099ff;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preset-avatar.model {
  background-color: #ffffff;
  border-radius: 50%;
}

.preset-avatar.custom img {
  width: 100%;
  border-radius: 50%;
}

.preset-avatar.model img {
  width: 90%;
}

.preset-info {
  position: relative;
  margin-left: 0.5rem;
  width: calc(100% - 7.5rem);
}

.slide-button {
  width: 2rem;
  border-top: #0099ff 2px solid;
  margin-left: 0.3rem;
  position: relative;
  left: 0;
  transition: left 0.3s;
}

.body {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-left: 1rem;
  padding-right: 1rem;
  overflow: hidden;
  position: relative;
  height: calc(100% - 2.5rem);
}

.info {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  height: calc(100% - 2.5rem);
}

.presets-types {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  width: 100%;
  margin-top: 1rem;
  position: relative;
}

.presets-types nav {
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  margin-right: 0.5rem;
  border-radius: 0.5rem;
  font-size: 0.8rem;
}

.presets-types nav.active {
  color: #0099ff;
}

.search {
  position: relative;
  box-sizing: border-box;
  border-bottom: 1px solid #f1f1f1;
  width: 100%;
  height: 2em;
  background-color: #f1f1f1;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  padding-left: 0.5rem;
}

.search:has(input:focus) {
  border: #0099ff 1px solid;
}

.search input {
  position: absolute;
  width: calc(100% - 2rem);
  height: 1.5rem;
  background-color: #f1f1f1;
  border: none;
  outline: none;
  margin-left: 1rem;
}

.search i {
  position: absolute;
  font-size: 0.8rem;
  color: #888;
}

.add-contactor {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  height: 500px;
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
}

.head {
  height: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f1f1;
  font-size: 0.8rem;
  padding-left: 1rem;
}

.close-icon {
  width: 1.5rem;
  font-size: 0.8rem;
  height: 100%;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
}

.close-icon:hover {
  color: aliceblue;
  background-color: rgb(196, 43, 28);
}

@media (max-width: 600px) {
  .add-contactor {
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    transform: none;
    border-radius: 0;
  }
}
</style>
<style>
.loading,
.loading > div {
  position: relative;
  box-sizing: border-box;
}

.loading {
  display: block;
  font-size: 0;
  color: #000;
}

.loading.la-dark {
  color: #333;
}

.loading > div {
  display: inline-block;
  float: none;
  background-color: currentColor;
  border: 0 solid currentColor;
}

.loading {
  margin-top: 1rem;
  width: 16px;
  min-height: 1rem;
}

.loading > div {
  position: absolute;
  top: 0;
  left: -100%;
  display: block;
  width: 16px;
  width: 100%;
  height: 16px;
  height: 100%;
  border-radius: 100%;
  opacity: 0.5;
  animation:
    ball-circus-position 2.5s infinite cubic-bezier(0.25, 0, 0.75, 1),
    ball-circus-size 2.5s infinite cubic-bezier(0.25, 0, 0.75, 1);
}

.loading > div:nth-child(1) {
  animation-delay:
    0s,
    -0.5s;
}

.loading > div:nth-child(2) {
  animation-delay:
    -0.5s,
    -1s;
}

.loading > div:nth-child(3) {
  animation-delay:
    -1s,
    -1.5s;
}

.loading > div:nth-child(4) {
  animation-delay:
    -1.5s,
    -2s;
}

.loading > div:nth-child(5) {
  animation-delay:
    -2s,
    -2.5s;
}

@keyframes ball-circus-position {
  50% {
    left: 100%;
  }
}

@keyframes ball-circus-size {
  50% {
    transform: scale(0.3, 0.3);
  }
}
</style>
