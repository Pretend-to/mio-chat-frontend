# Agent 模型选择与智能模式

输入框机器人图标在 Web Session 中修改本地会话模型，在服务端 Agent 中通过
`PATCH /api/agents/:agentId` 修改 Agent 的 provider/model。只有保存成功才更新
本地 Agent 的模型显示；请求失败时保留原值。

Agent 详情页的插件工具页通过管理员接口
`GET /api/agents/:agentId/tools?sessionId=...` 读取服务端投影结果。接口先确认
Session 属于 Agent，再按核心工具策略及权限生成目录。前端展示分组、数量、名称
和说明，不用本地 Web 工具目录推测服务端能力。

Web 智能模式的工具集为 ai-plugin 与 terminal-pty。默认创建、设置开关、工具页
状态和发送请求共同使用 smartTools.js。已完整启用 ai-plugin 的存量配置，在下一次
请求时补齐终端工具；单独选择 skill 不再造成终端整组“显示开启”的假象。
群聊成员发送请求也应用相同规则。后端终端工具仍要求管理员身份。
