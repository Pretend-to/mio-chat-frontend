/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor Mio-FCIP <1099834705@qq.com>
 * @lastEditTime 2024-04-14 10:16:36
 */

import './assets/main.css'
import 'md-editor-v3/lib/style.css';
import './assets/mio.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)


app.use(ElementPlus)
app.use(createPinia())
app.use(router)

app.mount('#app')
