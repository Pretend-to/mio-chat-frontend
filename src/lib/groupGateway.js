/**
 * groupGateway.js — 群聊多 Agent 消息分发与上下文隔离封装引擎
 * 
 * 职责：
 * 1. 注入包含群信息、全量成员名单与职责的 Group System Prompt。
 * 2. 对每个 Agent 的上下文进行隔离封装：Agent 自己的发言保持原生格式，其他成员/用户的发言通过 <group_chat_history> XML 清晰化呈现。
 * 3. 处理 @Mention 路由，触发特定或全体 Agent 响应。
 */

import { client } from "@/lib/runtime.js";
import { getValidOpenaiMessage } from "@/lib/gateway.js";
import { assembleSystemPrompt } from "@/utils/SystemPromptAssembler.js";
import { useConfigStore } from "@/stores/configStore.js";
import { useContactorsStore } from "@/stores/contactorsStore.js";
import { getAdminAvatarUrl } from "@/utils/avatar.js";
import { buildUserProfileXml } from "@/lib/clientSettings.js";
import { numberString } from "@/utils/generate.js";

/**
 * 构建特定 Agent 成员在群聊中的专属 System Prompt
 * @param {Object} group 
 * @param {Object} member 
 * @returns {string}
 */
export function buildGroupSystemPrompt(group, member) {
  const configStore = useConfigStore();
  const userProfile = configStore.userProfile || { name: "User" };

  const membersXml = (group.members || [])
    .map((m) => {
      const isSelf = m.id === member.id;
      return `    <member id="${m.id}" name="${m.name}" title="${m.title || ''}" intro="${m.intro || ''}" is_self="${isSelf}" />`;
    })
    .join("\n");

  // 举例时取一个「别人」，避免示范成 @ 自己（自我 @ 会被 checkAndTriggerAgentInvocation 丢弃）
  const examplePeer =
    (group.members || []).find((m) => m.id !== member.id) || member;

  const lines = [
    `You are participating as group member "${member.name}" (${member.title || 'Agent'}) in a multi-agent Group Chat.`,
    ``,
    `<group_info>`,
    `  <group_name>${group.name || "Group Chat"}</group_name>`,
    `  <group_intro>${group.intro || "General discussion"}</group_intro>`,
    `</group_info>`,
    ...(group.notice && group.notice.trim()
      ? [
          ``,
          `<group_announcement>`,
          group.notice.trim(),
          `</group_announcement>`,
        ]
      : []),
    ``,
    `<group_members>`,
    `    <member id="user" name="${userProfile.name}" role="user" />`,
    membersXml,
    `</group_members>`,
    ``,
    `<group_rules>`,
    `  1. Speak and respond strictly as ${member.name}.`,
    `  2. Follow your designated role, expertise, and system instructions.`,
    `  3. Address other group members by their names when interacting with them.`,
    `</group_rules>`,
    ``,
    `<agent_invocation_rules>`,
    `如果需要在回复中呼叫、提问或唤起群内的其他 Agent 成员共同讨论，请在回复文本中使用标准语法：@'\u6210员名称'(ID) （例如：@'${examplePeer.name}'(${examplePeer.id}) ）。注意：名称两侧必须用英文单引号（直引号'\u6216弯引号’均可）包裹，小括号内写 ID。系统会自动识别并唤起对应成员回复。`,
    ``,
    `重要——@ 是唯一会让这场多 Agent 对话继续下去的动作，请把它当成一个需要理由的决定：`,
    `  1. 只有当你确实需要某位成员的专长、授权或信息，且没有他就无法推进时，才 @ 他。`,
    `  2. 如果问题已经回答完毕、讨论已经收敛、结论已经形成，或者你判断这轮对话到此为止就够了，就不要 @ 任何人。直接给出你的结论并停下，把下一步交回给用户。`,
    `  3. 不要出于客套、附和、"再听听别人意见"、或者单纯想让讨论显得热闹而 @ 其他成员。没有实质推进的 @ 属于噪音。`,
    `  4. 如果你发现讨论开始原地打转、在重复已有观点，或者几位成员已经达成一致，应当主动收尾而不是继续 @。`,
    `  5. 不确定要不要 @ 的时候，默认不 @。少唤起一次，用户自己会来推进；多唤起一次，就是一串没人想要的对话。`,
    `</agent_invocation_rules>`,
  ];

  const opening = member.options?.presetSettings?.opening || "";
  if (opening) {
    lines.push(``, `<persona_instruction>`, opening, `</persona_instruction>`);
  }

  return lines.join("\n");
}

