import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore } from '../chatStore'

// Mock storage
vi.mock('../../lib/storage', () => ({
  loadConversations: vi.fn().mockResolvedValue([]),
  saveConversations: vi.fn().mockResolvedValue(undefined),
}))

describe('chatStore', () => {
  beforeEach(() => {
    // Reset store state
    useChatStore.setState({
      conversations: [],
      activeId: null,
      loading: false,
      streaming: false,
      streamingContent: '',
      toast: null,
      openCites: {},
    })
  })

  it('starts with empty state', () => {
    const state = useChatStore.getState()
    expect(state.conversations).toEqual([])
    expect(state.activeId).toBeNull()
  })

  it('newChat adds a conversation', async () => {
    await useChatStore.getState().newChat()
    const state = useChatStore.getState()
    expect(state.conversations).toHaveLength(1)
    expect(state.activeId).toBe(state.conversations[0].id)
    expect(state.conversations[0].title).toBe('New chat')
  })

  it('selectConversation sets activeId', () => {
    useChatStore.getState().selectConversation('test-id')
    expect(useChatStore.getState().activeId).toBe('test-id')
  })

  it('deleteActive removes conversation', async () => {
    await useChatStore.getState().newChat()
    const { activeId } = useChatStore.getState()
    expect(activeId).not.toBeNull()

    await useChatStore.getState().deleteActive()
    expect(useChatStore.getState().conversations).toHaveLength(0)
    expect(useChatStore.getState().activeId).toBeNull()
  })

  it('toggleCitations toggles message open state', () => {
    useChatStore.getState().toggleCitations('msg-1')
    expect(useChatStore.getState().openCites['msg-1']).toBe(true)

    useChatStore.getState().toggleCitations('msg-1')
    expect(useChatStore.getState().openCites['msg-1']).toBe(false)
  })

  it('setToast updates toast message', () => {
    useChatStore.getState().setToast('Test error')
    expect(useChatStore.getState().toast).toBe('Test error')

    useChatStore.getState().setToast(null)
    expect(useChatStore.getState().toast).toBeNull()
  })
})
