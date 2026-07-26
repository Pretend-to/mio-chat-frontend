<template>
  <div class="group-avatar-wrapper" :style="wrapperStyle">
    <!-- 单个自定义头像或只有 1 个头像 -->
    <template v-if="displayAvatars.length <= 1">
      <img
        :src="displayAvatars[0] || defaultAvatar"
        class="single-avatar"
        alt="avatar"
        @error="handleImgError($event)"
      />
    </template>

    <!-- 2 个人 (1 用户 + 1 Agent): 上下留白，中间 50% 高度横向排布 -->
    <template v-else-if="displayAvatars.length === 2">
      <div class="layout-2">
        <img
          v-for="(url, idx) in displayAvatars"
          :key="idx"
          :src="url"
          class="sub-avatar"
          alt="avatar"
          @error="handleImgError($event)"
        />
      </div>
    </template>

    <!-- 3 个人 (1 用户 + 2 Agent): 三角形排布 (上 1 中间，下 2 并排) -->
    <template v-else-if="displayAvatars.length === 3">
      <div class="layout-3">
        <div class="top-row">
          <img
            :src="displayAvatars[0]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
        </div>
        <div class="bottom-row">
          <img
            :src="displayAvatars[1]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
          <img
            :src="displayAvatars[2]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
        </div>
      </div>
    </template>

    <!-- 4 个人: 四角 2x2 网格排布 -->
    <template v-else-if="displayAvatars.length === 4">
      <div class="layout-4">
        <div class="row">
          <img
            :src="displayAvatars[0]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
          <img
            :src="displayAvatars[1]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
        </div>
        <div class="row">
          <img
            :src="displayAvatars[2]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
          <img
            :src="displayAvatars[3]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
        </div>
      </div>
    </template>

    <!-- 5 个人: 上 2 下 3 排布 -->
    <template v-else-if="displayAvatars.length === 5">
      <div class="layout-5">
        <div class="top-row">
          <img
            :src="displayAvatars[0]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
          <img
            :src="displayAvatars[1]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
        </div>
        <div class="bottom-row">
          <img
            :src="displayAvatars[2]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
          <img
            :src="displayAvatars[3]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
          <img
            :src="displayAvatars[4]"
            class="sub-avatar"
            alt="avatar"
            @error="handleImgError($event)"
          />
        </div>
      </div>
    </template>

    <!-- 6 个人及以上: 3x3 九宫格 -->
    <template v-else>
      <div class="layout-grid">
        <img
          v-for="(url, idx) in displayAvatars.slice(0, 9)"
          :key="idx"
          :src="url"
          class="grid-avatar"
          alt="avatar"
          @error="handleImgError($event)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";
import client from "@/lib/client.js";

const props = defineProps({
  contactor: {
    type: Object,
    default: null,
  },
  members: {
    type: Array,
    default: () => [],
  },
  avatarPolicy: {
    type: String,
    default: "",
  },
  avatar: {
    type: String,
    default: "",
  },
  size: {
    type: [Number, String],
    default: null,
  },
});

const defaultAvatar = "/static/icons/512x512.png";

const wrapperStyle = computed(() => {
  if (!props.size) return {};
  const sz = typeof props.size === "number" ? `${props.size}px` : props.size;
  return {
    width: sz,
    height: sz,
    minWidth: sz,
    minHeight: sz,
  };
});

const displayAvatars = computed(() => {
  const policy = props.contactor?.avatarPolicy || props.avatarPolicy || "composite";
  const customAvatar = props.contactor?.avatar || props.avatar;

  // 自定义单张头像策略
  if (policy === "custom" || policy === 1) {
    if (customAvatar) return [customAvatar];
  }

  // 组合头像策略：包含【当前登录用户】+【群聊成员 Agent】
  const userAvatar = client.avatar || defaultAvatar;

  const rawMembers = props.contactor?.members || props.members || [];
  const agentAvatars = rawMembers.map((m) => m.avatar).filter(Boolean);

  const list = [userAvatar, ...agentAvatars];
  return list.length > 0 ? list : [defaultAvatar];
});

function handleImgError(e) {
  if (e?.target) {
    e.target.src = defaultAvatar;
  }
}
</script>

<style scoped lang="scss">
.group-avatar-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: var(--el-fill-color-darker, #e5e6eb);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;

  .single-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  /* 2 个人: 上下留白，中间 50% 高度横着放略缩版头像 */
  .layout-2 {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 52%;
    gap: 3px;

    .sub-avatar {
      height: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid rgba(255, 255, 255, 0.7);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
  }

  /* 3 个人: 三角形排布 (上 1，下 2) */
  .layout-3 {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 3px;
    gap: 2px;
    box-sizing: border-box;

    .top-row {
      display: flex;
      justify-content: center;
      width: 100%;
      height: 46%;

      .sub-avatar {
        height: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.7);
      }
    }

    .bottom-row {
      display: flex;
      justify-content: center;
      width: 100%;
      height: 46%;
      gap: 3px;

      .sub-avatar {
        height: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.7);
      }
    }
  }

  /* 4 个人: 2x2 网格 */
  .layout-4 {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 3px;
    gap: 2px;
    box-sizing: border-box;

    .row {
      display: flex;
      justify-content: center;
      width: 100%;
      height: 46%;
      gap: 2px;

      .sub-avatar {
        height: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.7);
      }
    }
  }

  /* 5 个人: 上 2 下 3 */
  .layout-5 {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 2px;
    gap: 2px;
    box-sizing: border-box;

    .top-row {
      display: flex;
      justify-content: center;
      width: 100%;
      height: 45%;
      gap: 2px;

      .sub-avatar {
        height: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.7);
      }
    }

    .bottom-row {
      display: flex;
      justify-content: center;
      width: 100%;
      height: 45%;
      gap: 2px;

      .sub-avatar {
        height: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.7);
      }
    }
  }

  /* 6 个人及以上: 3x3 九宫格 */
  .layout-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 2px;
    padding: 3px;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-items: center;
    box-sizing: border-box;

    .grid-avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid rgba(255, 255, 255, 0.7);
    }
  }
}
</style>