/**
 * 提取文本消息中的纯文本（剥离工具调用与复杂格式）
 * @param {Object} message
 * @param {boolean} includeReason 是否纳入推理链文本。@ 唤起检测必须传 false，
 *   否则 Agent 在思考过程中提到 @'成员'(id) 就会被误判为真实唤起指令。
 * @returns {string}
 */
function extractMessageText(message, includeReason = true) {
  if (!message || !Array.isArray(message.content)) return "";
  return message.content
    .filter((c) => c.type === "text" || (includeReason && c.type === "reason"))
    .map((c) => c.data?.text || "")
    .join("\n")
    .trim();
}

/**
 * 为特定的群 Agent 成员格式化 OpenAI 请求 Payload
 * @param {Object} group 
 * @param {Object} member 
 * @returns {Array<Object>} finalMessages
 */
export function formatGroupMessagesForMember(group, member) {
  const groupPrompt = buildGroupSystemPrompt(group, member);

  // 记忆结晶按成员独立：群共用一条 messageChain，但每个成员压缩到哪、
  // 压出了什么都各不相同。结晶内容并入 system message（与单聊 assembleSystemPrompt 同款），
  // 原始消息则从该成员自己的 lastCompressedIndex 往下取。
  // 群聊强制开启结晶，不提供关闭开关：群消息链是所有成员共享且只增不减的，
  // 没有压缩的话每个成员的上下文都会无限膨胀，比单聊更早撞上限。
  const crystal = member.options?.crystallization;
  const systemPrompt = assembleSystemPrompt(
    groupPrompt,
    crystal?.latestSummary || "",
  );

  const finalMessages = [{ role: "system", content: systemPrompt }];

  const fullChain = group.messageChain || [];
  const startIndex = Math.min(
    Math.max(Number(member.lastCompressedIndex) || 0, 0),
    fullChain.length,
  );
  const messageChain = startIndex > 0 ? fullChain.slice(startIndex) : fullChain;

  let pendingHistoryXml = [];

  const flushPendingHistory = () => {
    if (pendingHistoryXml.length > 0) {
      const xmlBlock = `<group_chat_history>\n${pendingHistoryXml.join("\n")}\n</group_chat_history>`;
      finalMessages.push({
        role: "user",
        content: xmlBlock,
      });
      pendingHistoryXml = [];
    }
  };

  messageChain.forEach((msg) => {
    if (msg.role === "mio_system") return;

    // 检查是否是 Agent member 本人的历史回复
    const isSelfReply =
      msg.senderMemberId === member.id ||
      (msg.role === "other" && msg.senderName === member.name);

    if (isSelfReply) {
      // 遇到本人的回复，先把之前收集的其他成员/用户发言打包输出
      flushPendingHistory();

      // 本人的回复直接复用单聊的 assistant 格式化逻辑：
      // 保留 tool_calls 与配对的 role:"tool" 结果消息、reasoning_content 独立字段，
      // 以及 tool_call 前后的分段。绝不能压成单个字符串，否则 Agent 会丢失
      // 自己调用过哪些工具、拿到了什么结果的记忆。
      // 传 Infinity 让它只做格式化、不再二次截断（与 getCrystallizationMessages 同款用法）。
      finalMessages.push(...getValidOpenaiMessage([msg], 0, Infinity));
    } else {
      // 其他成员或用户的发言：格式化为包含文本与工具调用的 XML 消息
      const senderName =
        msg.senderName ||
        msg.sender_name ||
        (msg.role === "user" ? "User" : "Member");
      const senderId =
        msg.senderMemberId ||
        msg.sender_id ||
        (msg.role === "user" ? "user" : "unknown");
      const timeText = msg.time
        ? new Date(msg.time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";

      const msgXml = formatMessageXml(msg, senderId, senderName, timeText);
      if (msgXml) {
        pendingHistoryXml.push(msgXml);
      }
    }
  });

  // 刷出尾部剩余的聊天历史
  flushPendingHistory();

  // 收尾必须是 user 轮，否则请求非法。
  //
  // 触发场景：A、B、C 依次发言且 A 在发言里 @ 了 C。为 C 组装上下文时，
  // A 和 B 的发言被打包成一个 XML user 块，紧接着 C 自己的那条以 assistant 收尾，
  // 数组最后一条就成了 assistant —— 接口会直接拒绝（不能以模型发言结尾）。
  //
  // 除了协议问题，语义上也不对：C 看到的最后一句是自己说的，
  // 像是已经回应过那个 @ 了，容易直接沉默。所以补一条明确的发言邀请。
  const lastMsg = finalMessages[finalMessages.length - 1];
  if (!lastMsg || lastMsg.role !== "user") {
    finalMessages.push({
      role: "user",
      content:
        `<group_chat_turn_notice>\n` +
        `现在轮到你（${member.name}）发言。请基于上面的群聊记录作出回应。\n` +
        `如果上文中有人 @ 了你，请优先回应对方；若讨论已经收敛、没有需要你补充的内容，简短收尾即可。\n` +
        `</group_chat_turn_notice>`,
    });
  }

  return finalMessages;
}

/** XML 转义 */
function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 格式化单个 tool_call 节点为 XML，并对参数和结果做 1000 字符长文本截断
 */
function formatToolCallXml(toolCallData, maxLen = 1000) {
  if (!toolCallData) return "";
  const name =
    toolCallData.name ||
    toolCallData.function?.name ||
    toolCallData.action ||
    "unknown_tool";

  // 1. 解析与格式化 parameters
  let rawParams =
    toolCallData.parameters ??
    toolCallData.arguments ??
    toolCallData.function?.arguments ??
    "";
  if (typeof rawParams === "object" && rawParams !== null) {
    try {
      rawParams = JSON.stringify(rawParams);
    } catch (e) {
      rawParams = String(rawParams);
    }
  } else {
    rawParams = String(rawParams || "");
  }

  let truncatedParams = rawParams.trim();
  if (truncatedParams.length > maxLen) {
    truncatedParams =
      truncatedParams.substring(0, maxLen) + "\n... (参数内容过长系统已省略)";
  }

  // 2. 解析与格式化 result / response
  let rawResult =
    toolCallData.result ??
    toolCallData.response ??
    toolCallData.output ??
    "";
  if (typeof rawResult === "object" && rawResult !== null) {
    try {
      rawResult = JSON.stringify(rawResult);
    } catch (e) {
      rawResult = String(rawResult);
    }
  } else {
    rawResult = String(rawResult || "");
  }

  let truncatedResult = rawResult.trim();
  if (truncatedResult.length > maxLen) {
    truncatedResult =
      truncatedResult.substring(0, maxLen) + "\n... (结果内容过长系统已省略)";
  }

  let xml = `    <tool_call name="${escapeXml(name)}">\n`;
  if (truncatedParams) {
    xml += `      <parameters>${escapeXml(truncatedParams)}</parameters>\n`;
  }
  if (truncatedResult) {
    xml += `      <result>${escapeXml(truncatedResult)}</result>\n`;
  }
  xml += `    </tool_call>`;

  return xml;
}

/**
 * 将整条消息（包括文本与工具调用）渲染为结构化 XML
 */
function formatMessageXml(msg, senderId, senderName, timeText) {
  if (!msg || !Array.isArray(msg.content)) return "";

  const textParts = [];
  const toolCallParts = [];

  msg.content.forEach((elm) => {
    if (elm.type === "text" && elm.data?.text) {
      textParts.push(elm.data.text);
    } else if (elm.type === "image" && elm.data?.file) {
      textParts.push(`[图片: ${elm.data.file}]`);
    } else if (elm.type === "file" && elm.data?.name) {
      textParts.push(`[文件: ${elm.data.name}]`);
    } else if (elm.type === "tool_call" && elm.data) {
      const toolXml = formatToolCallXml(elm.data, 1000);
      if (toolXml) {
        toolCallParts.push(toolXml);
      }
    }
  });

  const fullText = textParts.join("\n").trim();
  if (!fullText && toolCallParts.length === 0) return "";

  let innerXml = `  <message sender_id="${escapeXml(senderId)}" sender_name="${escapeXml(senderName)}" time="${escapeXml(timeText)}">\n`;
  if (fullText) {
    innerXml += `    <text>${escapeXml(fullText)}</text>\n`;
  }
  if (toolCallParts.length > 0) {
    innerXml += toolCallParts.join("\n") + "\n";
  }
  innerXml += `  </message>`;

  return innerXml;
}

/**
 * 收集「上一轮」发过言的 Agent 成员 ID。
 * 定义为：当前这条用户消息之前、紧邻的那一串连续 Agent 发言（往前遇到用户消息即停）。
 * 按消息链顺序判定而非完成时间 —— 多成员是并发流式的，完成顺序是竞态的。
 * @param {Object} group
 * @param {Object} currentUserMsg - 本次触发的用户消息
 * @returns {Array<string>} 去重后的成员 ID 列表
 */
function collectLastAgentRound(group, currentUserMsg) {
  const chain = group.messageChain || [];
  let idx = currentUserMsg ? chain.indexOf(currentUserMsg) : -1;
  if (idx === -1) idx = chain.length;

  const ids = new Set();
  for (let i = idx - 1; i >= 0; i--) {
    const msg = chain[i];
    if (!msg || msg.role === "mio_system") continue;
    if (msg.role === "user") break;
    if (msg.role !== "other") continue;
    const id = msg.senderMemberId || msg.sender_id;
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * 用户消息未 @ 任何人时，决定由谁接话。
 *
 * 1. 接话延续：上一轮恰好只有一个 Agent 发言时由他继续 —— 不 @ 任何人直接说话，
 *    绝大多数时候是在跟刚才那个人接着聊。零额外开销，不增加首 token 前的延迟。
 *    上一轮有多人发言时不适用：那种情况下「最后一个说话的人」只是扇出循环的末位，没有语义。
 * 2. 否则落到该群配置的默认发言人（群主 / 主持人）。它的 system prompt 自带全量成员名单
 *    与 @ 唤起规则，问题不归它管时会自然转交给对的人 —— 路由即一个正常的对话轮次。
 * 3. 都不满足时回退成员列表首位（旧行为）。
 *
 * @param {Object} group
 * @param {Object} currentUserMsg
 * @returns {Object|null} 成员对象
 */
function resolveImplicitResponder(group, currentUserMsg) {
  const members = group.members || [];
  if (members.length === 0) return null;

  const findById = (id) =>
    id
      ? members.find(
          (m) => String(m.id) === String(id) || String(m.agentId) === String(id),
        )
      : null;

  const lastRound = collectLastAgentRound(group, currentUserMsg);
  if (lastRound.length === 1) {
    const speaker = findById(lastRound[0]);
    if (speaker) return speaker;
  }

  return findById(group.defaultResponderId) || members[0];
}

/**
 * 从文本中解析出被 @ 的群成员。
 *
 * 匹配以 ID 为准，绝不用 text.includes(`@${name}`) 这种子串判断 ——
 * 成员叫「小明」和「小明助手」时，@小明助手 会把两个人都唤起。
 *
 * 支持两种写法：
 *  1. 规范式 @'名字'(ID) / @{名字}(ID) —— Agent 互相唤起、以及输入框 @ 徽标产出的格式，
 *     以括号里的 ID 为准，ID 解析不到才回落到名字全等。
 *  2. 裸写 @名字 —— 用户手打的情况。要求整名匹配且右侧是边界，
 *     并按名字长度倒序匹配，保证长名优先、短名不会被顺带命中。
 *
 * @param {string} text
 * @param {Array<Object>} members
 * @returns {Array<Object>} 命中的成员（去重，保持 members 中的对象引用）
 */
export function resolveMentionedMembers(text, members) {
  const found = new Map();
  if (!text || !Array.isArray(members) || members.length === 0) return [];

  // 已被规范式消费掉的片段替换为空格，避免裸名匹配二次命中同一处
  let rest = text;

  const QUOTE = "['‘’]";
  const regex = new RegExp(
    `@(?:${QUOTE}([^'‘’]+)${QUOTE}|\\{([^}]+)\\})(?:\\(([^)]+)\\))?`,
    "g",
  );
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1] || match[2];
    const id = match[3];

    let hit = null;
    if (id) {
      hit = members.find(
        (m) => String(m.id) === String(id) || String(m.agentId) === String(id),
      );
    }
    if (!hit && name) {
      hit = members.find((m) => m.name === name);
    }
    if (hit) found.set(hit.id, hit);

    rest = rest.replace(match[0], " ".repeat(match[0].length));
  }

  // 裸 @名字：长名优先
  const byLengthDesc = [...members].sort(
    (a, b) => (b.name || "").length - (a.name || "").length,
  );
  for (const member of byLengthDesc) {
    const name = member.name;
    if (!name || found.has(member.id)) continue;

    let idx = rest.indexOf(`@${name}`);
    while (idx !== -1) {
      const after = rest.charAt(idx + 1 + name.length);
      // 右边界为空（结尾）、空白或常见标点才算完整的一次 @；
      // 否则说明它只是某个更长名字的前缀，跳过。
      if (after === "" || /[\s,，.。!！?？:：;；、)）\]】"'"']/.test(after)) {
        found.set(member.id, member);
        rest =
          rest.slice(0, idx) +
          " ".repeat(name.length + 1) +
          rest.slice(idx + 1 + name.length);
        break;
      }
      idx = rest.indexOf(`@${name}`, idx + 1);
    }
  }

  return [...found.values()];
}

