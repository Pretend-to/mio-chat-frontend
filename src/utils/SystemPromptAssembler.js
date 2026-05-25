/**
 * SystemPromptAssembler - 前端系统 Prompt 组装工具
 *
 * 职责：
 * 1. 将全局人格 prompt 与 <memory_crystal> XML 合并为唯一的 system message
 * 2. 解析 latestSummary XML 字符串为 5 个区块的对象（用于 MemoryManager 展示）
 * 3. 从 5 个区块重新组合为 XML 字符串（用于 MemoryManager 编辑后回写）
 */

// 结晶的 5 个分区标签
export const CRYSTAL_ZONES = [
  { key: 'long_term_profile', label: '用户画像', icon: '👤' },
  { key: 'short_term_goals', label: '短期目标', icon: '🎯' },
  { key: 'current_plan', label: '运行计划', icon: '📋' },
  { key: 'file_architecture_delta', label: '文件变更', icon: '📁' },
  { key: 'constraints', label: '开发约束', icon: '🔒' },
]

/**
 * 将联系人的系统 prompt 与结晶数据组装为单条 system message 内容
 *
 * @param {string} baseSystemPrompt - 联系人原始的系统 prompt（全局人格）
 * @param {string|null} latestSummary - 最近的结晶 XML 字符串（或 null/空字符串）
 * @returns {string} 组装好的单条 system message 内容
 */
export function assembleSystemPrompt(baseSystemPrompt, latestSummary) {
  const hasCrystal = latestSummary && latestSummary.trim().length > 0

  if (!hasCrystal) {
    // 即使没有结晶内容，也注入空模板，让后端有准备压缩的基础
    if (!baseSystemPrompt) return ''
    return baseSystemPrompt
  }

  const parts = []
  if (baseSystemPrompt && baseSystemPrompt.trim()) {
    parts.push(baseSystemPrompt.trim())
  }
  parts.push(`<memory_crystal>\n${latestSummary.trim()}\n</memory_crystal>`)

  return parts.join('\n\n')
}

/**
 * 解析 latestSummary XML 字符串为各区块的文本内容对象
 *
 * @param {string} xmlStr - XML 结晶字符串
 * @returns {Record<string, string>} 键为 tagName，值为区块文本内容
 */
export function parseXmlZones(xmlStr) {
  const result = {}
  if (!xmlStr) {
    CRYSTAL_ZONES.forEach(z => { result[z.key] = '' })
    return result
  }

  CRYSTAL_ZONES.forEach(({ key }) => {
    const openTag = `<${key}>`
    const closeTag = `</${key}>`
    const startIdx = xmlStr.indexOf(openTag)
    const endIdx = xmlStr.indexOf(closeTag)
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      result[key] = xmlStr.slice(startIdx + openTag.length, endIdx).trim()
    } else {
      result[key] = ''
    }
  })
  return result
}

/**
 * 将各区块文本内容重新组合为 XML 结晶字符串
 *
 * @param {Record<string, string>} zones - 键为 tagName，值为区块文本
 * @returns {string} 完整的 XML 结晶字符串
 */
export function buildXmlFromZones(zones) {
  return CRYSTAL_ZONES.map(({ key }) => {
    const content = (zones[key] || '').trim()
    return `<${key}>\n${content}\n</${key}>`
  }).join('\n\n')
}

export default {
  assembleSystemPrompt,
  parseXmlZones,
  buildXmlFromZones,
  CRYSTAL_ZONES,
}
