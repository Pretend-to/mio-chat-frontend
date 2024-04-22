/**
 * @author Mio-FCIP <1099834705@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-19 11:10:54
 */

import './assets/global.sass'
import '//at.alicdn.com/t/c/font_4459318_ioeido0jcz.js' // 项目图标库
import 'element-plus/dist/index.css'
import 'md-editor-v3/lib/style.css';
import './assets/mio.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import ElementPlus from 'element-plus'

import App from './App.vue'
import router from './router'

const app = createApp(App)


app.use(ElementPlus)
app.use(createPinia())
app.use(router)

app.mount('#app')