/**
 * 在群聊中路由并触发 Agent 响应
 * @param {Object} group
 * @param {string} assistantMsgId - 主占位消息 ID
 * @param {string} targetMemberId - 指定唤醒的成员 ID (可选)
 */
export async function sendGroupCompletions(group, assistantMsgId, targetMemberId = null) {
  if (!group || !group.members || group.members.length === 0) {
    throw new Error("群聊中暂无可用成员");
  }

  // 决定唤醒哪些成员
  let targetMembers = [];

  if (targetMemberId) {
    const found = group.members.find((m) => m.id === targetMemberId);
    if (found) targetMembers = [found];
  }

  if (targetMembers.length === 0) {
    // 检查最新一条用户消息中是否带有 @ 提及
    const lastUserMsg = [...group.messageChain]
      .reverse()
      .find((m) => m.role === "user");

    const text = extractMessageText(lastUserMsg);

    if (text.includes("@全体成员") || text.includes("@All")) {
      targetMembers = [...group.members];
    } else {
      // 检查匹配的名字 @AgentName
      const matched = resolveMentionedMembers(text, group.members);
      if (matched.length > 0) {
        targetMembers = matched;
      } else {
        // 未 @ 任何人：接话延续，冷启动落到默认发言人
        const responder = resolveImplicitResponder(group, lastUserMsg);
        if (responder) targetMembers = [responder];
      }
    }
  }

  // 用户通过 / 或 # 指定了工具/技能时，替本轮要发言的成员把它开上。
  // 群成员的工具配置是各自独立的，被 @ 的人如果没开这个技能就用不了，
  // 用户还得先去成员设置里手动勾选 —— 这里直接补上。
  const lastUserMsg = [...(group.messageChain || [])]
    .reverse()
    .find((m) => m.role === "user");
  const requestedTools = (lastUserMsg?.content || [])
    .filter((c) => c.type === "prompt_hint" && Array.isArray(c.data?.enableTools))
    .flatMap((c) => c.data.enableTools);

  if (requestedTools.length > 0) {
    let changed = false;
    targetMembers.forEach((m) => {
      if (!m.options) m.options = {};
      if (!m.options.toolCallSettings) m.options.toolCallSettings = {};
      if (!Array.isArray(m.options.toolCallSettings.tools)) {
        m.options.toolCallSettings.tools = [];
      }
      requestedTools.forEach((name) => {
        if (!m.options.toolCallSettings.tools.includes(name)) {
          m.options.toolCallSettings.tools.push(name);
          changed = true;
        }
      });
    });
    if (changed) client.setLocalStorage();
  }

  if (!client.socket || typeof client.socket.streamCompletions !== "function") {
    throw new Error("Socket 未就绪或未建立连接，请确认 Socket 服务状态");
  }

  // 为被唤醒的每个成员触发独立的流式生成
  for (let i = 0; i < targetMembers.length; i++) {
    const member = targetMembers[i];
    let msgId = assistantMsgId;

    if (i > 0) {
      msgId = numberString(16);
      group.messageChain.push({
        id: msgId,
        role: "other",
        status: "pending",
        time: Date.now(),
        content: [{ type: "blank", data: {} }],
        sender_id: member.id,
        sender_name: member.name,
        sender_avatar: member.avatar,
        senderMemberId: member.id,
        senderName: member.name,
        senderAvatar: member.avatar,
      });
    } else {
      const placeholder = group.messageChain.find((m) => m.id === assistantMsgId);
      if (placeholder) {
        placeholder.sender_id = member.id;
        placeholder.sender_name = member.name;
        placeholder.sender_avatar = member.avatar;
        placeholder.senderMemberId = member.id;
        placeholder.senderName = member.name;
        placeholder.senderAvatar = member.avatar;
      }
    }

    const finalMessages = formatGroupMessagesForMember(group, member);

    const metaData = {
      contactorId: group.id,
      messageId: msgId,
      memberId: member.id,
      memberName: member.name,
      memberAvatar: member.avatar,
    };

    // 水位线由前端下发（后端只管推理）。群聊里每个成员的结晶进度独立，
    // 因此参数必须逐成员组装，不能共用群级配置。
    const options = member.options || {};
    const memberCrystal = options.crystallization;
    const settings = { ...options };

    // 群聊结晶恒开，无条件下发水位线参数
    settings.crystallization_token_watermark =
      memberCrystal?.tokenWatermark || 200000;
    settings.previous_summary = memberCrystal?.latestSummary || "";
    settings.crystallization_keep_turns = 1;
    // opening 已经并进 system message（见 formatGroupMessagesForMember），
    // 这里清掉避免后端重复注入人格
    if (settings.presetSettings) {
      settings.presetSettings = { ...settings.presetSettings, opening: "" };
    }

    const data = {
      settings,
      messages: finalMessages,
    };

    console.log(`🚀 [groupGateway] 正在触发群成员 [${member.name}] 响应:`, data);
    client.socket.streamCompletions(data, metaData);
  }
}

