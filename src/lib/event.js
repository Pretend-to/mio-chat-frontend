export default class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(eventName, listener) {
        // 移除之前的回调函数
        this.off(eventName);
        // 添加新的回调函数
        this.events[eventName] = [listener];
    }

    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(listener => {
                listener(data);
            });
        }
    }

    off(eventName) {
        if (this.events[eventName]) {
            delete this.events[eventName];
        }
    }
}
