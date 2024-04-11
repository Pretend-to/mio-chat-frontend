/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor Mio-FCIP <1099834705@qq.com>
 * @lastEditTime 2024-04-11 14:30:48
 */
export default class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
    }

    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(listener => {
                listener(data);
            });
        }
    }

    off(eventName, listener) {
        if (this.events[eventName]) {
            this.events[eventName] = this.events[eventName].filter(fn => fn !== listener);
        }
    }
}
