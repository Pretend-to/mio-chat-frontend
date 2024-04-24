/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-24 08:36:05
 */

import './assets/global.sass'
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