import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, Conversation } from '../types/chat'
import { ask } from '../lib/api'
import { loadConversations, saveConversations } from '../lib/storage'

function fmtTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

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
  // citations open state per message id
  openCites: Record<string, boolean>
  fileInputRef: React.RefObject<HTMLInputElement | null> | null

  // Actions
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
      const convs = loadConversations instanceof Function
        ? await loadConversations()
        : []
      set({ conversations: convs, activeId: convs[0]?.id ?? null })
    } catch (e: any) {
      set({ toast: e?.message ?? 'Không thể tải hội thoại' })
    }
  },

  selectConversation: (id: string) => {
    set({ activeId: id })
  },

  newChat: async () => {
    const c = makeEmptyConversation()
    const next = [c, ...get().conversations]
    set({ conversations: next, activeId: c.id })
    try { await saveConversations(next) } catch (e: any) { set({ toast: e?.message ?? 'Lỗi lưu' }) }
  },

  deleteActive: async () => {
    const { activeId, conversations } = get()
    if (!activeId) return
    const next = conversations.filter((c) => c.id !== activeId)
    set({ conversations: next, activeId: next[0]?.id ?? null })
    try { await saveConversations(next) } catch (e: any) { set({ toast: e?.message ?? 'Lỗi lưu' }) }
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
        ? { ...c, messages: [...c.messages, userMsg, assistantMsg], updatedAt: now, title: inferTitle([...c.messages, userMsg]) }
        : c
    )
    set({ conversations: withUser })
    try { await saveConversations(withUser) } catch { /* ignore */ }

    try {
      const res = await ask(text, { conversation_id: activeId })
      set({ streaming: false, loading: false, streamingContent: '' })

      const filled: ChatMessage = {
        id: assistantMsg.id,
        role: 'assistant',
        content: res.answer ?? '',
        createdAt: Date.now(),
        citations: res.citations ?? [],
      }

      const withAssistant = get().conversations.map((c) =>
        c.id === activeId
          ? { ...c, messages: c.messages.map((m) => (m.id === assistantMsg.id ? filled : m)), updatedAt: Date.now() }
          : c
      )
      set({ conversations: withAssistant })
      try { await saveConversations(withAssistant) } catch (e: any) { set({ toast: e?.message ?? 'Lỗi lưu' }) }
    } catch (e: any) {
      set({ streaming: false, loading: false, streamingContent: '' })
      const errMsg = e?.message ?? 'Lỗi gọi API'
      const errAssistant: ChatMessage = {
        id: assistantMsg.id,
        role: 'assistant',
        content: `⚠️ ${errMsg}`,
        createdAt: Date.now(),
      }
      const withError = get().conversations.map((c) =>
        c.id === activeId
          ? { ...c, messages: c.messages.map((m) => (m.id === assistantMsg.id ? errAssistant : m)), updatedAt: Date.now() }
          : c
      )
      set({ conversations: withError, toast: errMsg })
      try { await saveConversations(withError) } catch { /* ignore */ }
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
    } catch (err: any) {
      set({ toast: err?.message ?? 'Import thất bại' })
    }
  },
}))
