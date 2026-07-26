/**
 * agentMentionPlugin — markdown-it 插件
 * 
 * 参考 alertPlugin.ts 的实现：函数签名 (md) => void，直接操作 md.renderer.rules
 * 
 * 在 markdown-it 文本 token 渲染阶段，将
 *   @'名称'(id) 或 @'名称'(id)（直/弯引号）或 @{名称}(id)
 * 输出为高亮 HTML span，隐藏括号内的 id。
 * 
 * 注意：非匹配的文本段必须调用 md.utils.escapeHtml，否则 < > & 等字符会出错。
 */
export function agentMentionPlugin(md) {
  // 匹配直引号 ' (U+0027) 和弯引号 ' (U+2018) / ' (U+2019)
  const MENTION_RE = /@(?:['\u2018\u2019]([^'\u2018\u2019]+)['\u2018\u2019]|\{([^}]+)\})(?:\([^)]*\))?/g;

  md.renderer.rules.text = function (tokens, idx) {
    const content = tokens[idx].content;

    // 快速路径：无 @ 直接转义返回
    if (!content || !content.includes("@")) {
      return md.utils.escapeHtml(content);
    }

    // 先测试是否有匹配
    MENTION_RE.lastIndex = 0;
    if (!MENTION_RE.test(content)) {
      return md.utils.escapeHtml(content);
    }

    // 逐段处理：非匹配段 escapeHtml，匹配段输出 badge span
    MENTION_RE.lastIndex = 0;
    let result = "";
    let lastIndex = 0;
    let match;

    while ((match = MENTION_RE.exec(content)) !== null) {
      // 匹配前的普通文本，必须 escape
      if (match.index > lastIndex) {
        result += md.utils.escapeHtml(content.slice(lastIndex, match.index));
      }
      const name = match[1] || match[2];
      if (name) {
        result += `<span class="command-badge mention-badge">@${md.utils.escapeHtml(name)}</span>`;
      } else {
        result += md.utils.escapeHtml(match[0]);
      }
      lastIndex = MENTION_RE.lastIndex;
    }

    // 末尾剩余文本
    if (lastIndex < content.length) {
      result += md.utils.escapeHtml(content.slice(lastIndex));
    }

    return result;
  };
}
