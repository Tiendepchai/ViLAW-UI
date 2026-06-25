import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../stores/chatStore'
import { Message } from './Message'

export function ChatView() {
  const { conversations, activeId, openCites, toggleCitations, streaming, streamingContent } = useChatStore()
  const active = conversations.find((c) => c.id === activeId) ?? null

  const chatRef = useRef<HTMLDivElement | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const [stickToBottom, setStickToBottom] = useState(true)
  const stickRef = useRef(true)
  useEffect(() => { stickRef.current = stickToBottom }, [stickToBottom])

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

  useEffect(() => {
    if (stickRef.current) chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [active?.messages.length, streamingContent])

  if (!active) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-[#9ca3af]">Bấm "New chat" để bắt đầu.</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1f2937] bg-gradient-to-b from-white/4 to-transparent">
        <div className="font-bold">ĐATT Q&A</div>
        <div className="text-xs text-[#9ca3af] mt-1">
          Đang mở: {active.title} • {active.messages.length} tin nhắn
        </div>
      </div>

      <div ref={chatRef} className="flex-1 overflow-auto p-4 flex flex-col gap-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#1f2937]" role="log" aria-live="polite" aria-label="Tin nhắn">
        {active.messages.length === 0 ? (
          <div className="text-[#9ca3af]">Nhập câu hỏi ở bên dưới.</div>
        ) : (
          active.messages.map((m) => (
            <Message
              key={m.id}
              message={m}
              isCitationsOpen={!!openCites[m.id]}
              onToggleCitations={toggleCitations}
            />
          ))
        )}

        {/* Streaming indicator */}
        {streaming && streamingContent && (
          <div className="flex gap-3 items-start max-w-[920px]">
            <div className="w-8 h-8 rounded-xl bg-[#111827] border border-[#1f2937] flex items-center justify-center font-extrabold text-[#cbd5e1] shrink-0 text-sm">AI</div>
            <div className="border border-[#1f2937] bg-[#111827] rounded-xl px-3.5 py-3 min-w-0">
              <div className="text-xs text-[#9ca3af] mb-1.5">Trợ lý</div>
              <div className="whitespace-pre-wrap leading-relaxed">{streamingContent}<span className="animate-pulse">▊</span></div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  )
}
