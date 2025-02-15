export default class EventEmitter {
    constructor() {
        this.events = {};
    }
    on(eventName, listener,refresh = true) {
        // 如果 refresh 为真，删除之前的回调函数
        if(refresh) {
            this.off(eventName)
        }   
        // 如果事件名不存在，则初始化为一个空数组
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        // 添加新的回调函数到数组中
        this.events[eventName].push(listener);
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