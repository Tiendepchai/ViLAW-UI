import { useState } from 'react'
import { useChatStore } from '../stores/chatStore'

export function Composer() {
  const { activeId, loading, send } = useChatStore()
  const [draft, setDraft] = useState('')
  const disabled = !activeId || loading

  const handleSend = () => {
    const text = draft.trim()
    if (!text || disabled) return
    setDraft('')
    send(text)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-[#1f2937] p-3.5 bg-[#111827]">
      <div className="flex gap-2.5 items-end max-w-[920px] mx-auto">
        <textarea
          className="flex-1 min-h-[44px] max-h-[200px] resize-none border border-[#1f2937] bg-[#0f172a] text-[#e5e7eb] rounded-xl p-2.5 outline-none focus:border-[#334155] placeholder:text-[#9ca3af]"
          placeholder={activeId ? 'Nhập câu hỏi... (Enter để gửi, Shift+Enter xuống dòng)' : 'Hãy tạo hoặc chọn hội thoại'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          aria-label="Nhập câu hỏi"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !draft.trim()}
          className="border border-green-500/40 bg-green-500/15 text-[#e5e7eb] px-3.5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500/25 transition-colors"
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Gửi'
          )}
        </button>
      </div>
    </div>
  )
}
