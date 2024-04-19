import localforage from 'localforage'

export default class Config {
    constructor() {
    }

    load(config) {
        Object.assign(this, config);
    }

    async init() {
        const config = await localforage.getItem('config');
        if (!config) {
            const platform = this.getPlatform();

            const system = {
                platform: platform,
                maxScreen: this.plaform == 'phone' ? true : false,
            };
            const openai = {
                modelList: []
            };
            const onebot = {
    
            };
    
            const config = {
                system: system,
                openai: openai,
                onebot: onebot,
            }
            
            this.load(config);
        }else {
            this.load(config);
        }


        
    }
    
    /**
     * 获取当前终端
     * @returns {string} 终端类型
     */
    getPlatform() {
        // 通过宽度来判断phone或computer
        const width = window.innerWidth;
        if (width < 768) {
            return 'phone';
        } else {
            return 'computer';
        }
    }
    
}
