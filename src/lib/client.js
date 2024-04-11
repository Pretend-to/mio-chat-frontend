/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor Mio-FCIP <1099834705@qq.com>
 * @lastEditTime 2024-04-11 14:30:48
 */
export default class Client {
    constructor() {
        this.firstCome = !this.checkLocalStorage();
        this.id = this.firstCome ? this.genFakeId() : this.id;
        this.isAdmin = this.firstCome ? false : this.isAdmin;
        this.code = this.firstCome ? '' : this.code;
    }

    /** 
     * 生成一个以1开头的10位随机ID
     * @returns {string} 1开头的10位随机ID
     */
    genFakeId() {
        let id = Math.floor(Math.random() * 10000000000) + 1;
        return '1' + id.toString();
    }

    /**
     * 检查localstorage中是否有用户信息
     * @returns {client} 用户信息
     */
    checkLocalStorage() {
        let client = JSON.parse(localStorage.getItem('client'));
        if (client) {
            // 把client对象的所有属性附加到this上
            for (let key in client) {
                this[key] = client[key];
            }
            return true;
        } else {
            return false;
        }
    }
}
