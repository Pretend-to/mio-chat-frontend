function fileNameFromUrl(url) {
  try {
    const query = String(url || '').split('?')[1] || ''
    return new URLSearchParams(query).get('name') || 'file'
  } catch {
    return 'file'
  }
}

/**
 * Collect standalone uploads immediately preceding the current Agent text as
 * one logical turn. A non-user message is the turn boundary.
 */
export function collectAgentTurnPayload(messagesChain = []) {
  let lastUserIndex = -1
  for (let index = messagesChain.length - 1; index >= 0; index -= 1) {
    if (messagesChain[index]?.role === 'user') {
      lastUserIndex = index
      break
    }
  }
  if (lastUserIndex < 0) {
    return { files: [], images: [], lastUserMsg: null, text: '' }
  }

  let turnStart = lastUserIndex
  while (turnStart > 0 && messagesChain[turnStart - 1]?.role === 'user') {
    turnStart -= 1
  }
  const turnMessages = messagesChain.slice(turnStart, lastUserIndex + 1)
  const lastUserMsg = messagesChain[lastUserIndex]
  const text =
    lastUserMsg?.content?.find((content) => content.type === 'text')?.data
      ?.text ||
    lastUserMsg?.text ||
    ''
  const images = []
  const files = []
  const seenImages = new Set()
  const seenFiles = new Set()

  for (const message of turnMessages) {
    if (!Array.isArray(message?.content) || message.status === 'failed') {
      continue
    }
    for (const content of message.content) {
      if (content.type === 'image') {
        const url = content.data?.file || content.data?.url
        if (url && !seenImages.has(url)) {
          seenImages.add(url)
          images.push(url)
        }
      }
      if (content.type === 'file') {
        const url = content.data?.file || content.data?.url
        if (url && !seenFiles.has(url)) {
          seenFiles.add(url)
          files.push({
            name: content.data?.name || fileNameFromUrl(url),
            url,
          })
        }
      }
    }
  }

  return { files, images, lastUserMsg, text }
}

export default collectAgentTurnPayload
