/**
 * 重试管理器类
 * 实现指数退避算法的重连机制
 */
export default class RetryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 10;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.retryCount = 0;
    this.timer = null;
  }

  /**
   * 计算下一次重试的延迟时间
   * @returns {number} 延迟时间（毫秒）
   */
  getNextDelay() {
    const delay = Math.min(
      this.maxDelay,
      this.baseDelay * Math.pow(2, this.retryCount),
    );
    return delay + Math.random() * 1000; // 添加随机抖动
  }

  /**
   * 重置重试计数器
   */
  reset() {
    this.retryCount = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 检查是否可以继续重试
   * @returns {boolean} 是否可以继续重试
   */
  canRetry() {
    return this.retryCount < this.maxRetries;
  }

  /**
   * 执行重试操作
   * @param {Function} retryFn 重试函数
   * @returns {Promise} 重试操作的Promise
   */
  async retry(retryFn) {
    if (!this.canRetry()) {
      throw new Error("已达到最大重试次数");
    }

    const delay = this.getNextDelay();
    this.retryCount++;

    await new Promise((resolve) => {
      this.timer = setTimeout(resolve, delay);
    });

    return retryFn();
  }
}
