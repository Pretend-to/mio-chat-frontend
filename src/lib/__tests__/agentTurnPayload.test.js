import { describe, expect, it } from 'vitest'

import { collectAgentTurnPayload } from '../agentTurnPayload.js'

describe('collectAgentTurnPayload', () => {
  it('carries standalone uploaded documents into the following Agent text turn', () => {
    const payload = collectAgentTurnPayload([
      {
        content: [
          {
            data: {
              file: '/uploaded/file/course.docx?size=120&name=%E8%AF%BE%E7%A8%8B.docx',
            },
            type: 'file',
          },
        ],
        role: 'user',
        status: 'completed',
      },
      {
        content: [{ data: { text: '这个是啥' }, type: 'text' }],
        id: 'user-text',
        role: 'user',
      },
      { id: 'assistant-placeholder', role: 'other', status: 'pending' },
    ])

    expect(payload.text).toBe('这个是啥')
    expect(payload.lastUserMsg.id).toBe('user-text')
    expect(payload.files).toEqual([
      {
        name: '课程.docx',
        url: '/uploaded/file/course.docx?size=120&name=%E8%AF%BE%E7%A8%8B.docx',
      },
    ])
  })

  it('does not carry attachments across an assistant turn', () => {
    const payload = collectAgentTurnPayload([
      {
        content: [{ data: { file: '/old.pdf' }, type: 'file' }],
        role: 'user',
      },
      { content: [], role: 'other', status: 'completed' },
      {
        content: [{ data: { text: '新问题' }, type: 'text' }],
        role: 'user',
      },
    ])

    expect(payload.files).toEqual([])
  })
})