/**
 * 本轮（自最近一条用户消息起）是否已经提示过连锁唤起到顶。
 * 多条支线同时到达深度上限时，只提醒一次。
 * @param {Object} group
 * @returns {boolean}
 */
function hasPendingDepthWarning(group) {
  const chain = group.messageChain || [];
  for (let i = chain.length - 1; i >= 0; i--) {
    const msg = chain[i];
    if (!msg) continue;
    if (msg.role === "user") return false;
    if (msg.role === "mio_system" && msg.isInvocationLimit) return true;
  }
  return false;
}

/**
 * 检查并触发 Agent 互相唤起/连锁唤起
 * @param {Object} group
 * @param {Object} message
 */
export function checkAndTriggerAgentInvocation(group, message) {
  if (
    !group ||
    group.platform !== "group" ||
    !message ||
    message.status !== "completed"
  ) {
    return;
  }

  const text = extractMessageText(message, false);
  if (!text || !text.includes("@")) return;

  // 与用户侧 @ 路由共用同一套解析（以 ID 为准），避免两边口径不一致
  const targetMemberIds = new Set();
  resolveMentionedMembers(text, group.members || []).forEach((found) => {
    if (
      !found.isUser &&
      found.id !== message.sender_id &&
      found.id !== message.senderMemberId
    ) {
      targetMemberIds.add(found.id);
    }
  });

  if (targetMemberIds.size === 0) return;

  const maxDepth =
    group.maxInvocationDepth !== undefined ? Number(group.maxInvocationDepth) : 5;

  if (maxDepth <= 0) {
    console.log("ℹ️ [groupGateway] 当前群聊已禁用 Agent 连锁唤起(0轮)");
    return;
  }

  // 深度记在消息上，而不是记在群上：每条被唤起的消息继承「触发它的那条消息的深度 + 1」。
  // 这样同时唤起多个成员时每条支线独立计数，一条到顶不会连累另一条，
  // 也不需要任何「回合结束」式的重置 —— 用户新发的消息本就没有 invocationDepth，天然从 0 起算。
  const currentDepth = Number(message.invocationDepth) || 0;

  if (currentDepth >= maxDepth) {
    console.warn(
      `⚠️ [groupGateway] 达到当前群聊设置的 Agent 互相唤起最大深度上限(${maxDepth}轮)，终止链式唤起`
    );
    // 本轮内只提醒一次：多条支线同时到顶时不重复刷屏
    if (!hasPendingDepthWarning(group)) {
      const contactorsStore = useContactorsStore();
      contactorsStore.insertSystemMessage(
        group.id,
        `已达到本群设定的 Agent 连锁唤起上限（${maxDepth} 轮），后续的 @ 唤起已自动停止。继续发言或 @ 指定成员即可重新开始。`,
        { isInvocationLimit: true }
      );
    }
    return;
  }

  const nextDepth = currentDepth + 1;

  setTimeout(() => {
    // 重新从 Pinia store 取响应式对象，确保 push 能触发 Vue 响应式更新
    const contactorsStore = useContactorsStore();
    const reactiveGroup = contactorsStore.contactors[group.id];
    if (!reactiveGroup) return;

    targetMemberIds.forEach((targetId) => {
      const member = reactiveGroup.members?.find((m) => m.id === targetId);
      if (!member) return;

      // 先立即写入 pending 占位气泡，让 UI 马上呈现预热状态
      const assistantMsgId = numberString(16);
      reactiveGroup.messageChain.push({
        id: assistantMsgId,
        role: "other",
        status: "pending",
        time: Date.now(),
        content: [{ type: "blank", data: {} }],
        sender_id: member.id,
        sender_name: member.name,
        sender_avatar: member.avatar,
        senderMemberId: member.id,
        senderName: member.name,
        senderAvatar: member.avatar,
        invocationDepth: nextDepth,
      });

      sendGroupCompletions(reactiveGroup, assistantMsgId, targetId).catch((err) => {
        console.error("❌ [groupGateway] 链式唤起 Agent 失败:", err);
      });
    });
  }, 200);
}
