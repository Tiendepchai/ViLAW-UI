import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Composer } from '../Composer'

// Mock zustand store
vi.mock('../../stores/chatStore', () => ({
  useChatStore: vi.fn((selector) =>
    selector({
      activeId: 'conv-1',
      loading: false,
      send: vi.fn(),
    })
  ),
}))

describe('Composer', () => {
  it('renders textarea and send button', () => {
    render(<Composer />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gửi/i })).toBeInTheDocument()
  })

  it('send button is disabled when textarea is empty', () => {
    render(<Composer />)
    const btn = screen.getByRole('button', { name: /gửi/i })
    expect(btn).toBeDisabled()
  })

  it('send button is disabled when no active conversation', () => {
    vi.mocked(require('../../stores/chatStore').useChatStore).mockImplementation(
      (selector: any) =>
        selector({ activeId: null, loading: false, send: vi.fn() })
    )
    render(<Composer />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
