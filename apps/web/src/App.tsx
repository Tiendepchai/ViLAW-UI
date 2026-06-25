import React, { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ReactMarkdown from 'react-markdown'

import type { ChatMessage, Conversation } from './types/chat'
import { ask } from './lib/api'
import { exportJson, importJsonFile, loadConversations, saveConversations } from './lib/storage'

function fmtTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
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

type CitationLike = any

function getCitationTag(c: CitationLike, idx: number) {
  return String(c?.tag ?? c?.id ?? `C${idx + 1}`)
}

function getCitationTitle(c: CitationLike) {
  return String(c?.title ?? c?.meta?.tieu_de_dieu ?? c?.meta?.so_dieu ?? c?.meta?.id ?? 'Trích dẫn')
}

function getCitationUrl(c: CitationLike) {
  return c?.url ? String(c.url) : ''
}

function getCitationText(c: CitationLike) {
  // try common keys
  return (
    c?.text ??
    c?.content ??
    c?.noi_dung ??
    c?.meta?.noi_dung ??
    c?.snippet ??
    c?.passage ??
    ''
  )
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // citation dropdown open state per message id
  const [openCites, setOpenCites] = useState<Record<string, boolean>>({})

  const fileRef = useRef<HTMLInputElement | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // stick-to-bottom behavior: only auto-scroll when user is already near bottom
  const [stickToBottom, setStickToBottom] = useState(true)
  const stickRef = useRef(true)
  useEffect(() => {
    stickRef.current = stickToBottom
  }, [stickToBottom])

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  )

  useEffect(() => {
    ;(async () => {
      try {
        const convs = await loadConversations()
        setConversations(convs)
        setActiveId(convs[0]?.id ?? null)
      } catch (e: any) {
        setToast(e?.message ?? 'Không thể tải hội thoại')
      }
    })()
  }, [])

  // track scrolling position
  useEffect(() => {
    const el = chatRef.current
    if (!el) return

    const onScroll = () => {
      const threshold = 140
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      setStickToBottom(dist < threshold)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // auto-scroll only when already near bottom
  useEffect(() => {
    if (!stickRef.current) return
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [active?.messages.length])

  async function persist(next: Conversation[]) {
    setConversations(next)
    try {
      await saveConversations(next)
    } catch (e: any) {
      setToast(e?.message ?? 'Không thể lưu hội thoại')
    }
  }

  async function onNewChat() {
    const c = makeEmptyConversation()
    const next = [c, ...conversations]
    await persist(next)
    setActiveId(c.id)
  }

  async function onDeleteActive() {
    if (!activeId) return
    const next = conversations.filter((c) => c.id !== activeId)
    await persist(next)
    setActiveId(next[0]?.id ?? null)
  }

  async function onExportAll() {
    exportJson(conversations)
    setToast('Đã export JSON')
  }

  async function onImportClick() {
    fileRef.current?.click()
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const convs = await importJsonFile(file)
      await persist(convs)
      setActiveId(convs[0]?.id ?? null)
      setToast('Đã import JSON')
    } catch (err: any) {
      setToast(err?.message ?? 'Import thất bại')
    } finally {
      e.target.value = ''
    }
  }

  function toggleCitations(messageId: string) {
    setOpenCites((prev) => ({ ...prev, [messageId]: !prev[messageId] }))
    // keep bottom in view if user is at bottom
    requestAnimationFrame(() => {
      if (stickRef.current) chatEndRef.current?.scrollIntoView({ block: 'end' })
    })
  }

  async function send() {
    if (!active) return
    const text = draft.trim()
    if (!text) return

    setDraft('')
    setLoading(true)

    const now = Date.now()
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: text, createdAt: now }

    const withUser = conversations.map((c) =>
      c.id === active.id
        ? {
            ...c,
            messages: [...c.messages, userMsg],
            updatedAt: now,
            title: inferTitle([...c.messages, userMsg]),
          }
        : c
    )
    await persist(withUser)

    try {
      const res = await ask(text, { conversation_id: active.id })
      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: res.answer ?? '',
        createdAt: Date.now(),
        citations: res.citations ?? [],
      }

      const withAssistant = withUser.map((c) =>
        c.id === active.id
          ? {
              ...c,
              messages: [...c.messages, assistantMsg],
              updatedAt: Date.now(),
            }
          : c
      )
      await persist(withAssistant)
    } catch (e: any) {
      const errMsg = e?.message ?? 'Lỗi gọi API'
      setToast(errMsg)

      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `⚠️ ${errMsg}`,
        createdAt: Date.now(),
      }
      const withAssistant = withUser.map((c) =>
        c.id === active.id
          ? {
              ...c,
              messages: [...c.messages, assistantMsg],
              updatedAt: Date.now(),
            }
          : c
      )
      await persist(withAssistant)
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sideTop">
          <button onClick={() => void onNewChat()}>+ New chat</button>
          <button onClick={() => void onExportAll()}>Export JSON</button>
          <button onClick={() => void onImportClick()}>Import JSON</button>
          <button className="danger" onClick={() => void onDeleteActive()} title="Xoá hội thoại đang mở">
            Xoá
          </button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImportFile} />
        </div>

        <div className="sideList">
          {conversations.length === 0 ? (
            <div style={{ color: 'var(--muted)', padding: 12 }}>Chưa có hội thoại. Bấm “New chat”.</div>
          ) : (
            conversations
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((c) => (
                <div
                  key={c.id}
                  className={'convItem' + (c.id === activeId ? ' active' : '')}
                  onClick={() => setActiveId(c.id)}
                >
                  <div className="convTitle">{c.title || 'New chat'}</div>
                  <div className="convMeta">
                    <span>{c.messages.length} msg</span>
                    <span>•</span>
                    <span>{fmtTime(c.updatedAt)}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      </aside>

      <main className="main">
        <div className="header">
          <div className="headerTitle">ĐATT Q&A</div>
          <div className="headerSub">
            {active ? `Đang mở: ${active.title} • ${active.messages.length} tin nhắn` : 'Chưa chọn hội thoại'}
          </div>
        </div>

        {/* IMPORTANT for scroll: the chat list should be the ONLY vertical scroller */}
        <div ref={chatRef} className="chat">
          {!active ? (
            <div style={{ color: 'var(--muted)' }}>Bấm “New chat” để bắt đầu.</div>
          ) : active.messages.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>Nhập câu hỏi ở bên dưới.</div>
          ) : (
            active.messages.map((m) => (
              <div key={m.id} className={'msgRow ' + m.role}>
                <div className="avatar">{m.role === 'user' ? 'U' : 'AI'}</div>
                <div className="bubble">
                  <div className="meta">
                    {m.role === 'user' ? 'Bạn' : 'Trợ lý'} • {fmtTime(m.createdAt)}
                  </div>

                  <div className="content">
                    {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                  </div>

                  {m.role === 'assistant' && m.citations && m.citations.length > 0 ? (
                    <div className="citationsWrap">
                      <button
                        type="button"
                        className="citationsToggle"
                        onClick={() => toggleCitations(m.id)}
                        aria-expanded={!!openCites[m.id]}
                      >
                        {openCites[m.id] ? '▾' : '▸'} Trích dẫn ({m.citations.length})
                      </button>

                      {openCites[m.id] ? (
                        <div className="citationsPanel">
                          {m.citations.map((c: any, idx: number) => {
                            const tag = getCitationTag(c, idx)
                            const title = getCitationTitle(c)
                            const url = getCitationUrl(c)
                            const text = getCitationText(c)

                            return (
                              <details key={`${m.id}-${tag}-${idx}`} className="citeItem" open={idx === 0}>
                                <summary className="citeSummary">
                                  <b>[{tag}]</b> {url ? (
                                    <a href={url} target="_blank" rel="noreferrer">
                                      {title}
                                    </a>
                                  ) : (
                                    <span>{title}</span>
                                  )}
                                </summary>

                                {text ? <div className="citeBody">{text}</div> : null}
                              </details>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="composer">
          <div className="composerBox">
            <textarea
              className="textarea"
              placeholder={active ? 'Nhập câu hỏi... (Enter để gửi, Shift+Enter xuống dòng)' : 'Hãy tạo hoặc chọn hội thoại'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!active || loading}
            />
            <button className="send" onClick={() => void send()} disabled={!active || loading || !draft.trim()}>
              {loading ? '...' : 'Gửi'}
            </button>
          </div>
        </div>

        {toast ? (
          <div className="toast" onClick={() => setToast(null)} role="button" title="Bấm để đóng">
            {toast}
          </div>
        ) : null}
      </main>
    </div>
  )
}
