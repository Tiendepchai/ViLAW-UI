import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, Conversation, Citation } from '../types/chat'
import { ask, askStream } from '../api/ask'
import { loadConversations, saveConversations } from '../lib/storage'

function makeEmptyConversation(): Conversation {
  const now = Date.now()
  return {
    id: uuidv4(),
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
}

function inferTitle(messages: ChatMessage[]) {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'New chat'
  const t = firstUser.content.trim().replace(/\s+/g, ' ')
  return t.length > 48 ? t.slice(0, 48) + '…' : t
}

export interface ChatState {
  conversations: Conversation[]
  activeId: string | null
  loading: boolean
  streaming: boolean
  streamingContent: string
  toast: string | null
  openCites: Record<string, boolean>

  init: () => Promise<void>
  selectConversation: (id: string) => void
  newChat: () => Promise<void>
  deleteActive: () => Promise<void>
  send: (text: string) => Promise<void>
  setToast: (msg: string | null) => void
  toggleCitations: (messageId: string) => void
  exportAll: () => void
  importFile: (file: File) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeId: null,
  loading: false,
  streaming: false,
  streamingContent: '',
  toast: null,
  openCites: {},

  init: async () => {
    try {
      const convs = await loadConversations()
      set({ conversations: convs, activeId: convs[0]?.id ?? null })
    } catch (e: unknown) {
      set({ toast: (e as Error)?.message ?? 'Không thể tải hội thoại' })
    }
  },

  selectConversation: (id: string) => set({ activeId: id }),

  newChat: async () => {
    const c = makeEmptyConversation()
    const next = [c, ...get().conversations]
    set({ conversations: next, activeId: c.id })
    try { await saveConversations(next) } catch { /* ignore */ }
  },

  deleteActive: async () => {
    const { activeId, conversations } = get()
    if (!activeId) return
    const next = conversations.filter((c) => c.id !== activeId)
    set({ conversations: next, activeId: next[0]?.id ?? null })
    try { await saveConversations(next) } catch { /* ignore */ }
  },

  send: async (text: string) => {
    const { activeId, conversations } = get()
    if (!activeId) return
    const active = conversations.find((c) => c.id === activeId)
    if (!active) return

    set({ loading: true, streaming: true, streamingContent: '' })

    const now = Date.now()
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: text, createdAt: now }
    const assistantMsg: ChatMessage = { id: uuidv4(), role: 'assistant', content: '', createdAt: 0 }

    const withUser = conversations.map((c) =>
      c.id === activeId
        ? {
            ...c,
            messages: [...c.messages, userMsg, assistantMsg],
            updatedAt: now,
            title: inferTitle([...c.messages, userMsg]),
          }
        : c
    )
    set({ conversations: withUser })
    try { await saveConversations(withUser) } catch { /* ignore */ }

    // Try streaming first, fall back to regular ask
    let usedStream = false
    const streamPromise = askStream(
      text,
      {
        onToken: (token: string) => {
          usedStream = true
          set((s) => ({ streamingContent: s.streamingContent + token }))
        },
        onCitations: (citations: Citation[]) => {
          // Store citations for the final message
          const msgId = assistantMsg.id
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === activeId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === msgId ? { ...m, citations } : m
                    ),
                  }
                : c
            ),
          }))
        },
        onDone: () => {
          // Finalize the assistant message with accumulated content
          const finalContent = get().streamingContent
          const finalCitations = (() => {
            const msgs = get().conversations.find((c) => c.id === activeId)?.messages ?? []
            const am = msgs.find((m) => m.id === assistantMsg.id)
            return am?.citations
          })()

          const filled: ChatMessage = {
            id: assistantMsg.id,
            role: 'assistant',
            content: finalContent,
            createdAt: Date.now(),
            citations: finalCitations ?? [],
          }

          set((s) => ({
            loading: false,
            streaming: false,
            streamingContent: '',
            conversations: s.conversations.map((c) =>
              c.id === activeId
                ? {
                    ...c,
                    messages: c.messages.map((m) => (m.id === assistantMsg.id ? filled : m)),
                    updatedAt: Date.now(),
                  }
                : c
            ),
          }))
          saveConversations(get().conversations).catch(() => {})
        },
        onError: (error: string) => {
          // If stream connection failed, fallback to regular ask
          if (!usedStream) {
            doRegularAsk(text, userMsg, assistantMsg)
          } else {
            set((s) => ({
              loading: false,
              streaming: false,
              streamingContent: '',
              toast: error,
            }))
          }
        },
      },
    )

    // Race: if streaming doesn't produce first token within 3s, fallback
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('stream_timeout')), 3000)
    )

    try {
      await Promise.race([streamPromise, timeout])
      // Wait for stream to finish if it started
      if (usedStream) {
        await streamPromise
      }
    } catch {
      if (!usedStream) {
        doRegularAsk(text, userMsg, assistantMsg)
      }
    }
  },

  setToast: (msg: string | null) => set({ toast: msg }),

  toggleCitations: (messageId: string) => {
    set((s) => ({ openCites: { ...s.openCites, [messageId]: !s.openCites[messageId] } }))
  },

  exportAll: () => {
    const blob = new Blob([JSON.stringify(get().conversations, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversations_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    set({ toast: 'Đã export JSON' })
  },

  importFile: async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('JSON phải là một mảng Conversation[]')
      const convs = data as Conversation[]
      set({ conversations: convs, activeId: convs[0]?.id ?? null })
      try { await saveConversations(convs) } catch { /* ignore */ }
      set({ toast: 'Đã import JSON' })
    } catch (err) {
      set({ toast: (err as Error)?.message ?? 'Import thất bại' })
    }
  },
}))

// Fallback regular ask function
async function doRegularAsk(text: string, userMsg: ChatMessage, assistantMsg: ChatMessage) {
  const store = useChatStore.getState()
  const { activeId } = store
  if (!activeId) return

  setImmediate(() => {
    useChatStore.setState({ streaming: false })
  })

  try {
    const res = await ask(text, { conversation_id: activeId })
    const filled: ChatMessage = {
      id: assistantMsg.id,
      role: 'assistant',
      content: res.answer ?? '',
      createdAt: Date.now(),
      citations: res.citations ?? [],
    }

    useChatStore.setState((s) => ({
      loading: false,
      streamingContent: '',
      conversations: s.conversations.map((c) =>
        c.id === activeId
          ? { ...c, messages: c.messages.map((m) => (m.id === assistantMsg.id ? filled : m)), updatedAt: Date.now() }
          : c
      ),
    }))
    await saveConversations(useChatStore.getState().conversations)
  } catch (e) {
    const errMsg = (e as Error)?.message ?? 'Lỗi gọi API'
    useChatStore.setState({
      loading: false,
      toast: errMsg,
      conversations: useChatStore.getState().conversations.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: `⚠️ ${errMsg}`, createdAt: Date.now() }
                  : m
              ),
              updatedAt: Date.now(),
            }
          : c
      ),
    })
  }
}
