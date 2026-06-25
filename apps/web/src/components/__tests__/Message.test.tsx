import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Message } from '../Message'
import type { ChatMessage } from '../../types/chat'

const userMessage: ChatMessage = {
  id: 'msg-1',
  role: 'user',
  content: 'Luật này quy định gì?',
  createdAt: Date.now(),
}

const assistantMessage: ChatMessage = {
  id: 'msg-2',
  role: 'assistant',
  content: 'Luật quy định về tổ chức Chính phủ.',
  createdAt: Date.now(),
  citations: [
    { tag: 'C1', title: 'Điều 1', url: 'http://example.com' },
  ],
}

describe('Message', () => {
  it('renders user message content', () => {
    render(
      <Message
        message={userMessage}
        isCitationsOpen={false}
        onToggleCitations={vi.fn()}
      />
    )
    expect(screen.getByText('Luật này quy định gì?')).toBeInTheDocument()
  })

  it('renders assistant message with citations button', () => {
    render(
      <Message
        message={assistantMessage}
        isCitationsOpen={false}
        onToggleCitations={vi.fn()}
      />
    )
    expect(screen.getByText('Luật quy định về tổ chức Chính phủ.')).toBeInTheDocument()
    expect(screen.getByText(/trích dẫn/i)).toBeInTheDocument()
  })

  it('shows citation panel when open', () => {
    render(
      <Message
        message={assistantMessage}
        isCitationsOpen={true}
        onToggleCitations={vi.fn()}
      />
    )
    expect(screen.getByText('[C1]')).toBeInTheDocument()
  })
})
