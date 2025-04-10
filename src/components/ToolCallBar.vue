<template>
  <div class="tool-call-bar">
    <div class="status-icon">
      <span v-if="toolCallSuccess" class="call-success-icon">
        <div class="checkmark-container">
          <svg
            class="checkmark"
            viewBox="0 0 52 36"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polyline points="1 20 15 36 51 1" />
          </svg>
        </div>
      </span>
      <span v-else-if="toolCallFail" class="call-fail-icon">❌</span>
      <span v-else class="call-pend-icon"></span>
    </div>
    <div class="tool-info">
      <div>
        <span class="tool-name">{{ toolCall.name }}</span>
      </div>
      <div class="tool-status">
        {{ call_status }}
      </div>
    </div>
    <div class="extra-info">
      <button
        ref="show-extra-info"
        :class="{ active: showExtraInfo, 'extra-info-button': true }"
        @click="showExtraInfo = !showExtraInfo"
      >
        <svg
          t="1731677922196"
          class="icon"
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          p-id="5948"
          width="16"
          height="16"
        >
          <path
            d="M778.965749 128.759549l-383.064442 383.063419 388.097062 388.096039-0.070608 0.033769c12.709463 13.137205 20.529569 31.024597 20.529569 50.731428 0 40.376593-32.736589 73.112158-73.115228 73.112158-19.705807 0-37.591153-7.819083-50.730405-20.528546l-0.034792 0.035816L241.890654 564.622498l0.035816-0.035816c-13.779841-13.281491-22.3838-31.915897-22.3838-52.585659 0-0.071631 0-0.106424 0-0.178055 0-0.072655 0-0.10847 0-0.144286 0-20.669762 8.603959-39.341007 22.3838-52.622498l-0.035816-0.034792L680.573835 20.337187l0.180102 0.179079c13.139252-12.5662 30.950919-20.313651 50.587142-20.313651 40.378639 0 73.115228 32.736589 73.115228 73.114205C804.455283 95.485725 794.567076 115.334795 778.965749 128.759549z"
            p-id="5949"
          ></path>
        </svg>
      </button>
    </div>
    <div :class="{ active: showExtraInfo, 'extra-info-bar': true }">
      <div class="extra-detail">
        <div class="detail-params">
          <div class="detail-title">参数</div>
          <div class="detail-content">
            {{ toolCall.parameters }}
          </div>
        </div>

        <div class="detail-result">
          <div class="detail-title">返回值</div>
          <div class="detail-content">
            {{ toolCall.result }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    toolCall: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      showExtraInfo: false,
    };
  },
  computed: {
    toolCallSuccess() {
      return (
        this.toolCall.action === "finished" && !this.toolCall?.result?.error
      );
    },
    toolCallFail() {
      return (
        this.toolCall.action === "finished" && this.toolCall?.result?.error
      );
    },
    call_status() {
      if (this.toolCall.action == "started") return "开始运行";
      if (this.toolCall.action == "pending") return "函数构建中";
      if (this.toolCall.action == "running") return "函数运行中";
      if (this.toolCallSuccess) return "函数运行成功";
      if (this.toolCallFail) return "函数运行失败";
      else return "未知状态";
    },
  },
  mounted() {},
};
</script>
<style scoped>
.extra-detail {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20rem;
  max-height: 25rem;
  flex-grow: 1;
  padding-bottom: 1rem;
}

.detail-params,
.detail-result {
  margin-top: 1rem;
  width: calc(100% - 2rem);
  background-color: #fff;
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
}

.detail-title {
  padding-top: 0.5rem;
  flex-basis: 2rem;
  width: 90%;
  border-bottom: 1px solid #5c5c5c;
}

.detail-content {
  user-select: text;
  margin: 0.5rem 0rem;
  font-size: 0.8rem;
  color: #5c5c5c;
  width: 90%;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 8rem;
  flex-grow: 1;
}

.extra-info-bar {
  position: absolute;
  overflow: hidden;
  z-index: 2;
  max-height: 0px;
  transition: 0.3s;
  top: 4rem;
  position: absolute;
  background-color: #f5f5f5;
  border-radius: 0.5rem;
  box-shadow: 0px 0px 5px 0px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.extra-info-bar.active {
  max-height: 50rem;
}

.tool-info {
  flex-grow: 1;
  flex-basis: 1rem;
  flex-shrink: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extra-info {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 0.5rem;
}

button.extra-info-button {
  transition: transform 0.3s ease;
  transform: rotate(90deg);
}

button.extra-info-button.active {
  transform: rotate(-90deg);
}

button.extra-info-button:hover svg {
  transition: transform 0.3s ease;
  transform: scale(1.2);
}

.tool-name {
  font-weight: bolder;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-call-bar {
  max-width: 100%;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  height: 4rem;
  flex-wrap: nowrap;
  background-color: #f5f5f5;
  border-radius: 5px;
  display: flex;
  position: relative;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border-radius: 50%;
  padding: 0 0.5rem;
}

.call-pend-icon {
  transform: rotateZ(45deg);
  perspective: 1000px;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  color: #fff;
}

.call-pend-icon:before,
.call-pend-icon:after {
  content: "";
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  width: inherit;
  height: inherit;
  border-radius: 50%;
  transform: rotateX(70deg);
  animation: 1s spin linear infinite;
}

.call-pend-icon:after {
  color: #ff3d00;
  transform: rotateY(70deg);
  animation-delay: 0.4s;
}

@keyframes rotate {
  0% {
    transform: translate(-50%, -50%) rotateZ(0deg);
  }

  100% {
    transform: translate(-50%, -50%) rotateZ(360deg);
  }
}

@keyframes rotateccw {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }

  100% {
    transform: translate(-50%, -50%) rotate(-360deg);
  }
}

@keyframes spin {
  0%,
  100% {
    box-shadow: 0.2em 0px 0 0px currentcolor;
  }

  12% {
    box-shadow: 0.2em 0.2em 0 0 currentcolor;
  }

  25% {
    box-shadow: 0 0.2em 0 0px currentcolor;
  }

  37% {
    box-shadow: -0.2em 0.2em 0 0 currentcolor;
  }

  50% {
    box-shadow: -0.2em 0 0 0 currentcolor;
  }

  62% {
    box-shadow: -0.2em -0.2em 0 0 currentcolor;
  }

  75% {
    box-shadow: 0px -0.2em 0 0 currentcolor;
  }

  87% {
    box-shadow: 0.2em -0.2em 0 0 currentcolor;
  }
}

.checkmark-container {
  width: 2.25rem;
  height: 2rem;
}

.checkmark {
  width: 100%;
  height: 100%;
}

.checkmark polyline {
  fill: none;
  stroke: green;
  /* 设置颜色为绿色 */
  stroke-width: 10;
  /* 设置线条的粗细 */
  stroke-dasharray: 60;
  /* 总长度 */
  stroke-dashoffset: 60;
  /* 起始偏移量 */
  animation: draw 1s forwards;
  /* 动画定义 */
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
    /* 结束时偏移量为0，显示完整的对勾 */
  }
}
</style>
