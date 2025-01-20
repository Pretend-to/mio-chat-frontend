export default class Config {
    constructor() {
        this.localPresets = []
        this.openaiDefaultConfig = {
            model: 'gpt-4o-mini',
            stream: true,
            temperature: 1,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            history: [],
            opening: '',
            max_messages_num: 10,
        }
        this.onebotDefaultConfig = null
        this._loadStrogeConfig()
    }

    updateOpenaiDefaultConfig(patch) {
        this.openaiDefaultConfig = {
            ...this.openaiDefaultConfig,
            ...patch
        }
        this._saveStrogeConfig()
    }

    async loadOnebotDefaultConfig() {
        const onebotOptionsData = await fetch(`/api/onebot/plugins`)
        const onebotOptionsJson = await onebotOptionsData.json()
        this.onebotDefaultConfig = onebotOptionsJson.data.options
        this._saveStrogeConfig()
    }

    _loadStrogeConfig() {
        const config = localStorage.getItem('config')
        if (config) {
            Object.assign(this, JSON.parse(config))
        }else{
            this._saveStrogeConfig() 
        }
    }

    _saveStrogeConfig() {
        localStorage.setItem('config', JSON.stringify(this))
    }
}
